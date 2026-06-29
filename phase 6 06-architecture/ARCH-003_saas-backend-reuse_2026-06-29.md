---
title: "ARCH-003 — SaaS Backend Reuse (php_mysql_stack as the thin cloud)"
phase: 06_architecture
created: 2026-06-29
updated: 2026-06-29
version: 1.1
status: PLAN — code read & assessed; no code changes made. Reuse-and-clean strategy proposed, build deferred.
related:
  - phase 6 06-architecture/ARCH-001_job-module-component-architecture_2026-06-25.md
  - phase 6 06-architecture/ARCH-002_deployment-electron-packaging_2026-06-26.md
  - D:/xampp/htdocs/php_mysql_stack/  (the existing PHP+MySQL backend)
  - .claude/skills/db-audit-remediation/SKILL.md
---

# ARCH-003 — SaaS Backend Reuse

**Goal:** decide whether the existing PHP + MySQL codebase at `D:/xampp/htdocs/php_mysql_stack`
can become the **SaaS "thin cloud"** for the cabinet product (the cloud layer ARCH-002 deferred:
jobs/DB, auth, accounts, licensing). The directive: **reuse the same codebase**, cleaning and
optimising **one module at a time** rather than rewriting.

> Architecture/plan document. No code changes are made by it. Build is deferred, consistent with ARCH-001/002.

---

## 1. TL;DR / recommendation
**Reuse it — but as a *shell*, not as-is.** The codebase is a PHP 8 port of a C#/ASP.NET-Identity
multi-tenant SaaS skeleton. It already ships the *expensive* parts of any SaaS: a full
**onboarding funnel** (contact → invite → email-verify → workspace setup → auto-login), **JWT + refresh-token
rotation**, **per-tenant RBAC** (a `manage_user_roles` permission matrix), and **user/profile management**.
That is exactly the "thin cloud" ARCH-002 said we would need.

But it is **not production-grade as written**: it has *committed DB credentials and a default JWT key*,
**app-level-only tenant isolation** (one query bug = cross-tenant leak), a hand-rolled JWT, cookies set
without `HttpOnly/Secure/SameSite`, silent DB-error swallowing, raw SQL scattered across three layers, and a
40-branch `if/preg_match` router. None of these block reuse; all are fixable module-by-module.

**Recommendation:** adopt it as the auth/tenant backend, do a **one-time security gate** (credentials, JWT key,
cookie flags, tenant-isolation guard) *before* it touches real users, then **graft the cabinet domain
(ARCH-001's `Job ▸ Module ▸ Component`) onto it** as new, clean modules — leaving the messy legacy auth code to
be refactored behind its existing interfaces, in place, on a schedule.

---

## 2. What this codebase actually is (reverse-engineered)
A standalone backend (`composer` name `app-standscale/php-mysql-stack`, namespace `PHPMySqlStack\`) that is a
**line-by-line PHP port of a .NET app**. Evidence: `ApplicationUser`/`ApplicationRole`, `security_stamp` /
`concurrency_stamp` / `normalized_email` (ASP.NET Identity), `…Async` method names with no async, PascalCase
methods (`Login`, `CreateUpdateUserProfile`), and `Roles` that literally parse `porting_source_files/Models/*.cs`.

**Domain it implements** (all multi-tenant, keyed by `tenant_workspace_id`):

| Capability | Entry point | DB tables |
|---|---|---|
| Onboarding funnel | `VerificationService`, `WorkspaceController` | `contacts`, `invite_codes`, `verification_tokens` |
| Workspace/tenant setup | `FunctionalService::createTenantWorkspace/createCompany/createDefaultAdmin` | `tenants`, `companies` |
| Auth (login/refresh/logout/reset) | `LoginController`, `TokenService`, `RefreshTokenRepository` | `users`, `refresh_tokens`, `verification_tokens` |
| Identity (CRUD users/roles) | `Auth\Identity\*` (`UserManager`, `RoleManager`, `User`, `Role`) | `users`, `roles`, `user_roles` |
| Per-tenant RBAC matrix | `ManageUserRolesController`, `Roles` | `manage_user_roles`, `manage_user_role_details` |
| User management UI APIs | `UserManagementController`, `Account`, `Common` | `user_profiles` |
| User profile CRUD API | `UserProfileAPIController` | `user_profiles` |
| Tenant resolution | `TenantContext` (reads `TenantWorkspaceId` JWT claim) | `users` |

There is **no cabinet/cut-list domain in it at all** — it is purely the account/tenant shell.

---

## 3. Module inventory & verdict

| Module | What it does | Quality | Verdict |
|---|---|---|---|
| `public/index.php` (router) | 40+ inline `if (preg_match…)` routes; manual `require_once` of 25 files despite PSR-4 | Poor | **Replace** with a small route table + autoload |
| `routes.php` | *Comments only* — not executed | Dead | **Delete** (or make it the real table) |
| `Db/Database` + `ProxyPDO` + `SafeStatement` | PDO singleton that **swallows errors** and returns fake empty results | Risky | **Refactor** — fail loud, single access pattern |
| `Config/db.php` | **Hardcoded prod credentials, committed** | Critical | **Replace** with env/secrets *immediately* |
| `Services/TokenService` | Hand-rolled HS256 JWT; **default signing key fallback** | Risky | **Refactor** — vetted lib + required key |
| `Services/RefreshTokenRepository` | Refresh store + rotation | Good | **Keep**, add index/cleanup |
| `LoginController` | login / refresh-rotate / logout / forget+reset / video-url | Mixed (raw SQL inline; cookie flags missing) | **Keep flow, refactor internals** |
| `WorkspaceController` + `FunctionalService` + `VerificationService` | Onboarding funnel + workspace provisioning | Good logic, raw SQL | **Keep**, clean SQL into repos |
| `Auth\Identity\*` | User/Role/Password managers (static methods) | OK, dual-INSERT fallbacks hide schema drift | **Keep**, tidy |
| `ManageUserRolesController` + `Services\Roles` | Per-tenant RBAC matrix | Valuable, SQL-heavy | **Keep**, repo-ise |
| `UserManagementController` + `Services\Account` + `Common` | User admin APIs; `Common` still has .NET `wwwroot` upload paths | Mixed / leftovers | **Refactor**, strip .NET-isms |
| `UserProfileAPIController` | Profile REST CRUD | OK | **Keep** |
| `Models/*` (`Contact`, `InviteCode`, `VerificationToken`, `TenantWorkspace`, `EntityBase`, `BaseModel`) | ActiveRecord-lite static methods + anemic DTOs mixed | Inconsistent | **Consolidate** into one persistence style |
| `NotifyHubClient`, `FunctionalService::initAppData` | No-ops | Stub | **Implement or remove** |
| `public/diagnose.php`, `test_script.php`, `scripts/test_*` | Diagnostics in web root | Risk | **Remove from deploy** |

---

## 4. Architecture problems, ranked (what reuse must address)

**Tier 0 — security gate (fix before any real user/tenant):**
1. **Committed DB credentials** in `src/Config/db.php` (host, user, live password). → env vars / secrets; rotate the password (it is now in git history).
2. **Default JWT signing key** — `TokenService` falls back to `'change-me-…'` if `JWT_KEY` is unset. A deploy that forgets the env var has a *publicly known* signing key → anyone can forge tenant/admin tokens. → make the key **required**; refuse to boot without it.
3. **Tenant isolation is app-level only.** Every read does `WHERE tenant_workspace_id = ?`, several with `OR tenant_workspace_id IS NULL` fallbacks. There are **no FK constraints and no row-level enforcement**. One missing predicate = silent cross-tenant data leak — the single biggest SaaS risk. → centralise tenant scoping; add it in one place, not 30.
4. **Auth cookies lack flags** — `setcookie('access_token', …, 0, '/')` has no `HttpOnly`, `Secure`, or `SameSite`. XSS can exfiltrate tokens. → set all three; `Secure` in prod.
5. **Plaintext password in `tenants`** — `TenantWorkspace::create` writes the raw `Password` into the `password_hash` column. → never store; the real credential lives hashed in `users`.

**Tier 1 — correctness / maintainability:**
6. **Silent DB failures** — `ProxyPDO`/`SafeStatement` log and return empty, so a broken query *looks like "no rows."* → fail loud; let the top-level handler format the error.
7. **Raw SQL in controllers + services + models**, heavily duplicated (the `COALESCE(up.tenant_workspace_id, t…, u…)` join appears ~6×). → one repository layer per aggregate.
8. **Router** — unmaintainable branch chain; **manual requires** despite working PSR-4 autoload. → route table + `composer dump-autoload`.
9. **Schema gaps** — VARCHAR(36) ids with **no foreign keys, no cascades**; `user_roles` PK is `(user_id, role_id)` yet the app inserts/filters by `tenant_workspace_id`. This repo's own **`db-audit-remediation` standard** would flag all of it ("if a business rule isn't in the schema, it isn't a real constraint"). → run that audit as part of cleanup.

**Tier 2 — hygiene:** hand-rolled JWT → `firebase/php-jwt`; PascalCase/.NET-isms; no rate-limiting/CSRF; dead stubs and diagnostic scripts in web root.

---

## 5. Reusable vs missing (for *our* product)

**Reuse directly (high value, already built):**
- Complete SaaS **signup funnel** + workspace provisioning (tenant + company + default admin + roles, with post-setup auto-login).
- **JWT access + refresh rotation**, `TenantContext` claim-based tenant resolution.
- **Per-tenant RBAC** matrix (`manage_user_roles` / `_details`) — maps cleanly to "who in this shop can edit jobs / see pricing / manage users."
- **Service interfaces** (`ITokenService`, `IRefreshTokenRepository`, `IAccount`, `ICommon`, `IRoles`) — already DI-shaped, so internals can be swapped without touching callers.
- PSR-4 + composer scaffolding.

**Missing — must be built (this is the cabinet SaaS itself):**
- The **domain**: `Job ▸ Module ▸ Component` persistence (ARCH-001) — none of it exists server-side.
- **Project/cut-list sync** API (the client today is `localStorage`/offline per ARCH-002).
- **Material & sheet catalogs**, pricing/BOM rollup storage.
- **Licensing / entitlement** (which the Electron thick client will check).
- **Design file storage** (the `FileStorage/<subdomain>/` scaffolding is started in `FunctionalService` but unused).

> Net: the backend gives us **~100% of the boring SaaS plumbing** and **0% of the cabinet domain**. That is the ideal split for reuse.

---

## 6. Target architecture (where reuse lands)

```
Electron thick client (ARCH-002)          SaaS thin cloud  (this codebase, cleaned)
─ offline core: design/2D/3D/             ┌───────────────────────────────────────┐
  cut list/nesting/BOM (vanilla JS)       │  Router (table) → Controller →          │
─ talks to cloud only for:                │  Service (interface) → Repository → PDO │
    • auth (JWT)                ───────►   │                                         │
    • job/project sync          ───────►   │  KEEP:  Auth · Tenant · RBAC · Profiles │
    • licensing                 ───────►   │  ADD :  Jobs · Modules · Components ·    │
    • pricing/material catalog  ───────►   │         Catalog · Licensing · Sync      │
                                           │  Tenant scope enforced in ONE place     │
                                           └───────────────────────────────────────┘
```

- The **heavy compute stays client-side** (ARCH-002 holds). The cloud only carries **data + auth + entitlement**.
- New cabinet modules are written **clean from day one** (route table, repository, tenant-scoped base class), so we are not blocked on refactoring the legacy auth code first.

---

## 7. Module-by-module cleanup plan (the "one at a time" ask)
Order chosen so each step is independently shippable and the **security gate comes first**.

| Step | Module | Action | Why first/now |
|---|---|---|---|
| C0 | `Config/db.php`, `TokenService` key, cookie flags | Move secrets to env; require `JWT_KEY`; add `HttpOnly/Secure/SameSite`; rotate leaked password | **Blocks go-live** |
| C1 | `Db/Database` | One access pattern; **stop swallowing errors**; add a `TenantScopedRepository` base | Foundation for all reads |
| C2 | Tenant isolation | Single choke-point for `tenant_workspace_id`; remove `OR … IS NULL` leak paths; add FKs | **#1 SaaS risk** |
| C3 | Router | Replace `index.php` chain with a route table; delete manual `require_once` (use PSR-4); retire `routes.php`-as-comments | Unlocks adding new endpoints cleanly |
| C4 | `Models/*` | Pick one persistence style (repositories); kill duplicated tenant-join SQL | Maintainability |
| C5 | `Auth` + `Login` + `Workspace`/`Functional`/`Verification` | Keep behaviour; move SQL into repos behind existing interfaces; `firebase/php-jwt`; remove plaintext tenant password | De-risk core flows |
| C6 | `Common`/`Account`/`Roles` | Strip .NET `wwwroot`/`porting_source_files` leftovers; implement or delete no-op stubs | Hygiene |
| C7 | Web root | Remove `diagnose.php`, `test_script.php`, `scripts/test_*` from deploy; add rate-limit + CSRF on cookie auth | Surface reduction |
| **N1+** | **New: Jobs/Modules/Components, Catalog, Sync, Licensing** | Build **clean** on the C1–C4 foundation | The actual product |

Because every legacy service already sits behind an interface, **C5/C6 are internal refactors** — controllers and the new cabinet modules don't change when the guts are cleaned.

---

## 8. Multi-tenant isolation — the decision to lock
Three options; pick before C2:

| Model | What it is | Effort | Fit |
|---|---|---|---|
| **A. Shared schema + `tenant_workspace_id` column** ⭐ | what exists today, but enforced in **one** scoped-repository layer + FKs | Low | **Recommended** — matches code; cheapest correct path |
| B. Schema-per-tenant | one MySQL schema per workspace | High | only if a big customer demands hard isolation |
| C. DB-per-tenant | full physical separation | Very high | enterprise/compliance later |

Recommendation: **A**, but make the scoping **structural** — a base repository that *always* injects the current `tenant_workspace_id` from `TenantContext`, so no individual query can forget it. That converts today's "best-effort WHERE clause" into an invariant.

---

## 8.1 — URL & tenant routing (path vs subdomain)
**Decision: path-based, not subdomain** — e.g. `app.standscale.com/api/v1/...`.
The key insight from the code: **tenant is already resolved from the JWT `TenantWorkspaceId` claim**
(`TenantContext`), *not* from the URL. So the URL tenant segment is secondary to the token — that reframes the
whole choice.

| Factor | Path `/v1/{tenant}/` ⭐ | Subdomain `{tenant}.standscale.com` |
|---|---|---|
| TLS | one cert | **wildcard** `*.standscale.com` |
| DNS / vhost | none | **wildcard DNS + per-deploy vhost** |
| Shared hosting (cPanel `a920363`) | trivial | painful / often unsupported |
| Consumer | an **Electron app** (API, not a browser) | branding only matters to humans |
| White-label branding | weak | strong |

Subdomains only pay off for a **human-browsed, per-tenant *branded web portal*** (branding + per-origin cookie
isolation). Our product is a **thick Electron client → thin API** (ARCH-002): none of the subdomain benefits
apply, all the ops costs do. **Path-based wins.** Reserve subdomains for a future browser white-label portal only.

**Three rules that make path-based safe and clean:**
1. **The URL is never authoritative for tenant.** Keep deriving tenant from the JWT claim. If `{tenant}` also
   appears in the path, **validate `url_tenant === token_tenant` on every request and reject mismatch** — otherwise
   it is an IDOR / horizontal-escalation hole (valid token + someone else's tenant in the URL). The path segment is
   a *checked assertion*, not the lookup key.
2. **Put the human-readable `subdomain` slug in the URL, not the GUID** — `/api/v1/acme/jobs`, not
   `/api/v1/ac5db4b2-…/jobs`. The `subdomain` column already exists; resolve slug → `tenant_workspace_id` internally.
3. **Authenticate the API with `Authorization: Bearer`** (already supported by `TenantContext`), not cookies.
   Cookies were for the server-rendered `/workspace/*` views; Bearer keeps the API single-origin / CORS-free for Electron.

**Recommended URL shapes (in order):**
- **Cleanest:** `app.standscale.com/api/v1/...` — *no tenant in path*; tenant from token. No match-guard needed.
- **Explicit (your proposal, made safe):** `app.standscale.com/api/v1/{subdomain}/...` — log-friendly, **with the
  must-match guard**.
- **Avoid:** subdomain-per-tenant until a browser white-label portal exists.

The `/v1` version prefix **before** the tenant segment is correct either way. This lands in the **C3 (router)** step.

---

## 9. Security hardening checklist (gate for "real users")
- [ ] DB creds → env/secret manager; **rotate** the committed password.
- [ ] `JWT_KEY` required at boot (no default); long random per environment.
- [ ] Cookies: `HttpOnly`, `Secure`, `SameSite=Lax/Strict`.
- [ ] Tenant scope enforced in one repository layer; remove `OR tenant_workspace_id IS NULL`.
- [ ] If `{tenant}` is in the URL path, enforce `url_tenant === token_tenant` (IDOR guard) — see §8.1.
- [ ] FKs + cascades added (run the repo's **`db-audit-remediation`** skill on the schema).
- [ ] Swap hand-rolled JWT → `firebase/php-jwt` (or keep, but add `alg` allow-list + tests).
- [ ] Rate-limit auth endpoints; CSRF token for cookie-authenticated POST/PATCH/DELETE.
- [ ] Remove diagnostic/test PHP from web root; disable verbose errors in prod.
- [ ] Stop writing plaintext password into `tenants`.

---

## 10. How it connects to ARCH-001 / ARCH-002
- **ARCH-002** defined the split: thick client offline + **thin cloud for jobs/DB/auth/licensing**. *This codebase is that thin cloud.* It slots in with no change to the offline design/cut-list/3D engine.
- **ARCH-001** defined the domain (`Job ▸ Module ▸ Component`, versioned `Job` JSON). That becomes the **new server modules (N1+)**: a `jobs` aggregate storing the versioned Job document per tenant, synced from the client. The existing `users`/`tenants`/RBAC become the *owner & permission* layer around it.
- **BYOK AI** (ARCH-002) is unaffected — AI stays client-side; the cloud never holds the key.

---

## 11. Risks / decisions to lock first
- **Isolation model** (§8) — decide once; the repository layer depends on it.
- **URL/tenant routing** (§8.1) — **locked: path-based `/api/v1/...`, tenant from JWT, subdomain slug if in path, Bearer auth.** Revisit only if a browser white-label portal is added.
- **Refactor-in-place vs fork** — recommend **in-place behind interfaces** (cheaper, keeps the working funnel) with the C0 security gate as a hard precondition to any deployment.
- **JWT library** — keep hand-rolled (tested) or adopt `firebase/php-jwt` (recommended).
- **Schema ownership** — adopt FKs/cascades now (per db-audit standard) or accept app-level integrity debt.
- **Is this the long-term backend, or a bridge?** If a managed platform (e.g. Laravel/Supabase) is likely within a year, scope cleanup to the **security gate + new domain only** and don't gold-plate the legacy code.

---

## 12. Recommendation
**Reuse `php_mysql_stack` as the SaaS backend.** Execute **C0 (security gate)** first — it is non-negotiable and
small. Then build the **cabinet domain (N1+) clean** on a tenant-scoped repository foundation (C1–C4), and refactor
the legacy auth/RBAC modules in place, behind their existing interfaces, on a rolling schedule (C5–C7). This keeps
the valuable, already-working SaaS funnel and auth while eliminating the credential, JWT-key and cross-tenant-leak
risks — and it composes cleanly with ARCH-001's job hierarchy and ARCH-002's thick-client/thin-cloud split.

---

## Version history
- **v1.2 (2026-06-29)** — Superset spec added: **[ARCH-004]** details the thin-client/whole-engine boundary
  (all math server-side), the engine API contract, the canonical design/render models, and **multi-tenancy on
  both FE and BE**. ARCH-004 builds on this doc's §6 (engine), §8 (isolation) and §8.1 (URL routing).
- **v1.1 (2026-06-29)** — Added **§8.1 URL & tenant routing**: locked **path-based `/api/v1/...`** over
  subdomain-per-tenant (tenant resolved from the JWT claim, not the URL; subdomain slug if path-scoped;
  Bearer auth; mandatory `url_tenant === token_tenant` IDOR guard). Reflected in the security checklist,
  decisions-to-lock, and the C3 router step.
- **v1.0 (2026-06-29)** — Initial assessment of the `php_mysql_stack` PHP+MySQL backend (all `src/` modules,
  migrations, router, config read). Identified it as a .NET→PHP multi-tenant SaaS shell (onboarding funnel, JWT +
  refresh rotation, per-tenant RBAC, profiles) with no cabinet domain. Recommended **reuse-as-shell**: a Tier-0
  security gate (committed creds, default JWT key, app-only tenant isolation, cookie flags, plaintext tenant
  password) before any real user, then graft ARCH-001's Job▸Module▸Component as clean new modules while refactoring
  legacy code in place behind its interfaces. Defined module inventory/verdicts, isolation options, cleanup order,
  and links to ARCH-001/002. Implementation deferred.
