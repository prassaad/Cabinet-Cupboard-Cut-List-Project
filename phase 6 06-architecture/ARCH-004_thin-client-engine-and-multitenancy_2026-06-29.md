---
title: "ARCH-004 — Thin-Client Engine + Multi-Tenant SaaS (server owns all math)"
phase: 06_architecture
created: 2026-06-29
updated: 2026-06-29
version: 1.1
status: PLAN — authoritative spec; implementation NOT started. Extends ARCH-003 (§6 engine, §8 isolation, §8.1 URL routing).
related:
  - phase 6 06-architecture/ARCH-003_saas-backend-reuse_2026-06-29.md
  - phase 6 06-architecture/ARCH-001_job-module-component-architecture_2026-06-25.md
  - phase 6 06-architecture/ARCH-002_deployment-electron-packaging_2026-06-26.md
  - prototype/app.js  (the engine being ported)
---

# ARCH-004 — Thin-Client Engine + Multi-Tenant SaaS

**Goal.** Make the browser a **dumb, replaceable renderer** and the server the **whole valuable engine**.
**All engineering math runs server-side (PHP); the client only captures input and draws what the server returns.**
The system is **multi-tenant on both ends** — one front-end bundle serves every tenant (WallView, Sky, …), and
every byte of compute and data is isolated per tenant.

> **The principle (locked):** Client = dumb renderer + input forwarder. Server = the whole engine.
> Anyone who steals the front-end gets a drawing surface with no brain.

> Architecture/spec document. No code changes. Build deferred to an explicit go-ahead.

---

## 1. TL;DR
- **Client holds only the *design document* (the user's inputs) and a *render model* (what to draw).** It computes **no** geometry, cut lists, nesting, pricing, or 3D boxes — only pan/zoom/orbit *projection* and an optimistic drag *preview*.
- **Server (PHP) owns the engine**: geometry resolution, cut list, edge-banding, sheet nesting, priced BOM, room/run layout, validation, persistence — all in MySQL, all per tenant.
- **Multi-tenant BE**: shared-schema isolation enforced in one repository layer (ARCH-003 §8); tenant from the JWT claim, mirrored in the URL path as a checked assertion (ARCH-003 §8.1).
- **Multi-tenant FE**: a single static bundle, tenant-aware via login + URL; per-tenant **branding/theming** and **catalog** pulled from a tenant-config endpoint. No tenant secrets ever reach the browser.
- **Honest protection boundary:** server-side math hides the **how** (algorithms, pricing rules, catalog), never the **what's drawn** (the rectangles and dimension labels are on screen by definition).
- **Trade-off accepted:** online-only for protected features. Offline ⊥ protection (an offline build must ship the engine). Keep the licence-gated Electron build if offline is ever required — it will *not* be protected.

---

## 2. System overview

```
┌────────────────────────── BROWSER (dumb renderer) ───────────────────────────┐
│  Input capture → edit intents          Render model → Canvas 2D / 3D / Sheet   │
│  View transforms only (pan/zoom/orbit)  Optimistic drag preview (visual only)  │
│  Holds: design document (data) + last render model + JWT + tenant slug         │
└───────────────▲───────────────────────────────────────────────▲──────────────┘
                │  HTTPS · JSON · Bearer JWT · /api/v1/{tenant}/…  │
┌───────────────┴───────────────────────────────────────────────┴──────────────┐
│  PHP API (stateless)                                                           │
│   Router → Auth/Tenant middleware → Controller → ENGINE (pure) → Repository    │
│                                                                                │
│   ENGINE (the moat): geometry · cut list · banding · NESTING · priced BOM ·    │
│                      room/run layout · validation/clamping · units             │
│   Per-tenant: catalog (materials, sheet stock, price lists), projects, RBAC    │
└───────────────────────────────────────▲───────────────────────────────────────┘
                                         │
                                   MySQL (per-tenant rows: tenants, projects,
                                   catalog, users, roles, refresh_tokens …)
```

The engine is **pure** (input → output, no side effects) → trivially testable, cacheable, and horizontally scalable.

---

## 3. Responsibility split (function-by-function)
Mapping the current `prototype/app.js` to the target.

| Concern | `app.js` today | Target |
|---|---|---|
| Geometry resolution | `cellAt`, `splitSegments`, `shelfSegments`, `verticalSegments`, `partRect`, `doorRects`, `drawerParts/Fronts`, `backGeom`, `normalizeComps`, `clampComp` | **Server** |
| Cut list + grouping + banding | `cutListInstances`, `cutList`, `groupKey`, `bandLen`, `bandNotation`, `jobCutList`, `jobTotals` | **Server** |
| Sheet nesting / optimiser | `nest`, `jobNest` | **Server** |
| Priced BOM / costing | `aiEstimateBOM` | **Server** |
| Room / run layout | `ensureRunLayout`, `roomBBox`, placement resolution | **Server** |
| 3D box construction | `buildBoxes` | **Server** (returns box list) |
| Units / validation / clamping | `toMM/toDisp`, input clamping | **Server** (authoritative) |
| **2D/3D/Sheet drawing** | `renderDesign`, `renderDesign3D`, `renderSheet`, `drawPlacement`, `fillRectMM` | **Client** (draws the render model) |
| **Camera / view transforms** | `computeView`, `zoom2DAt`, 3D `rot`/`proj`, pan | **Client** (presentation only) |
| **Input + edit intents** | `mousedown/move/up`, `hitTest`, `addComp`, drag | **Client** → sends intents; server resolves |
| **Optimistic drag preview** | (new) translate the dragged shape locally | **Client** (visual only; server reconciles on drop) |
| Persistence | `localStorage` save/load | **Server** (MySQL), per tenant |

**Why this is safe to draw client-side:** the render model is just rectangles, boxes and labels — the *output*. The *production rules* that make them (cell-bounding, segment splitting, nesting, pricing) never leave the server.

---

## 4. The Engine API (contract)

Base: `https://{host}/api/v1/{tenant}/…` — `{tenant}` is the workspace slug, **validated to equal the JWT claim** (ARCH-003 §8.1). All calls send `Authorization: Bearer <jwt>`.

### 4.1 Core endpoint — compute
The client holds the **design document** (user inputs; not secret) and asks the server to derive everything.

```
POST /api/v1/{tenant}/engine/compute
Authorization: Bearer <jwt>
Content-Type: application/json
{
  "design":   <Job>,                       // §5 — full doc (small JSON) OR
  "designId": "uuid",                       //      a stored project to load+compute
  "scope":    "module" | "job",
  "activeModuleId": "uuid",
  "views":    ["2d","3d","sheet","cutlist","bom"],   // compute only what the active tab needs
  "unit":     "mm" | "in"
}
→ 200
{
  "design":      <Job>,            // canonical (normalized, clamped) — client adopts this
  "renderModel": <RenderModel>,    // §6
  "hash":        "sha256:…",       // of (design+scope+views+engineVersion) for caching
  "engineVersion": "1.0.0"
}
```

- **Stateless & idempotent:** same input ⇒ same output ⇒ cacheable (ETag / `hash`).
- **Compute only what's asked** (`views`): dragging needs `["2d"]`; opening Sheet adds `["sheet","bom"]`.
- Server **always re-normalizes and clamps** — never trusts client geometry.

### 4.2 Edit intents (server resolves engine-bound edits)
Edits that require engine logic (insertion bounding via `cellAt`, clamping) are expressed as intents; the server returns the updated canonical design + render model. (Equivalent to POSTing the mutated design to `/compute`; intents are the higher-level, smaller-payload form.)

```
POST /api/v1/{tenant}/engine/edit
{ "designId"|"design", "activeModuleId",
  "op": "add_shelf" | "add_vertical" | "add_drawer" | "add_door" |
        "move" | "resize" | "delete" | "set_props" | "place_room",
  "args": { … }    // e.g. add_shelf: {point:{x,y}}; move:{id, pos|offsetX|baseHeight}
}
→ { design, renderModel, hash }
```

### 4.3 Projects (persistence, per tenant)
```
GET    /api/v1/{tenant}/projects                 → [ {id,name,updatedAt} ]
POST   /api/v1/{tenant}/projects  {name,design}  → {id}
GET    /api/v1/{tenant}/projects/{id}            → {id,name,design}
PUT    /api/v1/{tenant}/projects/{id} {name,design}
DELETE /api/v1/{tenant}/projects/{id}
```

### 4.4 Tenant config & catalog (drives FE branding + engine inputs)
```
GET /api/v1/{tenant}/config
→ { brand:{name,logoUrl,iconUrl,accent,poweredBy?}, units, features:{…entitlements} }

GET /api/v1/{tenant}/catalog
→ { materials:[{id,name,thickness,...}], sheets:[{w,h,kerf}], priceListId, grainLockDefault }
```
- **Catalog & prices are per tenant with global defaults**; the price list itself **never** ships to the browser as numbers the optimiser uses — only display-safe summaries do. BOM totals are computed server-side.

### 4.5 Auth (reuse ARCH-003)
`POST /api/v1/login` · `POST /api/v1/refresh` · `POST /api/v1/logout` — JWT access + refresh-token rotation. Bearer for the API (not cookies; ARCH-003 §8.1).

### 4.6 Errors & limits
- Errors: `{ "error": {code, message, field?} }` with proper HTTP status (400 validation, 401/403 auth/authz, 404, 409, 422 engine-invalid-design, 429 rate-limit).
- Payload cap (e.g. 1 MB design), request rate-limit **per tenant**, `engineVersion` returned so clients can detect drift.

---

## 5. The Design Document (canonical model)
The single source of truth that travels and is stored. It is **data only** (the user's choices) — holding it client-side reveals no algorithm.

```jsonc
Job {
  id, tenantWorkspaceId, name, schemaVersion, unit:"mm"|"in",
  settings: { sheet:{w,h,kerf}, grainLock, materialId, priceListId },  // job-wide (ARCH-001 P1.2)
  modules: [ Module ],
  layout:  { runs:[ { id, items:[ { moduleId, offsetX, baseHeight } ] } ] }   // room/run
}
Module {
  id, code, name, type:"base"|"wall"|"tall"|"cupboard",
  cab:{ w,h,d,t,back }, backPanel:{ type, thickness, groove, setback },
  comps:[ Component ],         // shelves/verticals/doors/drawers (logical positions)
  doors:{ reveal }, band:{ Side:{…}, Shelf:{…}, … }
}
Component {                    // exactly today's S.comps shape
  id, type:"shelf"|"vertical"|"door"|"drawer",
  pos, a0, a1, thick?, depth?, setback?,            // shelf/vertical
  ax, ay, count?, mount?, covers?, span?, valign?, w?, h?   // door/drawer
}
```
Versioned (`schemaVersion`) with server-side migrations.

---

## 6. The Render Model (what the client draws)
Everything the dumb renderer needs — **no geometry math required client-side.** Coordinates in mm; the client applies only its camera/zoom.

```jsonc
RenderModel {
  scope:"module"|"job", unit,
  module2d: {
    carcass:[ {x0,x1,y0,y1, role:"interior|wall", fill, stroke} ],
    parts:[   {x0,x1,y0,y1, id, kind:"shelf|vertical|door|drawer", fill, stroke, alpha} ],
    labels:[  {x,y, text, vertical} ],          // dimension labels, pre-formatted
    openings:[{x0,x1,y0,y1, label?} ]
  },
  module3d: {
    boxes:[ {x0,x1,y0,y1,z0,z1, color:[r,g,b], id, alpha} ]   // client only rotates/projects
  },
  cutList: { rows:[ {name,qty,length,width,edges,srcId} ], totals:{parts,areaM2,tapeM} },
  sheets:  { SW,SH, utilisation, sheets:[ {placements:[ {x,y,w,h,rot,name,gkey,srcId} ]} ] },
  bom:     { currency, lines:[ {item,qty,unit,unitCost,lineCost} ], total, assumptions },
  selection:{ gkeyToSrc: { … } }                // for cross-highlight, precomputed
}
```
The client’s entire 2D job becomes: *fill these rects, write these labels.* 3D: *rotate these boxes by the camera, painter-sort, shade, fill.* Sheet: *draw these placements.*

---

## 7. Multi-tenancy — Backend

**Isolation model (locked, ARCH-003 §8): shared schema + `tenant_workspace_id`, enforced structurally.**
- A single `TenantScopedRepository` base **always** injects the current `tenant_workspace_id` from `TenantContext` into every query — no individual query can forget it. Today's "best-effort WHERE" becomes an invariant.
- **Tenant resolution:** authoritative = JWT `TenantWorkspaceId` claim. The `{tenant}` URL segment is a **checked assertion** — middleware rejects `url_tenant ≠ token_tenant` (IDOR guard, ARCH-003 §8.1).
- **FKs + cascades** on every relationship (run the repo's `db-audit-remediation` skill).
- **Per-tenant catalog/pricing**: `catalog`/`price_lists` rows carry `tenant_workspace_id`; resolution = tenant row → fallback to global default.
- **RBAC**: reuse `manage_user_roles`/`_details` — who in a tenant may price, export, manage users.
- **Caching & rate-limits are tenant-keyed** (cache key includes tenant; quotas per tenant).
- **Entitlements**: the engine checks the tenant's plan (e.g., max modules, pricing enabled) before computing — enforced server-side, not in the FE.

Request pipeline:
```
Router → AuthMiddleware (verify JWT) → TenantMiddleware (resolve + assert {tenant})
       → RbacMiddleware (role/entitlement) → Controller → Engine(pure) → TenantScopedRepository → PDO
```

---

### 7.1 Tenant resolution — identity is the boundary (the `/app/` routing question)
The deployed route is `…/app/`. **Resolve the tenant from the signed JWT on every request — that is the only secure source.** A URL path segment is user-editable, so it can *never* be the authorization boundary: if the server trusted `/{tenant}/…`, a user could swap the slug and reach another workspace.

- **Authoritative (required):** the `TenantWorkspaceId` claim in the access token. The API derives the tenant from the token on **every** request and scopes all data via `TenantScopedRepository`. *This is the per-request validation you want* — it's signed, so it can't be tampered.
- **URL tenant slug (optional, convenience only):** use it for branding, shareable deep-links, and choosing which workspace to sign into — **never** for authz. If present it is a *checked assertion*: middleware rejects when `url_tenant ≠ token_tenant` (IDOR guard, ARCH-003 §8.1).

**Recommended URL shapes**
- **Simplest (recommended, post-login product):** `wallview.standscale.com/app/` + tenant from JWT. Nothing to keep in sync; onboarding lands every tenant on the same `/app/` and identity does the rest.
- **With slug (branding / deep-links):** `wallview.standscale.com/t/{tenantSlug}/app/` (or `/{tenantSlug}/app/`). On static hosting, an Apache rewrite serves the same files — `.htaccess`: `RewriteRule ^([^/]+)/app/(.*)$ /app/$2 [L]` — the FE reads the slug from `location.pathname`; the JWT still rules.
- **API:** `/api/v1/{tenant}/…` with the match-guard, **or** drop the slug and derive purely from the token — both safe because the token is authoritative; the slug only aids logging/routing.

**Verdict:** resolve by **identity**; treat any tenant in the URL as a *validated, non-authoritative* convenience. Embedding the name/id in the path is fine for UX, but the JWT — not the URL — is what authorises each request.

---

## 8. Multi-tenancy — Frontend
**One static bundle serves all tenants.** No tenant-specific code is shipped; the FE is *configured* at runtime.

- **Tenant identity** comes from (a) login → JWT (authoritative) and (b) the URL slug — path-based per ARCH-003 §8.1, e.g. `app.standscale.com/v1/{tenantSlug}/…` (recommended) or a tenant subdomain if a branded portal is ever wanted.
- **Branding/theming at runtime**: on boot the FE calls `GET /api/v1/{tenant}/config` and applies `brand` (name, logo, icon/favicon, accent colour, optional “Powered by …”) via CSS custom properties. → WallView, Sky-branded, white-label partners all run the *same* bundle with different config. (This is where the current hardcoded WallView/“Powered by Sky” become tenant config.)
- **Every API call carries tenant context**: `Authorization: Bearer <jwt>` + the `{tenant}` path. The FE never holds tenant secrets — only display-safe config.
- **Tenant-scoped client cache**: any local cache (last render model, draft design) is keyed by `tenant` so switching workspaces never bleeds data; cleared on logout.
- **No engine, no prices, no catalog logic** in the bundle — only rendering, input, view transforms, and the tenant’s display config.

---

## 9. Request lifecycle (sequence)
```
1. Browser loads static FE (CDN)         → no tenant logic baked in
2. FE → POST /api/v1/login               → JWT (access+refresh), contains tenant claim
3. FE → GET  /api/v1/{tenant}/config     → apply branding/theme; read entitlements
4. FE → GET  /api/v1/{tenant}/projects/{id} (or new) → design document
5. User edits → FE sends intent → POST /engine/edit → {design, renderModel} → redraw
6. Continuous drag/orbit → LOCAL preview/transform; on release → /engine/edit reconcile
7. Open Sheet/Cut/BOM tab → /engine/compute with views=[…] → draw returned model
8. Save → PUT /projects/{id} {design}
```

---

## 10. Performance & interactivity (how "dumb client" stays fast)
- **Local preview during gestures:** the dragged rectangle / camera moves locally on the already-returned render model; the **authoritative** recompute happens once on release. Orbit/zoom are pure client transforms.
- **Debounce** edits (≈150–250 ms); coalesce rapid changes into one compute.
- **Compute only the active view** (`views`); nesting/BOM are computed **on demand** (Sheet/BOM tabs), not on every shelf nudge.
- **Server memoization:** engine is pure → cache by `hash(design+views+engineVersion)` per tenant; `ETag`/304 on repeats.
- **Stateless engine** → scale horizontally behind a load balancer; no sticky sessions.
- **Latency budget target:** edit→redraw ≤ ~150 ms p95 on a normal connection; gestures feel instant via local preview.

---

## 11. Security model
- **Protected (server-only):** the engine algorithms, **pricing rules & catalog**, entitlements, and all tenant data. **Not protected (by definition):** the rendered rectangles and on-canvas dimensions.
- **Tier-0 gate from ARCH-003 (precondition to any real user):** secrets out of the repo + rotate; **required** JWT key (no default); `HttpOnly/Secure/SameSite` if any cookie is used (API uses Bearer); structural tenant isolation; no plaintext passwords.
- **Never trust the client design doc:** server validates schema, bounds, and clamps everything; rejects malformed/oversized payloads (422 / 413).
- **AuthZ** per tenant + role + entitlement on every endpoint; **rate-limit per tenant**; audit log of compute/exports if needed.
- **Hand-rolled JWT → `firebase/php-jwt`** (or keep with an `alg` allow-list + tests).

---

## 12. Data model (MySQL, per tenant)
Reuse ARCH-003 identity/tenant tables; add:
```sql
projects(    id PK, tenant_workspace_id FK, name, design JSON, schema_version,
             created_by, updated_by, created_at, updated_at )          -- the design doc
catalog_materials( id PK, tenant_workspace_id NULL=global, name, thickness, … )
catalog_sheets(    id PK, tenant_workspace_id NULL=global, w, h, kerf, … )
price_lists(  id PK, tenant_workspace_id, currency, rates JSON )       -- never sent raw to FE
tenant_config( tenant_workspace_id PK, brand JSON, features JSON )     -- FE branding + entitlements
```
FKs + cascades on every `tenant_workspace_id` and ownership relation (db-audit standard).

---

## 13. Tech choices — "best possible"
- **Engine in PHP, kept *pure*** (no DB/IO inside the math) → unit-testable, cacheable, scalable. Build on the **cleaned ARCH-003 codebase**; a lean router + DI + repositories is enough — no heavy framework required for compute (Slim/Laravel optional if you want batteries/queues later).
- **Transport:** JSON over HTTPS, **Bearer JWT**, versioned path (`/api/v1/`), tenant in path with the match-guard.
- **FE:** keep the **zero-dependency vanilla renderer** (honours the existing constraint) but refactored to *consume the render model* — drawing/input/camera only. A framework is unnecessary; the bundle gets *smaller* (no engine).
- **Single engine, two run modes (decision, §15):** to avoid maintaining the math twice, the **PHP engine is authoritative** and the client keeps only a *trivial* visual preview (not a second engine). If a protected-ish offline mode is ever needed, prefer compiling **one** engine (Rust/Go/C++ → native server lib **and** WASM) over hand-porting — but that's a later, optional path.
- **Determinism & versioning:** engine pure + `engineVersion`; design `schemaVersion` with migrations; golden-file parity tests (see §14).

---

## 14. Migration path (incremental, low-risk)
| Phase | Deliverable | Risk control |
|---|---|---|
| **E0** | ARCH-003 **Tier-0 security gate** + tenant-scoped repository foundation | precondition; no engine yet |
| **E1** | Port the self-contained moat first: **`nest` + cut list + priced BOM** → `/engine/compute`; FE calls it for the **Sheet/Cut/BOM** tabs while still drawing 2D locally | **dual-run parity:** run JS vs PHP on the same designs, diff outputs (golden tests) until identical |
| **E2** | Port **geometry resolution** (`cellAt`/segments/`partRect`/`doorRects`/`buildBoxes`); FE switches to **render-model** consumer; add **local drag preview + reconcile** | feature-flag per view; keep JS engine as oracle for tests |
| **E3** | **Projects + catalog in MySQL**, multi-tenant scoping, auth wired (ARCH-003) | per-tenant data tests |
| **E4** | **FE tenant config/branding** (retire hardcoded WallView/Sky) + **entitlements/licensing** | white-label one extra tenant to prove isolation |
| **E5** | Caching, rate-limits, observability, load test | latency p95 target |

---

## 15. Risks / decisions to lock
- **Offline ⊥ protection** — confirm **online-only** for protected features; offline = unprotected Electron build only. (Locked by user: "all math server-side.")
- **One engine vs two** — **decision: PHP authoritative + trivial JS preview** (don't maintain a second JS engine). Revisit WASM-shared engine only if protected-offline becomes a hard requirement.
- **Edit model** — full-design POST vs edit-intents. Start with **intents** for small payloads; both are stateless. Lock the op list.
- **Latency budget** — agree p95 target and compute granularity (which tabs compute on demand).
- **Tenant URL scheme** — path-based `/v1/{tenantSlug}/` (ARCH-003 §8.1); subdomain only if a branded browser portal is added.
- **Catalog/price exposure** — confirm BOM returns totals/line items but **never** the raw rate tables to the FE.
- **Engine/design versioning** — migration policy for stored designs when the engine changes.

---

## 16. Reusable platform — SaaS Core + Security Core (for future product launches)
Build the multi-tenant plumbing as a **product-agnostic platform** the cabinet app and any future SaaS reuse unchanged. Three layers, one-way dependencies:

```
Security Core    →    SaaS Core (platform)    →    Product modules
(crypto, tokens,      (tenancy, identity, RBAC,     (WallView engine;
 isolation, mw)        onboarding, billing, config)   next product; …)
```

### 16.1 Security Core — `Standscale\Security`
Product-agnostic security primitives:
- **Token service** (JWT issue/validate + refresh-token rotation; vetted lib; key required at boot).
- **Password hashing** (argon2id), secret/key management, **input validation/sanitisation**.
- **`TenantScopedRepository`** base (the isolation invariant), **AuthMiddleware**, **TenantMiddleware** (resolve + match-guard), **RbacMiddleware**, **rate-limiter**, security headers/CSRF.
- Ships **interfaces** (`ITokenService`, `ITenantContext`, `IRateLimiter`, …) so concretions are swappable.

### 16.2 SaaS Core — `Standscale\SaasCore`
The reusable business platform that **knows nothing about cabinets**:
- **Identity & accounts**, **Tenancy** (workspace lifecycle), **RBAC** (roles + the `manage_user_roles` matrix).
- **Onboarding funnel** (contact → invite → verify → setup workspace → first admin) — generalised from ARCH-003.
- **Plans / entitlements / billing hooks**, **tenant config & branding** (`/config`), **notifications**, **audit**, **admin**.
- **API kernel**: router, `/api/v1` versioning, error envelope, the Security-Core middleware pipeline.
- Owns the **core tables** (tenants, users, roles, invites, plans, tenant_config, audit) — all tenant-scoped + FK'd.

### 16.3 Product module — e.g. `Standscale\Products\WallView`
Only product-specific parts: the **engine** (compute/edit), **projects** + **catalog** tables, product routes registered into the kernel, product entitlements. Depends on the cores; the cores never depend on it. **No product names in the cores** — branding comes from tenant config.

### 16.4 Launching a new SaaS product
1. New thin app repo: `composer require` SaaS Core + Security Core.
2. Add the new product module (engine, tables, routes, entitlements).
3. Configure tenants/branding as **data**, not code.
4. Deploy — reuse the same onboarding, auth, RBAC, billing, multitenancy and the **Tier-0 security gate** unchanged.

### 16.5 Rules that keep it reusable
- **Dependency direction:** Product → SaaS Core → Security Core (never reversed).
- **Versioned packages** (semver) shared across product repos; each product pins a core version.
- **Contracts over concretions** — program to the cores' interfaces.
- **Config/data-driven** branding & entitlements (one bundle → many tenants/products).
- **Cores carry zero product vocabulary; products carry zero copies of auth/tenant logic.**

---

## 17. Recommendation
Adopt this as the target architecture. **Tenant resolution = identity (JWT); URL slug is a validated convenience only (§7.1).** Build the **Security Core + SaaS Core as reusable packages from day one (§16)** so this and future products share them. Sequence: **E0 (Security Core + SaaS Core packages + Tier-0 gate + tenant repo) → E1 (nest/cutlist/BOM behind `/engine/compute`, dual-run parity) → E2 (geometry → render model + local preview) → E3 (DB/multitenancy/auth) → E4 (FE tenant branding + entitlements)**. Each phase is shippable and reversible, and parity tests guarantee the PHP engine matches today's JS before the JS engine is retired. End state: a single static, tenant-themed renderer over a pure, per-tenant PHP engine — the front-end is a drawing surface with no brain.

---

## Version history
- **v1.1 (2026-06-29)** — Added **§7.1 tenant resolution** (locked: **identity/JWT is the authorization
  boundary**; URL tenant slug is an optional, validated convenience — answers the `/app/` routing question with
  recommended URL shapes + static-host rewrite). Added **§16 Reusable platform — Security Core + SaaS Core**
  (product-agnostic packages with one-way deps so future SaaS products reuse auth/tenancy/RBAC/onboarding/billing
  + the security gate unchanged). Recommendation + migration E0 updated to build the cores first; Recommendation
  renumbered to §17.
- **v1.0 (2026-06-29)** — Initial spec. Locked the thin-client/whole-engine boundary (all math server-side), the
  compute/edit/projects/config API contract, the canonical design document and render model, backend + frontend
  multi-tenancy (shared-schema isolation, JWT-claim tenant with URL match-guard, runtime per-tenant branding from
  a config endpoint), performance model (local preview + server reconcile, on-demand compute, pure-engine caching),
  security model, MySQL data model, tech choices, and a 6-phase parity-tested migration path. Extends ARCH-003.
