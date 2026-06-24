---
name: nfr-discovery
description: >
  Apply this skill whenever defining, extracting, reviewing, or improving Non-Functional Requirements (NFRs)
  for any project, BRD, or architecture effort. Triggers include: requests to define NFRs, quality 
  attributes, system constraints, "-ilities", architecture characteristics, or non-functional specs; 
  questions about performance targets, uptime SLAs, security requirements, scalability limits, 
  data retention, compliance, cost budgets, or observability; reviewing a BRD or PRD that is missing 
  quality constraints; or any time a developer or architect asks "what are the non-functional requirements 
  for this?". Also triggers on phrases like "how fast should it be?", "what's the uptime target?", 
  "who can access what?", "can it handle the load?", "what does good look like?", 
  "define the quality attributes", or "what are the ilities for this system?". 
  Apply after brd-uncertainty-audit and stakeholder-discovery have been run — NFRs are derived from 
  business requirements and stakeholder priorities, not invented in isolation.
---

# NFR Discovery Skill

## Core Principle: Constraints Determine Architecture

> "Most developers skip non-functional requirements and pay for them later during production incidents."

NFRs are not documentation polish. They are the constraints that determine which architectures are possible and which aren't. A system that meets every functional requirement but violates its NFRs — too slow, down during peak hours, breached by an attacker, too expensive to run — has failed. NFRs must be **specific, measurable, and traceable to a business reason.** Vague NFRs are not NFRs — they are future production incidents in disguise.

**Authority:** This skill applies the full taxonomy of system quality attributes as defined by IEEE/ISO and documented at [Wikipedia — List of System Quality Attributes](https://en.wikipedia.org/wiki/List_of_system_quality_attributes), filtered to those architecturally significant for software systems.

---

## The NFR Discovery Workflow

Run all five phases in sequence. Do not write NFR targets before completing Phases 1 and 2.

---

### Phase 1 — Extract From Existing BRD/PRD

Before inventing any NFR, scan the business requirements document for **implied quality constraints**. Business language hides NFRs constantly.

**Extraction patterns — translate these phrases immediately:**

| Business Language Found | NFR Type | Question to Ask |
|------------------------|----------|-----------------|
| "needs to be fast" | Performance | Fast for whom? Under what load? p50/p95/p99 target? |
| "always available" | Availability | What's the acceptable downtime per month? 99.9% or 99.99%? |
| "handles our growth" | Scalability | What is today's volume? What's the 12-month projection? Peak scenario? |
| "secure" / "compliant" | Security / Compliance | Which regulation? GDPR, SOC2, HIPAA, PCI-DSS? What data is in scope? |
| "easy to maintain" | Maintainability | What does "easy" mean operationally? Deploy frequency? Change lead time? |
| "won't lose data" | Durability / Reliability | What's the acceptable RPO (Recovery Point Objective)? RTO? |
| "support future needs" | Extensibility / Evolvability | What future features are anticipated? What must not be locked out? |
| "affordable to run" | Cost / Affordability | Monthly infrastructure budget cap? Cost per transaction ceiling? |
| "know when it breaks" | Observability | What must be logged, traced, alerted? SLA on incident detection? |

**Deliverable from Phase 1:** A list of implicit NFRs found in the BRD, with the source quote and the quality attribute it maps to.

---

### Phase 2 — Stakeholder NFR Interview

NFRs must be anchored to the person who will be harmed if they're violated. Run targeted questions per stakeholder type before setting targets.

**Questions by stakeholder role:**

| Role | Key NFR Questions |
|------|------------------|
| **Executive / Sponsor** | What does a bad day look like — is it the system being slow, down, or wrong? What's the business cost of one hour of downtime? Are there regulatory penalties we must avoid? What's the infrastructure budget ceiling? |
| **Operations Lead** | How many users are on the system simultaneously at peak? When is peak — time of day, month-end, campaign launch? What's the longest acceptable response time before a user calls the helpdesk? |
| **Security / Compliance Officer** | Which regulations apply (GDPR, HIPAA, SOC2, PCI-DSS, ISO27001)? What data classifications are in scope? Who must NOT have access to what? What's the audit trail requirement? |
| **IT / Infrastructure** | What's the deployment environment (cloud, on-prem, hybrid)? What's the preferred cloud provider? What's the DR/failover expectation? What monitoring tools are already in place? |
| **Developer / Architect** | What's the expected change frequency? What must be easy to swap out later? What integration points introduce latency? What's the test coverage expectation? |
| **End User** | At what point does slowness make the tool unusable for your job? Do you use this on mobile, low-bandwidth, or offline scenarios? |

**Deliverable from Phase 2:** A stakeholder-anchored NFR priority list — which quality attributes matter most, to whom, and what the cost of failure is for each.

---

### Phase 3 — Define NFRs Across the Full Taxonomy

Use the taxonomy below to ensure no critical quality attribute is omitted. For each relevant attribute: state the target, the measurement method, and the business justification.

**NFR Statement template:**
```
Attribute:     [Quality attribute name]
Target:        [Specific, measurable value]
Measurement:   [How this will be tested or monitored]
Justification: [Business reason — what fails if this target is missed]
Tier:          [Tier 1 Critical / Tier 2 Important / Tier 3 Nice-to-Have]
```

---

#### TIER 1 — CRITICAL ARCHITECTURE DRIVERS
*These directly determine which architectures are viable. Define all that apply before any architecture decision.*

---

**1. Availability**
Will the system be up when users need it?

| Sub-attribute | Define This |
|---------------|-------------|
| Uptime SLA | 99.9% (8.7h downtime/yr) · 99.95% · 99.99% (52m/yr) · 99.999% (5m/yr) |
| Planned maintenance window | When can updates be deployed without breaching SLA? |
| Geographic availability | Single region or multi-region failover? |

*Measurable example:*
> "System must be available 99.9% of the time measured monthly, excluding a pre-announced maintenance window of max 2 hours on the first Sunday of each month between 02:00–04:00 UTC."

---

**2. Performance**
How fast does it respond under real load?

| Sub-attribute | Define This |
|---------------|-------------|
| API response time | p50 / p95 / p99 latency targets under normal and peak load |
| Page load time | Time to interactive (TTI), Largest Contentful Paint (LCP) |
| Batch processing time | Max acceptable duration for scheduled jobs |
| Throughput | Minimum transactions per second (TPS) the system must sustain |

*Measurable example:*
> "API endpoints must respond in ≤200ms at p50, ≤500ms at p95, and ≤1,500ms at p99, measured under a load of 500 concurrent users. Page load time (TTI) must be ≤3 seconds on a 4G mobile connection."

---

**3. Scalability**
Can it handle growth without a rewrite?

| Sub-attribute | Define This |
|---------------|-------------|
| Concurrent users | Current baseline + 12-month projected peak |
| Data growth rate | GB/month added; total volume at 3 years |
| Peak load scenario | Black Friday, month-end close, campaign launch — describe the shape |
| Elasticity | Must it auto-scale, or is manual scaling acceptable? |

*Measurable example:*
> "System must handle 1,000 concurrent users at launch, scaling to 10,000 within 18 months without architectural change. Database volume expected to grow at 50GB/month. Must sustain 3× normal load for up to 4 hours during month-end processing."

---

**4. Security**
Who can access what, and how is data protected?

| Sub-attribute | Define This |
|---------------|-------------|
| Authentication | SSO, MFA, OAuth2, SAML, API keys — which and for whom? |
| Authorization | RBAC, ABAC, row-level security — what model? What roles exist? |
| Data encryption | At rest (AES-256), in transit (TLS 1.2+), key management |
| Confidentiality | What data is classified? PII, PHI, financial, trade secret? |
| Audit trail | What actions must be logged? Retention period? Tamper-proof? |
| Compliance | GDPR, HIPAA, SOC2, PCI-DSS, ISO 27001, CCPA — which apply? |
| Vulnerability management | Penetration testing cadence, SAST/DAST in CI, CVE patch SLA |

*Measurable example:*
> "All PII must be encrypted at rest (AES-256) and in transit (TLS 1.3). Access requires MFA for all admin roles. RBAC with four roles (Admin, Manager, Analyst, Read-Only). All data access events logged with 7-year retention. GDPR compliant: data subject requests fulfilled within 72 hours."

---

**5. Reliability**
Does it recover gracefully when things go wrong?

| Sub-attribute | Define This |
|---------------|-------------|
| Recovery Time Objective (RTO) | Max acceptable time to restore service after failure |
| Recovery Point Objective (RPO) | Max acceptable data loss measured in time |
| Fault tolerance | Does the system degrade gracefully or fail hard? |
| Recoverability | Automated failover, manual runbook, or both? |
| Durability | Backup frequency, backup retention, restore test cadence |

*Measurable example:*
> "RTO: service restored within 1 hour of any major incident. RPO: maximum 15 minutes of data loss. Automated failover to standby replica within 5 minutes of primary failure. Daily backups retained for 90 days; monthly backups for 7 years."

---

**6. Maintainability**
How easy is it to change or extend?

| Sub-attribute | Define This |
|---------------|-------------|
| Modifiability | Can a single feature be changed without cascading breakage? |
| Deployability | How frequently can new releases be deployed? Blue/green? Canary? |
| Testability | Code coverage target; unit/integration/E2E split |
| Debuggability | Structured logging, distributed tracing, error correlation IDs? |
| Upgradability | Dependency update policy; major version upgrade window |

*Measurable example:*
> "Deployments must be achievable with zero downtime using blue/green strategy. Minimum 80% unit test code coverage enforced in CI. All errors include a correlation ID traceable across services. Dependency updates reviewed monthly; critical CVEs patched within 5 business days."

---

**7. Observability**
Can you see what the system is doing in production?

| Sub-attribute | Define This |
|---------------|-------------|
| Logging | Structured logs (JSON); minimum log level; retention period |
| Metrics | Which business and technical metrics must be dashboarded? |
| Tracing | Distributed trace coverage across which services? |
| Alerting | What conditions trigger a page? Who is on-call? What's the SLA? |
| Incident detection | Max time from failure to alert firing |

*Measurable example:*
> "All services emit structured JSON logs with correlation IDs, retained for 90 days. Dashboards cover: error rate, p95 latency, active users, and queue depth. Alerts fire within 2 minutes of error rate exceeding 1% over a 5-minute window. On-call rotation acknowledged within 15 minutes."

---

**8. Cost / Affordability**
How much will it cost to run at scale?

| Sub-attribute | Define This |
|---------------|-------------|
| Infrastructure budget | Monthly ceiling at launch and at 12-month projected scale |
| Cost per transaction | Acceptable unit economics at scale |
| Cloud provider constraints | Provider preference, region restrictions, existing commitments |
| Hosting model | Cloud-native, self-hosted, hybrid — and who operates it? |
| Cost scaling behavior | Should cost scale linearly with users, or step-function? |

*Measurable example:*
> "Infrastructure cost must not exceed $8,000/month at launch (1,000 users) and $35,000/month at projected scale (10,000 users). Cost per transaction ceiling: $0.004. Hosted on AWS (existing EDP agreement). No egress-heavy architectures without CFO approval."

---

#### TIER 2 — IMPORTANT QUALITY ATTRIBUTES
*Define these after Tier 1. They significantly affect user experience and operational quality.*

---

**9. Usability**
| Attribute | Measurable Target Examples |
|-----------|---------------------------|
| Learnability | New user completes primary task without training within 10 minutes |
| Accessibility | WCAG 2.1 AA compliance; screen-reader tested |
| Responsiveness | UI adapts correctly from 320px (mobile) to 2560px (4K) |
| Intuitiveness | Task completion rate ≥85% without help documentation in usability test |

---

**10. Interoperability**
| Attribute | Measurable Target Examples |
|-----------|---------------------------|
| API standards | REST/GraphQL with OpenAPI 3.0 spec published; versioned |
| Data formats | JSON + CSV export; ISO 8601 dates; UTF-8 encoding |
| Integration points | List each upstream/downstream system and the contract type |
| Standards compliance | Which industry standards must be supported (HL7, SWIFT, EDI, etc.)? |

---

**11. Portability**
| Attribute | Measurable Target Examples |
|-----------|---------------------------|
| Environment portability | Must run in dev / staging / prod with config-only change |
| Cloud portability | Locked to one cloud provider or portable? |
| Data portability | User can export all their data in standard format on request |

---

**12. Extensibility / Evolvability**
| Attribute | Measurable Target Examples |
|-----------|---------------------------|
| Plugin / extension model | New integrations added without core code changes |
| API versioning | Breaking changes require minimum 6-month deprecation notice |
| Feature flag support | New features deployable behind flags; rollback within 5 minutes |

---

**13. Compliance & Auditability**
| Attribute | Measurable Target Examples |
|-----------|---------------------------|
| Regulatory compliance | Name each regulation; state the specific controls required |
| Audit trail completeness | All CREATE/UPDATE/DELETE events logged with actor, timestamp, before/after state |
| Data retention | Retention schedule per data classification; automated purge policy |
| Right to erasure | PII deletion within 30 days of request; cascades to all copies |

---

**14. Resilience / Fault Tolerance**
| Attribute | Measurable Target Examples |
|-----------|---------------------------|
| Degraded mode | System remains partially usable when a dependency fails |
| Circuit breaker | Downstream failures isolated within 500ms; fallback response defined |
| Retry behavior | Idempotent retries with exponential backoff; max 3 retries |
| Data integrity | No partial writes; transactions atomic even under failure |

---

#### TIER 3 — CONTEXT-DEPENDENT ATTRIBUTES
*Assess whether these are relevant. Define only if they are architecturally significant for this system.*

| Attribute | When It Matters | Example Target |
|-----------|----------------|----------------|
| **Localizability** | Multi-language, multi-currency, multi-timezone | All user-facing strings externalized; timezone stored as UTC; locale-aware formatting |
| **Mobility / Offline** | Field workers, low-connectivity environments | Core workflows function offline; sync on reconnect within 60 seconds |
| **Configurability** | Multi-tenant or heavily customized deployments | Tenant-level config without code deployment |
| **Autonomy** | Background processing, scheduled jobs | Jobs self-recover after failure without manual intervention |
| **Traceability** | Regulated industries, audit-heavy processes | Every data element traceable to its source and transformation history |
| **Sustainability** | ESG-conscious organizations | Infrastructure carbon footprint reported; right-sized compute provisioning |
| **Safety** | Physical systems, medical, industrial | Failure must not result in physical harm; fail-safe defaults defined |
| **Anonymizability** | Privacy-sensitive data processing | PII anonymized for analytics pipelines; re-identification prevented by design |

---

### Phase 4 — NFR Conflict Resolution

NFRs frequently conflict. Identify and resolve conflicts **before** architecture decisions are made.

**Common conflicts — resolve explicitly:**

| Conflict | Trade-off Question |
|----------|--------------------|
| Availability vs. Cost | 99.99% uptime requires multi-region redundancy. Is the cost justified for this system? |
| Performance vs. Security | Full encryption and audit logging add latency. Is the p99 target still achievable with security controls on? |
| Scalability vs. Cost | Auto-scaling handles peaks but costs more. What's the budget ceiling at 3× normal load? |
| Maintainability vs. Delivery Speed | Clean architecture and full test coverage take longer. What's the non-negotiable minimum coverage? |
| Data Durability vs. Performance | Synchronous replication protects data but increases write latency. Which is the priority under conflict? |
| Portability vs. Cloud-native Features | Using proprietary cloud features reduces portability. Is lock-in acceptable for this system's lifetime? |

**Resolution format:**
```
Conflict: [Attribute A] vs. [Attribute B]
Decision: Prioritize [A / B] because [business reason]
Accepted trade-off: [What we're giving up and why it's acceptable]
Decided by: [Name / Role]
Date: [Date]
```

---

### Phase 5 — NFR Output Document

Produce a structured NFR specification with these sections:

#### Section 1 — NFR Summary Table
```
| # | Attribute | Target | Measurement Method | Tier | Justification |
|---|-----------|--------|--------------------|------|---------------|
```

#### Section 2 — Tier 1 Critical NFRs (full detail per attribute)
Use the NFR Statement template from Phase 3 for each.

#### Section 3 — Tier 2 / 3 NFRs (summary table format)

#### Section 4 — NFR Conflict Register
All identified conflicts, decisions made, trade-offs accepted, and who decided.

#### Section 5 — Open NFR Assumptions
NFRs that cannot yet be set because of missing information — with the question that needs answering and who can answer it.

```
| # | Attribute | Missing Information | Who Resolves | By When |
|---|-----------|-------------------|--------------|---------|
```

#### Section 6 — Architecture Implications
For each Tier 1 NFR, state at least one architecture decision it constrains or enables.

```
| NFR | Architecture Implication |
|-----|-------------------------|
| 99.99% availability | Requires multi-AZ deployment with automated failover |
| p95 ≤500ms under 500 CCU | Eliminates synchronous external API calls on the critical path |
| GDPR + data residency EU | Data must not leave eu-west regions; rules out US-only providers |
```

---

## NFR Quality Scoring

Apply the same 0–10 Uncertainty Reduction Scale from `brd-uncertainty-audit` to each NFR statement.

| Score | Meaning |
|-------|---------|
| 0–2 | Vague quality aspiration ("should be fast", "must be secure") |
| 3–4 | Category named but no target set ("performance requirements defined") |
| 5–6 | Target set but not measurable or testable ("under 2 seconds for most requests") |
| 7–8 | Specific, measurable, testable — a developer can implement against this |
| 9–10 | Specific + measurable + justified + tied to a measurement method + conflict-resolved |

**Minimum acceptable score before architecture begins: 7.**

**Score these immediately and rewrite any below 7:**

| NFR Statement | Score | Why | Rewrite |
|---------------|-------|-----|---------|
| "The system should be fast." | 1 | No metric, no percentile, no load | "API response ≤200ms at p95 under 500 CCU" → 9 |
| "It needs to be secure." | 1 | No model, no classification, no control | "MFA required + RBAC + AES-256 at rest + SOC2 Type II" → 9 |
| "Must handle our users." | 2 | No user count, no growth, no peak | "1,000 CCU today; 10,000 in 18 months; 3× peak for 4h" → 9 |
| "Should be available 24/7." | 3 | No SLA %, no downtime budget | "99.9% monthly SLA; max 8.7h downtime/year" → 9 |

---

## Common Anti-Patterns to Reject

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| "The system should be performant." | Not measurable; developer has no implementation target | Define p50/p95/p99 + load condition |
| "Enterprise-grade security." | Marketing phrase; no control defined | Name authentication model, data classification, compliance standard |
| "Scalable architecture." | Not a requirement — it's an adjective | Define user count baseline, growth rate, and peak scenario |
| NFRs defined after architecture is chosen | Architecture locked in before constraints were known | Run NFR discovery before architecture decisions |
| Single NFR target with no load condition | "Under 2 seconds" is meaningless without "at N concurrent users" | Always pair performance targets with the load scenario |
| No conflict register | Contradictory NFRs silently break the architecture | Explicitly resolve every conflict; document the decision |
| No open assumptions section | Unknown NFRs become production surprises | Name every gap; assign an owner; set a resolution date |

---

## Quick NFR Discovery Checklist

Run before any architecture decision or sprint commitment:

- [ ] Phase 1 complete: all implicit NFRs extracted from BRD with source quote?
- [ ] Phase 2 complete: NFR interview run with at least Executive, Operations, Security, and IT stakeholders?
- [ ] All Tier 1 attributes addressed (Availability, Performance, Scalability, Security, Reliability, Maintainability, Observability, Cost)?
- [ ] Every NFR statement scores ≥ 7 on the Uncertainty Reduction Scale?
- [ ] All NFR conflicts identified and explicitly resolved with a named decision-maker?
- [ ] Architecture implications documented for all Tier 1 NFRs?
- [ ] Open Assumptions Register complete with owners and resolution dates?
- [ ] NFR document reviewed with at least one architect or senior developer before architecture begins?

**If any box is unchecked, NFR discovery is not done. Do not begin architecture.**

---

## Reference: ISO/IEEE Quality Attribute Taxonomy

Full taxonomy from [Wikipedia — List of System Quality Attributes](https://en.wikipedia.org/wiki/List_of_system_quality_attributes).
Architecturally significant attributes organized by the common acronym frameworks:

| Framework | Attributes | When to Use |
|-----------|-----------|-------------|
| **FURPS** | Functionality, Usability, Reliability, Performance, Supportability | General software products |
| **RASR** | Reliability, Availability, Scalability, Recoverability | Database and data-intensive systems |
| **RAMS** | Reliability, Availability, Maintainability, Safety | Safety-critical systems |
| **ACID** | Atomicity, Consistency, Isolation, Durability | Transaction processing systems |
| **Security triad (CIA)** | Confidentiality, Integrity, Availability | Any system handling sensitive data |
| **Agility (DEPSETU)** | Debuggability, Extensibility, Portability, Scalability, Securability, Testability, Understandability | Systems expected to evolve rapidly |

When in doubt, default to FURPS + Security CIA triad + Observability as your minimum NFR set. Add RASR for any data-intensive system. Add RAMS for any system with physical or safety implications.
