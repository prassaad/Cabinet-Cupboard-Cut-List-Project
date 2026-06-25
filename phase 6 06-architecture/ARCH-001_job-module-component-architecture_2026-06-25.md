---
title: "ARCH-001 — Job ▸ Module ▸ Component Architecture (room-level design)"
phase: 06_architecture
created: 2026-06-25
updated: 2026-06-25
version: 1.0
status: PLAN — approved to document; implementation NOT started (client: "just the plan, not yet building")
related:
  - phase 1-2 02-elicitation/session-notes/NOTES-002_Client-Review_2026-06-25.md
  - prototype/app.js
  - prototype/ai.js
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

| Phase | Deliverable | Value |
|---|---|---|
| 1 | Job wrapper + module switcher (rename current to a Module) | multi-cabinet jobs |
| 2 | Job-wide cut list + BOM rollup (cross-module nesting) | biggest shop ROI |
| 3 | Run/elevation linked view (2 modules side-by-side) | "whole wall" view |
| 4 | Plan view + walls + base-height-by-type | room/kitchen scale |
| 5 | Module library/types, snapping, fillers/worktop | pro polish |

---

## 10. Risks / decisions to lock first
- **Coordinate convention** (module origin, base heights per type) — decide once; everything depends on it.
- **Shared vs per-module materials/sheet** — recommend job-wide default with module override.
- **Selection model** across modules (active module vs global pick).
- **Save format & migration** — versioned `Job` JSON; auto-migrate single-`S` saves.

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
- **v1.0 (2026-06-25)** — Initial architecture plan from benchmark research + current prototype analysis. Hierarchy
  confirmed (Job ▸ Module ▸ Component); recommended run-based linked view first; data-model split (Job settings vs
  Module) and 5-phase roadmap defined. Implementation deferred ("just the plan").
