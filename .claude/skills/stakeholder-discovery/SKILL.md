---
name: stakeholder-discovery
description: >
  Apply this skill whenever identifying, mapping, assessing, interviewing, or documenting stakeholders
  for any project, BRD, or requirements effort. Triggers include: requests to identify stakeholders, 
  build a stakeholder map or register, assess stakeholder influence, plan discovery interviews, 
  determine who to involve in requirements, understand who decides what, prioritize who to talk to first, 
  or figure out why stakeholders disagree. Also triggers on phrases like "who should I talk to?", 
  "who are the stakeholders for this?", "do we have the right people in the room?", 
  "why do stakeholders keep disagreeing?", "who decides?", "we need better visibility", 
  or any scenario where a requirement is attributed to a generic group ("leadership", "the business", 
  "users") instead of named individuals. Use this before beginning any discovery session, interview plan, 
  or requirements workshop. Apply alongside brd-uncertainty-audit when reviewing an existing BRD.
---

# Stakeholder Discovery Skill

## Core Principle: Uncertainty Is Never Reduced "In General"

> "Uncertainty is never reduced 'in general.' It's reduced for a specific person who has to decide something."
> Rule 1.1 — Know Your Stakeholder

"The stakeholders" are not one voice. They are multiple people with distinct problems, distinct decisions to make, and distinct uncertainties to resolve. Treating them as one audience is the single most common cause of requirements that satisfy nobody.

**The BA's job:** Map who decides what — then aim each piece of analysis at the person who actually needs it.

---

## The Stakeholder Discovery Framework

### Phase 1 — Identify: Who Is in the System?

Start by listing everyone who touches, funds, approves, uses, or is affected by the system being built. Cast wide before narrowing.

**Discovery questions to ask:**
- Who commissioned this work? Who is paying for it?
- Who will use the system daily / weekly / occasionally?
- Who approves the work as "done"? Who signs off?
- Who will be affected if this fails?
- Who has blocked or paused similar work in the past?
- Who has data or systems this project depends on?
- Who is NOT in the room but should have a voice?

**Stakeholder categories (check all that apply per person):**

| Category | Description | Common Titles |
|----------|-------------|---------------|
| **Decision-Maker** | Final say on scope, priorities, go/no-go | CEO, VP, Product Owner, Sponsor |
| **Subject Matter Expert** | Owns the domain knowledge | Ops Lead, Finance Manager, Compliance Officer |
| **End User** | Uses the system to do their job | Field staff, Data Analyst, Customer |
| **Technical Gatekeeper** | Controls architecture, data, or infrastructure | IT Lead, DBA, Security Officer, Architect |
| **Affected Party** | Impacted by the change but not a user | Adjacent team, Downstream process owner |
| **Regulator / Auditor** | External compliance or governance requirement | Legal, External Auditor, Regulatory Body |

---

### Phase 2 — Map: Power, Interest, Uncertainty

For each identified stakeholder, assess three dimensions:

#### 2a — Power / Influence (High / Medium / Low)
Can this person stop the project, change its scope, or veto a decision?
- **High:** Project cannot proceed without their buy-in
- **Medium:** Can significantly delay or redirect if dissatisfied
- **Low:** Affected but not blocking

#### 2b — Interest / Stakes (High / Medium / Low)
How much does the outcome of this project affect their daily work or goals?
- **High:** Their job changes significantly because of this project
- **Medium:** Noticeable but not daily impact
- **Low:** Peripheral impact

#### 2c — Uncertainty They Hold (what they don't yet know)
This is the most important dimension for the BA. Identify the single biggest open question each stakeholder carries about this project.

> "This will help ______ decide ______."
> If you can't fill both blanks with a specific name and a specific decision — you haven't found the uncertainty yet.

---

### Phase 3 — The Stakeholder Register

Produce a register with one row per stakeholder. Update it throughout discovery.

```
| Name / Role | Category | Power | Interest | Top Uncertainty | Analysis Needed | Deliverable |
|-------------|----------|-------|----------|----------------|----------------|-------------|
```

**Example — Expense Reporting System:**

| Name / Role | Category | Power | Interest | Top Uncertainty | Analysis Needed | Deliverable |
|-------------|----------|-------|----------|----------------|----------------|-------------|
| CEO | Decision-Maker | High | Medium | "Will this save or cost money?" | Cost-benefit: manual vs. system | ROI showing 40% cost reduction |
| Finance Manager | SME + User | High | High | "Can we keep audit compliance?" | Compliance audit | Spec: audit trail, approval rules, retention |
| Employee (expense submitter) | End User | Low | High | "Will this be faster than today?" | Time study: current vs. proposed | 5-min → 2-min per expense |
| IT Lead | Technical Gatekeeper | Medium | Medium | "Can we integrate and secure it?" | Integration + security review | Integration diagram + auth approach |

---

### Phase 4 — Uncertainty Prioritization

Not all uncertainties are equal. Rank them by the damage caused if left unresolved.

**Prioritization criteria:**

| Criterion | Questions to Ask |
|-----------|-----------------|
| **Blocking potential** | Does unresolved uncertainty for this person stop the project from launching? |
| **Downstream cost** | If this uncertainty isn't resolved in week 1, how expensive is it in week 8? |
| **Reach** | Does this person's uncertainty affect the requirements for multiple other stakeholders? |
| **Decision dependency** | Is another decision waiting on this one? |

**Priority tiers:**

- 🔴 **Tier 1 — Resolve This Week:** High power + high uncertainty. Project scope or architecture will be wrong if this isn't resolved first.
- 🟡 **Tier 2 — Resolve Before Sprint Start:** Medium power or uncertainty that shapes a major feature area.
- 🟢 **Tier 3 — Resolve Before Build Completes:** Low power or peripheral uncertainty; important but not blocking.

**The rule:** Resolve Tier 1 before writing any requirements. Resolve Tier 2 before any sprint begins. Never leave a Tier 1 unresolved and assume it will work itself out.

---

### Phase 5 — The Disagreement Diagnostic

When stakeholders appear to agree but are actually using the same word for different things, apply the Disagreement Diagnostic.

**Warning signals:**
- Multiple stakeholders nod at a vague phrase ("better visibility", "smarter reporting", "more efficient process")
- Stakeholders stop using the phrase but describe very different things in the next sentence
- The same requirement satisfies two people but would require contradictory architectural choices

**Diagnostic question (ask each stakeholder separately):**
> "When you say [the agreed phrase], are you trying to [Option A] or [Option B]?"

**Example from The Dashboard Disaster:**
> "When you say 'better visibility into operations,' are you trying to **react to a problem today** — within the hour — or **review what happened last month** for the board?"
>
> COO: *"React today. If a shipment's slipping, I want to know within the hour."*
> CFO: *"Last month. It has to reconcile to the ledger for the board; I don't want live numbers that argue with the close."*

One phrase. Two completely different products. The diagnostic separated them in two conversations that took ten minutes.

**When to run the diagnostic:**
- Any time a requirement is attributed to "leadership," "the business," or "users" as a group
- Any time two stakeholders use the same word and you sense they mean different things
- Before committing to an architecture that only serves one interpretation

---

### Phase 6 — Interview Planning

For each Tier 1 and Tier 2 stakeholder, plan a focused uncertainty-reduction conversation.

**Interview structure (30–45 minutes per stakeholder):**

```
1. Open with their role (5 min)
   "Walk me through your day on [relevant process]. What does that look like today?"

2. Surface the pain, not the solution (10 min)
   "What's the most frustrating part of [current process]?"
   "When does it break down? What happens when it does?"
   "What decision are you making today without good information?"

3. Define success (10 min)
   "If this project goes perfectly, what does your day look like six months from now?"
   "How would you know it worked?"
   "What does 'better' mean to you — specifically?"

4. Test your hypotheses (10 min)
   Present your current understanding: "Here's what I think you need. Does this sound right?"
   Listen for corrections — corrections are the gold.

5. Clarity check (5 min)
   "On a scale of 0–10, how confident are you that we understand what you need?"
   "What's the one thing you're most worried we'll get wrong?"
```

**After the interview:**
- Record: what did they actually say (not your interpretation)?
- Record: what uncertainty was reduced, and by how much?
- Update the Stakeholder Register with any new uncertainties surfaced
- Flag any new disagreements between this stakeholder and others already interviewed

---

## The Stakeholder Audit Output

Produce this document after completing Phase 1–5. Update it throughout discovery.

### Section 1 — Stakeholder Inventory
Complete list of all identified stakeholders with category, power, interest.

### Section 2 — Stakeholder Register
Full table with top uncertainty, analysis needed, deliverable for each.

### Section 3 — Uncertainty Priority Ranking
Tier 1 / 2 / 3 with rationale for each tier assignment.

### Section 4 — Disagreements Log
Any identified cases where two or more stakeholders use the same language to mean different things.

```
| Phrase | Stakeholder A meaning | Stakeholder B meaning | Status |
|--------|-----------------------|----------------------|--------|
```

### Section 5 — Interview Plan
Who to interview, in what order, and the primary uncertainty each interview targets.

### Section 6 — Gaps and Unrepresented Voices
Who should be in the room but isn't? What perspective is missing?

---

## Red / Green Stakeholder Map Classification

- 🟢 **GREEN** — Stakeholder is identified, their top uncertainty is named, an analysis and deliverable to resolve it is planned, and they have been assigned a priority tier.
- 🔴 **RED** — Stakeholder is unnamed ("leadership", "the business", "users"), or top uncertainty is unidentified, or no analysis is planned to resolve it.

**Any generic group label ("leadership", "users") is automatically RED. Name the individuals.**

---

## Common Anti-Patterns to Reject

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| "Leadership needs better visibility." | "Leadership" is 2–5 people with different needs. No individual uncertainty named. | Name each leader. Interview separately. Run the Disagreement Diagnostic. |
| Interviewing only the loudest voice | Quiet stakeholders have the highest-impact unresolved uncertainties | Map every category; use the Register to identify gaps |
| Treating the sponsor as the only decision-maker | End users who reject the system at launch are also decision-makers | Include End User uncertainty as Tier 1 if adoption is a risk |
| Resolving the CEO's uncertainty but not the employee's | Approved and unused — the classic launch failure | Resolve all Tier 1 uncertainties before sprint start, regardless of seniority |
| Stakeholder list not updated after discovery interviews | New stakeholders surface mid-discovery; register gets stale | Treat the Register as a living document; update after every interview |
| Assuming agreement because nobody objected | Silence is not agreement; it's often unexpressed confusion | Use the clarity check (0–10 scale) at the end of every interview |

---

## The Clarity Check — Use This in Every Meeting

At the end of any requirements review, interview, or workshop:

> "On a scale of 0 to 10, how confident are you that we understand what you need?"

- **0–5:** Stop. More work required before proceeding.
- **6–7:** Identify the specific gaps keeping them from an 8 and close those gaps.
- **8–10:** Document the confidence level, who gave it, and the date. Proceed.

**If the number didn't move after your analysis — your work didn't land.** No matter how polished it was.

---

## Quick Discovery Checklist

Run this before beginning any requirements workshop or BRD drafting:

- [ ] Every stakeholder identified by name and role (no generic groups)?
- [ ] Power and interest assessed for each?
- [ ] Top uncertainty named for each stakeholder?
- [ ] Uncertainty Priority Tiers assigned (Tier 1 / 2 / 3)?
- [ ] Disagreements Diagnostic run on any shared vague phrases?
- [ ] Tier 1 uncertainties resolved before requirements writing begins?
- [ ] Clarity check (0–10) completed with each Tier 1 stakeholder?
- [ ] Gaps and unrepresented voices documented?
- [ ] Stakeholder Register designated as a living document with an owner?

**If any box is unchecked, discovery is not done.**

---

## Reference: The Two Questions That Prevent Dashboard Disasters

Before any requirement is written as a shared need for multiple stakeholders, ask these two questions separately of each person:

**Question 1 — The Decision Question:**
> "When you use [the thing we're building], what decision are you trying to make?"

**Question 2 — The Timing Question:**
> "When do you need that decision? Today, within the hour — or last month, for a report?"

Different answers = different products. Document the difference. Make the trade-off explicit. The conversation is always available in week one. Don't leave it to month six.
