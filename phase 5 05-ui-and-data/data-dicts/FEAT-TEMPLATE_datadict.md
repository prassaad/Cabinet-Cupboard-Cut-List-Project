---
title: Feature Data Dictionary
name: FEAT-[FeatureName]_datadict
phase: 05_ui-and-data
created: 2026-06-19
updated: 2026-06-19
status: DRAFT
traces: [UC-###, US-###, SCREEN-###]
verdict: RED
---

# FEAT-[FeatureName]_datadict

**Traces to:** UC-### | US-### | SCREEN-[ScreenName]_mockup.md

**Feature:** [Feature Name]  
**Purpose:** [What data does this feature manage?]

---

## Data Element Inventory

| Field Name | Data Type | Format/Pattern | Required | Max Length | Min Value | Max Value | Valid Values | Notes |
|------------|-----------|---------------|-----------|-----------|-----------|-----------|----|-------|
| [field] | Text | Email | Y | 254 | — | — | Valid email | User email |
| [field] | Number | Integer | Y | — | 1 | 100 | 1–100 | Quantity |
| [field] | Date | YYYY-MM-DD | Y | — | — | — | ISO format | Start date |
| [field] | Dropdown | Categorical | N | — | — | — | Active, Inactive, Pending | Status |

---

## Field Details

### Field 1: [Field Name]

- **Data Type:** [Type]
- **Format/Pattern:** [Format or regex]
- **Required:** [ ] Yes [ ] No
- **Max Length:** [Length]
- **Valid Values:** [Examples: "Email", "1–100", "A, B, C"]
- **Invalid Values:** [What fails?]
- **Validation Error:** ["Please enter a valid email"]
- **Default Value:** [Default or "None"]
- **Source/Origin:** [Where does it come from? User input / Database / Calculation?]
- **Update Frequency:** [Is it editable? When?]
- **Storage Requirements:** [Any special storage needs?]
- **Related Fields:** [Dependencies on other fields?]
- **Business Rule:** [Any business logic tied to this field?]

---

### Field 2: [Field Name]

- **Data Type:** [Type]
- **Format/Pattern:** [Format]
- **Required:** [ ] Yes [ ] No
- **Max Length:** [Length]
- **Valid Values:** [Examples]
- **Invalid Values:** [What fails?]
- **Validation Error:** [Message]
- **Default Value:** [Default]
- **Source/Origin:** [Where does it come from?]
- **Update Frequency:** [Editable? When?]
- **Storage Requirements:** [Any special needs?]
- **Related Fields:** [Dependencies?]
- **Business Rule:** [Business logic?]

---

## Relationships

| Field | Relates To | Relationship | Cardinality |
|-------|-----------|--------------|------------|
| [Field] | [Other field/entity] | [1:1 / 1:N / M:N] | [Details] |

---

## Business Rules

| Rule | Applies When | Action | Owner |
|------|-------------|--------|-------|
| [Rule 1] | [Condition] | [What happens] | [Owner] |
| [Rule 2] | [Condition] | [What happens] | [Owner] |

---

## Definition of Ready (DoR)

- [ ] All data elements documented
- [ ] No ❌ INCOMPLETE fields
- [ ] All validations defined
- [ ] All business rules captured
- [ ] Relationships clear
- [ ] Linked to screen mockup
- [ ] Linked to story

**DoR Status:** [X/7 criteria met]

---

## Linked Artifacts

- **Story:** US-###
- **Mockup:** SCREEN-[ScreenName]_mockup.md
- **UC:** UC-###

---

## Notes

[Special considerations, data migration notes, privacy/compliance flags]
