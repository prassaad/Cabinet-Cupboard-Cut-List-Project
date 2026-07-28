# WallView API

Multi-tenant SaaS backend for the WallView cabinet product (ARCH-004). This is
**slice 1: the full auth + multi-tenancy foundation** — the API kernel, Security
Core, and SaaS Core. The compute engine (`/engine/compute`) lands in the next
slice and plugs into this kernel unchanged.

## Layers (one-way dependencies)

```
Standscale\Security   ->  Standscale\SaasCore   ->  Standscale\Products\WallView
(tokens, hashing,         (identity, tenancy,        (engine, projects, catalog —
 tenant-scoped repo,       onboarding funnel,          next slice)
 auth/tenant/rbac mw)      RBAC, tenant config)
```

`Products -> SaasCore -> Security`, never reversed. Kept as namespaced layers in
one repo; extractable to Composer packages later.

## Requirements

- PHP 8.0+ (XAMPP), extensions: `pdo_mysql`, argon2id (`PASSWORD_ARGON2ID`).
- MySQL / MariaDB (local `wallview_dev`).
- Composer.

## Setup

```bash
cd D:/xampp/htdocs/wallview-api
composer install

# 1. Config — copy the template and set a real key.
cp .env.example .env
php -r "echo bin2hex(random_bytes(48));"      # paste into JWT_KEY=

# 2. Database — fresh local schema (never point dev at production).
"D:/xampp/mysql/bin/mysql.exe" -u root -e "CREATE DATABASE wallview_dev CHARACTER SET utf8mb4"
"D:/xampp/mysql/bin/mysql.exe" -u root wallview_dev < migrations/001_core_schema.sql
"D:/xampp/mysql/bin/mysql.exe" -u root wallview_dev < migrations/002_projects.sql
```

`JWT_KEY` is **required** — the app refuses to boot without it (no default key).

## Run

- Under XAMPP Apache: `http://localhost/wallview-api/public/api/v1/health`
- Or the built-in dev server (front-controller as router):

  ```bash
  php -S 127.0.0.1:8099 public/index.php
  ```

## API (v1)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/api/v1/health` | — | liveness |
| POST | `/api/v1/register` | — | funnel: capture contact, issue verification code |
| POST | `/api/v1/verify` | — | funnel: check code, issue single-use invite code |
| POST | `/api/v1/workspace/setup` | — | provision tenant+company+admin+roles+config, auto-login |
| POST | `/api/v1/login` | — | `{email, subdomain, password}` -> JWT + refresh |
| POST | `/api/v1/refresh` | — | rotate refresh token -> new pair |
| POST | `/api/v1/logout` | — | revoke refresh token |
| GET  | `/api/v1/me` | Bearer | echo the authenticated identity |
| GET  | `/api/v1/{tenant}/config` | Bearer | branding + entitlements (IDOR-guarded) |
| GET/POST | `/api/v1/{tenant}/projects` | Bearer | list / create design documents |
| GET/PUT/DELETE | `/api/v1/{tenant}/projects/{id}` | Bearer | read / save / delete a design |
| POST | `/api/v1/{tenant}/engine/nest` | Bearer | server-side sheet-nesting optimiser (ARCH-004 E1) |

## Server-side engine (ARCH-004 E1 done + E2 first cut)

The **real cabinet engine runs server-side** — the same `app.js`, loaded headless
in a Node "engine service", so the derivation rules, nesting and pricing execute
on the server and no longer need to ship to the browser (single-engine strategy:
no re-port, no parity drift).

```
browser (renderer) ──design──▶ PHP API (auth/tenant) ──▶ Node engine (real app.js)
                    ◀─render model (cutlist/nest/BOM)──
```

- **Node engine service** — `engine/server.js` loads `app.js` via `engine/load.js`
  (universal DOM stub) and exposes `POST /compute {design,scope}` →
  `{cutList, totals, sheets, bom}`. Run it:
  ```bash
  cd engine
  PORT=4001 ENGINE_KEY=<shared-secret> node server.js
  ```
- **PHP proxy** — `POST /api/v1/{tenant}/engine/compute` forwards to `ENGINE_URL`
  (config in `.env`) with `X-Engine-Key`, after auth + tenant checks. Browsers only
  ever talk to PHP; they never receive the engine code.
- **Client (E2 first cut)** — the designer's **Cut list (server)** button posts the
  design and renders the authoritative cut list + nesting + priced BOM from the
  hidden engine.

**Deploy note (cPanel):** point `ENGINE_URL` at wherever Node runs — a cPanel
"Setup Node.js App" on the same account, or a separate small host. If Node is
unavailable, the standalone PHP `Nester` (below) still covers nesting.

**Remaining (E2 endgame):** delete the engine from the browser bundle entirely —
refactor the live 2D/3D editor to consume a full server render model + edit
intents. Large, careful change to the live editor; tracked as the next effort.

## Engine — standalone PHP nester (ARCH-004 E1, pure-PHP path)

The **nesting optimiser** is ported to PHP (`src/Products/WallView/Engine/Nester.php`)
and served at `POST /{tenant}/engine/nest` — it no longer ships to the browser.
Input `{sheet:{w,h,kerf}, grainLock, items:[{name,length,width,thick,key,srcId}]}`
→ `{sheets:[{levels,placements}], utilisation, SW, SH}`. Pure/stateless → cacheable.

**Parity gate (JS is the oracle):** `tests/parity/gen_golden.js` extracts the real
`nest()`/`groupKey` from `prototype/app.js` (brace-matched, not rewritten), runs 93
seeded + edge cases, and writes `tests/parity/nest_golden.json`. `NesterParityTest`
asserts the PHP port reproduces every case exactly. Regenerate on JS changes:

```bash
node tests/parity/gen_golden.js /path/to/prototype/app.js
php vendor/phpunit/phpunit/phpunit --filter NesterParityTest
```

Next cuts: port `cutListInstances`/`cutList` (geometry-derived cut list) and
`aiEstimateBOM` (priced BOM + catalog) behind `/engine/compute`; then rewire the
designer to consume server results (E2). The client is unchanged so far.

## Cabinet designer (UI)

`http://127.0.0.1:8099/app/` → sign in → **Open designer** (`/app/designer/`).
The designer is the vanilla 2D/3D/cut-list/nesting/BOM app; `designer/cloud.js`
adds the SaaS layer: session guard, runtime tenant branding, and cloud
**Projects** (New / Open / Save / Save As) backed by `/{tenant}/projects`. The
design engine still runs client-side — the server-side engine (`/engine/compute`)
is the next slice; the JS engine stays the parity oracle during that migration.

Errors use one envelope: `{ "error": { "code", "message", "field?" } }`.

### Quick smoke (dev mode returns the codes)

```bash
BASE=http://127.0.0.1:8099
curl -s -X POST $BASE/api/v1/register -d '{"email":"a@ex.com"}'            # -> devCode
curl -s -X POST $BASE/api/v1/verify   -d '{"email":"a@ex.com","code":"123456"}'   # -> inviteCode
curl -s -X POST $BASE/api/v1/workspace/setup \
  -d '{"inviteCode":"...","email":"a@ex.com","subdomain":"acme","businessName":"Acme","password":"secret12"}'
# -> { accessToken, refreshToken, user, tenant }
```

## Verification

`tests/e2e.sh` drives the whole flow and asserts the security properties
(auth-required 401s, IDOR 403, refresh rotation single-use, wrong-password 401):

```bash
php -S 127.0.0.1:8099 public/index.php &
BASE=http://127.0.0.1:8099 bash tests/e2e.sh
```

PHPUnit (`tests/TenantScopedRepositoryTest.php`) covers the isolation invariant —
the scoped repository always injects the tenant predicate.

## Security posture (Tier-0 gate, satisfied by construction)

- **No committed secrets** — all config in `.env` (gitignored); `JWT_KEY` required at boot.
- **JWT** via `firebase/php-jwt`, HS256 pinned by an explicit `Key` allow-list (forged-alg rejected).
- **Structural tenant isolation** — `TenantScopedRepository` injects `tenant_workspace_id` on every query; the `{tenant}` URL slug is only a checked assertion against the signed claim (IDOR guard).
- **argon2id** password hashing; **no plaintext** password stored anywhere.
- **Bearer-only** API auth (no cookies); tenant-keyed rate limiting; security headers on every response.
- **Schema** is InnoDB with FKs + `ON DELETE CASCADE` on every ownership/tenant relation.
