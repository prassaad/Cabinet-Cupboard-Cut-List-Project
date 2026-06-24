---
name: elicitation-interviews-questionnaires
description: >
  Apply this skill whenever planning, designing, conducting, reviewing, or improving Requirements 
  Elicitation using Interviews, Questionnaires/Surveys, or Reverse Engineering techniques. 
  Triggers include: requests to design interview questions, build a stakeholder questionnaire, 
  create a discovery interview script, generate elicitation questions for a BRD, review or score 
  existing questions, perform black-box reverse engineering on an existing system, or plan a 
  requirements elicitation session. Also triggers on: "what questions should I ask?", 
  "help me prepare for my stakeholder interview", "generate a questionnaire for this project", 
  "reverse engineer this system", "I have an interview with the CEO/manager/user — what do I ask?", 
  "review my interview questions", "the stakeholder didn't tell me what I needed", 
  "how do I elicit requirements from a C-level?", or any scenario involving drawing out 
  information from people or existing systems. ALWAYS operate in Plan Mode when applying this skill — 
  use numbered steps, scored tables, and Before→After refinement. Never generate questions without 
  first confirming the discovery goal and stakeholder role.
---

# Elicitation — Interviews, Questionnaires & Reverse Engineering Skill

## Core Principle: Your Job Is to Be a Vacuum

> "The requirement that kills a project is the one nobody volunteers — and you'll miss it by talking."
> Listen More Than Talk

Elicitation is **drawing out** what is already in the stakeholder's head — not putting your ideas into it. Every technique in this skill exists to serve one goal: reduce uncertainty by extracting what the stakeholder knows but hasn't yet said. The BA who dominates the session hasn't elicited — they've broadcast assumptions and called it discovery.

**The 70/30 Stance:** ~70% listening, ~20% clarifying, ~10% suggesting. When in doubt, say less.

**The three instincts to resist:**
- The urge to impress → makes the conversation about you, not them
- Eagerness to help → premature solutions close doors before the real need surfaces
- Discomfort with silence → fills the space where the project-saving insight was forming

---

## PLAN MODE — ALWAYS OPERATE THIS WAY

**This skill runs in Plan Mode.** Every elicitation task follows numbered steps, produces scored tables, and outputs a polished deliverable before asking what to do next. Never generate questions without completing Step 1 (Goal & Stakeholder Confirmation) first.

**Available Modes within Plan Mode:**

| Mode | When to Use |
|------|-------------|
| **Generate** | Design a new question set from a discovery goal |
| **Review** | Critically score and improve an existing question set |
| **Script** | Build a full interview script with opening, flow, probes, and close |
| **Reverse Engineer** | Extract implemented requirements from an existing system (Black Box) |
| **Simulate** | Role-play stakeholder answers to test question quality |

---

## THE LAYERED QUESTION METHODOLOGY

All elicitation questions sit in one of four layers. Questions must be sequenced from surface to depth — never start at Features when you haven't established Exploration.

```
Layer 1 — EXPLORE    → What exists today? What hurts? What's the reality?
Layer 2 — CONTEXT    → Why does it work this way? Who's involved? What shapes the environment?
Layer 3 — PROCESS    → How exactly does it work? Walk me through it step by step.
Layer 4 — IDEA/FUTURE → What would better look like? What's missing? (User Stories / Mockup level)
```

**Layer sequencing rule:** Never advance to the next layer until the current one is clear. A stakeholder who jumps to Layer 4 without having answered Layer 1 is giving you a wish, not a requirement.

**Default question distribution for a 10-question set:**

| Layer | Default | When to Increase |
|-------|---------|-----------------|
| Explore | 3 | New domain, no prior context, first session |
| Context | 2 | Multi-stakeholder alignment needed, political complexity |
| Process / System | 3 | Migration, replatform, operational systems |
| Idea / Future State | 2 | Greenfield product, innovation, design-level discovery |

Users can override: *"4 Explore, 3 Context, 2 Process, 1 Idea"* — adjust accordingly.

---

## STAKEHOLDER-APPROPRIATE QUESTIONING

**The same question asked to the wrong person wastes both their time and yours.** Match question layer and vocabulary to the stakeholder tier.

### Tier 1 — C-Level / Executive Sponsor
**Goal:** Understand strategic intent, business case, success definition, constraints, and risk appetite.
**Layer focus:** Explore (Why does this matter?) + Context (What shapes the environment?)
**Vocabulary:** Business outcomes, ROI, risk, competitive position, strategic goals
**Avoid:** Process details, UI preferences, system specifics — they don't own those

**Signature questions for C-Level:**
- "What business outcome are you hoping this project changes in the next 12 months?"
- "What does failure look like? What would make you say this was a waste of investment?"
- "What's the one thing competitors do that we currently can't — and does this solve that?"
- "What decisions are you making today without good information — and what would change if you had it?"
- "If this project lands perfectly, what does your dashboard look like six months from now?"

---

### Tier 2 — Managers / Department Heads / Process Owners
**Goal:** Understand operational reality, process ownership, team constraints, and cross-functional dependencies.
**Layer focus:** Context (How is this area structured?) + Process (How does it actually work?)
**Vocabulary:** Workflows, team structure, KPIs, reporting lines, exceptions, handoffs
**Avoid:** Strategic justification (CEO's territory), granular UI (user's territory)

**Signature questions for Managers:**
- "Walk me through the process your team owns — from the trigger that starts it to the output that closes it."
- "Where does this process break down most often — what's the exception that causes the most rework?"
- "How does your team currently hand off to [upstream/downstream team], and where does that go wrong?"
- "What workarounds has your team built because the current system doesn't do what you need?"
- "What would you want your team to be able to do that they can't do today?"
- "When month-end / quarter-end / [peak period] hits — what does your process look like then?"

---

### Tier 3 — End Users / Frontline / Subject Matter Experts
**Goal:** Understand the actual workflow as performed (not as designed), pain points, workarounds, and what "easy" means in practice.
**Layer focus:** Process (Step-by-step, what do you actually do?) + Idea (What would make this better?)
**Vocabulary:** Tasks, screens, clicks, daily experience, frustrations, workarounds
**Avoid:** Strategic questions, org chart discussions — these drain the conversation

**Signature questions for End Users:**
- "Walk me through the last time you did [task] — what did you click, what did you enter, what happened?"
- "What's the most annoying part of your day that this system causes?"
- "What do you do when the system doesn't let you do something you need to do?"
- "How long does [task] take you today? What would be a good time?"
- "What's the first thing you'd change if you could change anything about this?"
- "Is there anything you do in Excel or another tool because the system can't do it?"
- "Show me — can you walk me through it right now?" (observation trigger)

---

## THE FIVE ELICITATION RULES (Applied in Every Technique)

**Rule 1 — Open Before Closed**
Lead every session with open questions (can't be answered yes/no). Close only late, to confirm understanding.
- ❌ "Do you use mobile often?" → closed, confirms your assumption
- ✅ "Walk me through your typical day — when do you reach for mobile versus desktop?" → open, reveals theirs

**Rule 2 — Follow the Silence**
Count to ten after asking a real question. The insight arrives after the pause, not before it. The rehearsed answer is always the fast one; the true answer takes time to form.

**Rule 3 — Document Verbatim First, Interpret Later**
Capture their exact words during the session. "It usually syncs overnight, I think" is not the same requirement as "it syncs overnight." The hedge *is* the requirement. Paraphrase deletes nuance; verbatim preserves it.

**Rule 4 — One Source Is Not Enough**
Triangulate across at least three perspectives: the manager (how it's designed), the user (how it actually runs), and support (how it fails). When three independent sources converge — that's a requirement. When only one does — that's a viewpoint to verify.

**Rule 5 — Divergence Is Data**
When stakeholders use the same word to mean different things ("easy integration," "better visibility"), surface the conflict. Don't average it away. The divergence is the shape of the real requirement trying to show itself.

---

## TECHNIQUE 1 — STAKEHOLDER INTERVIEW

**When to use:** Deep discovery with a single stakeholder or small group. Best for uncovering hidden requirements, validating hypotheses, and building trust.

**Format:** One-on-one preferred. 30–60 minutes. Structured but conversational.

### The 3-Step Interview Process

#### STEP 1 — PREPARE
```
□ Who are you interviewing? (Name, role, tier)
□ What is the goal for this session? (One sentence: "This session will help [person] decide [what].")
□ What uncertainty am I trying to reduce? (Name the specific gap)
□ Question set prepared? (Layer-balanced, stakeholder-appropriate)
□ Two types of questions ready:
  - Engaging Questions: open dialogue starters ("Walk me through...")
  - Probing Questions: depth-drills ("Tell me more about that. What happens next? Why?")
□ Recording consent or note-taker arranged
```

#### STEP 2 — CONDUCT
```
1. Build rapport first (2–3 min): Thank them. State the purpose in one sentence.
   "I'm here to understand [your process / your needs / your challenges] — not to present solutions yet."

2. Open with an Engaging Question (Layer 1 — Explore)
   Never start with a closed question. Never start with a solution.

3. Ask, then get out of the way.
   Ask → Pause (count to 10) → Listen → Note verbatim key phrases.

4. Probe when something matters:
   "Tell me more about that."
   "What happens next?"
   "Say more about why that's frustrating."
   "Hmm — go on."
   "What does that look like in practice?"
   "When you say [their word], what do you mean exactly?"

5. Limit note-taking during the session: capture Reminder Key Bullet Points only.
   Full notes immediately after — never during, unless recording.

6. Close: Summarise the 3 key things you heard. Ask: 
   "On a scale of 0–10, how confident are you I understood what you need?"
   "What's the one thing you're most worried I'll get wrong?"
```

#### STEP 3 — FOLLOW UP
```
□ Confirm Key Points in writing within 24 hours (do NOT send comprehensive notes to review)
□ Highlight 2–3 key things you heard, not a transcript
□ Flag any open questions you still carry
□ Create a Visual Model of what you heard (process flow, mind map, or stakeholder map)
□ Update the Stakeholder Register with new uncertainties surfaced
□ Note divergences from other stakeholders' accounts
```

---

## TECHNIQUE 2 — QUESTIONNAIRE / SURVEY

**When to use:** Large stakeholder groups (10+), geographically dispersed, broad baseline data collection, or when direct interviews are not feasible. Best combined with follow-up interviews for ambiguous answers.

**Four Questionnaire Types (match to your discovery goal):**

| Type | Level | Purpose | Example Analytical Tools |
|------|-------|---------|--------------------------|
| **Exploratory** | High — Sector/Industry | Investigate little-known areas of a domain | PEST, SWOT, market scan |
| **Contextual** | High — Within the Firm | Describe the current state (As-Is) | GAP Analysis, RCA, SWOT, PESTLE, RISK |
| **Descriptive** | Mid — People & Process | Describe how work actually happens | Process flows, role mapping, 5W1H |
| **Generative** | Low — Design & Solution | Brainstorm features, improvements, future state | User Stories, Mockups, Ideation |

**Design rules for questionnaires:**
- Open-ended questions first (qualitative, free text) — they reveal what you didn't know to ask
- Closed questions last (quantitative, yes/no, rating scales) — they confirm what you learned
- Never more than 15 questions; under 10 is better
- Each question targets one thing only — no compound "and" questions
- Test with one person before distributing; ambiguous questions surface immediately

**Strengths and Limitations:**

| Strengths | Limitations |
|-----------|-------------|
| Reaches many stakeholders quickly | Response rate may be low |
| Low cost to administer | Ambiguous questions go unanswered |
| Effective across geographies | Open-ended answers need follow-up analysis |
| Structured, comparable responses | Cannot probe deeper in real time |

---

## TECHNIQUE 3 — BLACK BOX REVERSE ENGINEERING

**When to use:** Migrating, replacing, or extending an existing system. No source code access. Requirements must be extracted from what the system *does*, not how it's built.

**Core principle:** Study the application exclusively from the outside — observable behavior, user interfaces, inputs/outputs, workflows, and documentation. Do NOT speculate about internal code, database schema, or architecture unless clearly inferable from external behavior.

### Black Box Analysis Framework

For each feature or module observed, document:

```
Feature / Module Name:
─────────────────────────────────────────────────────
Observed Functionality:
  What does the system do from the user's perspective?

User Roles & Permissions:
  Who can do what? What is hidden/restricted by role?

Core Entities & Data Flows:
  What are the key objects? How do they move through the system?

Complete User Workflows:
  Step-by-step: Precondition → Trigger → Steps → Output → Postcondition

Business Rules & Validation Constraints:
  What rules does the system enforce? (inferred from behavior)
  Example: "Approvals require two signatures if value > $10,000"

Inputs & Outputs:
  Screens, forms, reports, exports, APIs, files visible externally

Edge Cases & Error Handling:
  What happens with invalid data? Empty states? Exceeded limits?

Non-Functional Observations:
  Performance hints, security indicators, usability issues visible externally

Ambiguities & Gaps:
  [CLARIFICATION NEEDED] — flag every assumption, gap, or unknown
```

### After Analyzing All Features, Produce:

1. **System Scope Summary** — overall capability map inferred from external observation
2. **Gap Analysis** — what the current system does NOT do (for migration / new build target)
3. **Prioritized SME Clarification Questions** — ranked by impact on scope
4. **Action Items (MOM format)**:

```
| Next Step | Owner | Due Date | Notes |
|-----------|-------|----------|-------|
```

---

## PLAN MODE WORKFLOW — STEP BY STEP

**Run this sequence for every elicitation task. Do not skip steps.**

---

### PLAN STEP 1 — Goal & Context Confirmation

Before writing a single question:
- Rephrase the discovery goal in your own words (ensures alignment)
- Identify: stakeholder tier (C-Level / Manager / End User), domain, and session type
- Name the specific uncertainty this session is trying to reduce
- Confirm the mode: Generate / Review / Script / Reverse Engineer / Simulate
- Confirm or override the default layer distribution

> "This session will help **[stakeholder name/role]** decide/understand **[specific thing]**."
> If you cannot complete that sentence — stop and find out before designing questions.

---

### PLAN STEP 2 — Layered Question Generation or Review

**If Generate Mode:**
Produce questions per the confirmed layer distribution. Apply stakeholder-tier vocabulary.

**If Review Mode:**
For each existing question, assign:
- Primary Layer: Explore / Context / Process / Idea
- Stakeholder fit: C-Level / Manager / End User / Any

---

### PLAN STEP 3 — Scoring Table

For all questions (generated or reviewed), produce this table:

```
| # | Layer | Question | Open/Closed (5=Open) | Neutral/Leading (5=Neutral) | Assumption-free (5=Free) | Stakeholder Fit | Justification |
```

**Scoring scale (1–5, 5 = best):**
- **Open vs Closed:** 5 = cannot be answered yes/no; 1 = yes/no only
- **Neutral vs Leading:** 5 = no embedded assumption or desired answer; 1 = leads to one answer
- **Assumption-free:** 5 = surfaces their reality; 1 = assumes your hypothesis is correct

**Minimum acceptable score per question: 4/5/4. Any question scoring 3 or below on any axis must be rewritten.**

---

### PLAN STEP 4 — Refinement Plan

- Identify the three weakest questions (lowest combined score)
- Produce Before → After improvements with one-line reasoning
- Check layer balance: flag if any layer has 0 questions or >50% of the set
- Recommend the final interview sequence (Explore → Context → Process → Idea)
- Present the polished final question set

---

### PLAN STEP 5 — Next Actions

- Rate the overall questionnaire for elicitation effectiveness (1–10) with justification
- State what uncertainty this question set will reduce, and for which stakeholder tier
- Offer the next move:
  - "Switch to Review mode with these questions"
  - "Build a full interview script with opening, probes, and close"
  - "Simulate stakeholder answers to test question quality"
  - "Generate a follow-up probing question set for Layer 3"
  - "Add a Reverse Engineering session for the existing system"
  - "Create a divergence diagnostic for conflicting stakeholder answers"

---

## QUESTION SCORING — CALIBRATION EXAMPLES

| Question | Open | Neutral | Assumption-free | Verdict |
|----------|------|---------|----------------|---------|
| "Do you use mobile often?" | 1 | 3 | 2 | ❌ Rewrite |
| "Is the current system slow?" | 1 | 2 | 1 | ❌ Rewrite |
| "You'd want a dashboard, right?" | 2 | 1 | 1 | ❌ Rewrite |
| "Walk me through your typical day." | 5 | 5 | 5 | ✅ Keep |
| "What happens when [process] breaks down?" | 5 | 5 | 4 | ✅ Keep |
| "What would make this better for you?" | 5 | 5 | 5 | ✅ Keep |
| "How long does this take, and what makes it take that long?" | 4 | 5 | 5 | ✅ Keep |

**Rewrite pattern — three moves that fix most weak questions:**
1. Replace "Do you / Is it / Can you" openers → replace with "Walk me through / Tell me about / Describe"
2. Remove embedded solutions ("a dashboard", "a notification", "a report") → ask about the need, not the solution
3. Remove leading adjectives ("slow", "better", "easy") → let them supply the evaluation

---

## DIVERGENCE DIAGNOSTIC

When two or more stakeholders use the same word differently — run this before any requirement is written:

**Step 1:** Identify the phrase where everyone nodded: "easy integration", "better visibility", "faster processing"

**Step 2:** Ask each stakeholder separately:
> "When you say [phrase], are you trying to [interpretation A] or [interpretation B]?"

**Step 3:** Map the answers:

```
| Stakeholder | Their definition of "[phrase]" | Layer | Implication |
|-------------|-------------------------------|-------|-------------|
| COO         | "React within the hour"        | Process | Real-time architecture |
| CFO         | "Month-end reconciled report"  | Context | Batch, audited data |
| IT Lead     | "Demoable in 5 minutes"        | Idea   | Self-service connector |
```

**Step 4:** Name the conflict explicitly in the requirements. Do not average it. Do not pick the loudest voice.

> "I heard [A] from [role] and [B] from [role]. Are these two different needs, or the same need seen from two angles?"

---

## COMMON ANTI-PATTERNS TO REJECT

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Starting with a solution ("Would you want a dashboard?") | Anchors the stakeholder on your hypothesis before you've heard their reality | Start with "What decision are you trying to make?" |
| Filling silences | Gives you the rehearsed answer, not the real one | Count to 10; the insight arrives after the pause |
| Paraphrasing during the interview | Replaces their meaning with your interpretation | Capture verbatim; interpret later |
| One interview = one requirement | You've captured one person's opinion, not a validated need | Triangulate: user, manager, support |
| Comfortable agreement on a vague word | "Easy integration" hid three irreconcilable architectures | Run the Divergence Diagnostic on any vague phrase everyone agreed on |
| All questions at one layer | Either too abstract (C-level questions to a user) or too granular (UI questions to a CEO) | Match layer to stakeholder tier |
| Sending comprehensive notes for review | Stakeholders won't read them; they'll confirm anything to be polite | Send 3 key bullets and ask: "Does this capture what you meant?" |
| Reverse engineering without [CLARIFICATION NEEDED] tags | Assumptions pass as facts into the spec | Flag every inference; SME review every tag before writing requirements |

---

## QUICK ELICITATION CHECKLIST

Before any session:
- [ ] Discovery goal named in one sentence with stakeholder + decision?
- [ ] Stakeholder tier identified (C-Level / Manager / End User)?
- [ ] Layer distribution set (Explore / Context / Process / Idea)?
- [ ] Question set scored ≥ 4/5/4 on all three axes?
- [ ] Two Engaging Questions and at least three Probing follow-ups prepared?
- [ ] Verbatim capture method arranged (recording consent or note-taker)?
- [ ] Divergence Diagnostic ready for any vague agreed phrase?

After the session:
- [ ] Key bullet summary sent within 24 hours (not a transcript)?
- [ ] Visual model created (process map, mind map, or flow)?
- [ ] Stakeholder register updated with new uncertainties?
- [ ] Divergences from other sessions flagged?
- [ ] Clarity check score recorded (0–10)?

**If any pre-session box is unchecked — do not start the interview.**
