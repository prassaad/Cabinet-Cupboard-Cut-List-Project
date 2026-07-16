---
title: "ARCH-005 — Browser Distribution + Licensing (thin client, server is the license boundary)"
phase: 06_architecture
created: 2026-07-16
updated: 2026-07-16
version: 1.0
status: PLAN — authoritative spec; implementation NOT started. Builds on ARCH-004 (thin client + server engine, already implemented as wallview-api). SUPERSEDES ARCH-002's Electron-packaging direction for the protected product.
related:
  - phase 6 06-architecture/ARCH-004_thin-client-engine-and-multitenancy_2026-06-29.md
  - phase 6 06-architecture/ARCH-003_saas-backend-reuse_2026-06-29.md   (§8.1 Bearer-vs-cookie decision — REVISITED here)
  - phase 6 06-architecture/ARCH-002_deployment-electron-packaging_2026-06-26.md   (Electron packaging — SUPERSEDED for the protected SKU)
  - D:/xampp/htdocs/wallview-api/   (the built thin client + Node engine + PHP SaaS core)
---

# ARCH-005 — Browser Distribution + Licensing

**Goal.** Decide how the ARCH-004 thin client is **distributed** and how the product is **monetised and protected**, now that the engine already runs server-side.

> **The principle (locked, inherited from ARCH-004):** the engine is never in the distributed bundle, and **the server is the license boundary**. All valuable compute is server-side, so the entitlement check and the compute are the *same* round-trip — a cracked/forked client is a client that still cannot compute.

> Architecture/spec document. No code changes. Build deferred to an explicit go-ahead.

---

## 1. TL;DR / decisions locked

- **Distribute as a browser web app, not Electron.** Electron gives **zero** engine protection (asar unpacks, DevTools attach); since the bundle is engine-free by construction, packaging protects nothing. A browser delivers the same thin client with no installer, instant updates, one origin. **Electron is dropped for the protected product** (ARCH-002 superseded).
- **The protection source is architecture, not packaging:** engine server-side + **entitlement gate on every `/engine/*` call**. Name it correctly so we never regress.
- **Licensing model = named-user seats + concurrency limits** (server-enforced, browser-agnostic). Hardware/device locking is impossible in a browser and was never strong anyway — replaced, not mourned.
- **PWA** (manifest + service worker) recovers Electron's only real user-facing benefits: app-icon/standalone window, **offline *view* cache**, and auto-update — natively, cross-platform, no signing.
- **Token hardening the switch unlocks:** same-origin browser ⇒ move the **refresh token to an `HttpOnly; Secure; SameSite` cookie** (+ in-memory access token + CSRF) and a **strict CSP**. Strictly safer than the current `localStorage` refresh token. Revisits ARCH-003 §8.1 (which chose Bearer *because the consumer was Electron*).
- **Offline ⊥ protection stays:** view cached projects offline; **compute/edit require the server**. A protected-offline SKU (ships engine) is a separate paid tier only, never the default.

---

## 2. Why Electron adds nothing here (the reframe)

| Claimed Electron benefit | Reality for a thin, online client |
|---|---|
| Protects the code | **False.** `app.asar` unpacks in seconds; DevTools attach. Protection comes from the engine being **absent**, not packaged. |
| Licensing / device lock | Real, but replaced by **named-user seats + concurrency** (stronger operationally; see §4). |
| Offline use | The protected features are online-only *by design*. Offline **view** is recovered via PWA service worker (§5). |
| App feel / install | Recovered by **PWA install** (standalone window, icon) — no installer, no code signing. |
| Auto-update | Recovered by PWA SW update — a deploy is the update. |
| Native file export | Modern web (downloads, File System Access API) covers cut-list CSV/PDF export. |

**Net:** Electron = per-OS builds + code signing + auto-update infra + larger download, for **no protection**. Drop it. (Keep it in the back pocket *only* for a future protected-offline SKU, which is inherently less protected — §9.)

---

## 3. Threat model (what we defend, and how)

| Threat | Defended by |
|---|---|
| Extract engine algorithms / pricing / catalog | Engine runs server-side only; bundle engine-free (build-guard §8) |
| Use the product without paying | **Server refuses to compute** without an entitled token — client cannot produce cut list / nest / BOM at all |
| Crack / fork / re-host the client | Irrelevant — a forked client still can't compute; the API is the gate |
| Call the API directly (bypass the UI) | Fine — the API *is* the product; auth + entitlement + rate-limit gate every call |
| Steal a token | HttpOnly refresh cookie (immune to XSS read) + short access TTL + refresh rotation + CSP; concurrency + revocation server-side |
| Share one account across a team | Named-user seats + **concurrency cap** + usage metering/anomaly detection |
| Reverse-engineer rules from outputs | **Inherent limit** (ARCH-004 §11): rectangles/dims/BOM totals are on screen. Send totals/line-items only; **never** raw rate tables |

**Crucial:** the server is the license server. There is no "crack your way to a free cut list" — the compute *is* the gated resource.

---

## 4. Licensing model — named-user seats + concurrency

Hardware/device binding is impossible in a browser (no stable machine id; localStorage/cookies/fingerprints are resettable). So:

- **Named-user seats.** A subscription grants **N seats = N named, email-verified user accounts** in the tenant. Standard SaaS model (Figma/Notion/Linear). Robust and server-enforced.
- **Concurrency limit.** Max **C simultaneous active sessions** per subscription (often C = seats). Enforced server-side by tracking live refresh tokens; exceeding it forces a session out or blocks the new login. This is what actually deters account sharing.
- **"Registered clients" (soft/UX only).** A `localStorage` client id, registered on login, lets users *see and revoke* their active browsers ("You're signed in on 3 browsers"). It **counts toward concurrency for UX**, but is not a hard security control — never gate entitlement on it alone.

> The old ARCH-005 "devices" table becomes **`sessions` / `registered_clients`**. Hard control = named users + concurrency; soft UX = registered clients.

---

## 5. Distribution — browser web app + PWA

- **One static bundle, same origin as the API.** Serve the engine-free thin client from the API origin (e.g. `wallview.standscale.com/app/` — already built). Same-origin ⇒ no CORS, cookie auth works, smallest security surface. Matches ARCH-004 §8.
- **PWA layer:**
  - **Web manifest** → installable icon, standalone window (app feel, no browser chrome).
  - **Service worker** → cache the app shell + assets (instant loads, auto-update on redeploy).
  - **IndexedDB** → cache design documents + last render model for **offline view** (open & inspect saved projects with no connection; compute stays blocked).
- **No installer, no code signing, no per-OS builds, no auto-update pipeline.** A deploy is the update.

---

## 6. Backend — entitlement layer (extends SaaS Core, ARCH-004 §16)

New tables (all tenant-scoped, FK'd + cascaded per the db-audit standard):

```sql
plans(          id PK, code, name, seats, features JSON, price_ref )        -- catalog of plans
subscriptions(  id PK, tenant_workspace_id FK, plan_id FK, status,          -- active|past_due|canceled|trialing
                current_period_end, provider, provider_ref, seats,
                created_at, updated_at )
seats(          id PK, tenant_workspace_id FK, subscription_id FK,
                user_id FK NULL, invited_email, status )                    -- named-user assignment
sessions(       id PK, tenant_workspace_id FK, user_id FK, client_id,       -- concurrency + "your logins"
                refresh_token_hash, created_at, last_seen, revoked )
usage_events(   id PK, tenant_workspace_id FK, user_id FK, kind,            -- compute|edit|export
                units, meta JSON, created_at )                              -- metering + audit
```

**`EntitlementMiddleware` (new)** — runs after Auth + Tenant, on every `/engine/*` and every `/projects` **write**:
1. Subscription is `active` or `trialing` (else `402 Payment Required`).
2. Feature flag allows the action (pricing/export/max-modules from `plans.features`).
3. The user holds a **seat**, and **concurrency** is within limit (else `403` with a clear reason).
4. On success, emit a `usage_event` (async) for metering/audit.

Pipeline: `Auth → Tenant(IDOR guard) → Entitlement → RateLimit → Controller → EngineClient → Node engine`.

**Billing:** Stripe (test mode first). Checkout for subscribe/upgrade; **webhooks** update `subscriptions.status` + `current_period_end`. Entitlement reads status; `past_due` blocks compute immediately (short grace optional for *view*).

---

## 7. Security — same-origin token model + CSP

**Revisits ARCH-003 §8.1** (Bearer was chosen *because the consumer was Electron*; the consumer is now a same-origin browser):

- **Refresh token** → `HttpOnly; Secure; SameSite=Strict` cookie. Never readable by JS ⇒ immune to XSS exfiltration. Rotated on use (rotation already built).
- **Access token** → in memory only (short TTL, e.g. 15 min); silently refreshed via the cookie.
- **CSRF token** for state-changing calls (double-submit or header token) since auth now rides a cookie.
- **Strict CSP** — the bundle is 100% first-party and engine-free, so `script-src 'self'`, no third-party scripts, `connect-src 'self'` is easy and kills the main token-theft vector.
- **Tier-0 gate from ARCH-003 still precedes any real user** (secrets out of repo, required JWT key, structural tenant isolation, no plaintext passwords).

> Trade-off: cookie auth requires **same-origin** (client served from the API origin) and CSRF handling. Both are acceptable and desired. If a cross-origin/CDN split is ever needed, fall back to Bearer + in-memory + refresh-in-cookie on the API subdomain.

---

## 8. Build-time invariant — the guard that makes this real

- **CI asserts the deployed client bundle contains ZERO engine symbols** (no `nest`, `cutListInstances`, `aiEstimateBOM`, `partRect`, `buildBoxes`, `PRESETS`, `DEFAULTS`, construction constants…). A simple grep/AST check that **fails the build** if the engine leaks into the client.
- This is the single mechanical check that keeps "the engine is never in the bundle" true forever, across refactors.

---

## 9. Offline & the protected-offline SKU

- **Allowed offline:** open and **view** previously computed projects (design doc + last render model cached in IndexedDB). Leaks nothing new.
- **Blocked offline:** edit / compute / nest / BOM — "Reconnect to compute."
- **Protected-offline is a contradiction** (ARCH-004 §1). If ever required, that build must ship the engine (native or WASM) and is inherently less protected — keep it a **separate, higher-priced, licence-gated SKU**, never the default browser product. This is the *only* scenario where Electron/WASM returns.

---

## 10. Migration / build order

| Step | Deliverable | Notes |
|---|---|---|
| **L1** | **Entitlement layer**: `plans/subscriptions/seats/sessions/usage_events` + `EntitlementMiddleware` on `/engine/*` + `/projects` writes | turns "logged in" into "paid & allowed" |
| **L2** | **Billing hook** (Stripe test) + subscribe/renew screens in the thin client | webhooks → subscription status |
| **L3** | **Named-user seats + concurrency** on login (replaces device registration) | seat invite/assign; concurrency cap |
| **L4** | **Usage metering + audit** events | billing + anomaly detection |
| **L5** | **PWA** (manifest + service worker + IndexedDB offline-view) | replaces the Electron wrapper |
| **L6** | **Token hardening**: refresh → HttpOnly cookie + CSP (revisit ARCH-003 §8.1) | or keep Bearer + add CSP as an interim |
| **L7** | **Build-time guard**: CI zero-engine-symbols check | the invariant |

Each step is shippable and reversible. L1 is the keystone (the gate that monetises).

---

## 11. Residual limits (honest)

- **The render model is visible** — rectangles, dimensions, cut sizes, BOM totals are on screen by definition. You hide the *how* (algorithms, nesting, catalog, pricing math), never the *what's drawn*. Keep raw rate tables server-only.
- **Account sharing** is easier than a hardware lock — mitigated (named seats + concurrency + metering), not eliminated. This is the normal SaaS posture.
- **XSS is the main token risk** in any browser app — addressed by HttpOnly refresh cookie + strict CSP + first-party-only bundle.

---

## 12. Decisions to lock

- **Distribution: browser web app + PWA. Electron dropped for the protected SKU.** (Locked.)
- **Licensing: named-user seats + concurrency.** Confirm seat/concurrency numbers per plan.
- **Token model: HttpOnly refresh cookie + in-memory access + CSRF + CSP** (revisit ARCH-003 §8.1) — adopt now, or ship L1–L5 on Bearer and switch at L6? (Recommend adopt with L1.)
- **Billing provider: Stripe** (vs Paddle/merchant-of-record for global tax). Confirm.
- **Grace policy** on `past_due` (block compute immediately; allow view for N hours?).
- **Same-origin hosting** confirmed (client served from API origin) — required for the cookie model.

---

## 13. Recommendation

Adopt browser-only distribution with a PWA layer, and make the **API the license boundary** via an entitlement middleware on every engine/write call. License by **named-user seats + concurrency**, bill via **Stripe**, and harden tokens with an **HttpOnly refresh cookie + CSP** (revisiting ARCH-003's Electron-era Bearer choice). Enforce the whole model with one mechanical **build-time guard**: the client bundle must contain zero engine symbols. Sequence **L1 (entitlement) → L2 (billing) → L3 (seats/concurrency) → L4 (metering) → L5 (PWA) → L6 (token hardening) → L7 (build guard)**. End state: a single engine-free browser client (installable as a PWA) over a per-tenant, per-seat, metered PHP SaaS core and a server-side engine — where paying is the precondition to computing, and there is nothing in the client worth stealing.

---

## Version history
- **v1.0 (2026-07-16)** — Initial spec. Locked **browser-only distribution + PWA** (Electron dropped for the protected SKU; ARCH-002 superseded), **named-user seats + concurrency** licensing (device/hardware locking rejected as impossible/weak in a browser), the **entitlement layer** (plans/subscriptions/seats/sessions/usage_events + `EntitlementMiddleware` on `/engine/*` and `/projects` writes) as the monetisation gate, **Stripe** billing hooks, a **same-origin HttpOnly-refresh-cookie + CSP** token model (revisiting ARCH-003 §8.1's Electron-era Bearer choice), **offline-view-only** (protected-offline reserved for a separate SKU), and the **build-time zero-engine-symbols guard** as the invariant. Threat model, residual limits, and a 7-step (L1–L7) build order defined. Builds on the implemented ARCH-004 thin client + Node engine + PHP SaaS core in `wallview-api`.
