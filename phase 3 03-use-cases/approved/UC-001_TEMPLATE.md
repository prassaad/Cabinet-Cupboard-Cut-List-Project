---
id: UC-001
name: [Verb-Noun]
status: APPROVED
version: 1.0
agent: use-case-driven-discovery
traces: [BRD-v1.0, US-###, US-###, SCREEN-###]
updated: 2026-06-19
verdict: GREEN
---

# UC-001_[Verb-Noun]

## Goal

[What the actor achieves. User-goal level: what they want to accomplish, not how the system helps.]

---

## Actor

- **Primary Actor:** [Role / Type of user]
- **Secondary Actors:** [Other roles involved]

---

## Preconditions

- [Condition 1] (What must be true before this UC can start)
- [Condition 2]

---

## Basic Flow

```
1. Actor [action]
2. System [response]
3. Actor [action]
4. System [response/decision]
5. Actor [action]
6. System [confirmation/outcome]
```

---

## Alternative Flows

### A1: [Alternative scenario / decision point]

Triggered when: [Condition]

```
At step [X] in Basic Flow, if [condition]:
  A1.1. [Actor action]
  A1.2. [System response]
  A1.3. [Outcome / back to basic flow]
```

---

## Exception Flows

### E1: [Error / Edge case]

Triggered when: [Condition that causes failure]

```
At step [X], if [error condition]:
  E1.1. System [detects issue]
  E1.2. System [error message]
  E1.3. Actor [recovers or exits]
```

**Error Message to Display on SCREEN:** "This link has expired. Request a new one."

---

### E2: [Error / Edge case]

Triggered when: [Condition that causes failure]

```
At step [X], if [error condition]:
  E2.1. System [detects issue]
  E2.2. System [error message]
  E2.3. Actor [recovers or exits]
```

---

## Postconditions

- [State achieved after UC completes successfully]
- [Data state changes]
- [System state changes]

---

## Key Business Rules

- [Rule 1]
- [Rule 2]

---

## Frequency & Volume

- **Daily?** [Yes/No]
- **Peak volume:** [N transactions per day/hour]
- **SLA:** [Response time target]

---

## Related UCs

- [UC-###] — prerequisite
- [UC-###] — related flow

---

## Linked Artifacts

- **Stories:** US-###, US-###
- **Mockup:** SCREEN-[ScreenName]_mockup.md
- **BRD:** BRD-v1.0 Section [X.X]
- **Data:** FEAT-[FeatureName]_datadict.md

---

## Approval Checklist

- [ ] All flows testable (pre/postconditions clear)
- [ ] All exception flows have error messages
- [ ] All decision points named (no ambiguity)
- [ ] Traceability to BRD ✓
- [ ] Linked stories exist
- [ ] Mockup annotated with exception messages
- [ ] Data dictionary complete
- [ ] Verdict: GREEN = approved for sprint
