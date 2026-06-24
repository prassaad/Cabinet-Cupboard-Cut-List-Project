---
name: user-story-standards
description: "Apply this skill whenever writing, reviewing, refining, or evaluating user stories. Triggers include: requests to write a user story, review a backlog, assess acceptance criteria, split stories, check story quality, or any task involving Agile/Scrum story writing. This skill enforces the 'Done = No More Questions' standard — a story is only done when a competent developer can build it without asking a single blocking question. Use this before finalizing any story or acceptance criteria."
---

# User Story Writing Standards
## Core Principle: Done = No More Questions

> "If a developer reads your story and has a question, it isn't done."

A story is **done** when a competent developer can build it without asking you a single blocking question. Not when it has the right format. Not when you've written a lot. **Zero blocking questions remaining.**

### The Fifteen-Second Estimate Test
Hand the story to a developer. If they give a rough estimate in **15 seconds** → the story is clear enough to build. If they say *"well, it depends on…"* → every word after "depends" is a question you left unanswered.

---

## The INVEST Quality Checklist

Run every story through all six letters before calling it done. **Failed letters = your fix list.**

| Letter | Question to Ask | Failure Signal |
|--------|----------------|---------------|
| **I**ndependent | Can it be built and shipped on its own, without waiting on another story? | Story requires another story to be done first |
| **N**egotiable | Does it state the *need*, leaving the *how* to the team? | Story over-specifies implementation details |
| **V**aluable | Does it deliver value to a user or the business (not just a technical task)? | Story describes a task, not an outcome |
| **E**stimable | Can a developer size it in ~15 seconds? | Vague scope; developer says "it depends" |
| **S**mall | Does it fit comfortably within a sprint (ideally a few days)? | Story bundles multiple behaviors |
| **T**estable | Can QA write a test that proves it works? | No measurable, observable outcome defined |

**If a story fails INVEST, it is not done. Fix the failures before adding it to the sprint.**

---

## Acceptance Criteria: Given-When-Then (GWT) Structure

Every acceptance criterion must follow this structure:

```
Given [a starting context]
When  [an action or trigger]
Then  [an observable, measurable result]
```

**Example:**
```
Given a user with email notifications enabled for "mentions"
When  a teammate mentions them in a comment
Then  they receive one email notification within one minute
```

### Why GWT Works
- Forces a **concrete context**, a **concrete trigger**, and a **concrete observable outcome**
- Acts as a **vagueness detector** — if you can't express a requirement as GWT, you don't understand it well enough yet
- Makes "done" something QA can actually verify

### Testability Rule
Every AC must pass this test: *Could QA write an automated or manual test for this?*
- ❌ "The system should be fast" → untestable opinion
- ✅ "Page loads in under 2 seconds on a 4G connection" → testable
- Replace every adjective (fast, intuitive, robust, user-friendly) with a **number, count, time, percentage, or specific behavior**

---

## The Five Rules

### Rule 1 — One Behavior, One Value
**Never bundle behaviors with "and."**

- ❌ `"As a user, I want to manage my tasks and collaborate with my team."`
- ✅ `"As a project manager, I want to assign a task to a teammate, so work is distributed fairly."`

The word **"and"** in a user story is a warning siren. When you find one, split the story. You will almost always get two clean, estimable stories out of one muddy one.

### Rule 2 — Acceptance Criteria Must Be Testable
**No adjectives without numbers. No opinions as criteria.**

- ❌ `"The experience should be intuitive."` → untestable
- ✅ `"A new user completes the task without help in under one minute."` → testable

If the criterion contains a vague adjective with no measurable threshold behind it, it is not a criterion — it is an opinion. Rewrite it with a specific, observable outcome.

### Rule 3 — Buildable Beats Perfect
**Write to "no blocking questions," then stop.**

Do not over-specify into paralysis. Past the point where all blocking questions are answered, more detail yields diminishing returns.

- **Blocking question** (must answer): *"Does an expired account see the balance or not?"* — the developer cannot proceed without this.
- **Non-blocking question** (leave to team): *"Which date-picker component should I use?"* — developer can decide and you can adjust later.

**Answer every blocker. Leave non-blockers to the team's judgment. Done lives at "no blockers left."**

### Rule 4 — Comments Explain the *Why*, Not the *What*
**The story states what. The AC states how we'll verify. Comments add the why.**

- ❌ Comment: `"User can filter; add a filter button."` → restates the what (noise)
- ✅ Comment: `"Customers requested this after seeing competitor X's filtering."` → supplies business context (gold)

Business context in comments lets developers make small judgment calls *in the spirit* of the requirement, not against it.

### Rule 5 — Acceptance Criteria Must Be Independent
**No hidden dependencies. Declare all dependencies explicitly.**

- ❌ `"Given the user is logged in…"` without noting this assumes the login story is already built
- ✅ `"Given the user is logged in (depends on Story #123 — User Authentication)…"`

Hidden dependencies are sprint landmines. They work in your head, pass review, and detonate when someone picks stories up in an order you never warned was wrong. **Declare every dependency out loud so the team can sequence around it.**

---

## Story Writing Workflow

Follow this sequence when writing or refining any user story:

1. **Write the story** in proper format: `As a [role], I want [action], so that [value].`
2. **Check for "and"** — if present, split into separate stories (Rule 1).
3. **Run INVEST** — identify every failing letter; fix each failure before proceeding.
4. **Write GWT acceptance criteria** — cover the happy path plus 2–3 edge cases.
5. **Test each AC for testability** — replace all vague adjectives with measurable thresholds (Rule 2).
6. **Check for hidden dependencies** — declare any explicitly in the AC or story notes (Rule 5).
7. **Add a why comment** if business context would help the developer make judgment calls (Rule 4).
8. **Apply the 15-second test** — would a developer estimate this instantly, or say "it depends"? If the latter, there are blocking questions still inside it.

---

## Red/Green Story Evaluation

When evaluating an existing story, classify it immediately:

- 🟢 **GREEN** — A developer could build this without asking a single blocking question. Passes INVEST. Has testable GWT criteria. No hidden dependencies.
- 🔴 **RED** — Has questions still inside it. Must name: which INVEST letter fails, or which AC is untestable or ambiguous.

**If you hesitate to classify — it's RED.**

For every RED story, produce:
1. The specific reason(s) it fails (INVEST letter, untestable AC, hidden dependency, bundled behaviors)
2. A rewritten version that fixes all failures

---

## Common Anti-Patterns to Reject

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| `"As a user, I want to manage [X]"` | "Manage" hides 5–10 behaviors | Split by each discrete behavior |
| `"The system should be fast/intuitive/robust"` | Untestable adjective; no measurable threshold | Define the specific metric (e.g., `< 2 seconds`) |
| AC that assumes another story is complete without saying so | Hidden dependency; sprint landmine | Declare the dependency explicitly |
| One story with "and" in the action | Multiple behaviors bundled | Split at every "and" |
| Story with no acceptance criteria | "Done" is undefined; QA cannot test | Add GWT criteria covering happy path + edge cases |
| 100-item unprioritized list (Requirements Dump) | Volume is not value; team can't distinguish must-haves from nice-to-haves | Prioritize with MoSCoW (Must/Should/Could/Won't); write each item to Done standard |

---

## Quick Self-Check Before Marking a Story Done

- [ ] Could a developer estimate this in 15 seconds without saying "it depends"?
- [ ] Does the story contain "and"? (If yes → split it)
- [ ] Does every AC contain a measurable, observable outcome? (No vague adjectives)
- [ ] Does every AC pass the GWT structure?
- [ ] Are all dependencies declared explicitly — none hidden inside a "Given…"?
- [ ] Does any comment explain the *why*, not restate the *what*?
- [ ] Does the story pass all six INVEST letters?

**If any box is unchecked, the story is not done.**

---

## Reference: Key Definitions

**Done** — A story a competent developer can build without asking you a single blocking question.

**Blocking question** — Any ambiguity about behavior, value, or outcome that prevents the developer from proceeding. Must be resolved in the story before it reaches the sprint.

**Non-blocking question** — An implementation detail the developer can decide using reasonable judgment (e.g., component choice, minor layout). Leave these to the team.

**INVEST** — Independent, Negotiable, Valuable, Estimable, Small, Testable. The quality standard for a well-formed user story.

**Given-When-Then (GWT)** — The required structure for acceptance criteria. Forces specificity and verifiability. If a requirement cannot be expressed as GWT, it is not yet understood well enough to be called done.
