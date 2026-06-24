---
name: story-mockup-data-mapper
description: Maps Agile user stories and UI/UX mockups directly to a technical feature data dictionary during backlog refinement.
---

# Story, Mockup & Data Mapper Skill

This skill triggers whenever a user provides a UI/UX wireframe, mockup description, Figma layout link, or an agile user story requiring a data schema.

## 🎯 Objective
Bridge the gap between product requirements (user intent), interface design (mockups), and developer execution (database structures) by producing a structured Feature Data Dictionary.

## 🔄 Execution Workflow

When this skill activates, perform the following steps in sequence:

### Step 1: UI/UX Component Audit
Analyze the provided mockup or mockup description. Scan left-to-right, top-to-bottom to identify all data boundaries:
- **Inputs:** Captures form fields, drop-down options, toggle states, radio arrays, and image upload zones.
- **Outputs:** Captures dynamic text fields, table grids, metric tiles, KPI headers, and conditional error messages.

### Step 2: User Story Parsing
Scan the user story text—specifically the Acceptance Criteria (AC)—to capture explicit and implicit business logic:
- Search for rule triggers like "must validate", "must match", "only allowed to see", or "calculated based on".
- Map user roles (e.g., "Admin", "Premium User") to dynamic permission scopes in the data schema.

### Step 3: Schema Generation
Format the output into a markdown compliant table using the structure below. Do not deviate from these column definitions:

| UI Element Label | Data Element Name | Data Type | Validation / Constraints | Business Rules / Source | PII? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| *Label seen on screen* | *snake_case database field* | *String, Int, Decimal, Enum, Boolean* | *Length limits, formatting, Nullability* | *Formulas, logic, state defaults* | *Yes/No tracking* |

## 📐 Formatting & Engineering Constraints
1. **Naming Standard:** Force all `Data Element Names` into lower_snake_case.
2. **Numeric Precision:** Explicitly state numeric scales (e.g., `Decimal(10,2)`) for financial elements.
3. **Data Privacy:** Strictly evaluate fields against Privacy regulations. Flag names, emails, IPs, or location records as `PII: Yes`.
4. **Error Alignment:** For every UI input constraint, define what error condition the mockup must show if the constraint fails.

## 🏁 Quality Checklist Output
Conclude every execution by outputting an automated "Definition of Ready (DoR)" checklist based on gaps found during analysis.
