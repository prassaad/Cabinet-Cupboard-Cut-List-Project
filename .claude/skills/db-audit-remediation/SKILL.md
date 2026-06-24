---
name: db-audit-remediation
description: "Apply this skill whenever auditing, reviewing, remediating, or generating SQL DDL schemas. Triggers include: requests to audit a database schema, review a DDL file, generate remediation SQL, check for missing constraints, evaluate foreign key cascade rules, assess nullability decisions, detect plaintext PII or secrets, check financial data types, or any task involving database structural integrity or data quality enforcement. This skill enforces all five rules of the Data Design Standards — the governing principle being: if a business rule is not in the schema, it is not a real constraint. Always invoke before running db_audit_tool.py or writing any remediation DDL."
---

# Database Audit & Remediation Standards
## Governing Principle: Good Design Prevents Bad Data

> "If a business rule isn't in the schema, it isn't a rule — it's a wish the next integration will ignore."

This skill operationalises the **Data Design Standards** into executable audit procedures and copy-paste-ready remediation SQL. It governs how `db_audit_tool.py` is run, how its output is interpreted, and how every finding is remediated permanently — in the schema, not in code.

---

## Execution Workflow — Two Phases (always in this order)

> **Reports are saved automatically — never wait to be asked.** `db_audit_tool.py` writes `<schema>_audit_report.md` and `<schema>_audit_report.html` into a `reports/` folder beside the schema on every run. The `.html` embeds the dashboard so it renders in a browser. Always tell the user the saved report path.

### Phase 1 — Audit & Report (do this first, every time)

1. **Run the audit tool** on the target schema (it accepts `.sql`, `.md`, and `.csv` data dictionaries):
   ```bash
   python3 ./.claude/tools/db_audit_tool.py <path_to_schema_file>
   ```
   It emits to stdout **and auto-saves** the report containing:
   - **Architectural Health Score** (0–100, penalty-weighted by severity)
   - **System Metrics Dashboard** (Base64 PNG — rendered in the saved `.html`)
   - **Rule 2 Cascade Coverage** table — every FK with its ON DELETE status
   - **Diagnostic Findings Ledger** — every finding tagged to the rule it violates
2. **Classify findings** into 🔴 CRITICAL / 🟡 WARNING / 🔵 ADVISORY (table below).
3. **Present the analysis + the saved report path.** Supplement the tool's mechanical findings with a manual gap audit: referenced-but-undefined tables, prose-only uniqueness/enum rules, sensitive-field masking, and intentional polymorphic columns.
4. **STOP and ask the user to approve remediation.** Do **not** write or apply any remediation SQL during Phase 1.

| Severity | Colour | Meaning | Action |
|---|---|---|---|
| 🔴 **CRITICAL** | Red | Structural integrity or security failure. Data can be corrupted or breached right now. | Fix before any deployment. |
| 🟡 **WARNING** | Yellow | Data quality degradation risk. Silent errors will compound over time. | Fix in current sprint. |
| 🔵 **ADVISORY** | Blue | Convention or optimisation gap. No immediate risk but accumulates technical debt. | Fix in next sprint or backlog. |

### Phase 2 — Remediate & Re-Report (only after the user approves)

1. **Generate remediation** for every finding — deterministic, copy-paste-ready DDL/DML with fully qualified names. Each script must be:
   - **Idempotent** where possible (`IF NOT EXISTS`, `IF OBJECT_ID IS NULL`)
   - **Zero-downtime safe** — `WITH (ONLINE = ON)` for index creation on large tables
   - **Reversible** — a commented rollback statement for every destructive change
2. **Produce the remediated artifacts:** the ALTER migration script *and* a consolidated remediated schema (`*_remediated.sql`) with every fix baked inline.
3. **Re-run the audit tool on the remediated schema** to verify — this **auto-saves the post-remediation report**. Present the before/after (health score, cascade coverage, finding counts) and the new report path.

---

## The Five Rules — Audit Checks & Remediation Patterns

### Rule 1 — Normalize to 3NF; Denormalize Only When Measured Slow

**What the tool checks:**
- Facts stored in multiple columns across tables (heuristic: same column name pattern in multiple tables)
- EAV (Entity-Attribute-Value) patterns — flagged as Rule 5 overlap

**What to look for manually:**
- Any column whose value is derivable from another column in the same table (transitive dependency)
- Customer address fields duplicated in both `Customers` and `Orders`
- Any table with `attribute_name` / `attribute_value` column pairs

**Remediation pattern — extract duplicated fact to a reference table:**
```sql
-- Before: address duplicated in Orders
-- After: Orders references Customers for address

ALTER TABLE dbo.Orders
    DROP COLUMN IF EXISTS CustomerAddress,
    DROP COLUMN IF EXISTS CustomerCity;

-- Orders.CustomerId FK already covers the address lookup via JOIN
```

**Denormalization documentation requirement:**
Any deliberate denormalization must be recorded as a comment in the DDL:
```sql
-- DENORMALIZED: CustomerEmail copied from Customers for read-performance on
-- OrderSummary report. Measured p95 query time: 4.2s normalized → 0.3s denorm.
-- Re-evaluate if Customers.Email update frequency exceeds 1000/day.
ALTER TABLE dbo.OrderSummary ADD CustomerEmail NVARCHAR(254) NOT NULL DEFAULT '';
```

---

### Rule 2 — Every Foreign Key Needs an Explicit Cascade Rule

**What the tool checks:**
- Every declared `FOREIGN KEY` constraint for presence of `ON DELETE` clause
- Every column ending in `_id` or `_ref` with no matching FK constraint (implicit FK)

**The three decisions — choose one for every relationship:**

| Option | SQL | Use when |
|---|---|---|
| **CASCADE** | `ON DELETE CASCADE` | Child has no meaning without parent (e.g. `OrderLineItems` without `Orders`) |
| **RESTRICT** | `ON DELETE RESTRICT` or `ON DELETE NO ACTION` | Child must be handled before parent can be deleted (e.g. cannot delete `Customer` with active `Orders`) |
| **SET NULL** | `ON DELETE SET NULL` | Child can exist without parent, relationship becomes optional (e.g. `Tasks` when `Project` is archived) — pair with `NULL`-tolerant queries and an audit log |

**Remediation pattern — add missing FK with cascade rule:**
```sql
-- Step 1: Add the FK constraint with an explicit ON DELETE rule
ALTER TABLE dbo.Orders
    ADD CONSTRAINT FK_Orders_Customers
    FOREIGN KEY (CustomerId)
    REFERENCES dbo.Customers (CustomerId)
    ON DELETE RESTRICT;   -- or CASCADE / SET NULL per business decision

-- Step 2: Add the supporting non-clustered index (see Rule 5 / performance)
CREATE NONCLUSTERED INDEX IF NOT EXISTS IX_Orders_CustomerId
    ON dbo.Orders (CustomerId)
    WITH (ONLINE = ON);

-- Rollback:
-- ALTER TABLE dbo.Orders DROP CONSTRAINT FK_Orders_Customers;
-- DROP INDEX IF EXISTS IX_Orders_CustomerId ON dbo.Orders;
```

**Remediation pattern — clean up existing orphans before adding FK:**
```sql
-- Identify orphans first
SELECT o.OrderId, o.CustomerId
FROM   dbo.Orders o
WHERE  NOT EXISTS (
    SELECT 1 FROM dbo.Customers c WHERE c.CustomerId = o.CustomerId);

-- Decide: delete orphans, reassign to a placeholder, or investigate
-- DELETE dbo.Orders WHERE CustomerId NOT IN (SELECT CustomerId FROM dbo.Customers);

-- Then apply the FK
ALTER TABLE dbo.Orders
    ADD CONSTRAINT FK_Orders_Customers
    FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId)
    ON DELETE RESTRICT;
```

---

### Rule 3 — If It's Not in the Schema, It's Not a Real Constraint

**What the tool checks:**
- Missing PRIMARY KEY on any table
- Columns matching secret/PII name hints stored as plain `VARCHAR` / `NVARCHAR`
- `VARCHAR` / `NVARCHAR` columns with no explicit length limit
- Implicit FK columns (ends in `_id`, `_ref`) with no declared FK constraint

**Remediation pattern — add PRIMARY KEY:**
```sql
-- Option A: table has a natural unique column
ALTER TABLE dbo.Customers
    ADD CONSTRAINT PK_Customers PRIMARY KEY CLUSTERED (CustomerId);

-- Option B: no natural PK — add a surrogate
ALTER TABLE dbo.Customers ADD CustomerId INT IDENTITY(1,1) NOT NULL;
ALTER TABLE dbo.Customers
    ADD CONSTRAINT PK_Customers PRIMARY KEY CLUSTERED (CustomerId);
```

**Remediation pattern — UNIQUE constraint:**
```sql
-- Every customer must have a unique email (business rule → schema rule)
ALTER TABLE dbo.Customers
    ADD CONSTRAINT UQ_Customers_Email UNIQUE (Email);

-- Rollback:
-- ALTER TABLE dbo.Customers DROP CONSTRAINT UQ_Customers_Email;
```

**Remediation pattern — CHECK constraint for valid ranges / fixed sets:**
```sql
-- Price cannot be negative
ALTER TABLE dbo.Products
    ADD CONSTRAINT CHK_Products_Price CHECK (Price >= 0);

-- Status must be a known value
ALTER TABLE dbo.Orders
    ADD CONSTRAINT CHK_Orders_Status
    CHECK (Status IN ('Pending', 'Active', 'Cancelled', 'Completed'));
```

**Remediation pattern — plaintext secrets (CRITICAL):**
```sql
-- Do NOT store raw passwords. Store only the salted hash.
-- If column exists as VARCHAR, migrate data to hash format then enforce type:
ALTER TABLE dbo.Users
    ALTER COLUMN PasswordHash VARBINARY(64) NOT NULL;
-- Application layer: hash with bcrypt/argon2 before INSERT/UPDATE.
```

**Remediation pattern — plaintext PII (CRITICAL):**
```sql
-- Apply Always Encrypted (SQL Server) or equivalent column-level encryption
-- Example: mark column for Always Encrypted in SSMS Column Encryption Wizard,
-- or use transparent column encryption at the application layer.
-- Minimum: ensure column is NOT NULL and has an audit log on access.
ALTER TABLE dbo.Customers
    ALTER COLUMN NationalId VARBINARY(256) NOT NULL;  -- post-encryption storage
```

**Remediation pattern — VARCHAR with no length:**
```sql
-- Add appropriate length cap based on the business rule
ALTER TABLE dbo.Customers ALTER COLUMN Email      NVARCHAR(254)  NOT NULL;
ALTER TABLE dbo.Customers ALTER COLUMN Phone      NVARCHAR(20)   NULL;
ALTER TABLE dbo.Products  ALTER COLUMN ProductName NVARCHAR(200) NOT NULL;
```

---

### Rule 4 — NULL Is Not the Same as Default

**What the tool checks:**
- Money/financial columns typed as `FLOAT` or `REAL`
- Identifier columns typed as `CHAR` / `VARCHAR`
- Columns with names suggesting they are always required (`name`, `email`, `status`, `created_at`) but no `NOT NULL` constraint

**Remediation pattern — financial columns (FLOAT → DECIMAL):**
```sql
-- Step 1: verify no precision loss exists in current data
SELECT MAX(ABS(Amount - CAST(Amount AS DECIMAL(19,4)))) AS MaxDrift
FROM   dbo.Payments;

-- Step 2: alter the column type
ALTER TABLE dbo.Payments
    ALTER COLUMN Amount DECIMAL(19,4) NOT NULL;

-- Rollback:
-- ALTER TABLE dbo.Payments ALTER COLUMN Amount FLOAT NOT NULL;
```

**Remediation pattern — add NOT NULL with a safe default:**
```sql
-- Add NOT NULL constraint with a backfill default
-- Step 1: backfill existing NULLs
UPDATE dbo.Customers SET Status = 'Active' WHERE Status IS NULL;

-- Step 2: apply NOT NULL
ALTER TABLE dbo.Customers
    ALTER COLUMN Status NVARCHAR(20) NOT NULL;

-- Step 3: add a DEFAULT so future inserts without the column still work
ALTER TABLE dbo.Customers
    ADD CONSTRAINT DF_Customers_Status DEFAULT 'Active' FOR Status;
```

**NULL decision documentation — add a column comment / extended property:**
```sql
-- Document what NULL means when it is intentionally allowed
EXEC sp_addextendedproperty
    @name  = N'MS_Description',
    @value = N'NULL = customer has not yet verified email. NOT NULL = verified.',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'Customers',
    @level2type = N'COLUMN', @level2name = N'EmailVerifiedAt';
```

---

### Rule 5 — Query Simplicity Beats Schema Cleverness

**What the tool checks:**
- Tables with two or more EAV-pattern column names (`attribute_name`, `attribute_value`, `property_name`, etc.)
- FK-like columns with no supporting non-clustered index

**Remediation pattern — replace EAV with explicit columns:**
```sql
-- Before (EAV — every query is a multi-join pivot):
-- ProductAttributes (ProductId, AttributeName, AttributeValue)

-- After (explicit columns — queries are simple SELECTs):
ALTER TABLE dbo.Products
    ADD Color    NVARCHAR(50)  NULL,
        Weight   DECIMAL(10,3) NULL,
        Material NVARCHAR(100) NULL;

-- Migrate existing EAV data
UPDATE p SET p.Color = a.AttributeValue
FROM   dbo.Products p
JOIN   dbo.ProductAttributes a
    ON a.ProductId = p.ProductId AND a.AttributeName = 'Color';

-- Then drop the EAV table after validation
-- DROP TABLE dbo.ProductAttributes;
```

**Remediation pattern — add non-clustered index on FK column:**
```sql
CREATE NONCLUSTERED INDEX IX_Orders_CustomerId
    ON dbo.Orders (CustomerId)
    INCLUDE (OrderDate, Status)     -- cover the most common query projections
    WITH (ONLINE = ON, FILLFACTOR = 90);

-- Rollback:
-- DROP INDEX IX_Orders_CustomerId ON dbo.Orders;
```

---

## Zero-Downtime Remediation Rules

All remediation scripts must follow these safety rules before execution on production:

| Rule | Requirement |
|---|---|
| Large table index creation | Always use `WITH (ONLINE = ON)` |
| Column type change | Test in staging; verify no data truncation or precision loss first |
| Adding NOT NULL to existing column | Backfill NULLs **before** applying the constraint |
| Adding FK to table with existing data | Check for orphans **before** adding the constraint |
| Dropping a column | Verify no application code references it; deprecate first if uncertain |
| Any destructive change | Include a commented rollback statement |

---

## Pre-Approval Checklist — Before Any Schema Is Approved

Run every item before marking a schema review complete:

### Structural Integrity (Rules 2 & 3)
- [ ] Every table has a PRIMARY KEY
- [ ] Every `FOREIGN KEY` has an explicit `ON DELETE` rule (CASCADE / RESTRICT / SET NULL)
- [ ] Every column named `*_id` or `*_ref` is either a PK or has a declared FK constraint
- [ ] No orphaned records can be created — verified by FK coverage

### Constraint Coverage (Rule 3)
- [ ] Uniqueness rules enforced with `UNIQUE` constraints, not just application validation
- [ ] Required fields enforced with `NOT NULL`
- [ ] Valid-range and valid-set rules enforced with `CHECK` constraints or FK to reference tables
- [ ] `VARCHAR` / `NVARCHAR` columns have explicit length limits

### Type Precision (Rule 4)
- [ ] No financial/monetary columns use `FLOAT` or `REAL` — all use `DECIMAL(19,4)` or `MONEY`
- [ ] No identifier columns use `CHAR` / `VARCHAR` — use `INT`, `BIGINT`, or `UNIQUEIDENTIFIER`
- [ ] Every nullable column has a documented meaning for NULL
- [ ] No column is nullable purely by default/laziness

### Security (Rule 3)
- [ ] No password or secret column stores plain text — hashed or encrypted storage only
- [ ] No PII column (SSN, DOB, passport, credit card) is stored unencrypted
- [ ] Sensitive columns have access audit logging defined

### Normalization & Queryability (Rules 1 & 5)
- [ ] No fact is stored in more than one place — or denormalization is documented with measured justification
- [ ] No EAV pattern without a proven, documented need for dynamic attributes
- [ ] Every FK column has a supporting non-clustered index
- [ ] The five most common queries against this schema have been written out and are acceptably simple

---

## Severity → Business Impact Mapping

| Tool Severity | Data Design Rule | Business Consequence if Ignored |
|---|---|---|
| 🔴 CRITICAL — Missing PK | Rule 3 | Rows not uniquely addressable; duplicates cannot be reliably detected or removed |
| 🔴 CRITICAL — No FK constraint | Rule 2 + 3 | Orphaned records accumulate silently; counts and reports become wrong |
| 🔴 CRITICAL — No cascade rule | Rule 2 | Parent deletion silently orphans children; data integrity undefined |
| 🔴 CRITICAL — Plaintext password | Rule 3 | Security breach — credential exposure |
| 🔴 CRITICAL — Plaintext PII | Rule 3 | Regulatory breach (GDPR, PCI-DSS, HIPAA) |
| 🟡 WARNING — FLOAT for money | Rule 4 | Rounding errors compound silently across millions of financial rows |
| 🟡 WARNING — Char-typed ID | Rule 4 | Index bloat; implicit conversion on every join degrades query performance |
| 🟡 WARNING — No index on FK | Rule 5 | Full table scans on every join; performance degrades as table grows |
| 🔵 ADVISORY — No NOT NULL | Rule 4 | NULL propagates through aggregates; reports silently miscount or missum |
| 🔵 ADVISORY — No length cap | Rule 3 | Unbounded strings allow data that violates business rules to enter |
| 🔵 ADVISORY — EAV pattern | Rule 5 | Every common query requires multi-join pivots; developer productivity compounds-costs daily |
| 🔵 ADVISORY — tbl_ prefix | Style | Naming inconsistency; minor but accumulates in large schemas |