---
name: use-case-driven-discovery
description: >
  Apply this skill whenever writing, reviewing, structuring, or evaluating Use Cases (UCs) and Use Case
  Descriptions (UCD) during Discovery and Elicitation passes — before User Stories and Mockups are written.
  Triggers include: requests to write a use case, define use case scenarios, document basic flow / alternate
  flow / exception flow, structure a use case specification, define actors and goal levels, build a use case
  diagram, review a use case for completeness, or trace requirements back to use cases. Also triggers on:
  "what are the use cases for this system?", "write me a UC for [feature]", "what's the difference between
  basic flow and alternate flow?", "map this requirement to a use case", "we need to define the scope before
  writing stories", "what level should this use case be?", "what are the actors?", or any scenario where
  functional scope must be defined before UI design or sprint planning begins. Apply this skill BEFORE
  user-story-standards and prototyping-mockup-standards — Use Cases are the foundation that both depend on.
  A mockup without a linked Use Case is incomplete. A User Story without a traceable Use Case has no
  verified scope anchor.
---

# Use Case Driven Discovery Skill

## Core Principle: Scope Before Screen, Flow Before Field

> "A Use Case is not a feature list. It is a contract between an actor and the system — describing what the system must do, for whom, under what conditions, and what constitutes success or failure."
> — Adapted from Alistair Cockburn, *Writing Effective Use Cases* (2001)

Use Cases occupy the critical space **between stakeholder elicitation and User Story writing**. They are written after discovery interviews reveal the business goals and before mockups expose the field-level details. Their job is to define **what** the system must do — not how it looks, not how it's coded, not which button the user clicks.

A Use Case done well makes User Stories easier to write, mockups easier to annotate, and development easier to scope. A Use Case skipped means User Stories are written without verified scope — and mockups are drawn without traceable functional anchors.

---

## The Cockburn Goal Level Framework — Write at the Right Altitude

Every Use Case must be written at the correct goal level. The wrong level produces either vague summaries (too high) or implementation details disguised as requirements (too low).

```
☁  CLOUD     — Enterprise/Organisation level. "Sell goods to customers." 
                Very high summary. 3–5 per organisation. Rarely written in full.

🪁 KITE      — Business Unit / Department level. "Manage Customer Returns."
                Summary goal. Multiple user goals contained inside.
                Written as brief UC; expanded UCs live below it.

🌊 SEA LEVEL — User Goal level. "Submit an Expense Report."  ← PRIMARY WRITING LEVEL
                "Can the primary actor go away happy after doing this?"
                One sitting. 2–20 minutes of user activity. This is where BAs write.

🐟 FISH      — Sub-function level. "Validate expense amount against policy."
                Part of a sea-level UC's alternate/exception flow.
                Written only when a sub-step needs its own detailed specification.

🐚 CLAM      — Implementation level. API calls, database queries, component logic.
                NOT a BA artifact. Belongs to the technical design team.
```

**The BA rule:** Write all primary Use Cases at **Sea Level (🌊)**. Reference Kite level for scope context. Extract Fish level UCs only when a sub-function is complex enough to need its own flows.

**The test for Sea Level:** "Can the primary actor go away satisfied having completed this — in one sitting — without needing to do anything else?" If yes: Sea Level. If the UC spans days or references a business lifecycle: go up to Kite. If the UC is just one step inside another UC: go down to Fish.

---

## The Fully Dressed Use Case Template

This is the authoritative structure for every primary UC at Sea Level. Every field is mandatory unless explicitly marked optional.

```
═══════════════════════════════════════════════════════════════
USE CASE: UC-[##] — [Active Verb + Noun Goal Phrase]
═══════════════════════════════════════════════════════════════

METADATA
────────
UC ID:           UC-[number]
UC Name:         [Active verb + noun: "Submit Expense Report", "Approve Purchase Order"]
Goal Level:      ☁ Cloud / 🪁 Kite / 🌊 Sea Level / 🐟 Fish
Version:         [e.g. 1.0]
Status:          Draft / Under Review / Approved / Deprecated
Author:          [BA name]
Last Updated:    [date]

ACTORS
──────
Primary Actor:   [Who initiates and benefits — a named role, not a system]
Secondary Actor: [Other roles or systems involved — optional if none]
Stakeholders:    [Who cares about the outcome — may differ from actors]

SCOPE & CONTEXT
───────────────
System Boundary: [What system is under discussion — the black box being specified]
Business Context:[Why this UC exists — the business driver in one sentence]
Trigger:         [The event that starts this UC — user action, system event, time-based, or signal]

PRECONDITIONS
─────────────
[State that must be TRUE before this UC can begin. Things the system/actor can assume.]
PRE-1: [e.g. Actor is authenticated and authorised]
PRE-2: [e.g. The expense period is open for submission]
PRE-3: [Add as many as needed — each a distinct, testable state]

POSTCONDITIONS — SUCCESS
────────────────────────
[State that must be TRUE after successful completion of the Basic Flow]
POST-S1: [e.g. Expense report is saved with status "Pending Approval"]
POST-S2: [e.g. Manager receives email notification within 2 minutes]
POST-S3: [e.g. Audit log records submission with actor ID and timestamp]

POSTCONDITIONS — FAILURE
────────────────────────
[State that must be TRUE if the UC terminates abnormally — system state is preserved/rolled back]
POST-F1: [e.g. No expense report record is created]
POST-F2: [e.g. Actor is shown an error message with the specific failure reason]

BASIC FLOW (Happy Path)
───────────────────────
[The most common, successful path from Trigger to Success Postconditions]
[Alternating: Actor steps (what the person does) vs System steps (what the system does)]
[Number each step. Use "Actor:" and "System:" prefixes for clarity]

Step 1 — Actor:  [Action the primary actor takes]
Step 2 — System: [System response or validation]
Step 3 — Actor:  [Next actor action]
Step 4 — System: [System response]
...
Step N — System: [Final system action that completes the goal — reaches SUCCESS Postcondition]

ALTERNATE FLOWS
───────────────
[Valid alternative paths that still reach the SUCCESS postcondition — different route, same destination]
[Naming convention: A[step]-[name] e.g. A3-PartialSubmission]

A[step]-[Name]: [When this alternate applies]
  A[step].1 — Actor/System: [what happens differently]
  A[step].2 — [continues until it REJOINS the basic flow at step X, or reaches success on its own]
  → Rejoins Basic Flow at Step [X] / Completes independently

EXCEPTION FLOWS
───────────────
[Error conditions, validation failures, or system failures that CANNOT complete the goal]
[Exception flows do NOT return to the Basic Flow — they end the UC at the FAILURE postcondition]
[Naming convention: E[step]-[name] e.g. E2-InvalidAmount]

E[step]-[Name]: [When this exception triggers — specific condition]
  E[step].1 — System: [System detects the failure condition]
  E[step].2 — System: [System response — error message, state preserved/rolled back]
  E[step].3 — Actor:  [What the actor can do — retry, cancel, contact support]
  → UC ends at FAILURE Postcondition [POST-F#]

BUSINESS RULES
──────────────
[Rules that constrain or govern behaviour within this UC — referenced from flows above]
BR-1: [Rule statement — e.g. "Expense amounts over $500 require a receipt attachment"]
BR-2: [Rule statement — e.g. "Reports cannot be submitted for a closed expense period"]
BR-3: [Reference: "Approval thresholds defined in Policy Document v3.2"]

SPECIAL REQUIREMENTS (Non-Functional, UC-specific)
──────────────────────────────────────────────────
[NFRs that apply specifically to this UC — NOT a place for system-wide NFRs]
SR-1: [e.g. "Submission must complete within 3 seconds under normal load"]
SR-2: [e.g. "Expense data must be encrypted at rest — PII: employee ID, amounts"]

OPEN QUESTIONS / ASSUMPTIONS
─────────────────────────────
[OPEN-1]: [Question that must be resolved before this UC is approved]
[ASSUMPTION-1]: [What we are assuming to be true — to be confirmed with stakeholder]

LINKED ARTEFACTS
────────────────
Parent UC:       [UC-## — Kite level UC this belongs to, if any]
Child UCs:       [UC-## — Fish level UCs that expand on steps of this UC]
User Stories:    [US-## — Stories derived from this UC's flows]
Mockups:         [Link / reference to wireframes covering this UC's Basic/Alternate/Exception flows]
Test Cases:      [TC-## — Test cases derived from this UC's flows and business rules]
═══════════════════════════════════════════════════════════════
```

---

## The Three Flows — Critical Distinctions

Getting these wrong is the most common Use Case mistake. Know the difference before writing a single step.

| Flow | Definition | Ends at | Example |
|------|-----------|---------|---------|
| **Basic Flow** | The most common, successful path. No errors, no variations. The "sunny day" scenario. | ✅ SUCCESS Postcondition | User submits expense → system saves → notification sent |
| **Alternate Flow** | A valid variation that is less common but still achieves the goal. Different path, same destination. | ✅ SUCCESS Postcondition | User submits expense WITHOUT a receipt (under $50 threshold) → system saves with exemption flag |
| **Exception Flow** | An error, failure, or invalid condition that CANNOT achieve the goal. The UC stops here. | ❌ FAILURE Postcondition | User submits with amount exceeding $500 with no receipt → system rejects → UC ends |

**The rule for Alternate vs Exception:**
- If the flow eventually reaches the SUCCESS postcondition → it is an **Alternate Flow**
- If the flow terminates without reaching the SUCCESS postcondition → it is an **Exception Flow**
- Alternate Flows REJOIN the Basic Flow (at a specific step) or complete independently with success
- Exception Flows NEVER return to the Basic Flow

---

## The Four Rules for Use Case Writing

**Rule 1 — Name the UC as an Active Verb + Noun Goal Phrase**
The name is the goal, stated from the primary actor's perspective.
- ❌ "Expense System" → no goal, no actor
- ❌ "User clicks Submit button" → implementation detail, not a goal
- ❌ "Expense Report Management" → "management" hides many goals
- ✅ "Submit Expense Report" → actor goal, single purpose, active verb
- ✅ "Approve Purchase Order" → clear, bounded, testable

**Rule 2 — Write What the System Does, Not How It Does It**
A Use Case is a **black box** specification. It describes observable behaviour — inputs, outputs, and outcomes — never internal implementation.
- ❌ "System queries the `expenses` table WHERE `status = 'pending'"` → clam level, not UC territory
- ❌ "System calls the PaymentGateway.ProcessTransaction() API" → implementation detail
- ✅ "System validates the expense amount against the current policy limits" → what, not how
- ✅ "System stores the submitted report and sets status to Pending Approval" → observable outcome

**Rule 3 — Alternate Before Exception. Cover Both. Cover All.**
A UC without Alternate Flows is optimistic fiction. A UC without Exception Flows is a liability. The real requirement is almost always in the flows that deviate from the happy path.
- Every validation in the Basic Flow implies at least one Exception Flow (what happens when it fails?)
- Every conditional path ("if X then Y else Z") implies at least one Alternate Flow
- Every Alternate Flow needs a REJOIN point — where does it reconnect to the Basic Flow?
- Every Exception Flow needs an error message, a state outcome, and an actor recovery option

**Rule 4 — Preconditions Are Not Steps; Postconditions Are Not Summaries**
- A **Precondition** is a state that must be TRUE before Step 1 — it is not verified inside the UC, it is assumed
- A **Postcondition** is a verifiable, testable state of the system after the UC completes — it is not "the user is happy"
- If you're tempted to write "User is logged in" as Step 1 → move it to Preconditions. Login is a separate UC.
- ❌ Postcondition: "The expense report is submitted successfully" → vague, not testable
- ✅ Postcondition: "Expense report record exists with status = 'Pending Approval', linked to the submitting actor's ID, with a timestamp within the current expense period" → testable, specific

---

## The UC Quality Checklist — Run Before Approving Any UC

**Scope:**
- [ ] UC name is an Active Verb + Noun goal phrase?
- [ ] Goal Level is specified (Sea Level for primary UCs)?
- [ ] System Boundary is named — what is the black box?
- [ ] Trigger is identified — what starts this UC?

**Actors:**
- [ ] Primary Actor is a named role (not a system, not "user")?
- [ ] Secondary actors and external systems listed if involved?
- [ ] The test passes: "Can the primary actor go away happy after this UC?"

**Flows:**
- [ ] Basic Flow covers only the happy path — no "if" branching inside it?
- [ ] Every validation in the Basic Flow has a corresponding Exception Flow?
- [ ] Every "if/else" in the Basic Flow has a corresponding Alternate Flow?
- [ ] Every Alternate Flow has a REJOIN point or independent SUCCESS end?
- [ ] Every Exception Flow ends at the FAILURE Postcondition?

**Pre/Postconditions:**
- [ ] Preconditions are states — not steps, not system checks?
- [ ] Success Postconditions are verifiable system states — not summaries?
- [ ] Failure Postconditions define what happens to data on abnormal exit?

**Business Rules:**
- [ ] All rules referenced in the flows are listed in the Business Rules section?
- [ ] Rules reference source documents where applicable?

**Linked Artefacts:**
- [ ] Every Exception Flow message corresponds to an annotated error on the linked Mockup?
- [ ] User Stories derived from this UC are listed?
- [ ] Open Questions are named with a resolution owner?

**If any box is unchecked — the UC is not approved. Flag the gap, name the owner.**

---

## Use Case Scenario Types — What to Derive from Each Flow

Each flow in a UC maps directly to downstream artefacts:

| UC Section | → User Story | → Mockup | → Test Case |
|------------|-------------|----------|------------|
| Basic Flow | Primary story (happy path AS-WANT-SO) | Screen in default/success state | Positive test: all conditions met |
| Alternate Flow | Variant story for the alternate path | Screen in alternate state | Alternate path test |
| Exception Flow | Story for error handling (if needed) | Error message annotation | Negative test: failure condition |
| Business Rule | AC (Given/When/Then) on the relevant story | Validation tooltip / error state | Boundary value test |
| Precondition | AC dependency declaration ("depends on UC-##") | Pre-state of the screen | Setup condition in test |
| Postcondition | AC "Then" clause | Success state of the screen | Verification assertion |

---

## Where Use Cases Sit in the Full BA Lifecycle

```
DISCOVERY & ELICITATION              SPECIFICATION               BUILD & TEST
─────────────────────────────────────────────────────────────────────────────
Stakeholder        Elicitation     [THIS SKILL]        User        Mockup /     Dev
Discovery    →     Interviews   →  Use Cases       →   Stories  →  Data Dict →  Sprint
                                   (Sea Level)         (INVEST)    (12 Qs)
─────────────────────────────────────────────────────────────────────────────
"Who needs        "What do        "What must the      "What       "What does   "Build
 what?"            they need?"     system do?"         sprint      the screen   it."
                                                       delivers?"  need?"
```

**The handoff rules:**
- A Use Case MUST be approved before a User Story derived from it enters the sprint
- A Mockup MUST be linked to a UC — it annotates the screens that support a UC's flows
- A User Story's ACs (Given/When/Then) should be traceable to a UC's Basic/Alternate/Exception flow
- Every Exception Flow error message in the UC MUST appear as an annotated error on the Mockup

---

## Red / Green UC Classification

🟢 **GREEN** — UC name is an Active Verb + Noun. Goal Level specified. Primary Actor named. Basic Flow has no branching. Every validation has a corresponding Exception Flow. Every Alternate Flow has a REJOIN point. Pre/Postconditions are testable states. Business Rules listed. All flows produce linked Mockup annotations and User Story traces.

🔴 **RED** — Any of the following: UC name is a noun phrase ("Expense Management"), Basic Flow contains "if/else" branching instead of extracting Alternate/Exception Flows, Preconditions describe steps instead of states, Postconditions are vague summaries, Exception Flows are missing for validation steps, no Mockup linkage, no open questions listed despite obvious gaps.

**If you hesitate to classify — it is RED.**
