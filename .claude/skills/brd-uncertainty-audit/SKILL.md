---
name: brd-uncertainty-audit
description: >
  Apply this skill whenever reviewing, writing, auditing, or improving a Business Requirements Document (BRD), 
  requirements statement, or any requirements artifact. Triggers include: requests to review a BRD, 
  assess requirements quality, check if a requirement is clear enough, score requirements, rewrite vague 
  requirements, or audit a requirements set before a sprint or build. This skill enforces the 
  'Reduce Uncertainty First' standard — a requirement is only ready when a developer could build it 
  tomorrow without a single blocking question. Use this before approving any BRD, adding stories to a 
  sprint, or handing off requirements to a development team. Also triggers on phrases like 
  "is this requirement clear?", "review my BRD", "what's missing from this spec?", 
  "are these requirements good enough?", or "can we start building from this?"
---

# BRD Uncertainty Audit Skill

## Core Principle: Measure Doubt, Not Pages

> "Your job is not to write documents. It's to eliminate what stakeholders don't know."
> Reduce Uncertainty

A BRD is **good** when someone now knows something they didn't know before, and can **decide** something they couldn't decide before. Volume, formatting, and completeness are irrelevant proxies. The only valid test: **did uncertainty go down?**

---

## The Three Types of Uncertainty — Diagnose Before You Fix

Every unclear requirement fails in one of three ways. Identify which type before rewriting.

| Type | The Question It Fails | Failure Signal |
|------|-----------------------|----------------|
| **Type 1 — Business Uncertainty** | *What problem are we actually solving?* | Stakeholders describe the solution ("a dashboard") before the problem. Agreement in the room is actually three people hearing three different things. |
| **Type 2 — Solution Uncertainty** | *How should we solve it?* | The problem is agreed but the approach is unresolved — or locked in by momentum, not analysis. |
| **Type 3 — Implementation Uncertainty** | *Can we actually build this?* | Estimates come with "it depends." Developers need to "research it first." Data assumptions are untested. |

**They are sequential.** Resolve Type 1 first, or the solution you chose is aimed at the wrong target. Resolve Type 2 before implementation or you'll build the worst of the available options. Skip Type 3 and the sprint ambushes you in week four.

---

## The Uncertainty Reduction Scale (0–10)

Score every requirement statement before and after your audit. This is your primary metric.

| Score | Meaning | Build-readiness |
|-------|---------|-----------------|
| **0–2** | Vague intent; near-total uncertainty | ❌ Do not build |
| **3–4** | Direction clear, but critical decisions unresolved | ❌ Do not build |
| **5–6** | Most gaps named; some still open | ⚠️ Build only if gaps are documented risk |
| **7–8** | Developer could build with minimal questions | ✅ Acceptable for sprint |
| **9–10** | Developer could build tomorrow, zero blockers | ✅ Ready |

**Minimum acceptable score before starting to build: 7.**

### Scoring Anchors (use for calibration)

| Statement | Score | Why |
|-----------|-------|-----|
| "The system should be user-friendly." | ~1 | No behavior, no metric, no user defined |
| "The dashboard will show key metrics." | ~3 | Which metrics? For whom? At what refresh rate? |
| "Users can export data." | ~4 | What data? Which format? Triggered how? By whom? |
| "Users should complete task X in under 2 minutes." | ~8 | Measurable, testable, specific |
| "Finance managers can export a CSV of approved expenses for the current month, triggered by a button on the Expenses list screen, within 5 seconds." | ~10 | Actor, action, object, scope, trigger, performance — all defined |

---

## The Audit Workflow

Run every BRD section through these steps in order. Do not skip steps — they are sequential by design.

### Step 1 — Pre-Audit: Identify the Decision-Maker
Before scoring a single requirement, answer this:

> "This BRD will help **[specific name/role]** decide **[specific decision]**."

If you cannot fill both blanks with a specific person and a specific decision, stop. The BRD has no anchor. Go find the decision-maker first.

**Quick test:** Can you finish the sentence below for each major section of the BRD?

```
Section: ___________________
Helps [who]: _______________
Decide [what]: _____________
```

If any section has no clear decision-maker, flag it as **UNANCHORED** before scoring.

---

### Step 2 — Score Each Requirement (0–10)
Apply the Uncertainty Reduction Scale to every requirement statement individually.

**For each requirement, record:**
- The original statement
- Your score (0–10)
- The uncertainty type that's failing (Type 1 / 2 / 3)
- The specific question that, if answered, would raise the score

Use this scoring table format:

```
| # | Requirement | Score | Uncertainty Type | Blocking Question |
|---|-------------|-------|-----------------|-------------------|
| 1 | "..." | 3 | Type 1 | Who is the intended user? |
| 2 | "..." | 8 | — | None (ready) |
```

---

### Step 3 — Rewrite Every Statement Below 7
For every statement scoring below 7, produce a rewritten version that targets a score of 8+.

**Rewrite rules:**
- Replace every vague adjective with a measurable threshold (fast → under 2 seconds)
- Name the specific actor (users → finance managers)
- Specify the object and scope (data → current-month approved expenses)
- Define the trigger (whenever → triggered by clicking "Export" on the Expenses screen)
- State the observable outcome (the system exports → a CSV file downloads automatically)

**Before / After format:**
```
BEFORE (Score: 3): "The report should be easy to access."
AFTER  (Score: 9): "Finance managers can access the monthly expense report from the main 
                    navigation menu under Reports > Monthly, within one click from any screen."
Uncertainty removed: who accesses it, where it lives, how many clicks required.
```

---

### Step 4 — Run the Three-Lens Check on Key Requirements
For any requirement central to the project, run all three uncertainty lenses explicitly:

```
Requirement: "[statement]"

Type 1 — Business: 
  - Who is this for? [answer or OPEN]
  - What problem does it solve? [answer or OPEN]
  - How will we know it worked? [answer or OPEN]

Type 2 — Solution:
  - What viable approaches exist? [answer or OPEN]
  - Was the chosen approach deliberate or assumed? [answer or OPEN]
  - What trade-off does this choice make? [answer or OPEN]

Type 3 — Implementation:
  - Does the data required actually exist and is it clean? [answer or OPEN]
  - Can we integrate within the timeline? [answer or OPEN]
  - Have developers been in the room before the commitment? [answer or OPEN]
```

Any **OPEN** is a gap the BRD has not resolved. Flag it explicitly.

---

### Step 5 — Produce the Audit Report

Output a structured report with these sections:

#### Section A — BRD Audit Summary
```
Decision-maker anchor: [name/role + decision]
Requirements reviewed: [count]
Average score: [X/10]
Below-threshold (<7): [count] ([%])
Uncertainty type breakdown:
  - Type 1 (Business): [count]
  - Type 2 (Solution): [count]
  - Type 3 (Implementation): [count]
BRD build-readiness verdict: READY / NOT READY / CONDITIONALLY READY
```

#### Section B — Scored Requirements Table
(Full table: original, score, type, blocking question)

#### Section C — Rewrites
(All statements below 7, rewritten to 8+, with uncertainty removed noted)

#### Section D — Open Assumptions Register
List every unresolved assumption explicitly. This is the "what I don't yet know" section.

```
| # | Open Assumption | Type | Impact if Wrong | Owner to Resolve |
|---|----------------|------|----------------|-----------------|
```

**Do not omit this section.** A BRD that names its gaps is more trustworthy than one that pretends it has none.

#### Section E — Recommended Next Actions
Prioritize the top 3 actions that would most reduce remaining uncertainty, ranked by impact.

---

## Red / Green Requirement Classification

Classify every requirement immediately when reviewing.

- 🟢 **GREEN** — Score ≥ 7. Developer can build it without a single blocking question. No open Type 1/2/3 gaps.
- 🔴 **RED** — Score < 7. Has at least one blocking question still inside it. Must rewrite before sprint.

**If you hesitate to classify — it's RED.**

---

## Common Anti-Patterns to Reject

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| "The system should be user-friendly / fast / intuitive." | Vague adjective; zero measurable content | Define a specific metric: under 2 seconds, task completion in one click |
| "The dashboard will show key metrics." | Object unspecified (which metrics?), audience unspecified | Name each metric, its source, its audience, its refresh rate |
| "Better visibility into operations." | Solution framing masking unresolved business problem | Push back to: what decision does this visibility enable, for whom, on what schedule? |
| "The system should support future scalability." | Implementation aspiration without constraint | Define the scale: concurrent users, data volume, latency target at peak |
| 30-page spec with no open questions listed | False completeness — hides uncertainty under structure | Add an explicit Open Assumptions Register (Section D above) |
| "Leadership needs X." | "Leadership" is not one stakeholder | Name each leader, their distinct need, and the requirement that serves it |

---

## The Cost of Leaving Uncertainty in the BRD

Use this when stakeholders push back on taking more time to refine requirements:

| When Uncertainty is Resolved | Relative Cost |
|------------------------------|---------------|
| Discovery / BRD review | 1× (a 5-minute conversation) |
| Mid-sprint (developer hits it) | ~10× (blocked story, context switch, rework) |
| QA (failed test cycle) | ~25× (defect ticket, re-spec, clarification meeting) |
| Production (wrong output shipped) | ~100× (hotfix, customer impact, credibility loss) |

**Same question. Same 5-minute answer. Only the timing changed — and timing set the price.**

---

## Quick Audit Checklist

Run this before declaring a BRD review complete:

- [ ] Decision-maker identified for every major section?
- [ ] Every requirement scored on the 0–10 scale?
- [ ] Every statement below 7 rewritten to 8+?
- [ ] Three-lens check run on all central requirements?
- [ ] Open Assumptions Register completed (even if empty)?
- [ ] BRD build-readiness verdict stated explicitly?
- [ ] Top 3 next actions to reduce remaining uncertainty listed?

**If any box is unchecked, the audit is not done.**

---

## Reference: Uncertainty Types Quick Lookup

**Type 1 — Business:** Wrong *target*. Team can build something perfect and still fail.
→ Fix: Push conversation back to the problem and the decision it serves.

**Type 2 — Solution:** Wrong *approach*. Team hits requirements but picks the worst trade-off.
→ Fix: Surface 2–3 real options, name what each optimizes for, make the choice deliberate.

**Type 3 — Implementation:** Wrong *confidence*. Plan is solid until week four ambushes it.
→ Fix: Time-box a spike, or pull technical people into the room before the commitment.
