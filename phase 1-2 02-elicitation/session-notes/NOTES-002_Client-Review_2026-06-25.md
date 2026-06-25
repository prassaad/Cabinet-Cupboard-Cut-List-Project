---
title: First Review — Cabinet & Cupboard Cut List (Change Requests)
phase: 02_elicitation
created: 2026-06-25
version: 1.0
status: CONFIRMED (client clarifications 2026-06-25) — video still untranscribed but key decisions captured
format: NOTES-[###]_[Role]_[YYYY-MM-DD].md
source_artifacts:
  - project_references/Cabinet & Cupboard Cut List First Review.mp4   # AUTHORITATIVE — not yet transcribed
  - project_references/Cabinet & Cupboard Cut List Review 1/Cabinet & Cupboard Cut List1.jpeg
  - project_references/Cabinet & Cupboard Cut List Review 1/Cabinet & Cupboard Cut List2.jpeg
  - project_references/Cabinet & Cupboard Cut List Review 1/Cabinet & Cupboard Cut List3.jpeg
  - project_references/Cabinet & Cupboard Cut List Review 1/Cabinet & Cupboard Cut List4.jpeg
  - project_references/Cabinet & Cupboard Cut List Review 1/Cabinet & Cupboard Cut List5.jpeg
---

# NOTES-002_Client-Review_2026-06-25

**Interview:** First Review (product walkthrough) | **Participant:** Client / cabinetmaker | **Date:** 2026-06-25 | **Interviewer:** —

**Linked to:** prototype/ (app.js · index.html · styles.css) | [BRD — Construction parameters] | [UC — Configure cabinet construction]

> ⚠️ **Provenance note.** The spoken brief lives in `…First Review.mp4`, whose audio has **not** been transcribed (no transcription/ffmpeg tooling available in-session). The list below is reconstructed from (a) the 5 reference photos, (b) the client's stated principle — *"20 mm and groove etc, they must be adjustable or configurable"* — and (c) **client clarifications on 2026-06-25** (recorded below). Remaining unconfirmed numbers are still marked **[VERIFY]**.

> ✅ **Client clarifications (2026-06-25):**
> 1. **Back panel — the MAIN pain point. Make the complete back panel configurable:** groove vs rabbet vs overlay, plus thickness / groove depth / setback.
> 2. **Carcass thickness:** provide a field to configure and **render accordingly** (18 or 20, free value).
> 3. **Per-part finishes / materials (CR-3): DEFERRED for now.**
> 4. **Everything else** (joinery, adjustable vs fixed shelves, door overlay/hinge, cut-list format): *"decide the best related to the critical structure"* → keep current sensible defaults, no new config this pass.

---

## Key Quotes (paraphrased — to be replaced with verbatim from video)

> "20 mm and groove etc. — they must be adjustable / configurable."
> — Client (paraphrased, pending verbatim)

---

## Governing principle (the real change)

The reference cabinet shows several **real-world construction features the prototype does not model**, and the client's instruction is that the construction values must **not be hard-coded** — they must be **adjustable/configurable** so the output matches how the shop actually builds.

Two new configuration groups are implied:
1. **Construction / Joinery** settings
2. **Materials / Finish** settings

Every change below ripples through the same pipeline: **Cut list → Sheet nesting → 3D view → BOM/cost.**

---

## What the reference photos evidence

| Photo | Feature shown | Prototype assumption today | Gap |
|------|----------------|----------------------------|-----|
| 1 — top panel underside | Cam-lock (minifix) + dowels + confirmat screws | No joinery concept | Construction method not modelled |
| 2 — rear | Thin back panel set in a **groove**, inset & recessed | Back = full `w×h`, same thickness, flush | Back construction wrong |
| 3 — side | **Two-tone**: dark laminate outside, beech inside; back recessed | One wood colour for all parts | No per-part material/finish |
| 4 — door open | Concealed Euro hinge + **adjustable shelves on pins** (hole rows) | Door flat overlay; shelves fixed | Hinge type & adjustable shelves missing |
| 5 — interior | Shelves shallower than carcass; edge-banding on front edges only | Shelves default full depth; banding generic | Setback/depth + banding detail |

---

## Change Requests (CR) — each = "make configurable"

### CR-1 — Back panel construction ("the groove") — ✅ CONFIRMED & IMPLEMENTED (v1.0)
- **Client:** complete back panel must be configurable (the main pain point).
- **What it means:** Back was a full-size `w × h` panel, same 20 mm, flush at the rear. Now configurable construction.
- **New config (Back panel card):** Fixing = `Groove/dado | Rabbet/rebate | Full overlay`; **back thickness** (independent); **groove/rebate depth**; **setback from rear**. (Include-back checkbox retained; unchecking hides the card.)
- **Decided defaults (mine — adjust if video differs):** thickness `6 mm`; groove/rebate depth `8 mm`; setback `12 mm`; default fixing `groove`.
- **Geometry implemented:**
  - overlay → back = `w × h`, front face at `z = thickness`
  - groove/rabbet → back = `(w−2t+2·depth) × (h−2t+2·depth)`, recessed by `setback`, front face at `z = setback + thickness`
- **Pipeline impact (done):** back cut-list size recomputed; **usable interior depth = cabinet depth − back front face**, so default shelf/divider depth shrinks accordingly; 3D renders the back inset & recessed; selection/highlight for the Back part uses the new size.
- **Clarity:** 9/10. **Still open [VERIFY]:** exact default numbers vs video.

### CR-2 — Material (carcass) thickness — ✅ CONFIRMED (already satisfied)
- **Client:** provision to configure and render accordingly.
- **Status:** the `Material thickness` field already drives all parts and re-renders live; back panel has its own independent thickness (CR-1). No further work this pass. Default `20 mm` (free value; 18 acceptable).

### CR-3 — Per-part material / finish (two-tone) — ⏸ DEFERRED (client)
- Deferred for now per client. Kept here for later: Materials list (name + colour + thickness + £/sheet) per part group; drives 3D colour + per-material BOM.

### CR-4 — Joinery / construction method + shelf type — ⏸ DEFAULTS (decide-best)
- No new config this pass. Current behaviour retained: shelves fixed within cells; AI BOM infers hardware. Revisit after back-panel structure is signed off.

### CR-5 — Door & hinge — ⏸ DEFAULTS (decide-best)
- No new config this pass. Door stays full-overlay with existing reveal field; AI BOM infers hinges by door height.

### CR-6 — Edge banding detail — ⏸ DEFAULTS (decide-best)
- No new config this pass. Per-edge banding selection retained; banding thickness not modelled yet.

---

## Hard-coded constants to lift into config (audit)

| Constant today | Location (prototype) | Becomes |
|---|---|---|
| Back = full overlay, carcass thickness | `cutListInstances()` / `buildBoxes()` | CR-1 back config + back thickness |
| Shelves always fixed, full depth | `addComp()` / cut list | CR-4 adjustable; CR-1/CR-3 depth |
| Hinge count formula, 4 pins/shelf, prices | `aiEstimateBOM()` (ai BOM) | CR-4/CR-5 configurable rules |
| Single wood colour | `buildBoxes()` colours | CR-3 per-part material |
| Door overlay (full) | `doorRects()` | CR-5 overlay type |

*(Already configurable and to be retained: cabinet W/H/D, material thickness, sheet size, kerf, grain lock, doors count + reveal, per-edge banding, per-component depth.)*

---

## Decision: build approach
Client direction (this session) = **"All as one config pass"** → implement **Construction/Joinery + Materials** config groups together, not piecemeal.

---

## Action Items

| Action | Owner | Due | Priority |
|--------|-------|-----|----------|
| Paste/transcribe video key points; replace **[VERIFY]** items; bump to v1.0 | Client | — | H |
| Confirm defaults/ranges/units for all CR fields | Client | — | H |
| Produce consolidated "config pass" build plan (fields + pipeline impact) | Dev | after v1.0 | H |
| Implement Construction/Joinery + Materials config in one pass | Dev | after plan sign-off | H |

---

## Follow-Up Questions

- [ ] Back panel: groove vs rabbet vs overlay — and the three numbers (thickness / groove depth / setback)?
- [ ] Carcass thickness default — 18 or 20 mm?
- [ ] Which parts are different finishes, and their names + £/sheet?
- [ ] Joinery method, and shelves adjustable or fixed (pin pitch)?
- [ ] Door overlay type + reveal/gap; hinge type?
- [ ] Any cut-list / output-format changes requested in the video?

---

## Linked Artifacts

- Reference video (authoritative, untranscribed): `project_references/Cabinet & Cupboard Cut List First Review.mp4`
- Reference photos (1–5): `project_references/Cabinet & Cupboard Cut List Review 1/`
- Prototype under review: `prototype/app.js`, `prototype/index.html`, `prototype/styles.css`
- Divergence Log: `../divergence-log.md`
- Template: `./NOTES-001_TEMPLATE.md`

---

## Implemented this pass (v1.0 build)
- **Back panel fully configurable** — new "Back panel" card: Fixing (Groove/Rabbet/Overlay), Back thickness, Groove/rebate depth, Setback from rear. Drives cut-list size, 3D inset/recess, usable interior depth, and Back-part selection/highlight.
  - Files: `prototype/index.html` (Back panel card), `prototype/app.js` (`backGeom()`, `backFront()`, updated `compDepth`, `cutListInstances`, `buildBoxes`, `carcassPartInfo`, `instancesForSelection`, `syncInputs`/`syncBackUI`, `readBack` + wiring), `prototype/styles.css` (`.card.hidden`).
- **Carcass thickness** — confirmed already configurable + live render.
- Deferred: CR-3 (materials), and CR-4/5/6 kept at sensible defaults.

## Version history
- **v1.0 (2026-06-25)** — Client clarifications captured; CR-1 (back panel) + CR-2 (thickness) confirmed and implemented; CR-3 deferred; CR-4/5/6 held at defaults. Remaining `[VERIFY]`: exact back-panel default numbers vs the (untranscribed) video.
- **v0.1-draft (2026-06-25)** — Initial capture from 5 reference photos + client principle ("20 mm, groove… configurable").
