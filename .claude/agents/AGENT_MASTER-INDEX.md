# BA Agent Prompt Suite — Master Index
**Skill set:** Business Analysis · Requirements Discovery · Elicitation · Use Cases · Story Writing · UI Specification · Data Mapping · NFR
**Governing principle:** Measure doubt, not pages. Every artifact earns its place by one test: did someone's uncertainty go down?
**Agent count:** 8 agents · 8 skills · one continuous delivery lifecycle

---

## The Eight Agents — Full Lifecycle Map

```
════════════════════════════════════════════════════════════════════════════════════════════════════
PHASE 1         PHASE 2          PHASE 3           PHASE 4             PHASE 5       PHASE 6
DISCOVERY       ELICITATION      USE CASES         REQUIREMENTS        UI & DATA     ARCHITECTURE
════════════════════════════════════════════════════════════════════════════════════════════════════
    │                │                │                  │                  │               │
    ▼                ▼                ▼                  ▼                  ▼               ▼
Stakeholder    Elicitation      Use Case          BRD Uncertainty    Prototyping    NFR Discovery
Discovery      Agent            Driven            Audit Agent        & Mockup       Agent
Agent          (Interviews /    Discovery    →    +                  Standards
               Questionnaires/  Agent        →    User Story         Agent
               Reverse Eng.)                      Standards          +
                                                  Agent              Story Mockup
                                                                     & Data Mapper
════════════════════════════════════════════════════════════════════════════════════════════════════
"Who holds     "How do I        "What must       "Are these          "Is every      "What quality
uncertainty?"  get the truth    the system       requirements        screen         constraints
               out?"            do, for whom,    sprint-ready?"      element        drive
                                under what                           specified?"    architecture?"
                                conditions?"
════════════════════════════════════════════════════════════════════════════════════════════════════
```

---

## AGENT 1 — Stakeholder Discovery Agent
**File:** `AGENT_stakeholder-discovery.md`
**Skill:** `stakeholder-discovery`
**Phase:** 1 — Discovery

**Use when:**
- Starting a new project — who are the real stakeholders?
- A requirement is attributed to "leadership," "users," or "the business" (group labels)
- Stakeholders disagree and you need to understand why
- You need to plan who to interview and in what order
- Requirements keep changing because a key voice is missing

**Hard rule:** Any generic group label is automatically 🔴 RED. Produces named individuals only.

**Output:** Stakeholder Register · Power/Interest/Uncertainty map · Tier 1/2/3 Priority ranking · Disagreement Diagnostic · Interview Plan

---

## AGENT 2 — Elicitation Agent (Interviews, Questionnaires & Reverse Engineering)
**File:** `AGENT_elicitation-interviews-questionnaires.md`
**Skill:** `elicitation-interviews-questionnaires`
**Phase:** 2 — Elicitation

**Use when:**
- Preparing for a stakeholder interview at any tier (C-Level / Manager / End User)
- Building a questionnaire for broad stakeholder input
- Reviewing and scoring existing interview questions
- Black Box Reverse Engineering of an existing system
- Simulating how a stakeholder would respond to test question quality

**Hard rule:** Never generates a question without confirming the discovery goal and stakeholder tier. Always operates in Plan Mode.

**Modes:** Generate · Review · Script · Reverse Engineer · Simulate

**Output:** Layered scored question set (Explore/Context/Process/Idea) · Before→After refinements · Interview Script · Black Box analysis · Divergence Diagnostic

---

## AGENT 3 — Use Case Driven Discovery Agent ← NEW PHASE 3 ANCHOR
**File:** `AGENT_use-case-driven-discovery.md`
**Skill:** `use-case-driven-discovery`
**Phase:** 3 — Use Cases (between Elicitation and Requirements)

**Use when:**
- Converting elicitation notes into structured functional scope
- Writing a Use Case for any feature, process, or system capability
- Reviewing a Use Case for completeness and structural correctness
- Identifying the full UC inventory for a system or feature set
- Decomposing a Kite-level business UC into Sea-Level system UCs
- Deriving User Stories and AC stubs from UC flows
- Confirming that a Mockup covers all exception flow error messages from the UC

**Hard rule:** Basic Flow must contain NO branching. Every validation step has a corresponding Exception Flow. Alternate ≠ Exception — they end at different postconditions. No UC without a named Primary Actor, a Trigger, testable Pre/Postconditions, and linked Mockups/Stories.

**Modes:** Write · Review · Scope · Decompose · Derive · Validate

**Output:** Fully Dressed UC (Cockburn template) · RED/GREEN verdict · Flow count (Basic/Alternate/Exception) · Linked Story stubs · Mockup gap check · UC Status verdict

---

## AGENT 4 — BRD Uncertainty Audit Agent
**File:** `AGENT_brd-uncertainty-audit.md`
**Skill:** `brd-uncertainty-audit`
**Phase:** 4 — Requirements

**Use when:**
- Reviewing a BRD before handing it to a development team
- Checking if requirements are ready to sprint
- Rewriting vague requirements so they can be built without questions
- Getting a quality verdict on a spec before architecture decisions

**Hard rule:** Minimum score of 7/10 on the Uncertainty Reduction Scale before anything goes to build. Every statement below 7 gets rewritten.

**Output:** Scored Requirements Table · Before→After Rewrites · Three-Lens Check · Open Assumptions Register · Build-Readiness Verdict

---

## AGENT 5 — User Story Standards Agent
**File:** `AGENT_user-story-standards.md`
**Skill:** `user-story-standards`
**Phase:** 4 — Requirements

**Use when:**
- Writing new user stories for a backlog
- Reviewing stories before sprint planning
- Splitting oversized or bundled stories
- Assessing acceptance criteria quality

**Hard rule:** "Done = No More Questions." Every story is 🟢 GREEN or 🔴 RED based on the 15-second estimate test and all six INVEST letters. Stories must be traceable to an approved Use Case.

**Output:** INVEST Audit · AC Quality Check (GWT) · Split recommendations · Rewritten GREEN story · Sprint-Ready verdict

---

## AGENT 6 — Prototyping & Mockup Standards Agent
**File:** `AGENT_prototyping-mockup-standards.md`
**Skill:** `prototyping-mockup-standards`
**Phase:** 5 — UI & Data Specification

**Use when:**
- Designing a new screen, form, or wireframe
- Reviewing an existing mockup before sprint
- Checking whether a mockup covers all UC Exception Flow error messages
- Annotating error messages, validation rules, and button behaviors

**Hard rule:** "Field + Value + Behavior + Rule." A mockup without a linked UC is 🔴 RED. Every Exception Flow error message from the UC must appear on the mockup with exact wording.

**Output:** Element Inventory · Field Annotation Table (12 questions) · Exception Flow coverage check · Open Items Register · Mockup Readiness Verdict

---

## AGENT 7 — Story, Mockup & Data Mapper Agent
**File:** `AGENT_story-mockup-data-mapper.md`
**Skill:** `story-mockup-data-mapper`
**Phase:** 5 — UI & Data Specification

**Use when:**
- Translating a completed mockup + user story into a Feature Data Dictionary
- Backlog refinement sessions where schema questions must be answered
- Mapping UI elements to data types, constraints, and business rules
- Identifying PII fields for compliance review

**Hard rule:** Every UI element documented on five dimensions: Data Type, Validation/Constraints, Business Rules/Source, PII Flag, Error Message. Financial fields always specify decimal precision. Dynamic dropdowns always flag a Master Data dependency.

**Output:** Feature Data Dictionary · Open Items Register · Dependency Flag List · Definition of Ready Verdict

---

## AGENT 8 — NFR Discovery Agent
**File:** `AGENT_nfr-discovery.md`
**Skill:** `nfr-discovery`
**Phase:** 6 — Architecture

**Use when:**
- Defining quality attributes (NFRs) for a new system
- Reviewing a BRD or PRD that has no quality constraints
- Preparing NFR specifications before any architecture decision
- Identifying and resolving conflicts between competing quality attributes

**Hard rule:** Minimum NFR score 7/10. Every conflict resolved with a named decision-maker. No NFR without a measurable target, measurement method, and business justification.

**Output:** NFR Specification Tier 1/2/3 · Conflict Register · Open Assumptions · Architecture Implications Table · Architecture Readiness Verdict

---

## Recommended Run Order

```
PHASE 1 — DISCOVERY
  └─► Agent 1: Stakeholder Discovery
        Who holds uncertainty? Who to interview? In what order?

PHASE 2 — ELICITATION
  └─► Agent 2: Elicitation Agent
        Design and run the interviews. Extract requirements from existing systems.

PHASE 3 — USE CASES  ← THE FUNCTIONAL SCOPE ANCHOR
  └─► Agent 3: Use Case Driven Discovery
        Convert elicitation notes → Fully Dressed Use Cases at Sea Level.
        Verify scope. Define Basic / Alternate / Exception flows.
        Every UC approved here is the authoritative source for Phases 4 and 5.

PHASE 4 — REQUIREMENTS
  ├─► Agent 4: BRD Uncertainty Audit
  │     Are the business requirements build-ready? Score, rewrite, certify.
  │
  └─► Agent 5: User Story Standards
        Are the sprint stories sprint-ready? INVEST audit. Trace every story to a UC.

PHASE 5 — UI & DATA SPECIFICATION
  ├─► Agent 6: Prototyping & Mockup Standards
  │     Does the mockup cover every UC flow? Twelve-question field audit.
  │
  └─► Agent 7: Story, Mockup & Data Mapper
        Bridge mockup + story → Feature Data Dictionary.

PHASE 6 — ARCHITECTURE
  └─► Agent 8: NFR Discovery
        Define quality constraints. Resolve conflicts. Certify architecture readiness.
```

**Iteration rules:**
- Agents 1 and 2 may iterate — re-run when new stakeholders surface during interviews
- Agent 3 is the GATE between discovery and sprint planning — no story enters the sprint without an approved UC
- Agent 3 may produce multiple Sea Level UCs from a single Kite-level discovery (Decompose mode)
- Agents 3 and 5 iterate — a UC's Exception Flows become ACs on stories; story review may surface UC gaps
- Agents 5 and 6 work in tandem — UC Exception Flows must appear as annotated errors on Mockups
- Agent 8 must complete before architecture begins; revisit when major UCs are added or changed

---

## Cross-Agent Handoff Points

| From Agent | To Agent | Handoff Artifact |
|-----------|----------|-----------------|
| Agent 1: Stakeholder Discovery | Agent 2: Elicitation | Stakeholder Register + Interview Plan |
| Agent 1: Stakeholder Discovery | Agent 8: NFR Discovery | Stakeholder NFR interview questions + priority list |
| Agent 2: Elicitation | Agent 3: Use Case Discovery | Discovery notes, verbatim quotes, goal statements per stakeholder |
| Agent 2: Elicitation (Reverse Eng.) | Agent 3: Use Case Discovery | Black Box analysis → UC scope identification |
| Agent 3: Use Case Discovery | Agent 4: BRD Audit | Approved UC set → BRD section per feature area |
| Agent 3: Use Case Discovery | Agent 5: User Story Standards | Basic Flow → primary story; Alternate Flow → variant story/AC; Exception Flow → error-handling AC |
| Agent 3: Use Case Discovery | Agent 6: Mockup Standards | Exception Flow error messages → must appear on linked Mockup |
| Agent 3: Use Case Discovery | Agent 8: NFR Discovery | UC-specific Special Requirements → NFR inputs |
| Agent 4: BRD Audit | Agent 5: User Story Standards | Certified requirements → sprint-ready stories |
| Agent 4: BRD Audit | Agent 8: NFR Discovery | Implied NFR phrases extracted from BRD language |
| Agent 5: User Story Standards | Agent 6: Mockup Standards | GREEN stories → trigger mockup design and annotation |
| Agent 5: User Story Standards | Agent 7: Data Mapper | User story ACs → business rule extraction |
| Agent 6: Mockup Standards | Agent 7: Data Mapper | GREEN annotated mockup → Feature Data Dictionary input |
| Agent 7: Data Mapper | Development | Feature Data Dictionary → developer implementation |
| Agent 8: NFR Discovery | Architecture | NFR Specification + Architecture Implications Table |

---

## Common Invocation Patterns

**Pattern 1 — Greenfield project kickoff**
> "We're starting a new [system] project. Where do I begin?"
→ Agent 1 (Stakeholder Discovery) → Agent 2 (Elicitation) → Agent 3 (Use Case Discovery, Scope mode first)

**Pattern 2 — Feature scoping before sprint planning**
> "We need to scope out [feature] before we write stories."
→ Agent 3 (Use Case Discovery, Write mode) → Agent 5 (User Story Standards, Derive from UC)

**Pattern 3 — Use case review**
> "Review this use case and tell me if it's complete."
→ Agent 3 (Use Case Discovery, Review mode) — RED/GREEN verdict + specific gaps

**Pattern 4 — Pre-sprint requirements review**
> "Are these requirements ready to hand to the developers?"
→ Agent 4 (BRD Audit) + Agent 5 (User Story Standards) in parallel

**Pattern 5 — Screen design review**
> "Is this mockup ready for the developer?"
→ Agent 3 (Use Case Discovery, Validate mode — confirm mockup covers all UC flows first) → Agent 6 (Mockup Standards)

**Pattern 6 — Backlog refinement with a developer**
> "The developer is asking about the data model behind this screen."
→ Agent 7 (Data Mapper) — Feature Data Dictionary + DoR verdict

**Pattern 7 — Migration / replatform**
> "We need to replace our legacy [system]."
→ Agent 2 (Elicitation, Reverse Engineer mode) → Agent 3 (Use Case Discovery, write UCs from Black Box analysis) → Agent 4 (BRD Audit)

**Pattern 8 — Architecture planning**
> "The architects are asking for NFRs."
→ Agent 8 (NFR Discovery) — extract from BRD and UC Special Requirements, interview stakeholders, resolve conflicts

**Pattern 9 — Story that has no UC**
> "Write me a user story for [feature]."
→ First: Agent 3 (Use Case Discovery, Write mode) to establish the UC → then Agent 5 (User Story Standards, Derive mode from the UC)

**Pattern 10 — Stakeholder conflict on scope**
> "Two stakeholders disagree about what [feature] should do."
→ Agent 1 (Disagreement Diagnostic) → Agent 3 (Use Case Discovery, one UC per interpretation, then explicit scope decision)

**Pattern 11 — Full story-to-build pipeline**
> "Take this requirement from BRD to sprint-ready with a data spec."
→ Agent 3 → Agent 4 → Agent 5 → Agent 6 → Agent 7

**Pattern 12 — Interview prep**
> "I have a 45-minute session with the VP of Operations tomorrow."
→ Agent 2 (Generate mode) — stakeholder = VP Operations, tier = Manager, goal = [what you need to learn]

---

## Where Use Cases Sit — The Position in the Full Lifecycle

```
ELICITATION        USE CASES             USER STORIES          MOCKUPS / DATA
─────────────────────────────────────────────────────────────────────────────
"What do they   → "What must the      → "What does the      → "What does the
 actually need?"   system DO for          sprint deliver?"       screen need, and
                   whom, under what                              what does the
                   conditions?"                                  database store?"

Agent 2         → Agent 3            → Agent 5             → Agent 6 + Agent 7
                  ↑ SCOPE GATE ↑
              No story enters
              sprint without an
              approved UC here
```

---

## The Eight Hard Rules — Common Across All Agents

| Rule | Scope | Detail |
|------|-------|--------|
| No generic groups | Agents 1, 3, 4, 5 | "Leadership/users/the business" → name individuals |
| Minimum quality threshold | All agents | 7/10 score (BRD), INVEST pass (stories), complete flows (UCs), 12-question complete (mockups) |
| Basic Flow has no branching | Agent 3 | Every "if/else" → Alternate or Exception Flow |
| Every validation has an Exception | Agent 3, 5 | No validation step without its failure scenario |
| Alternate ≠ Exception | Agent 3 | Different postcondition destinations — never confuse them |
| Every UC links to Stories + Mockups | Agent 3 | Unlinked UCs are unverified scope |
| Every gap is a named open question | All agents | "Needs more detail" is never acceptable |
| Verdicts are binary | All agents | GREEN or RED. Hesitation = RED. |

---

## The Governing Cost Equation

| When uncertainty is resolved | Relative cost |
|------------------------------|--------------|
| Discovery / stakeholder interview | 1× |
| Use Case scoping (this is the gate) | 2× |
| BRD / requirements writing | 3× |
| Sprint planning / story refinement | 5× |
| Mid-sprint (developer hits ambiguity) | ~10× |
| UI design / mockup review | ~15× |
| QA (failed test cycle) | ~25× |
| Production (wrong output shipped) | ~100× |

**The Use Case gate at 2× is the cheapest place to catch scope errors.**
Every assumption that slips through Agent 3 compounds by 5–50× before it surfaces.
