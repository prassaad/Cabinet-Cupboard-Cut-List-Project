---
id: US-001
name: [As a role I want...]
status: APPROVED
version: 1.0
agent: user-story-standards
traces: [UC-###]
verdict: GREEN
---

# US-001_[short-slug]

**Traces to:** UC-###

---

## Story

```
As a [role / type of user]
I want to [capability / action]
So that [business value / outcome]
```

---

## Acceptance Criteria (GWT Format)

### Scenario 1: [Happy Path Description]

```gherkin
Given [precondition]
When [actor action]
Then [observable outcome]
```

### Scenario 2: [Alternative Path]

```gherkin
Given [precondition]
When [actor action]
Then [observable outcome]
```

### Scenario 3: [Exception / Error Path]

```gherkin
Given [precondition]
When [actor action]
Then [error message / recovery]
```

---

## Additional Details

**Priority:** P0 / P1 / P2

**Effort Estimate:** [Points]

**Definition of Ready (DoR):**
- [ ] All 3+ scenarios written
- [ ] Mockup linked and annotated
- [ ] Data dictionary complete
- [ ] No blocking dependencies
- [ ] Acceptance criteria unambiguous

**Definition of Done (DoD):**
- [ ] Code review passed
- [ ] All scenarios tested (pass/fail captured)
- [ ] Regression tests written
- [ ] Documentation updated

---

## Linked Artifacts

- **Use Case:** UC-###
- **Mockup:** SCREEN-[Name]_mockup.md
- **Data:** FEAT-[FeatureName]_datadict.md
- **Related Stories:** US-###, US-###

---

## Notes

[Context, dependencies, technical notes]
