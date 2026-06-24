# BA Project Folder Structure
**Governs:** All outputs from the 8-agent BA suite
**Principle:** Folder = phase. File = artifact. Name = findable without opening it.

---

## Root Layout

```
PROJECT_NAME/
│
├── .copilot_.claude/                  ← skills, agent prompts, master index (your toolkit)
├── 01_discovery/               ← Agent 1 — Stakeholder Discovery
├── 02_elicitation/             ← Agent 2 — Interviews, Questionnaires, Reverse Engineering
├── 03_use-cases/               ← Agent 3 — Use Case Driven Discovery  ◄ SCOPE GATE
├── 04_requirements/            ← Agents 4 + 5 — BRD Audit + User Stories
├── 05_ui-and-data/             ← Agents 6 + 7 — Mockups + Feature Data Dictionaries
├── 06_architecture/            ← Agent 8 — NFR Discovery
└── _admin/                     ← decisions log, glossary, README
```

---

## 00_agents/ — Your Toolkit

```
00_agents/
├── skills/
│   ├── stakeholder-discovery/
│   │   └── SKILL.md
│   ├── elicitation-interviews-questionnaires/
│   │   └── SKILL.md
│   ├── use-case-driven-discovery/
│   │   └── SKILL.md
│   ├── brd-uncertainty-audit/
│   │   └── SKILL.md
│   ├── nfr-discovery/
│   │   └── SKILL.md
│   └── [user-story, prototyping, data-mapper skills when installed]
│
├── agents/
│   ├── AGENT_stakeholder-discovery.md
│   ├── AGENT_elicitation-interviews-questionnaires.md
│   ├── AGENT_use-case-driven-discovery.md
│   ├── AGENT_brd-uncertainty-audit.md
│   ├── AGENT_user-story-standards.md
│   ├── AGENT_prototyping-mockup-standards.md
│   ├── AGENT_story-mockup-data-mapper.md
│   └── AGENT_nfr-discovery.md
│
└── AGENT_MASTER-INDEX.md       ← lifecycle map, run order, invocation patterns
```

> This folder never holds project-specific content. It is your reusable toolkit, identical across projects.

---

## 01_discovery/ — Stakeholder Intelligence

```
01_discovery/
├── stakeholder-register.md     ← full register: name, category, power, interest, top uncertainty
├── power-interest-map.md       ← 2×2 grid: power vs interest per stakeholder
├── uncertainty-priority.md     ← Tier 1/2/3 ranking with resolution plan
├── disagreement-log.md         ← vague agreed phrases + diverging definitions per person
└── interview-plan.md           ← sequenced plan: who, goal, primary uncertainty, questions
```

**Naming convention:** Flat files — this phase produces a small, stable set of documents.

**Done signal:** Every stakeholder named. No generic groups. Tier 1 uncertainties have a resolution plan.

---

## 02_elicitation/ — Interviews, Questionnaires, Reverse Engineering

```
02_elicitation/
├── interview-scripts/
│   ├── INT-001_[Role]_[YYYY-MM-DD].md      ← full interview guide per session
│   └── INT-002_[Role]_[YYYY-MM-DD].md
│
├── question-sets/
│   ├── QS-001_[Topic]_generate.md          ← generated layered question set
│   └── QS-001_[Topic]_review.md            ← scored + refined version
│
├── session-notes/
│   ├── NOTES-001_[Role]_[YYYY-MM-DD].md    ← verbatim key bullets, NOT a transcript
│   └── NOTES-002_[Role]_[YYYY-MM-DD].md
│
├── reverse-engineering/
│   ├── RE-001_[SystemName]_blackbox.md     ← black box analysis: features, flows, gaps
│   └── RE-001_[SystemName]_sme-questions.md ← prioritised SME clarification list
│
└── divergence-log.md           ← updated after each session: phrase → A said / B said
```

**Naming convention:** Type prefix + sequence + role/topic + date. Sortable, identifiable without opening.

**Done signal:** Tier 1 uncertainty resolution confirmed (0–10 clarity check ≥ 8). Divergence log complete.

---

## 03_use-cases/ — Functional Scope Gate

```
03_use-cases/
├── uc-inventory.md             ← full UC list: ID, name, goal level, actor, status, linked stories
│
├── approved/                   ← GREEN-classified UCs only — the source of truth for sprints
│   ├── UC-001_Submit-Expense-Report.md
│   ├── UC-002_Approve-Purchase-Order.md
│   └── UC-003_[Verb-Noun].md
│
├── draft/                      ← work in progress — RED or under review
│   ├── UC-004_[Verb-Noun]_DRAFT.md
│   └── UC-005_[Verb-Noun]_DRAFT.md
│
└── deprecated/                 ← superseded UCs — never deleted, kept for traceability
    └── UC-OLD-001_[Verb-Noun]_DEPRECATED.md
```

**Naming convention:** `UC-[###]_[Verb-Noun].md`
- Three-digit sequence number (001, 002…) — sortable
- Verb-Noun matches the UC name exactly (kebab-case)
- Suffix `_DRAFT` in draft/, `_DEPRECATED` in deprecated/

**The gate rule:** No User Story enters the sprint backlog without a traceable UC in `approved/`. If the UC doesn't exist — run Agent 3 first.

**Done signal:** UC is 🟢 GREEN (complete flows, testable pre/postconditions, linked stories + mockups listed).

---

## 04_requirements/ — BRD and Sprint Backlog

```
04_requirements/
│
├── brd/
│   ├── BRD-v1.0_[ProjectName].md          ← full Business Requirements Document
│   ├── BRD-v1.0_audit-report.md           ← Agent 4 output: scores, rewrites, verdict
│   └── open-assumptions-register.md       ← all unresolved assumptions with owners + dates
│
└── backlog/
    ├── approved/                           ← 🟢 GREEN stories — sprint-ready
    │   ├── US-001_[As-a-role-I-want].md
    │   ├── US-002_[As-a-role-I-want].md
    │   └── US-###_[As-a-role-I-want].md
    │
    └── draft/                              ← 🔴 RED stories — in progress or failed INVEST
        ├── US-004_[As-a-role-I-want]_DRAFT.md
        └── US-005_[As-a-role-I-want]_DRAFT.md
```

**Naming convention:**
- BRD: `BRD-v[major.minor]_[ProjectName].md`
- Stories: `US-[###]_[short-slug].md` — slug is 3–5 words from the story action, not the "As a" prefix

**Traceability rule:** Each story file must contain a header line: `Traces to: UC-[###]`

**Done signal:** All BRD requirements score ≥ 7/10. All approved stories pass INVEST + GWT ACs. Open assumptions register has owners and due dates.

---

## 05_ui-and-data/ — Screen Specs and Data Dictionaries

```
05_ui-and-data/
│
├── prototypes/
│   ├── SCREEN-[ScreenName]_mockup.md       ← Agent 6: element inventory + 12-question audit
│   ├── SCREEN-[ScreenName]_mockup.md
│   └── SCREEN-[ScreenName]_mockup.md
│
├── data-dicts/
│   ├── FEAT-[FeatureName]_datadict.md      ← Agent 7: Feature Data Dictionary
│   └── FEAT-[FeatureName]_datadict.md
│
└── assets/
    ├── figma-links.md                      ← live Figma/design tool links per screen
    └── wireframes/                         ← exported static wireframe images if needed
```

**Naming convention:**
- Mockups: `SCREEN-[ScreenName]_mockup.md` — ScreenName matches the UC or feature it covers
- Data dicts: `FEAT-[FeatureName]_datadict.md`
- Both must contain a header: `Traces to: UC-[###]` + `US-[###]`

**The linkage rule:** Every screen file references the UC whose exception flow error messages must appear on it. Every data dictionary file references both the story and the screen it maps.

**Done signal:** Mockup is 🟢 GREEN (all 12 questions answered per field, all UC exception messages annotated). Data dictionary has no ❌ INCOMPLETE fields. DoR status = READY.

---

## 06_architecture/ — NFR Specification

```
06_architecture/
├── nfr-specification.md        ← Agent 8: full NFR spec, Tier 1/2/3 with targets + measurement
├── conflict-register.md        ← every NFR conflict: decision, trade-off, named owner, date
├── open-assumptions.md         ← NFRs that can't yet be set — question + owner + due date
└── architecture-implications.md ← per Tier 1 NFR: what architecture decision it constrains
```

**Done signal:** All Tier 1 NFRs score ≥ 7/10. All conflicts resolved with named decision-maker. Architecture Readiness Verdict = READY.

---

## _admin/ — Cross-Cutting Files

```
_admin/
├── README.md                   ← project overview, current phase, next action
├── decisions-log.md            ← all scope, architecture, and trade-off decisions with rationale
└── glossary.md                 ← agreed definitions for domain terms used in UCs and BRD
```

**README.md minimum content:**
```
# [Project Name]
Current phase: [01–06]
Last updated: [date]
Next action: [one sentence — what the team does next]
Open blocking items: [count + link to relevant register]
```

---

## File Naming Rules — The Full System

| Prefix | Type | Agent | Example |
|--------|------|-------|---------|
| `UC-###` | Use Case | Agent 3 | `UC-007_Reset-Password.md` |
| `US-###` | User Story | Agent 5 | `US-023_reset-password-via-email.md` |
| `BRD-` | Business Requirements | Agent 4 | `BRD-v1.2_PaymentSystem.md` |
| `SCREEN-` | Mockup spec | Agent 6 | `SCREEN-CheckoutPage_mockup.md` |
| `FEAT-` | Feature Data Dict | Agent 7 | `FEAT-Checkout_datadict.md` |
| `INT-###` | Interview script | Agent 2 | `INT-003_CFO_2025-06-19.md` |
| `QS-###` | Question set | Agent 2 | `QS-002_OperationsFlow.md` |
| `NOTES-###` | Session notes | Agent 2 | `NOTES-003_CFO_2025-06-19.md` |
| `RE-###` | Reverse engineering | Agent 2 | `RE-001_LegacyCRM_blackbox.md` |

**Four rules for all filenames:**
1. Prefix first — enables sorting by type in any file explorer
2. Sequence number zero-padded to three digits — 001, 012, 100
3. Descriptive slug in kebab-case — readable without opening the file
4. No dates in UC, US, BRD, SCREEN, or FEAT files — versions go in the file header, not the name

---

## Status Tracking — Use File Headers, Not Folders (Except UC and Story)

Every artifact file opens with a status block:

```yaml
---
id:       UC-007
name:     Reset Password
status:   APPROVED          # DRAFT | UNDER_REVIEW | APPROVED | DEPRECATED
version:  1.2
agent:    use-case-driven-discovery
traces:   [BRD-v1.0, US-023, US-024, SCREEN-ResetPassword]
updated:  2025-06-19
verdict:  GREEN             # GREEN | RED | CONDITIONALLY_READY
---
```

The verdict in the header matches the agent's RED/GREEN output. If it doesn't — the file has been edited without re-running the agent. Re-run the agent before the file returns to `approved/`.

---

## The Traceability Chain — Every File Links Forward and Back

```
UC-007_Reset-Password.md
  └─ traces to → BRD-v1.0 (Section 3.2)
  
US-023_reset-password-via-email.md
  └─ traces to → UC-007 (Basic Flow)
  
US-024_reset-password-expired-link.md
  └─ traces to → UC-007 (Exception Flow E4)
  
SCREEN-ResetPassword_mockup.md
  └─ traces to → UC-007, US-023, US-024
  └─ UC-007 exception E4 → annotated as inline error "This link has expired. Request a new one."
  
FEAT-ResetPassword_datadict.md
  └─ traces to → UC-007, US-023, SCREEN-ResetPassword
```

If any link in this chain is missing — that gap is a blocking open item.
