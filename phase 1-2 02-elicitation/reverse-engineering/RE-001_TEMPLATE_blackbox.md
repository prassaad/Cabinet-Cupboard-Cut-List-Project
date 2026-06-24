---
title: Reverse Engineering Template
phase: 02_elicitation
created: 2026-06-19
format: RE-[###]_[SystemName]_blackbox.md
---

# RE-001_[SystemName]_blackbox

**System:** [System Name] | **Type:** [Legacy/Competitor/Current] | **Date:** [Date]

**Purpose:** Black-box analysis to extract features, flows, and gaps without access to source code.

---

## System Overview

**What It Does:** [One-sentence description]

**Primary Actors:** [Who uses it?]

**Main Flows:** [3–5 key workflows]

---

## Feature Inventory

| Feature | Observations | Questions for SME |
|---------|--------------|------------------|
| [Feature Name] | [What we observed] | [What we need to know] |
| [Feature Name] | [What we observed] | [What we need to know] |

---

## User Flows (Happy Path)

### Flow 1: [Verb-Noun]

```
Actor starts at [screen/interface]
  → [Action 1]
  → [Action 2]
  → [Action 3]
  → Ends at [outcome/screen]
```

**Questions:**
- What happens if [scenario]?
- Who approves [decision point]?
- What data is saved where?

---

### Flow 2: [Verb-Noun]

```
Actor starts at [screen/interface]
  → [Action 1]
  → [Action 2]
  → [Action 3]
  → Ends at [outcome/screen]
```

**Questions:**
- What happens if [scenario]?
- Who approves [decision point]?
- What data is saved where?

---

## Data Observed

| Data Element | Format | Source | Questions |
|--------------|--------|--------|-----------|
| [Field] | [Type: text/date/number] | [Where we saw it] | [What we don't know] |
| [Field] | [Type: text/date/number] | [Where we saw it] | [What we don't know] |

---

## Gaps & Unknowns

- [ ] **Unknown 1:** How does [process] actually work internally?
- [ ] **Unknown 2:** What happens in [edge case]?
- [ ] **Unknown 3:** Who has authority to [decision]?

---

## SME Clarification Questions (Prioritized)

| Priority | Question | Answer |
|----------|----------|--------|
| HIGH | [Critical question about process] | [ ] Pending |
| HIGH | [Critical question about data] | [ ] Pending |
| MED | [Important detail] | [ ] Pending |
| MED | [Important edge case] | [ ] Pending |
| LOW | [Nice-to-know] | [ ] Pending |

---

## Linked Artifacts

- Related Use Cases: [UC-###, UC-###]
- Related Interview Notes: [NOTES-###]
