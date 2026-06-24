---
name: prototyping-mockup-standards
description: "Apply this skill whenever creating, reviewing, or eliciting requirements via UI Prototyping, Mockups, or Wireframes. Triggers include: requests to design a screen/form/mockup, generate a wireframe, elicit low-level UI requirements for a User Story or Use Case, or review an existing prototype for missing data fields, validations, or business rules. This skill enforces the 'Field + Value + Behavior + Rule' standard — a mockup is only done when every UI element has its data type, validation, and behavior explicitly answered, with zero open low-level questions left for the developer."
---

# UI Prototyping / Mockup Standards
## Governing Principle: A Picture Generates Questions, Not Just Answers

> "FR with Prototyping/Mockups is the basis for dev. after review — but only if every element on the screen has its low-level questions answered."

A mockup/wireframe's job is to **elicit and expose** low-level requirements: data fields (UI elements), data validations, expressions/calculations, business rules, and underlying assumptions, constraints, and dependencies — *before* development starts.

---

## When to Introduce Prototyping/Mockups

- **Never** introduce UI design at the very start of a new project.
- Introduce **at the time of writing Use Case scenarios / UCDD** — because while writing the UCD, application functionality evolves and the real fields/rules surface naturally.
- A mockup without a linked User Story / Use Case (UC) is incomplete — always trace each screen back to its UC's Basic/Alternate/Exception flows.

---

## Field vs Value (Foundational Distinction)

- **Field** = a variable / UI element that can hold a value and changes (e.g. `Gender`, `City`, `DOB`, `Age`, `Color`).
- **Value** = the actual data held in the field (e.g. `Gender = Male`, `City = Hyderabad`, `Age = 29`).
- Every mockup element must be classified: is this a **field** (input/editable) or a **static label/value** (read-only)?
- **Image is not data** — do not list images/icons as data elements (Rule applies to data inventories, not UI inventories).

---

## The Seven Primary Form Controls (Know Which One Applies)

| Control | Behavior | Key Question |
|---|---|---|
| **Label** | Read-only text; placeholders guide the user | Is this a placeholder (disappears on input) or a persistent label? |
| **Text Box / Input Box** (+ Text Area for multi-line) | Accepts free user input | Type, length, special characters allowed? |
| **Dropdown / Combo / Select / List Box** | User *selects*, doesn't free-type | Static or dynamic values? Single or multi-select? |
| **Date Picker** | Free text or calendar selection | Format — `dd/mm/yyyy` or `mm/dd/yyyy`? |
| **Radio Buttons** | Single selection from a group | What is the default-selected option (if any)? |
| **Checkboxes** | Multiple selection from a group | Minimum/maximum selections allowed? |
| **Buttons** | Trigger events (Create/Save/Update/Delete/Assign) | Exact caption text? Icon / Text / Icon+Text? |

**Grids/Tables/Lists** and **Divisions** (Tabs / Accordions / Popups / Wizards / Tiles) are structural elements — each needs its own elicitation pass (see Grid/Table section below).

---

## Mandatory Mockup Annotation — The "Additional Low Level" Layer

Every mockup must visually call out, for each element:

```
Label  →  what does this read-only text say, exactly?
Input Box / Text Box  →  type, length, validation
Date / Select / Dropdown  →  format or value source
Table  →  columns + alignment
Button  →  caption + behavior
Popup  →  trigger condition + fields inside
```

A mockup with unlabeled or unannotated elements is **not done** — it has questions still inside it (same "Done = No More Questions" standard as user stories).

---

## The Twelve Low-Level Elicitation Questions (Ask for EVERY Field)

Run every field on the mockup through this checklist. Each unanswered row is a blocking question.

| # | Question | Example / Notes |
|---|---|---|
| 1 | **Mandatory or Optional?** | Mark mandatory fields with `*` in red. |
| 2 | **Alignment?** | Left / Right / Center — for the field AND its label. |
| 3 | **Type?** | Text / Number / Both (Alphanumeric) / Boolean (True-False) / Any special characters allowed? |
| 4 | **Size / Length?** | Min and Max character count (e.g. "Min 5, Max 10"). |
| 5 | **Date format (if any)?** | `dd/mm/yyyy` vs `mm/dd/yyyy` vs `dd-mm-yyyy` — must be explicit. |
| 6 | **Behavior on submit/trigger?** | Popup / Next page / Same-page inline update? |
| 7 | **Select values — Static or Dynamic?** | If Dynamic → this implies a Master data Use Case; flag it as a new/linked story. |
| 8 | **Table: columns and alignment?** | List every column name, order, and alignment explicitly. |
| 9 | **Button captions?** | Exact text (Submit/Save/Cancel...) and Icon / Text / Icon+Text. |
| 10 | **Alert / message text?** | Ask for the EXACT wording, e.g. *"e-mail already exists! Please enter different value."* |
| 11 | **Attachment / file upload?** | Allowed file type(s) and max file size (e.g. ".jpg, max 150 KB"). |
| 12 | **Business rules / expressions?** | Any calculation or conditional rule, e.g. `Age > 6 and Age < 70`. State the full condition, not just "valid age". |

---

## Form Design Best Practices (Apply When Designing, Not Just Reviewing)

### Rule A — Ask Only for What's Needed
More fields = lower completion rate. For every field, ask: *"Is this truly required for this transaction, or can it be deferred/derived?"*

### Rule B — Space Fields for Readability
Cramped forms reduce comprehension. Each field/group needs visible breathing room — don't stack inputs with zero margin.

### Rule C — One-Column Layout Preferred
Single-column forms have higher completion rates because users fill sequentially top-to-bottom. Multi-column forms (Name/Address side-by-side) break the natural reading flow and should only be used for tightly related field pairs (e.g. City + State + Zip).

### Rule D — Intentional Label Placement
Choose one consistently, don't mix:
- **Left-aligned labels** — labels in a fixed-width left column, inputs aligned right of them. Good for scannable forms with many fields.
- **Right-aligned labels** — labels hug the input edge. Tighter visual association between label and field.
- **Top-aligned labels** — label sits above the input. Best for mobile/narrow layouts and long label text.

State which pattern is used and apply it to ALL controls (text input, combo, radio, checkbox, date, multi-select) on the screen — mixed alignment within one screen is a defect.

---

## Grid / Table Elicitation

For every Grid/Table/List on the mockup, capture:
- **Columns** — exact names, order, and per-column alignment (left/right/center — numbers typically right-aligned).
- **Sorting/Filtering** — which columns are sortable or filterable (icon present = filter; confirm which columns)?
- **Pagination** — page size, total count display format (e.g. "1–12 of 346 items")?
- **Row actions** — what does the "..." / action column do per row (View/Edit/Delete/Assign)? List each action and its trigger behavior (inline / popup / navigate).
- **Empty state** — what is shown when the table has zero rows?

---

## Popup / Form Elicitation

For every Popup or secondary Form/Page:
- **Trigger condition** — what click/action opens it?
- **Fields inside** — run the full 12-question checklist (above) on each field inside the popup too; popups are not exempt.
- **Close behavior** — does Save close the popup and refresh the parent grid? Does Cancel discard silently or prompt?

---

## Tying the Mockup Back to the Use Case (UCD)

Every mockup must map to a UC's flows:
- **Basic Flow** → the happy-path screen state and the primary action button.
- **Alternate Flow** → e.g. Cancel button — confirm it's annotated on the mockup with its resulting behavior.
- **Exception Flow** → every validation error message referenced in the UC (e.g. "Please enter transport mode name") must appear as an annotated alert/inline-error on the mockup, with its exact text and trigger condition.

If a UC's Exception Flow lists N error conditions, the mockup must show or annotate all N corresponding messages — missing ones are blocking questions.

---

## Output Format — Combining with Other Skills

When this skill is used together with:
- **user-story-standards** → every elicitation answer above becomes either a new GWT Acceptance Criterion (behavior/validation/message) or a declared dependency (e.g. dynamic Select → Master Use Case dependency).
- **db-audit-remediation** → field Type/Size/Mandatory answers become column data types, lengths, and `NOT NULL`/`CHECK` constraints; dynamic Select values become FK relationships to a reference/master table (Rule 2 & 3).

---

## Mockup Review Self-Check (Red/Green)

- 🟢 **GREEN** — Every field has: mandatory status, type, length/format, alignment, and behavior defined. Every button has exact caption + behavior. Every alert has exact text. Every Select is marked Static or Dynamic. All Exception Flow messages are represented.
- 🔴 **RED** — Any field, button, alert, or select is missing one or more of the above. List each missing item as a specific open question (per the 12-question checklist), not a vague "needs more detail."

**If you hesitate to classify a mockup as GREEN — it's RED.**

---

## Common Anti-Patterns to Reject

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| "Standard fields, you know what I mean" | Hides type/length/validation decisions | Run every field through the 12-question checklist |
| Dropdown with no source noted | Static vs Dynamic is a structural decision (new Use Case if dynamic) | Always state Static or Dynamic explicitly |
| Generic error text ("show validation error") | Untestable; QA can't verify exact wording | Specify the exact alert/message string |
| Multi-column form "to save space" | Reduces completion rate, breaks sequential flow | Default to single column unless fields are tightly related |
| Mockup with no linked Use Case | Mockup floats with no traceable Basic/Alternate/Exception flow | Map every screen and message back to its UC flows |
| Mixed label alignment on one screen | Inconsistent scanning pattern | Pick left/right/top labels once, apply to all controls |
