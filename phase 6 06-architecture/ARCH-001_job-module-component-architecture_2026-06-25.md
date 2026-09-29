---
title: "ARCH-001 — Job ▸ Module ▸ Component Architecture (room-level design)"
phase: 06_architecture
created: 2026-06-25
updated: 2026-08-14
version: 1.4
status: PHASES 1–4a IMPLEMENTED — P1 Job▸Module wrapper + switcher, P2 job-wide cut list / cross-module nesting / BOM rollup, P3 Room (run elevation) linked view, P4a WALL DESIGNER (2026-08-14) — the run elevation became a real design surface: a first-class wall entity (`layout.runs[]`), stable module ids, module types with automatic base heights, an add-unit palette, engine-published snap guides with a client-side drag ghost, overlap/gap/off-the-wall warnings in plain language, a per-band dimension chain, Tidy up, and Wall as the landing tab with double-click drill-in. Still one wall: multi-wall, plan view and rotation (P4b/P5) not started.
related:
  - phase 1-2 02-elicitation/session-notes/NOTES-002_Client-Review_2026-06-25.md
  - engine-vercel/app.js          # MODULE_TYPES + the wall layout block after roomBBox()
  - engine-vercel/lib/load.js     # __renderRoom + the wall intents
  - engine-vercel/tests/wall-parity.js
  - wallview-api/public/app/designer-thin/thin.js
---

# ARCH-001 — From single cabinet → Job ▸ Module ▸ Component

**Goal (client framing):** evolve the prototype from a single cabinet into a hierarchy —
**one Job Order contains multiple Modules** (cupboards, cabinets…), **each Module contains multiple
Components** (shelves, verticals, doors, drawers). The pivotal requirement: **link multiple modules
into one view** (e.g. a cupboard + a cabinet seen together at room / kitchen level).

> This is an architecture/plan document. No code changes are made by it. Build is deferred per client decision.

---

## 1. TL;DR / recommendation
The proposed hierarchy matches the industry standard: **Business ▸ Job/Project ▸ Room ▸ Module (cabinet) ▸ Part (component)**,
with **three linked views (Plan, Elevation, 3D)** and a **per-job rolled-up cut list**.

The hardest, highest-value piece is the **linked room view**. Recommendation: **do not** start with a full
2D floor-plan-with-walls. Start with a **run-based elevation/3D assembly** (modules snapped side-by-side along a
wall) — ~80% of the value (combined visual + **job-wide cut-list nesting**) at ~30% of the complexity — then
graduate to plan+walls. Architecturally, **today's global `S` becomes one Module**; a new **Job** wraps a list of modules.

---

## 2. Current state vs. target

| | Today (prototype) | Target |
|---|---|---|
| Scope | one cabinet (`S`) | many modules in a job |
| State | global `S` mixes cabinet + app settings | `Job ▸ Module ▸ Component`; settings split job vs module |
| Views | 2D front, 3D, sheet | + Plan, + Room/Run elevation, + 3D room |
| Cut list | one cabinet | per-module **and** per-job rollup (cross-module nesting) |
| AI / BOM | acts on the cabinet | acts on active module + job totals |

---

## 3. Benchmark analysis (what the leaders do)

| Tool | Hierarchy | Linked views | "Easy" signal | Take-away |
|---|---|---|---|---|
| **Mozaik** | Jobs ▸ Rooms ▸ cabinets, one control center | drag-drop floorplans + elevations | "manage all rooms/overrides from one screen" | Job dashboard + room overrides |
| **Cabinet Vision** | modular, parametric | design → manufacture | reuse a drawn cabinet & resize without reprogramming | Module library + parametric reuse |
| **PolyBoard** | parametric furniture | exploded + cut lists, auto assembly update | change propagates to outputs | Auto-recalc on every edit (already done) |
| **Chief Architect** | plan ▸ elevation ▸ 3D linked | edits propagate across views | extensive catalog, intuitive | One model, many synced views |
| **Cabinet Planner / Pro100** | floor plan + elevation + 3D + cutlist | plan / N-S-E-W elevations | lowest learning curve | "Easy" = few clicks, library, snapping |

**Winning pattern:** job control center → drop **standard modules** from a library → arrange by **drag-and-drop on
plan/elevation** → everything **recalculates into one cut list & price**. "Best + easy" = *low clicks to a correct
cut list*, not render beauty.

---

## 4. The core challenge — linking modules into one view
Each module lives in its **own local mm coordinate system** (origin bottom-left). Composing modules needs a
**placement transform** per module and a composing renderer.

| Approach | What it is | Effort | When |
|---|---|---|---|
| **A. Run (1D)** ⭐ | modules abut left→right along a wall; combined elevation + 3D; shared floor/worktop line | Low–Med | **Start here** |
| **B. Plan + walls (2D)** | place modules on a floor plan against walls, rotate, per-wall elevation | Med–High | Kitchen/room scale |
| **C. Full 3D room** | free 3D placement, appliances, worktops | High | Later / visualization |

Run-based (A) needs only `placement = { runId, offsetX, baseHeight }` per module and a loop that draws each module
translated by its cumulative width — **reusing the existing 2D/3D renderers** with an x-offset. Cheapest path to
"two modules in one view."

---

## 5. Proposed data model
Today `S` conflates **module data** and **app/session settings**. Split them:

```jsonc
Job {
  id, name, customer, createdAt,
  settings: { unit, sheet:{w,h,kerf}, grainLock, defaultMaterial },  // job-wide
  modules: [ Module ],
  layout:  { type:'run'|'plan', runs:[ { id, wall, modules:[moduleId…] } ] }
}
Module {                       // ~= today's S.cab + parts
  id, name, type:'base'|'wall'|'tall'|'cupboard',
  cab:{ w,h,d,t,back }, backPanel,
  comps:[ {type:'shelf'|'vertical'|'door'|'drawer', …} ],   // unchanged
  doors:{ reveal },
  placement:{ runId, offsetX, baseHeight, rotation }        // NEW — drives the linked view
}
```
- **App/session** keeps `unit, viewMode, zoom/pan, selectedModuleId, selectedId`.
- **Cut list/BOM**: per module, then a **job rollup** concatenates all modules' parts into **one nesting pass**
  → fewer sheets = headline benefit.

---

## 6. Linked views + the killer feature
- **Plan view** — top-down footprints along walls; click to enter a module.
- **Elevation / Run view** — modules side-by-side at correct base height ("whole kitchen wall").
- **3D room** — same, composed in 3D (reuse `buildBoxes` per module + offset).
- **Job cut list** — *the* differentiator: combine every module's parts into **one optimized sheet layout** and
  **one priced BOM**, with per-module subtotals. "How many boards for the whole job" beats any visual feature for a shop.

---

## 7. What "easy to use" must mean (benchmark bar)
1. **Job dashboard** as first screen (list/add modules) — Mozaik's control center.
2. **Module library**: drop *Base 600 / Wall 600 / Tall 2100*, then tweak — promote current presets to real module types.
3. **Snapping** edge-to-edge in a run; **auto base-height by type** (base on floor, wall ~1500, tall full height).
4. **One click** to the job-wide cut list & price.
5. Everything **recomputes live** (already achieved at module level).

---

## 8. Migration path (low-risk, incremental)
1. **Wrap, don't rewrite:** `Job = { settings, modules:[S-shaped] }`; editor operates on `job.modules[active]`. Single module ⇒ identical behaviour.
2. Move `unit/sheet/grainLock` to `job.settings`; module = cab+backPanel+comps+doors.
3. Add a **module switcher** (tabs/sidebar) + **Add module**.
4. Add **Run assembly view** (offset-compose existing renderers).
5. Add **job rollup cut list/BOM** (concat instances → one `nest()`).
6. AI copilot: scope tools to active module; add `add_module`, `list_modules`, job-level BOM.

---

## 9. Phased roadmap

| Phase | Deliverable | Value | Status |
|---|---|---|---|
| 1 | Job wrapper + module switcher (rename current to a Module) | multi-cabinet jobs | ✅ done |
| 2 | Job-wide cut list + BOM rollup (cross-module nesting) | biggest shop ROI | ✅ done |
| 3 | Run/elevation linked view (2 modules side-by-side) | "whole wall" view | ✅ done |
| 4a | **Wall designer** — wall entity, module types + auto base height, unit palette, snapping, warnings, dimension chain, wall-first workflow | design the whole run in one place | ✅ done 2026-08-14 |
| 4b | Plan view + multiple walls + rotation | room/kitchen scale | not started |
| 5 | Module library, fillers/worktop | pro polish | not started |

### Phase 4a as built (2026-08-14)
- **Design document** gains `schemaVersion: 2`, `layout: { type:'run', activeRunId, runs:[{ id, name, wall:{w,h,d}, origin }] }`,
  a stable `module.id`, `module.type`, and `placement: { runId, offsetX, baseHeight, rotation, pinned }`.
  Migration is **lazy, on read** (`hydrateModule` + `applyJob` + `ensureLayout`) — no SQL migration, and a
  pre-wall project still produces a byte-identical cut list (`engine-vercel/tests/wall-parity.js` §1).
- **New intents:** `place_module`, `set_wall`, `set_module_type`, `set_module_visible`, `tidy_wall`, and an
  extended `add_module {type, offsetX?, baseHeight?}`. `/edit` now accepts `room`/`render` so a wall edit
  refreshes the wall and the job cut list in **one** round trip.
- **Snapping** without breaking the thin-client rule: the engine publishes candidate guide lines
  (`room.guides`, each with `axis/at/align/kind/label`); the client only measures the drag against them at
  60 fps and sends the same tolerance back, so the engine's authoritative re-snap always reproduces the
  ghost the user saw.
- **Deferred:** job-wide `sheet`/`grainLock` (still per module — `jobNest` continues to use the active
  module's sheet spec). Only `unit` is read through, as `room.unit`.

---

## 10. Risks / decisions to lock first
- **Coordinate convention** — ✅ locked 2026-08-14, ratifying what `buildBoxes`/`__renderRoom` already
  assumed: X = 0 at the wall's left inner face; Y = 0 at the finished floor with `baseHeight` = the carcass
  underside; Z = 0 at the wall face; module origin = bottom-left-back.
- **Base heights per type** — ✅ in `MODULE_TYPES` (`engine-vercel/app.js`): base 0, wall 1500, tall 0.
  ⚠️ **Open with the client:** whether base units sit on a **plinth**. If they do, `MODULE_TYPES.base.baseHeight`
  must become the plinth height *before* customers save walls — changing it later moves every saved layout.
  It is deliberately the single place that number lives.
- **Shared vs per-module materials/sheet** — still per module; job-wide default with override is outstanding.
- **Selection model** across modules — Wall selects whole units by id; parts are still selected inside the
  Design tab (double-click a unit to drill in).
- **Save format & migration** — ✅ versioned (`schemaVersion: 2`) and migrated on read; ids are index-derived
  (`m1`, `m2`…) so they are deterministic even on a `/compute`, which does not return the design.

---

## 11. Sources (benchmark research, 2026-06)
- Mozaik Manufacturing — https://www.mozaiksoftware.com/mozaik-products/mozaik-manufacturing
- Mozaik Products — https://www.mozaiksoftware.com/mozaik-products
- Cabinet design software reviews (Sinclair) — https://sinclaircabinets.com/cabinet-design-software-reviews/
- SketchList: best cabinet software — https://sketchlist.com/blog/best-cabinet-design-software/
- Chief Architect kitchen/bath — https://www.chiefarchitect.com/kitchen-bath-software/
- Cabinet Planner — https://www.cabinetplanner.com/
- Pro100 — https://www.pro100usa.com/
- Cedreo: best kitchen design software 2026 — https://cedreo.com/blog/best-kitchen-design-software/

---

## Version history
- **v1.4 (2026-08-14)** — **Phase 4a implemented: the Wall designer.** Answers the client's "design all the
  modules in one place, a room wall". The Room tab (a viewer you could only drag modules across) became a real
  design surface and the **landing tab**, renamed **Wall**; the module editor is now what you drill into by
  double-clicking a unit. Built across the three live surfaces (`engine-vercel/`, `designer-thin/`, the PHP
  proxy) — **no new endpoints, no new tables, no SQL migration**.
  - **Wall entity**: `layout.runs[]` with a real `wall {w,h,d}`; an unsized wall is derived from what stands on
    it, and preset chips (3 m / 4 m / 6 m, standard / high ceiling) resize it — there is no number field.
  - **Stable module ids** (`m1`, `m2`…) back-filled in `applyJob`, fixing an index-keyed visibility bug on the way.
  - **Unit types** (`MODULE_TYPES`) drive size *and* base height: a wall unit lands at 1500 mm without input.
  - **Snapping**: the engine publishes named guide lines, the client latches a ghost onto them at 60 fps and
    returns the same tolerance, so the committed position always equals the ghost. Shift = free move.
  - **Warnings** in plain language (overlap / gap / past the end / too tall) and a **per-height-band dimension
    chain** with a wall total. **Tidy up** packs a run, honouring `pinned` units.
  - The client no longer writes `placement` itself — it goes through a `place_module` intent like everything else.
  - Fixed while building: `applyJob` rebuilt `JOB` from an object literal and so **silently dropped any new
    top-level key on every request** (the wall would have vanished on the first edit); `add_module` set
    `JOB.active` without moving `S`, which would have applied a new unit's preset to the previously active
    cabinet; and a new unit blocked its own free-slot search, parking the first cabinet at 600 mm instead of 0.
  - Regression suite: `node engine-vercel/tests/wall-parity.js` (parity + behaviour) and
    `wallview-api/tests/EngineControllerTest.php` (the proxy forwards `room`).
- **v1.3 (2026-06-29)** — **Phase 3 implemented** (the "see the whole wall" view) in `prototype/`: a new **Room
  tab** composes every module side-by-side as a **front elevation on one floor line**, reusing the per-module
  renderer via `withModule` + a world→screen transform (no renderer duplicated). Each module carries
  **`placement {offsetX, baseHeight}`** (persisted in the job). Per the client decision, all modules sit on the
  floor by default and **base height is manual** — drag a cabinet horizontally to position, drag up to lift/stack
  (snaps to floor < 30 mm); click selects/activates a module (jumps the editor to it). Room view has its own
  zoom (wheel) + pan (drag empty space). Started as **run-based 2D elevation** per §4 recommendation. Not yet:
  3D room compose, auto base-height-by-type, snapping/abutment between modules, plan + walls (Phase 4).
- **v1.2 (2026-06-29)** — **Phase 2 implemented** in `prototype/` (the headline ROI: fewer sheets). Added a
  **Module ⇄ Job scope toggle** on the cut-list panel that governs the cut list, summary, Sheet-layout tab,
  CSV/PDF export and AI BOM. In Job scope: a **consolidated job cut list**, **totals summed per-module** (so
  tape is correct even when modules band differently), and a **single cross-module nesting pass** (`jobNest`)
  → one optimised sheet set for the whole job. Implementation reuses every per-module geometry function via
  `withModule(m, fn)` (temporarily points global `S` at each module), so no logic was duplicated and module
  scope (default) is unchanged. AI gained `Cabinet.getJobCutList()` and `estimateBOM({scope:'job'})`. Known
  follow-ups: per-module **subtotal rows** in the job table (currently consolidated), and **colour/label sheet
  pieces by source module** (nest rects don't yet carry module id).
- **v1.1 (2026-06-29)** — **Phase 1 implemented** in `prototype/` (app.js/index.html/styles.css). The global
  `S` is now the active module inside a `JOB = { name, modules:[S-shaped], active, _mseq }` wrapper; the editor
  still operates on `S`, so **single-module behaviour is byte-for-byte unchanged**. Added a **module switcher**
  bar (switch / + Module / delete / double-click rename) and **job-level persistence** (`cabinet-cutlist-job`)
  with backward-compatible migration of legacy single-cabinet saves (`cabinet-cutlist-prototype`). Per-module
  settings (unit/sheet) kept on the module for now. Next: Phase 1 step 2 (split job-wide settings) and Phase 2
  (job-rollup cut list / cross-module nesting).
- **v1.0 (2026-06-25)** — Initial architecture plan from benchmark research + current prototype analysis. Hierarchy
  confirmed (Job ▸ Module ▸ Component); recommended run-based linked view first; data-model split (Job settings vs
  Module) and 5-phase roadmap defined. Implementation deferred ("just the plan").
