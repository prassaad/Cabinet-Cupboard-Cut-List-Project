#!/usr/bin/env python3
"""
db_audit_tool.py - Automated Database Schema Audit Engine
=========================================================
Parses T-SQL / ANSI SQL DDL and enforces the Data Design Standards skill rules:

  Rule 1  — Normalize to 3NF, denormalize only when measured slow
  Rule 2  — Every foreign key needs an explicit cascade rule
  Rule 3  — If it's not in the schema, it's not a real constraint
  Rule 4  — NULL is not the same as default
  Rule 5  — Query simplicity beats schema cleverness

Plus security checks: plaintext secrets/PII, imprecise financial types,
char-typed identifiers, naming hygiene, and missing indexes on FK columns.

Usage:
    python db_audit_tool.py <path_to_schema_file>

Supported input formats:
    .sql  — raw T-SQL / ANSI SQL DDL  (CREATE TABLE statements)
    .md   — Markdown data dictionary  (pipe tables: table | column | type | nullable | pk | fk)
    .csv  — CSV data dictionary       (headers:     table,  column,  type,  nullable,  pk,  fk)

Outputs a markdown report with a Base64-embedded Matplotlib dashboard on stdout,
and automatically saves .md + .html copies into a reports/ folder beside the
schema file on every run (no flag required; override the folder with --out=<dir>).
"""

import sys
import os
import re
import io
import base64
import html

# Ensure UTF-8 stdout so severity glyphs render on Windows consoles.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# ─────────────────────────────────────────────────────────────────────────────
# Severity model
# ─────────────────────────────────────────────────────────────────────────────
CRITICAL = "CRITICAL"
WARNING  = "WARNING"
ADVISORY = "ADVISORY"

SEVERITY_WEIGHTS = {CRITICAL: 25, WARNING: 10, ADVISORY: 3}
SEVERITY_COLORS  = {CRITICAL: "#d64545", WARNING: "#e0a500", ADVISORY: "#3b7dd8"}

# ─────────────────────────────────────────────────────────────────────────────
# Heuristic dictionaries  (Rule 3 — constraint detection; Rule 4 — NULL/type)
# ─────────────────────────────────────────────────────────────────────────────
PII_COLUMN_HINTS = [
    "ssn", "socialsecurity", "social_security", "nationalid", "national_id",
    "passport", "dob", "dateofbirth", "date_of_birth", "creditcard",
    "credit_card", "cardnumber", "card_number", "taxid", "tax_id",
    "driverlicense", "drivers_license",
]
SECRET_COLUMN_HINTS = [
    "password", "passwd", "pwd", "secret", "apikey", "api_key",
    "privatekey", "private_key", "token",
]
ENCRYPTED_TYPE_HINTS   = ["varbinary", "hashbytes", "encrypted"]
MONEY_COLUMN_HINTS = [
    "amount", "price", "cost", "total", "balance", "salary", "fee",
    "payment", "revenue", "subtotal", "tax", "discount",
]
IMPRECISE_NUMERIC_TYPES = ["float", "real"]   # Rule 4 — use DECIMAL(19,4) instead
CHAR_TYPES              = ["varchar", "char", "nvarchar", "nchar", "text", "ntext"]

# Columns whose names suggest they are relational identifiers
ID_COLUMN_PATTERN = re.compile(
    r"(^id$|_id$|^id_|ref$|_ref$|guid$|uuid$)", re.IGNORECASE)

# Columns that look nullable-by-default but should almost always be NOT NULL
# (heuristic for Rule 4 advisory)
LIKELY_REQUIRED_HINTS = [
    "name", "email", "status", "type", "created_at", "createdat",
    "created_by", "createdby", "updated_at", "updatedat",
]

# EAV pattern signals (Rule 5 — query simplicity beats schema cleverness)
EAV_COLUMN_HINTS = ["attribute_name", "attribute_value", "attr_name",
                    "attr_value", "entity_type", "property_name", "property_value"]

# Cascade keywords we look for in FK definitions (Rule 2)
CASCADE_KEYWORDS = re.compile(
    r"\bON\s+DELETE\s+(CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION|SET\s+DEFAULT)\b",
    re.IGNORECASE)


# ─────────────────────────────────────────────────────────────────────────────
# Parsing data structures
# ─────────────────────────────────────────────────────────────────────────────
class Column:
    def __init__(self, name, dtype, raw):
        self.name   = name
        self.dtype  = dtype      # normalised lower base type, e.g. "varchar"
        self.raw    = raw        # full raw definition line
        self.length = self._extract_length(raw)
        self.not_null = bool(re.search(r"\bNOT\s+NULL\b", raw, re.IGNORECASE))
        self.has_default = bool(re.search(r"\bDEFAULT\b", raw, re.IGNORECASE))

    @staticmethod
    def _extract_length(raw):
        m = re.search(r"\(\s*(\d+)\s*(?:,\s*\d+\s*)?\)", raw)
        return int(m.group(1)) if m else None


class ForeignKey:
    """Represents a single FK relationship with its cascade behaviour."""
    def __init__(self, col, ref_table, ref_col, has_cascade):
        self.col         = col
        self.ref_table   = ref_table
        self.ref_col     = ref_col
        self.has_cascade = has_cascade   # True if ON DELETE rule is declared


class Table:
    def __init__(self, name, schema, raw_body):
        self.name         = name
        self.schema       = schema
        self.fqn          = f"{schema}.{name}" if schema else name
        self.raw_body     = raw_body     # retained for cascade scanning
        self.columns      = []
        self.inline_pk    = []           # cols with inline PRIMARY KEY
        self.constraint_pk= []           # cols from table-level PK constraint
        self.foreign_keys = []           # list of ForeignKey objects
        self.identity_cols= []

    @property
    def has_pk(self):
        return bool(self.inline_pk or self.constraint_pk)

    @property
    def pk_columns(self):
        return self.inline_pk + self.constraint_pk


# ─────────────────────────────────────────────────────────────────────────────
# SQL preprocessing
# ─────────────────────────────────────────────────────────────────────────────
def strip_comments(sql):
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    sql = re.sub(r"--[^\n]*",  "", sql)
    return sql


def split_table_body(body):
    """Split CREATE TABLE body on top-level commas (ignoring nested parens)."""
    parts, depth, buf = [], 0, []
    for ch in body:
        if ch == "(":
            depth += 1; buf.append(ch)
        elif ch == ")":
            depth -= 1; buf.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(buf).strip()); buf = []
        else:
            buf.append(ch)
    if "".join(buf).strip():
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


def parse_tables(sql):
    sql_nc = strip_comments(sql)
    tables = []

    for m in re.finditer(
        r"CREATE\s+TABLE\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\s*\(",
        sql_nc, flags=re.IGNORECASE,
    ):
        schema = m.group(1) or ""
        name   = m.group(2)

        # Balance parens to find the full body
        start = m.end() - 1
        depth, i = 0, start
        while i < len(sql_nc):
            if sql_nc[i] == "(": depth += 1
            elif sql_nc[i] == ")":
                depth -= 1
                if depth == 0: break
            i += 1
        body = sql_nc[start + 1 : i]
        table = Table(name, schema, body)

        for part in split_table_body(body):
            low   = part.lower()
            first = low.split()[0] if low.split() else ""

            # Table-level PK
            pk_match = re.search(
                r"primary\s+key\s*\(([^)]*)\)", part, flags=re.IGNORECASE)
            # Table-level FK — capture cascade behaviour (Rule 2)
            fk_match = re.search(
                r"foreign\s+key\s*\(([^)]*)\)\s*references\s+"
                r"(?:\[?\w+\]?\.)?\[?(\w+)\]?\s*\(([^)]*)\)"
                r"([^,;]*)",          # capture tail for ON DELETE clause
                part, flags=re.IGNORECASE | re.DOTALL)

            if fk_match:
                fk_cols      = [c.strip(" []") for c in fk_match.group(1).split(",")]
                tail         = fk_match.group(4)
                has_cascade  = bool(CASCADE_KEYWORDS.search(tail))
                for c in fk_cols:
                    table.foreign_keys.append(
                        ForeignKey(c, fk_match.group(2),
                                   fk_match.group(3).strip(" []"),
                                   has_cascade))
                continue

            if first in ("constraint", "primary", "foreign",
                         "unique", "check", "key"):
                if pk_match:
                    table.constraint_pk.extend(
                        c.strip(" []") for c in pk_match.group(1).split(","))
                continue

            # Column definition
            tokens  = part.replace("[", " ").replace("]", " ").split()
            if not tokens:
                continue
            col_name  = tokens[0].strip("[]")
            dtype_raw = tokens[1] if len(tokens) > 1 else ""
            dtype     = re.split(r"\(", dtype_raw)[0].lower()
            col       = Column(col_name, dtype, part)
            table.columns.append(col)

            if re.search(r"\bidentity\b",    part, re.IGNORECASE):
                table.identity_cols.append(col_name)
            if re.search(r"\bprimary\s+key\b", part, re.IGNORECASE):
                table.inline_pk.append(col_name)

        tables.append(table)
    return tables


# ─────────────────────────────────────────────────────────────────────────────
# Anti-pattern detection  (each finding maps to a named skill rule)
# ─────────────────────────────────────────────────────────────────────────────
def normalize(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def detect_findings(tables):
    findings   = []
    table_names = {t.name.lower() for t in tables}

    for t in tables:

        # ── Rule 3 · Missing Primary Key ─────────────────────────────────────
        if not t.has_pk:
            findings.append((CRITICAL, t.fqn, "rule3_constraint",
                f"[Rule 3] Table '{t.fqn}' has no PRIMARY KEY. "
                "Rows are not uniquely addressable; replication and "
                "clustered-index behaviour are undefined."))

        # ── Rule 2 · Foreign Keys without explicit cascade rule ───────────────
        for fk in t.foreign_keys:
            if not fk.has_cascade:
                findings.append((CRITICAL, t.fqn, "rule2_cascade",
                    f"[Rule 2] FK '{t.name}.{fk.col}' → '{fk.ref_table}.{fk.ref_col}' "
                    "has no ON DELETE rule (CASCADE / RESTRICT / SET NULL). "
                    "Deleting a parent row may silently orphan child rows. "
                    "Decide the deletion behaviour as a business requirement "
                    "and write it into the schema."))

        # ── Rule 5 · EAV pattern (query-complexity smell) ────────────────────
        eav_cols = [c.name for c in t.columns
                    if any(h in normalize(c.name) for h in EAV_COLUMN_HINTS)]
        if len(eav_cols) >= 2:
            findings.append((WARNING, t.fqn, "rule5_eav",
                f"[Rule 5] Table '{t.name}' exhibits an Entity-Attribute-Value "
                f"pattern (columns: {', '.join(eav_cols)}). "
                "EAV schemas make every common query a multi-join exercise. "
                "Model entities explicitly unless a measured need for "
                "dynamic attributes exists."))

        for col in t.columns:
            ncol = normalize(col.name)

            # ── Rule 3 · Plaintext secrets ────────────────────────────────────
            if any(h in ncol for h in SECRET_COLUMN_HINTS):
                if col.dtype not in ENCRYPTED_TYPE_HINTS:
                    findings.append((CRITICAL, t.fqn, "rule3_security",
                        f"[Rule 3] Column '{t.name}.{col.name}' appears to store "
                        f"a secret/password as plaintext ({col.dtype.upper()}). "
                        "Store a salted hash (e.g. bcrypt) — never the raw value. "
                        "This is a constraint that must be enforced at the schema "
                        "or application layer unconditionally."))

            # ── Rule 3 · Plaintext PII ────────────────────────────────────────
            elif any(h in ncol for h in PII_COLUMN_HINTS):
                if col.dtype not in ENCRYPTED_TYPE_HINTS:
                    findings.append((CRITICAL, t.fqn, "rule3_security",
                        f"[Rule 3] Column '{t.name}.{col.name}' holds sensitive PII "
                        f"in unencrypted form ({col.dtype.upper()}). "
                        "Apply column-level encryption or Always Encrypted. "
                        "A constraint in code is not sufficient — enforce at the "
                        "storage layer."))

            # ── Rule 4 · Imprecise type for financial data ────────────────────
            if (any(h in ncol for h in MONEY_COLUMN_HINTS)
                    and col.dtype in IMPRECISE_NUMERIC_TYPES):
                findings.append((WARNING, t.fqn, "rule4_type",
                    f"[Rule 4] Column '{t.name}.{col.name}' uses "
                    f"{col.dtype.upper()} for monetary data. "
                    "Floating-point types cause rounding errors that compound "
                    "silently across millions of rows. "
                    "Use DECIMAL(19,4) — an exact numeric type."))

            # ── Rule 4 · Char-typed identifier ────────────────────────────────
            if ID_COLUMN_PATTERN.search(col.name) and col.dtype in CHAR_TYPES:
                findings.append((WARNING, t.fqn, "rule4_type",
                    f"[Rule 4] Column '{t.name}.{col.name}' is an identifier "
                    f"typed as {col.dtype.upper()}"
                    f"{'(' + str(col.length) + ')' if col.length else ''}. "
                    "Character-typed keys bloat indexes and force implicit "
                    "conversions on joins. Use INT / BIGINT or UNIQUEIDENTIFIER."))

            # ── Rule 4 · Likely-required column missing NOT NULL ──────────────
            if (any(h in ncol for h in LIKELY_REQUIRED_HINTS)
                    and not col.not_null
                    and col.name.lower() not in [c.lower() for c in t.pk_columns]):
                findings.append((ADVISORY, t.fqn, "rule4_null",
                    f"[Rule 4] Column '{t.name}.{col.name}' has no NOT NULL "
                    "constraint. Columns like name, email, status, and timestamps "
                    "are almost always required. "
                    "NULL here means 'unknown' — is that the intended meaning, "
                    "or should this be NOT NULL with a DEFAULT?"))

            # ── Rule 3 · VARCHAR/NVARCHAR with no length cap ──────────────────
            if col.dtype in ("varchar", "nvarchar") and col.length is None:
                raw_up = col.raw.upper()
                if "MAX" not in raw_up:
                    findings.append((ADVISORY, t.fqn, "rule3_constraint",
                        f"[Rule 3] Column '{t.name}.{col.name}' is "
                        f"{col.dtype.upper()} with no explicit length. "
                        "Add a length constraint appropriate to the business "
                        "rule (e.g. email ≤ 254, phone ≤ 20) so the schema "
                        "enforces the rule, not just the application."))

        # ── Rule 2 · Implicit FK columns (no declared FK constraint) ──────────
        declared_fk_cols = {fk.col.lower() for fk in t.foreign_keys}
        for col in t.columns:
            ncol = col.name.lower()
            if not (ncol.endswith("_id") or ncol.endswith("_ref")
                    or (ncol.endswith("id") and ncol != "id")):
                continue
            if ncol in declared_fk_cols:
                continue
            base = re.sub(r"(_id|_ref|id|ref)$", "", ncol)
            candidates = {base, base + "s", "tbl_" + base, "tbl_" + base + "s"}
            matched = candidates & table_names
            looks_relational = (ncol.endswith("_id") or ncol.endswith("_ref")
                                or bool(matched))
            if looks_relational and col.name.lower() not in [c.lower() for c in t.pk_columns]:
                target = next(iter(matched)) if matched else "a parent table"
                findings.append((CRITICAL, t.fqn, "rule2_cascade",
                    f"[Rule 2 + Rule 3] Column '{t.name}.{col.name}' looks like "
                    f"a foreign key referencing {target} but has no FOREIGN KEY "
                    "constraint and no ON DELETE rule. "
                    "Orphaned rows can be inserted freely. "
                    "Declare the FK and its deletion behaviour in the schema."))
                findings.append((WARNING, t.fqn, "performance",
                    f"FK-like column '{t.name}.{col.name}' has no supporting "
                    "non-clustered index. Joins and lookups will force full "
                    "table scans. Add a non-clustered index on this column."))

        # ── Naming convention (advisory) ──────────────────────────────────────
        if t.name.lower().startswith("tbl_") or t.name.lower().startswith("tbl"):
            findings.append((ADVISORY, t.fqn, "naming",
                f"Table '{t.name}' uses a Hungarian 'tbl_' prefix. "
                "Drop the prefix; use clean singular PascalCase entity names."))

    return findings


# ─────────────────────────────────────────────────────────────────────────────
# Metrics
# ─────────────────────────────────────────────────────────────────────────────
def compute_metrics(tables, findings):
    counts  = {CRITICAL: 0, WARNING: 0, ADVISORY: 0}
    rule_counts = {}
    for sev, _fqn, cat, _msg in findings:
        counts[sev] += 1
        rule_counts[cat] = rule_counts.get(cat, 0) + 1

    penalty = sum(SEVERITY_WEIGHTS[s] * c for s, c in counts.items())
    health  = max(0, 100 - penalty)

    n_tables = len(tables)
    n_pk     = sum(1 for t in tables if t.has_pk)
    n_fk     = sum(len(t.foreign_keys) for t in tables)
    n_fk_cascade = sum(
        sum(1 for fk in t.foreign_keys if fk.has_cascade) for t in tables)
    n_cols   = sum(len(t.columns) for t in tables)

    return {
        "counts":       counts,
        "rule_counts":  rule_counts,
        "health":       health,
        "n_tables":     n_tables,
        "n_pk":         n_pk,
        "n_fk":         n_fk,
        "n_fk_cascade": n_fk_cascade,
        "n_cols":       n_cols,
        "pk_coverage":  (n_pk / n_tables * 100) if n_tables else 0,
        "cascade_coverage": (n_fk_cascade / n_fk * 100) if n_fk else 100,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Visualization
# ─────────────────────────────────────────────────────────────────────────────
def fig_to_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")


def build_dashboard(metrics):
    counts = metrics["counts"]
    health = metrics["health"]

    fig, axes = plt.subplots(1, 4, figsize=(17, 4.2))
    fig.patch.set_facecolor("#ffffff")

    # 1) Architectural Health Score (donut)
    ax0 = axes[0]
    remaining   = 100 - health
    gauge_color = ("#2e9e5b" if health >= 75 else
                   "#e0a500" if health >= 45 else "#d64545")
    ax0.pie([health, remaining],
            colors=[gauge_color, "#ececec"],
            startangle=90, counterclock=False,
            wedgeprops=dict(width=0.38, edgecolor="white"))
    ax0.text(0,     0,      f"{health}", ha="center", va="center",
             fontsize=28, fontweight="bold", color=gauge_color)
    ax0.text(0, -0.28, "/ 100",    ha="center", va="center",
             fontsize=11, color="#666")
    ax0.set_title("Health Score", fontsize=12, fontweight="bold")

    # 2) Findings by Severity (bar)
    ax1 = axes[1]
    sevs = [CRITICAL, WARNING, ADVISORY]
    vals = [counts[s] for s in sevs]
    bars = ax1.bar(sevs, vals,
                   color=[SEVERITY_COLORS[s] for s in sevs],
                   edgecolor="white")
    ax1.set_title("Findings by Severity", fontsize=12, fontweight="bold")
    ax1.set_ylabel("Count")
    ax1.spines["top"].set_visible(False)
    ax1.spines["right"].set_visible(False)
    for b, v in zip(bars, vals):
        ax1.text(b.get_x() + b.get_width() / 2, v + 0.05, str(v),
                 ha="center", va="bottom", fontweight="bold")
    if max(vals + [0]) == 0:
        ax1.set_ylim(0, 1)

    # 3) Structural Inventory (horizontal bar)
    ax2 = axes[2]
    labels = ["Tables", "With PK", "FKs", "FK+Cascade", "Columns"]
    vals2  = [metrics["n_tables"], metrics["n_pk"],
              metrics["n_fk"], metrics["n_fk_cascade"], metrics["n_cols"]]
    colors2 = ["#3b7dd8", "#2e9e5b", "#3b7dd8",
                "#2e9e5b" if metrics["n_fk_cascade"] == metrics["n_fk"]
                else "#d64545", "#3b7dd8"]
    bars2  = ax2.barh(labels, vals2, color=colors2, edgecolor="white")
    ax2.set_title("Structural Inventory", fontsize=12, fontweight="bold")
    ax2.spines["top"].set_visible(False)
    ax2.spines["right"].set_visible(False)
    ax2.invert_yaxis()
    for b, v in zip(bars2, vals2):
        ax2.text(v + 0.05, b.get_y() + b.get_height() / 2, str(v),
                 va="center", fontweight="bold")

    # 4) Rule Violation Breakdown (bar)
    ax3 = axes[3]
    rc   = metrics["rule_counts"]
    rule_labels = {
        "rule2_cascade":   "Rule 2\nCascade",
        "rule3_constraint":"Rule 3\nConstraint",
        "rule3_security":  "Rule 3\nSecurity",
        "rule4_null":      "Rule 4\nNULL",
        "rule4_type":      "Rule 4\nType",
        "rule5_eav":       "Rule 5\nEAV",
        "performance":     "Perf\nIndex",
        "naming":          "Naming",
    }
    rl_keys = [k for k in rule_labels if k in rc]
    rl_vals = [rc[k] for k in rl_keys]
    rl_names = [rule_labels[k] for k in rl_keys]
    if rl_keys:
        b3 = ax3.bar(rl_names, rl_vals, color="#6c63ff", edgecolor="white")
        for b, v in zip(b3, rl_vals):
            ax3.text(b.get_x() + b.get_width() / 2, v + 0.05, str(v),
                     ha="center", va="bottom", fontweight="bold", fontsize=9)
    ax3.set_title("Violations by Rule", fontsize=12, fontweight="bold")
    ax3.set_ylabel("Count")
    ax3.spines["top"].set_visible(False)
    ax3.spines["right"].set_visible(False)
    if not rl_keys or max(rl_vals + [0]) == 0:
        ax3.set_ylim(0, 1)
    ax3.tick_params(axis="x", labelsize=8)

    fig.tight_layout()
    return fig_to_base64(fig)


# ─────────────────────────────────────────────────────────────────────────────
# Report rendering
# ─────────────────────────────────────────────────────────────────────────────
def severity_tag(sev):
    icon = {CRITICAL: "🔴", WARNING: "🟡", ADVISORY: "🔵"}[sev]
    return f"{icon} **[{sev}]**"


def cascade_summary(tables):
    """Return a human-readable cascade coverage summary per FK."""
    lines = []
    for t in tables:
        for fk in t.foreign_keys:
            status = "✅ Cascade declared" if fk.has_cascade else "❌ No ON DELETE rule"
            lines.append(
                f"  * `{t.name}.{fk.col}` → `{fk.ref_table}.{fk.ref_col}` — {status}")
    return lines


def render_report(path, tables, findings, metrics, b64):
    out = []

    out.append("### Dynamic Audit Insights")
    out.append(f"* **Source Schema File:** `{os.path.basename(path)}`")
    out.append(f"* **Total Identified Entities:** {metrics['n_tables']}")
    out.append(f"* **Total Columns Mapped:** {metrics['n_cols']}")
    out.append(f"* **Foreign Key Relationships:** {metrics['n_fk']} "
               f"({metrics['n_fk_cascade']} with explicit ON DELETE rule — "
               f"{metrics['cascade_coverage']:.0f}% coverage)")
    out.append(f"* **Primary Key Coverage:** "
               f"{metrics['pk_coverage']:.0f}% "
               f"({metrics['n_pk']}/{metrics['n_tables']} tables)")
    out.append(f"* **Architectural Health Score:** {metrics['health']}/100")
    out.append("")

    out.append("#### System Metrics Dashboard")
    out.append(f"![Database Audit Dashboard](data:image/png;base64,{b64})")
    out.append("")

    # Rule 2 cascade coverage table
    cascade_lines = cascade_summary(tables)
    if cascade_lines:
        out.append("#### Rule 2 — Foreign Key Cascade Coverage")
        out.extend(cascade_lines)
        out.append("")

    # Main findings ledger grouped by severity
    out.append("#### Diagnostic Findings Ledger")
    out.append("> Each finding is tagged to the Data Design Standards rule it violates.")
    if not findings:
        out.append("* ✅ No anti-patterns detected. Schema passes all Data Design Standards rules.")
    else:
        order = {CRITICAL: 0, WARNING: 1, ADVISORY: 2}
        for sev, fqn, _cat, msg in sorted(findings, key=lambda f: order[f[0]]):
            out.append(f"* {severity_tag(sev)} **`{fqn}`** — {msg}")
    out.append("")

    # Remediation guidance keyed to the five rules
    out.append("#### Remediation Reference — Data Design Standards Rules")
    out.append(
        "| Rule | Principle | Schema Fix |\n"
        "|---|---|---|\n"
        "| Rule 1 | Normalize to 3NF; denormalize only when measured slow | "
        "Ensure no fact is stored in two places; document any deliberate denormalization |\n"
        "| Rule 2 | Every FK needs an explicit cascade rule | "
        "Add `ON DELETE CASCADE / RESTRICT / SET NULL` to every FOREIGN KEY constraint |\n"
        "| Rule 3 | If it's not in the schema, it's not a real constraint | "
        "Add `UNIQUE`, `NOT NULL`, `CHECK`, and `FOREIGN KEY` constraints for every business rule |\n"
        "| Rule 4 | NULL ≠ default; choose types precisely | "
        "Use `DECIMAL(19,4)` for money; `NOT NULL` for required fields; document nullable fields |\n"
        "| Rule 5 | Query simplicity beats schema cleverness | "
        "Replace EAV/generic patterns with explicit entity tables; index FK columns |"
    )
    out.append("")

    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────────────
# Multi-format input converters
# Each converter reads the source file and returns a synthetic DDL string that
# parse_tables() can consume exactly as if it were a .sql file.
# ─────────────────────────────────────────────────────────────────────────────

def _col_def_from_parts(col_name, data_type, nullable, default, pk_hint, fk_hint):
    """Build a single column definition line for synthetic DDL."""
    dtype  = data_type.strip() if data_type.strip() else "NVARCHAR(255)"
    parts  = [f"    [{col_name}]", dtype]
    if re.search(r"\bNOT\s+NULL\b", nullable, re.IGNORECASE):
        parts.append("NOT NULL")
    elif re.search(r"\bNULL\b", nullable, re.IGNORECASE):
        parts.append("NULL")
    if default.strip():
        parts.append(f"DEFAULT {default.strip()}")
    if re.search(r"\bPK\b|primary\s*key", pk_hint, re.IGNORECASE):
        parts.append("PRIMARY KEY")
    return " ".join(parts)


def parse_md_dictionary(text):
    """
    Convert a Markdown data-dictionary file to synthetic DDL.

    Supported layouts
    -----------------
    Layout A — H2/H3 heading per table, then a pipe table with columns:
        ## TableName
        | Column | Type | Nullable | Default | PK | FK | Notes |
        |--------|------|----------|---------|----|----|-------|
        | Id     | INT  | NOT NULL |         | PK |    |       |

    Layout B — single flat pipe table with a 'Table' column:
        | Table    | Column | Type        | Nullable | Default | PK | FK |
        |----------|--------|-------------|----------|---------|----|----|
        | Customer | Id     | INT         | NOT NULL |         | PK |    |

    FK cells are parsed for patterns like:
        FK → Orders(OrderId)   or   Orders.OrderId   or   Orders
    """
    import csv as _csv

    ddl_blocks = []

    # ── Helper: parse pipe-table rows into list-of-dicts ─────────────────────
    def parse_pipe_table(lines):
        rows = []
        headers = []
        for line in lines:
            line = line.strip()
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(re.match(r"^[-:]+$", c) for c in cells if c):
                continue          # separator row
            if not headers:
                headers = [h.lower().replace(" ", "_") for h in cells]
            else:
                if len(cells) < len(headers):
                    cells += [""] * (len(headers) - len(cells))
                rows.append(dict(zip(headers, cells)))
        return headers, rows

    # ── Helper: synthesise one CREATE TABLE block ─────────────────────────────
    def rows_to_ddl(table_name, rows, col_col, type_col,
                    null_col, default_col, pk_col, fk_col):
        col_defs  = []
        pk_cols   = []
        fk_stmts  = []
        for r in rows:
            cname    = r.get(col_col, "").strip()
            if not cname or cname.startswith("-"):
                continue
            dtype    = r.get(type_col,    "").strip() or "NVARCHAR(255)"
            nullable = r.get(null_col,    "").strip()
            default  = r.get(default_col, "").strip()
            pk_hint  = r.get(pk_col,      "").strip()
            fk_hint  = r.get(fk_col,      "").strip()

            col_defs.append(_col_def_from_parts(
                cname, dtype, nullable, default, pk_hint, fk_hint))

            if re.search(r"\bPK\b|primary\s*key", pk_hint, re.IGNORECASE):
                pk_cols.append(cname)

            # Parse FK hint: "Orders(OrderId)", "Orders.OrderId", "Orders"
            if fk_hint:
                m_paren = re.search(r"(\w+)\s*\((\w+)\)", fk_hint)
                m_dot   = re.search(r"(\w+)\.(\w+)", fk_hint)
                if m_paren:
                    ref_t, ref_c = m_paren.group(1), m_paren.group(2)
                elif m_dot:
                    ref_t, ref_c = m_dot.group(1), m_dot.group(2)
                else:
                    ref_t = re.sub(r"[^a-zA-Z0-9_]", "", fk_hint)
                    ref_c = ref_t + "Id"
                if ref_t:
                    fk_stmts.append(
                        f"    FOREIGN KEY ([{cname}]) "
                        f"REFERENCES [{ref_t}] ([{ref_c}])")

        if not col_defs:
            return ""

        body = ",\n".join(col_defs)
        if pk_cols and not any("PRIMARY KEY" in d for d in col_defs):
            pk_list = ", ".join(f"[{c}]" for c in pk_cols)
            body += f",\n    CONSTRAINT PK_{table_name} PRIMARY KEY ({pk_list})"
        for fk in fk_stmts:
            body += f",\n{fk}"

        return f"CREATE TABLE [{table_name}] (\n{body}\n);\n"

    # ── Detect layout ─────────────────────────────────────────────────────────
    lines = text.splitlines()

    # Collect all pipe-table lines in one pass
    all_pipe_lines = [l for l in lines if l.strip().startswith("|")]
    if all_pipe_lines:
        headers, rows = parse_pipe_table(all_pipe_lines)
        h_set = set(headers)

        # Layout B — has a 'table' column → flat multi-table dictionary
        table_col = next((h for h in headers if h in ("table", "table_name")), None)
        col_col   = next((h for h in headers
                          if h in ("column", "column_name", "field", "field_name")), None)
        type_col  = next((h for h in headers
                          if h in ("type", "data_type", "datatype")), None)
        null_col  = next((h for h in headers
                          if h in ("nullable", "null", "nullability", "required")), None) or ""
        def_col   = next((h for h in headers
                          if h in ("default", "default_value")), None) or ""
        pk_col    = next((h for h in headers if h in ("pk", "primary_key")), None) or ""
        fk_col    = next((h for h in headers
                          if h in ("fk", "foreign_key", "references", "ref")), None) or ""

        if table_col and col_col:
            # Group rows by table name
            from collections import OrderedDict
            tables_dict = OrderedDict()
            for r in rows:
                tname = r.get(table_col, "").strip()
                if tname:
                    tables_dict.setdefault(tname, []).append(r)
            for tname, trows in tables_dict.items():
                block = rows_to_ddl(tname, trows, col_col,
                                    type_col or "type",
                                    null_col, def_col, pk_col, fk_col)
                if block:
                    ddl_blocks.append(block)
            if ddl_blocks:
                return "\n".join(ddl_blocks)

        # Layout A — no 'table' column; look for H2/H3 headings above each table
        current_table = None
        table_pipe_lines = {}
        for line in lines:
            h_match = re.match(r"^#{1,4}\s+(\w+)", line)
            if h_match:
                current_table = h_match.group(1)
                table_pipe_lines[current_table] = []
            elif line.strip().startswith("|") and current_table:
                table_pipe_lines[current_table].append(line)

        for tname, tlines in table_pipe_lines.items():
            if not tlines:
                continue
            _, trows = parse_pipe_table(tlines)
            if not trows:
                continue
            th = list(trows[0].keys())
            col_col_a  = next((h for h in th
                               if h in ("column", "column_name", "field", "name")), th[0])
            type_col_a = next((h for h in th
                               if h in ("type", "data_type", "datatype")),
                              th[1] if len(th) > 1 else "")
            null_col_a = next((h for h in th
                               if h in ("nullable", "null", "required")), "")
            def_col_a  = next((h for h in th
                               if h in ("default", "default_value")), "")
            pk_col_a   = next((h for h in th if h in ("pk", "primary_key")), "")
            fk_col_a   = next((h for h in th
                               if h in ("fk", "foreign_key", "references", "ref")), "")
            block = rows_to_ddl(tname, trows, col_col_a, type_col_a,
                                null_col_a, def_col_a, pk_col_a, fk_col_a)
            if block:
                ddl_blocks.append(block)

    return "\n".join(ddl_blocks) if ddl_blocks else ""


def parse_csv_dictionary(text):
    """
    Convert a CSV data-dictionary file to synthetic DDL.

    Expected columns (case-insensitive, any order):
        table / table_name          — entity name         (required)
        column / column_name / field — column name        (required)
        type / data_type / datatype  — SQL type           (optional, default NVARCHAR(255))
        nullable / null / required   — NULL / NOT NULL    (optional)
        default / default_value      — default expression (optional)
        pk / primary_key             — PK marker          (optional)
        fk / foreign_key / references / ref — FK target  (optional)

    FK cell formats accepted:
        Orders(OrderId)   |   Orders.OrderId   |   Orders
    """
    import csv as _csv
    from collections import OrderedDict
    from io import StringIO

    reader  = _csv.DictReader(StringIO(text))
    headers = [h.lower().strip().replace(" ", "_") for h in (reader.fieldnames or [])]

    # Remap reader rows to normalised header keys
    norm_rows = []
    for raw_row in reader:
        norm_row = {k.lower().strip().replace(" ", "_"): v
                    for k, v in raw_row.items()}
        norm_rows.append(norm_row)

    if not norm_rows:
        return ""

    table_col = next((h for h in headers if h in ("table", "table_name")), None)
    col_col   = next((h for h in headers
                      if h in ("column", "column_name", "field", "field_name")), None)
    type_col  = next((h for h in headers
                      if h in ("type", "data_type", "datatype")), None)
    null_col  = next((h for h in headers
                      if h in ("nullable", "null", "nullability", "required")), None)
    def_col   = next((h for h in headers
                      if h in ("default", "default_value")), None)
    pk_col    = next((h for h in headers if h in ("pk", "primary_key")), None)
    fk_col    = next((h for h in headers
                      if h in ("fk", "foreign_key", "references", "ref")), None)

    if not table_col or not col_col:
        return ""   # cannot determine table/column structure

    # Group rows by table
    tables_dict = OrderedDict()
    for r in norm_rows:
        tname = r.get(table_col, "").strip()
        if tname:
            tables_dict.setdefault(tname, []).append(r)

    ddl_blocks = []
    for tname, rows in tables_dict.items():
        col_defs  = []
        pk_cols   = []
        fk_stmts  = []

        for r in rows:
            cname    = r.get(col_col, "").strip()
            if not cname:
                continue
            dtype    = r.get(type_col,  "").strip() if type_col  else ""
            nullable = r.get(null_col,  "").strip() if null_col  else ""
            default  = r.get(def_col,   "").strip() if def_col   else ""
            pk_hint  = r.get(pk_col,    "").strip() if pk_col    else ""
            fk_hint  = r.get(fk_col,    "").strip() if fk_col    else ""

            col_defs.append(_col_def_from_parts(
                cname, dtype or "NVARCHAR(255)", nullable, default, pk_hint, fk_hint))

            if re.search(r"\bPK\b|primary\s*key|yes|true|1",
                         pk_hint, re.IGNORECASE):
                pk_cols.append(cname)

            if fk_hint:
                m_paren = re.search(r"(\w+)\s*\((\w+)\)", fk_hint)
                m_dot   = re.search(r"(\w+)\.(\w+)", fk_hint)
                if m_paren:
                    ref_t, ref_c = m_paren.group(1), m_paren.group(2)
                elif m_dot:
                    ref_t, ref_c = m_dot.group(1), m_dot.group(2)
                else:
                    ref_t = re.sub(r"[^a-zA-Z0-9_]", "", fk_hint)
                    ref_c = ref_t + "Id"
                if ref_t:
                    fk_stmts.append(
                        f"    FOREIGN KEY ([{cname}]) "
                        f"REFERENCES [{ref_t}] ([{ref_c}])")

        if not col_defs:
            continue

        body = ",\n".join(col_defs)
        if pk_cols and not any("PRIMARY KEY" in d for d in col_defs):
            pk_list = ", ".join(f"[{c}]" for c in pk_cols)
            body += f",\n    CONSTRAINT PK_{tname} PRIMARY KEY ({pk_list})"
        for fk in fk_stmts:
            body += f",\n{fk}"

        ddl_blocks.append(f"CREATE TABLE [{tname}] (\n{body}\n);\n")

    return "\n".join(ddl_blocks)


# ─────────────────────────────────────────────────────────────────────────────
# Report persistence  (auto-saved on every run — no flag required)
# ─────────────────────────────────────────────────────────────────────────────
def build_html(report_md, b64):
    """Wrap the markdown report in minimal HTML with the dashboard embedded, so
    the chart renders when the file is opened in a browser."""
    text = re.sub(r"!\[[^\]]*\]\(data:image/png;base64,[A-Za-z0-9+/=]+\)",
                  "[dashboard rendered above]", report_md)
    text = html.escape(text)
    img = ("<img src='data:image/png;base64," + b64 + "' alt='dashboard'/>"
           if b64 else "")
    style = ("body{font-family:Segoe UI,Arial,sans-serif;max-width:1100px;"
             "margin:2rem auto;padding:0 1rem;color:#1a1a1a}"
             "img{max-width:100%;border:1px solid #ddd;border-radius:6px}"
             "pre{white-space:pre-wrap;background:#f6f8fa;padding:1rem;"
             "border-radius:6px;font-size:13px;line-height:1.5}")
    return ("<!doctype html><html><head><meta charset='utf-8'>"
            "<title>DB Audit Report</title><style>" + style + "</style></head>"
            "<body><h1>Database Audit Report</h1>" + img +
            "<pre>" + text + "</pre></body></html>")


def save_reports(schema_path, report_md, b64, out_dir=None):
    """Persist the report as .md and .html. Default location: a reports/ folder
    beside the schema file. Returns (md_path, html_path)."""
    base = os.path.splitext(os.path.basename(schema_path))[0]
    if out_dir is None:
        out_dir = os.path.join(
            os.path.dirname(os.path.abspath(schema_path)), "reports")
    os.makedirs(out_dir, exist_ok=True)
    md_path   = os.path.join(out_dir, base + "_audit_report.md")
    html_path = os.path.join(out_dir, base + "_audit_report.html")
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write(report_md)
    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(build_html(report_md, b64))
    return md_path, html_path


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main(argv):
    if len(argv) < 2:
        print("Usage: python db_audit_tool.py <path_to_schema_file>")
        print("       Supported formats: .sql  .md  .csv")
        return 1
    path = argv[1]
    if not os.path.isfile(path):
        print(f"ERROR: file not found: {path}")
        return 1

    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        raw = fh.read()

    if raw.count("\n") > 50_000:
        print("ERROR: file exceeds 50,000 line processing limit.")
        return 1

    ext = os.path.splitext(path)[1].lower()

    if ext in (".md", ".markdown"):
        sql = parse_md_dictionary(raw)
        if not sql.strip():
            print("ERROR: no recognisable data-dictionary table found in the Markdown file.")
            print("       Expected a pipe table with columns: table, column, type, nullable, pk, fk")
            return 1
    elif ext == ".csv":
        sql = parse_csv_dictionary(raw)
        if not sql.strip():
            print("ERROR: no recognisable data-dictionary structure found in the CSV file.")
            print("       Expected columns: table, column, type, nullable, pk, fk")
            return 1
    else:
        # .sql or any other extension — pass through as raw DDL
        sql = raw

    tables   = parse_tables(sql)
    if not tables:
        print("ERROR: no CREATE TABLE statements could be parsed from the input.")
        print(f"       Input format detected: {ext or '.sql'}")
        return 1

    findings = detect_findings(tables)
    metrics  = compute_metrics(tables, findings)
    b64      = build_dashboard(metrics)
    report   = render_report(path, tables, findings, metrics, b64)
    print(report)

    # Persist the report to disk automatically (no flag required).
    out_dir = None
    for a in argv[2:]:
        if a.startswith("--out="):
            out_dir = a.split("=", 1)[1]
    md_path, html_path = save_reports(path, report, b64, out_dir)
    print("\n---")
    print("#### Report Saved")
    print(f"* Markdown: `{md_path}`")
    print(f"* HTML (dashboard rendered inline): `{html_path}`")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))