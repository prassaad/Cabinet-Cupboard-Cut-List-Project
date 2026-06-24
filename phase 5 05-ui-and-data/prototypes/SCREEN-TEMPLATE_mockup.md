---
title: Screen Mockup Specification
name: SCREEN-[ScreenName]_mockup
phase: 05_ui-and-data
created: 2026-06-19
updated: 2026-06-19
status: DRAFT
traces: [UC-###, US-###]
verdict: RED
---

# SCREEN-[ScreenName]_mockup

**Traces to:** UC-### | US-### | US-###

**Device Type:** [ ] Mobile | [ ] Desktop | [ ] Tablet | [ ] Agnostic

---

## Screen Purpose

[One sentence: What is the goal of this screen? What does the user accomplish here?]

---

## Element Inventory (The 12-Question Audit)

For every UI element on the screen, answer all 12 questions:

### Element 1: [Field/Button/Label Name]

| Question | Answer |
|----------|--------|
| 1. **What is it?** | [Text field / Button / Dropdown / etc.] |
| 2. **What data does it hold?** | [Field type: text/number/date/dropdown] |
| 3. **Required or optional?** | [ ] Required [ ] Optional |
| 4. **What are valid values?** | [Examples: "Email format", "1–100", "Dropdown: A, B, C"] |
| 5. **What's invalid?** | [Examples: "Empty", "Non-numeric", "Special chars not allowed"] |
| 6. **Validation message** | ["Please enter a valid email", etc.] |
| 7. **Default value?** | [None / "Today" / "Select..." / etc.] |
| 8. **Max length?** | [Characters/digits limit] |
| 9. **What happens on click/change?** | [Behavior: Submit / Filter / Toggle / etc.] |
| 10. **Error state visual** | [Red border / Icon / etc.] |
| 11. **Help text?** | ["Hint to user"] |
| 12. **Linked to UC exception?** | [Yes → Which flow? / No] |

---

### Element 2: [Field/Button/Label Name]

| Question | Answer |
|----------|--------|
| 1. **What is it?** | [Type] |
| 2. **What data does it hold?** | [Data type] |
| 3. **Required or optional?** | [ ] Required [ ] Optional |
| 4. **What are valid values?** | [Examples] |
| 5. **What's invalid?** | [Examples] |
| 6. **Validation message** | [Message] |
| 7. **Default value?** | [Default] |
| 8. **Max length?** | [Limit] |
| 9. **What happens on click/change?** | [Behavior] |
| 10. **Error state visual** | [Visual feedback] |
| 11. **Help text?** | [Help] |
| 12. **Linked to UC exception?** | [Yes/No] |

---

## Exception Messages from UC

[From UC-### exception flows, what error messages must appear on this screen?]

| UC Flow | Scenario | Error Message | Where on Screen? |
|---------|----------|---------------|------------------|
| E1 | [Trigger] | "This link has expired. Request a new one." | [Location] |
| E2 | [Trigger] | [Message] | [Location] |

---

## Layout & Navigation

```
┌─ HEADER ─────────────────────────────────┐
│  Logo  |  Title                  | Menu  │
├───────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ │
│ │ FORM AREA / CONTENT AREA             │ │
│ │                                      │ │
│ │ [Element 1] [Element 2]              │ │
│ │ [Element 3] [Element 4]              │ │
│ │                                      │ │
│ │            [Submit Button]           │ │
│ └──────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

---

## States & Transitions

### State 1: Initial Load

- [What elements are visible/enabled?]
- [Default values shown?]

### State 2: On Validation Error

- [Which fields show errors?]
- [Are buttons disabled?]

### State 3: On Success

- [Confirmation message shown?]
- [Redirect to next screen?]

---

## Accessibility Requirements

- [ ] Keyboard navigable
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG AA
- [ ] Error messages announced to screen reader
- [ ] Focus visible for all interactive elements

---

## Definition of Ready (DoR)

- [ ] All 12 questions answered for every element
- [ ] Exception messages from UC annotated
- [ ] States and transitions clear
- [ ] Layout unambiguous
- [ ] Linked mockup/data dictionary exists
- [ ] No blocking dependencies
- [ ] Ready for development

**DoR Status:** [X/7 criteria met]

---

## Linked Artifacts

- **Use Case:** UC-###
- **Stories:** US-###, US-###
- **Data Dictionary:** FEAT-[FeatureName]_datadict.md
- **Figma/Design Link:** [URL]

---

## Notes

[Design notes, accessibility considerations, technical constraints]
