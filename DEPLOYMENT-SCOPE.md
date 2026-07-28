# Deployment Scope — what ships, and where to make changes

> **Read this before implementing anything.** The repo was consolidated on 2026-07-27 to
> **one engine + one thin client + the PHP API**. The old duplicate engines/designers were
> deleted to end the maintenance trap. Do not reintroduce them.

_Last confirmed with the product owner: 2026-07-27._

## ✅ The three surfaces (this is the whole product)

| # | Surface | Path | Role |
|---|---------|------|------|
| 1 | **Engine (Node)** | `engine-vercel/` | THE engine — the single source of truth (cut list, edge banding, part naming, drawer/fascia geometry, nesting, BOM). Deployed to Vercel; the PHP API proxies to it. |
| 2 | **Thin client** | `wallview-api/public/app/designer-thin/` (`thin.js`, `index.html`, `styles.css`, `brand.css`) | The UI. Holds NO engine — renders the model the engine returns and sends edit intents. |
| 3 | **PHP API** | `wallview-api/` (`src/…`, `public/index.php`) | Auth, multi-tenancy, persistence, and **proxying engine calls** to `ENGINE_URL`. |

### Data flow
```
designer-thin/thin.js
  → POST /{tenant}/engine/{compute|edit}   (PHP: EngineController → EngineClient)
  → ENGINE_URL                              (wallview-api/.env → https://wallview-engine.vercel.app)
  → the deployed engine-vercel/app.js
```
`wallview-api/.env` → `ENGINE_URL=https://wallview-engine.vercel.app`. The engine that serves
users **is the Vercel deployment of `engine-vercel/app.js`.** There is no longer a local engine copy.

## Where to make a change

- **Engine / compute logic** (cut list, edge banding, part naming, drawer & fascia geometry, nesting, BOM):
  edit **`engine-vercel/app.js`** (and `engine-vercel/lib/load.js` for the row/model shape) → **redeploy to Vercel**.
  This is now the ONLY engine copy — no mirroring needed.
- **Thin client UI** (panels, canvas, controls, selection editors, cut-list table, exports):
  edit **`wallview-api/public/app/designer-thin/`**.
- **API / auth / tenancy / persistence**: edit **`wallview-api/` PHP (`src/…`)**.

## Removed 2026-07-27 (do NOT recreate)

| Path | Was | Why removed |
|------|-----|-------------|
| `prototype/` | Standalone designer w/ inline engine (dev tool). | Duplicate engine + old UI. |
| `dist/` | Old WallView standalone build. | Stale duplicate. |
| `server/` | Dev static server for `prototype/`. | Dead with prototype. |
| `electron/` | Desktop wrapper around `prototype/`. | Dead with prototype. |
| `wallview-api/engine/` | Local Node copy of the engine. | Redundant — the engine is `engine-vercel`, reached via `ENGINE_URL`. |
| `wallview-api/public/app/app.js` (+ index.html/styles.css/skin.css/effex.css) | Old full designer on the PHP side. | Superseded by `designer-thin/`. |

## Notes
- `brand/` and `brand-wallview/` (standalone logo assets) and the `phase */`, `project_references/`,
  `phases_admin/` doc folders were kept.
- The thin client's band grid is currently **inert** — edge banding is engine-driven (defaults + the
  "exterior faces auto-band" rule) and shown via the cut-list "Banded edges" column + tape total.
- `wallview-api/` at the repo root is **untracked** (freshly copied). To version it, `git add` it with a
  `.gitignore` for `vendor/` (and any `node_modules`). It is byte-current with `D:\xampp\htdocs\wallview-api`.
