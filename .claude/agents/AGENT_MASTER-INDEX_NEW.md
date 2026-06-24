# BA Agent Prompt Suite — Master Index
**Skill set:** Business Analysis · Requirements Discovery · Elicitation · Use Cases · Prototyping · Story Writing · Data Mapping · NFR
**Governing principle:** Measure doubt, not pages. Every artifact earns its place by one test: did someone's uncertainty go down?
**Agent count:** 8 agents · 8 skills · one continuous delivery lifecycle

---

## The Eight Agents — Full Lifecycle Map

```
══════════════════════════════════════════════════════════════════════════════════════════════════════
PHASE 1       PHASE 2        PHASE 3                    PHASE 4           PHASE 5      PHASE 6
DISCOVERY     ELICITATION    SCOPE & UI DISCOVERY        REQUIREMENTS      DATA SPEC    ARCHITECTURE
══════════════════════════════════════════════════════════════════════════════════════════════════════
    │              │               │                          │                 │              │
    ▼              ▼               ▼                          ▼                 ▼              ▼
Stakeholder   Elicitation    [3a] Use Case            BRD Uncertainty    Story+Mockup   NFR Discovery
Discovery     Agent          Driven Discovery         Audit Agent        Data Mapper    Agent
Agent         (Interviews /  Agent                    +                  Agent
              Questionnaires/     ↓                   User Story
              Reverse Eng.)  [3b] Prototyping &       Standards
                             Mockup Standards         Agent
                             Agent
                             (elicitation pass)
══════════════════════════════════════════════════════════════════════════════════════════════════════
"Who holds    "How do I      "What must the            "Are these        "What does    "What quality
uncertainty?" get the        system do? What           requirements      the database  constraints
              truth out?"    does the screen           sprint-ready?"    need?"        drive
                             look like to                                              architecture?"
                             verify the scope?"
══════════════════════════════════════════════════════════════════════════════════════════════════════
```

---

## Why Prototyping Sits in Phase 3 — The Reasoning

> "A picture generates questions, not just answers."
> — prototyping-mockup-standards SKILL

Prototyping in Phase 3 is **elicitation by picture** — a discovery tool, not a specification tool. After Use Cases define the functional scope (what the system must do), a low-fidelity wireframe placed in front of a stakeholder surfaces field-level questions that text alone never would:

- *"Wait, where does the approval status show?"*
- *"We need a bulk export button here — that's actually our biggest pain point."*
- *"This dropdown — those values need to come from the supplier master, not be free text."*

These are **new requirements**, not annotations of old ones. They belong in Phase 3, not Phase 5.

**Phase 3 Prototyping (elicitation pass) answers:** Does the Use Case scope feel right to stakeholders when they see it drawn? What have we missed?

**Phase 5 Data Mapping (specification pass) answers:** Now that the screen is agreed and the stories are written — what is every field's type, rule, and error message for the developer?

The Prototyping agent runs **twice** at different depths:
- **Phase 3b:** Low-fidelity. Linked to UC. Goal = surface missing requirements. Output feeds User Stories.
- **Phase 5 (review pass):** HIGH-fidelity. Linked to stories. Goal = certify every field is 12-question complete before the Data Mapper runs.

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

## AGENT 3a — Use Case Driven Discovery Agent
**File:** `AGENT_use-case-driven-discovery.md`
**Skill:** `use-case-driven-discovery`
**Phase:** 3a — Scope Definition (the functional contract)

**Use when:**
- Converting elicitation notes into structured functional scope
- Writing a Use Case for any feature, process, or system capability
- Reviewing a Use Case for completeness and structural correctness
- Identifying the full UC inventory for a system or feature set
- Decomposing a Kite-level business UC into Sea-Level system UCs
- Deriving User Story stubs from UC flows
- Confirming that a Prototype covers all Basic, Alternate, and Exception flows from the UC

**Hard rule:** Basic Flow must contain NO branching. Every validation step has a corresponding Exception Flow. Alternate ≠ Exception. No UC approved without a named Primary Actor, Trigger, testable Pre/Postconditions, and at least one linked Prototype or Story.

**Modes:** Write · Review · Scope · Decompose · Derive · Validate

**Output:** Fully Dressed UC (Cockburn template) · RED/GREEN verdict · Flow count · UC inventory · Story stubs · Prototype gap check

---

## AGENT 3b — Prototyping & Mockup Standards Agent ← MOVED TO PHASE 3
**File:** `AGENT_prototyping-mockup-standards.md`
**Skill:** `prototyping-mockup-standards`
**Phase:** 3b — UI Discovery (elicitation pass, feeds User Stories)

**The shift:** Prototyping now runs immediately after Use Cases are drafted — as a discovery tool to validate scope with stakeholders visually before any User Story is written. A low-fidelity prototype placed against a UC's Basic Flow exposes missing fields, wrong actors, and scope gaps that textual UCs alone never reveal.

**Phase 3b goal (elicitation):** Validate UC scope visually. Surface hidden requirements. Feed corrections back to Agent 3a before stories are written.

**Phase 5 goal (specification review):** After stories are approved, re-run the agent at full 12-question depth to certify every field for the Data Mapper.

**Use in Phase 3b when:**
- A UC has been drafted and you need stakeholder validation before writing stories
- A low-fidelity wireframe exists and you want to check UC flow coverage
- You need to surface missing requirements by showing rather than telling
- An existing system screen is being replicated and you want to map it to UC flows before speccing

**Use in Phase 5 (review pass) when:**
- Stories are approved and mockups need full 12-question field annotation
- Checking whether every UC Exception Flow error message appears on the screen with exact wording
- Certifying the mockup is complete before handing to the Data Mapper agent

**Hard rule:** A mockup without a linked UC is 🔴 RED at any phase. In Phase 3b, fidelity may be low — but UC linkage and Basic/Alternate/Exception flow coverage are still required. In Phase 5, all twelve questions must be answered for every field.

**Output (Phase 3b):** UC flow coverage map · Missing scope items · List of new requirements to feed back to Agent 3a · Stakeholder validation questions
**Output (Phase 5):** Element Inventory · Field Annotation Table (12 questions) · Exception Flow coverage check · Open Items Register · Mockup Readiness Verdict

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

**Hard rule:** Minimum score of 7/10 on the Uncertainty Reduction Scale before anything goes to build. Every statement below 7 gets rewritten. BRD sections must trace back to approved UCs.

**Output:** Scored Requirements Table · Before→After Rewrites · Three-Lens Check (Business/Solution/Implementation) · Open Assumptions Register · Build-Readiness Verdict

---

## AGENT 5 — User Story Standards Agent
**File:** `AGENT_user-story-standards.md`
**Skill:** `user-story-standards`
**Phase:** 4 — Requirements

**Use when:**
- Writing User Stories derived from approved UCs and validated Prototypes
- Reviewing stories before sprint planning
- Splitting oversized or bundled stories
- Assessing acceptance criteria quality
- Checking that every story traces to an approved UC and a validated prototype

**Hard rule:** "Done = No More Questions." Every story is 🟢 GREEN or 🔴 RED based on the 15-second estimate test and all six INVEST letters. Stories must trace to an approved UC (Agent 3a) and a validated prototype (Agent 3b).

**Output:** INVEST Audit · AC Quality Check (GWT) · Split recommendations · Rewritten GREEN story · Sprint-Ready verdict

---

## AGENT 6 — Story, Mockup & Data Mapper Agent
**File:** `AGENT_story-mockup-data-mapper.md`
**Skill:** `story-mockup-data-mapper`
**Phase:** 5 — Data Specification

**Use when:**
- Translating an approved story + 12-question-complete mockup into a Feature Data Dictionary
- Backlog refinement sessions where database schema questions must be answered
- Mapping UI elements to data types, constraints, and business rules
- Identifying PII fields for compliance review

**Prerequisite:** The mockup must have passed Agent 3b's Phase 5 review (all 12 questions answered) before this agent runs. Do not map incomplete mockups.

**Hard rule:** Every UI element documented on five dimensions: Data Type, Validation/Constraints, Business Rules/Source, PII Flag, Error Message. Financial fields always specify decimal precision. Dynamic dropdowns always flag a Master Data dependency.

**Output:** Feature Data Dictionary · Open Items Register · Dependency Flag List · Definition of Ready Verdict

---

## AGENT 7 — NFR Discovery Agent
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
        Output: discovery notes, verbatim quotes, goal statements per stakeholder.

PHASE 3 — SCOPE & UI DISCOVERY  ◄ TWO PASSES, ONE PHASE
  ├─► Agent 3a: Use Case Driven Discovery
  │     Convert elicitation notes → Fully Dressed Use Cases at Sea Level.
  │     Verify scope. Define Basic / Alternate / Exception flows.
  │     Output: approved UC set — the authoritative functional contract.
  │
  └─► Agent 3b: Prototyping & Mockup Standards  (ELICITATION PASS)
        Draw low-fidelity wireframes against the approved UC flows.
        Show to stakeholders — surface missing fields, wrong actors, scope gaps.
        Feed corrections back to Agent 3a before any story is written.
        Output: UC flow coverage map, list of new requirements, stakeholder validation.

        ↑ Phase 3 is the DOUBLE GATE: functional scope (UC) + visual scope (Prototype)
        ↑ No User Story is written until BOTH gates are GREEN.

PHASE 4 — REQUIREMENTS
  ├─► Agent 4: BRD Uncertainty Audit
  │     Are the business requirements build-ready? Score, rewrite, certify.
  │     Every BRD section must trace to an approved UC from Phase 3a.
  │
  └─► Agent 5: User Story Standards
        Write and certify sprint-ready stories.
        Every story must trace to: (1) an approved UC and (2) a validated prototype.

PHASE 5 — DATA SPECIFICATION
  ├─► Agent 3b: Prototyping & Mockup Standards  (SPECIFICATION PASS — re-run)
  │     Now that stories are approved, re-run at full 12-question depth.
  │     Certify every field, button, error message before the Data Mapper runs.
  │
  └─► Agent 6: Story, Mockup & Data Mapper
        Bridge approved story + 12-question-complete mockup → Feature Data Dictionary.
        Runs ONLY after Agent 3b's Phase 5 review returns GREEN.

PHASE 6 — ARCHITECTURE
  └─► Agent 7: NFR Discovery
        Define quality constraints. Resolve conflicts. Certify architecture readiness.
        Inputs: BRD, approved UC Special Requirements, stakeholder NFR interviews.
```

**Iteration rules:**
- Agents 1 and 2 may iterate — re-run when new stakeholders surface during interviews
- Agent 3a and 3b iterate with each other — a prototype may reveal UC gaps; update the UC, then re-validate the prototype
- Agent 3b runs twice: once lightly in Phase 3 (elicitation), once fully in Phase 5 (specification)
- Agents 3a, 3b, and 5 form a triangle — UC flows feed prototype; prototype corrections feed UC; both feed stories
- Agent 7 must complete before architecture begins; revisit when major UCs or NFR-impacting stories are added

---

## Cross-Agent Handoff Points

| From Agent | To Agent | Handoff Artifact |
|-----------|----------|-----------------|
| Agent 1: Stakeholder Discovery | Agent 2: Elicitation | Stakeholder Register + Interview Plan |
| Agent 1: Stakeholder Discovery | Agent 7: NFR Discovery | Stakeholder NFR interview questions + priority list |
| Agent 2: Elicitation | Agent 3a: Use Case Discovery | Discovery notes, verbatim quotes, goal statements per stakeholder |
| Agent 2: Elicitation (Reverse Eng.) | Agent 3a: Use Case Discovery | Black Box analysis → UC scope identification |
| Agent 3a: Use Case Discovery | Agent 3b: Prototyping | Approved UC flows → wireframe scope and flow coverage test |
| Agent 3b: Prototyping (Phase 3b) | Agent 3a: Use Case Discovery | Missing requirements found in prototype session → UC update |
| Agent 3b: Prototyping (Phase 3b) | Agent 5: User Story Standards | Validated prototype → confirms scope before story writing begins |
| Agent 3a: Use Case Discovery | Agent 4: BRD Audit | Approved UC set → BRD section per feature area |
| Agent 3a: Use Case Discovery | Agent 5: User Story Standards | Basic Flow → primary story; Alternate → variant AC; Exception → error-handling AC |
| Agent 3a: Use Case Discovery | Agent 7: NFR Discovery | UC-specific Special Requirements → NFR inputs |
| Agent 4: BRD Audit | Agent 5: User Story Standards | Certified requirements → sprint-ready stories |
| Agent 4: BRD Audit | Agent 7: NFR Discovery | Implied NFR phrases extracted from BRD language |
| Agent 5: User Story Standards | Agent 3b: Prototyping (Phase 5) | GREEN stories → trigger full 12-question mockup annotation |
| Agent 3b: Prototyping (Phase 5) | Agent 6: Data Mapper | GREEN annotated mockup → Feature Data Dictionary input |
| Agent 5: User Story Standards | Agent 6: Data Mapper | User story ACs → business rule extraction |
| Agent 6: Data Mapper | Development | Feature Data Dictionary → developer implementation |
| Agent 7: NFR Discovery | Architecture | NFR Specification + Architecture Implications Table |

---

## Common Invocation Patterns

**Pattern 1 — Greenfield project kickoff**
> "We're starting a new [system] project. Where do I begin?"
→ Agent 1 → Agent 2 → Agent 3a (Scope mode) → Agent 3b (elicitation pass)

**Pattern 2 — Feature scoping before sprint planning**
> "We need to scope out [feature] before we write stories."
→ Agent 3a (Write mode) → Agent 3b (low-fidelity prototype against UC) → Agent 5 (Derive from UC + prototype)

**Pattern 3 — UC review**
> "Review this use case and tell me if it's complete."
→ Agent 3a (Review mode) — RED/GREEN verdict + specific gaps

**Pattern 4 — Prototype review against UC**
> "Does this wireframe cover the use case properly?"
→ Agent 3b (Phase 3b, elicitation pass) — UC flow coverage map + missing requirements

**Pattern 5 — Pre-sprint requirements review**
> "Are these requirements ready to hand to the developers?"
→ Agent 4 (BRD Audit) + Agent 5 (User Story Standards) in parallel

**Pattern 6 — Mockup ready for data mapping?**
> "The developer is asking about the data model behind this screen."
→ Agent 3b (Phase 5, specification pass — certify 12 questions first) → Agent 6 (Data Mapper)

**Pattern 7 — Migration / replatform**
> "We need to replace our legacy [system]."
→ Agent 2 (Reverse Engineer) → Agent 3a (UCs from Black Box) → Agent 3b (prototype the target state) → Agent 4 (BRD Audit)

**Pattern 8 — Architecture planning**
> "The architects are asking for NFRs."
→ Agent 7 (extract from BRD and UC Special Requirements, interview stakeholders, resolve conflicts)

**Pattern 9 — Story that has no UC**
> "Write me a user story for [feature]."
→ Agent 3a (Write mode, establish the UC) → Agent 3b (validate with a quick wireframe) → Agent 5 (Derive stories from UC + prototype)

**Pattern 10 — Stakeholder conflict on scope**
> "Two stakeholders disagree about what [feature] should do."
→ Agent 1 (Disagreement Diagnostic) → Agent 3a (one UC per interpretation) → Agent 3b (prototype both — show stakeholders the difference visually)

**Pattern 11 — Full pipeline: scope to developer-ready**
> "Take this feature from scope to a data spec."
→ Agent 3a → Agent 3b (elicitation pass) → Agent 5 → Agent 3b (specification pass) → Agent 6

**Pattern 12 — Interview prep**
> "I have a 45-minute session with the VP of Operations tomorrow."
→ Agent 2 (Generate mode) — stakeholder = VP Operations, tier = Manager, goal = [what you need to learn]

---

## The Revised Lifecycle — Where Each Agent's Output Goes

```
ELICITATION     USE CASES          PROTOTYPE          USER STORIES       DATA DICT
─────────────────────────────────────────────────────────────────────────────────────
Agent 2      →  Agent 3a       →   Agent 3b        →  Agent 5        →   Agent 6
                                   (low-fi,                              (runs ONLY
                "What must the      stakeholder         "What does         after 3b
                system do?"         validation)         the sprint         Phase 5
                                   ↓                    deliver?"          certifies
                                   Finds gaps                             the mockup)
                                   ↓
                                   Back to 3a
                                   (UC updated)
                                   ↓
                                   Agent 3b again
                                   Phase 5 pass
                                   (full 12-Q audit)
─────────────────────────────────────────────────────────────────────────────────────
              ↑ SCOPE GATE ↑    ↑ VISUAL GATE ↑    ↑ STORY GATE ↑   ↑ DATA GATE ↑
              No story without  No story without    No data dict       No dev without
              an approved UC    a validated          without GREEN      complete dict
                                prototype            stories
```

---

## The Eight Hard Rules — Common Across All Agents

| Rule | Scope | Detail |
|------|-------|--------|
| No generic groups | Agents 1, 3a, 4, 5 | "Leadership/users/the business" → name individuals |
| Minimum quality threshold | All agents | 7/10 score (BRD), INVEST pass (stories), complete flows (UCs), 12-Q complete (mockups) |
| Basic Flow has no branching | Agent 3a | Every "if/else" → Alternate or Exception Flow |
| Every validation has an Exception | Agents 3a, 5 | No validation step without its failure scenario |
| Alternate ≠ Exception | Agent 3a | Different postcondition destinations — never confuse them |
| Prototype always links to a UC | Agent 3b | Any phase, any fidelity — no unlinked mockups |
| Every gap is a named open question | All agents | "Needs more detail" is never acceptable |
| Verdicts are binary | All agents | GREEN or RED. Hesitation = RED. |

---

## The Governing Cost Equation

| When uncertainty is resolved | Relative cost |
|------------------------------|--------------|
| Discovery / stakeholder interview | 1× |
| Use Case scoping — functional scope gate | 2× |
| Prototype elicitation pass — visual scope gate | 3× |
| BRD / requirements writing | 4× |
| Sprint planning / story refinement | 6× |
| Mid-sprint (developer hits ambiguity) | ~12× |
| Prototype specification pass / data dict | ~15× |
| QA (failed test cycle) | ~30× |
| Production (wrong output shipped) | ~100× |

**The Phase 3 double gate (UC + Prototype) at 2–3× is the cheapest place to catch both functional and visual scope errors.**
A missing field found during a stakeholder prototype review costs a five-minute conversation.
The same missing field found in QA costs a failed test cycle, a re-spec, and a clarification meeting.
Found in production — it costs a hotfix, a data correction, and a piece of your credibility.
