/* Cabinet & Cupboard Cut List — vanilla prototype (zero dependency)
   Design (2D drag + 3D orbit/pick) · Sizes · Cutlist · Sheet nesting
   Nested cell-bounded shelves/verticals · per-edge banding · doors · exploded 3D · on-canvas units.
   All dimensions stored internally in millimetres. */

'use strict';

// ---------- Config ----------
const PRESETS = {
  base: { w: 600, h: 720,  d: 560 },
  wall: { w: 600, h: 720,  d: 320 },
  tall: { w: 600, h: 2100, d: 560 },
};
const PART_TYPES = [
  ['Side', 'Sides'], ['TopBottom', 'Top & Bottom'], ['Shelf', 'Shelves'],
  ['Vertical', 'Verticals'], ['Door', 'Doors'], ['Back', 'Back'],
];
const EDGES = ['L1', 'L2', 'W1', 'W2'];   // L edges run along length, W edges along width
// Human edge names per part type. The model treats L1/L2 (long edges) and W1/W2 (end edges) as generic;
// this maps them to how a cabinetmaker talks: on a carcass panel the two long edges are Front & Back and
// the ends butt into the box; on a door they are the Left & Right stiles with Top & Bottom rails.
const EDGE_LABELS = {
  Side:      { L1: 'Front', L2: 'Back',   W1: 'Top',  W2: 'Bottom' },
  TopBottom: { L1: 'Front', L2: 'Back',   W1: 'Left', W2: 'Right'  },
  Shelf:     { L1: 'Front', L2: 'Back',   W1: 'Left', W2: 'Right'  },
  Vertical:  { L1: 'Front', L2: 'Back',   W1: 'Top',  W2: 'Bottom' },
  Door:      { L1: 'Left',  L2: 'Right',  W1: 'Top',  W2: 'Bottom' },
  Back:      { L1: 'Top',   L2: 'Bottom', W1: 'Left', W2: 'Right'  },
};
const edgeLabel = (key, e) => (EDGE_LABELS[key] && EDGE_LABELS[key][e]) || e;

// Edge banding is OFF by default for every part (user unchecks by default for now). The per-part
// keys are kept so the banding toggles — and later auto-banding — have a place to write into.
const defaultBand = () => ({
  Side: {}, TopBottom: {}, Shelf: {}, Vertical: {}, Door: {}, Back: {},
});

const DEFAULTS = () => ({
  unit: 'mm',
  preset: 'custom',
  cab: { w: 1200, h: 2400, d: 580, t: 20, back: true, sideL: true, sideR: true,   // sideL/sideR/back/*.on = panel present (deletable)
         // Editable top/bottom caps. mount: 'inset' (between sides, default — aligned to the sides) | 'outset' (caps over the sides).
         // depth: null = full cabinet depth; a smaller value is placed per anchor ('back' | 'center' | 'front'). on:false removes the panel.
         top: { mount: 'inset', depth: null, anchor: 'back', on: true },
         bottom: { mount: 'inset', depth: null, anchor: 'back', on: true } },
  backPanel: { type: 'groove', thickness: 6, groove: 6, setback: 19 },   // type: groove | rabbet | overlay. setback 19 + thickness 6 => shelf/vertical depth = d - 25 (e.g. 580 -> 555)
  // Module-level default drawer (the "Drawer Setup" step). New drawers are inserted with a clone of this; editing it
  // recalculates every drawer in the module. Literal (not defaultDrawerSetup()) because DEFAULTS() runs before that const.
  drawerSetup: {
    size: { height: 150, width: null, depth: null, thickness: null },
    backPanel: { type: 'groove', thickness: 6, groove: 6, setback: 19 },
    caps: { bottom: { on: true, mount: 'inset', depth: null, anchor: 'back' } }   // a drawer has a bottom (its base); no top (open box)
  },
  comps: [],                 // {id,type:'shelf'|'vertical',pos, a0,a1}  span: shelf=x-range, vertical=y-range
  doors: { reveal: 2 },   // reveal is the global gap; door fronts are now cell-bound components
  sheet: { w: 2440, h: 1220, kerf: 3.2 },
  grainLock: false,
  band: defaultBand(),
  edgeTape: { thickness: 0.8, width: 25 },   // tape thickness (subtracted from cut size on banded edges) + roll width (must cover the board thickness)
  viewMode: '2d',
  cam: { yaw: -0.65, pitch: 0.5 },
  explode: 0,
  showDims: false,           // 3D measurement labels — default off, user can switch on per 3D session
  zoom: 1, pan: { x: 0, y: 0 },   // 2D view zoom + pan
  zoom3d: 1, pan3d: { x: 0, y: 0 },   // 3D view zoom + screen-space pan
  lastPoint: null,           // mm point used as insertion cell anchor
  selectedId: null,
  woodTheme: 'birch',        // 3D/2D wood finish palette (see WOOD_THEMES)
  _seq: 1,
});

// Switchable wood finishes. `wood/back/shelf/vert/door` are 3D RGB bases (per-face shading is applied on
// top); `p2d`/`e2d` are the 2D part fill + edge stroke. Selection always highlights amber for contrast.
const WOOD_THEMES = {
  birch:  { label: 'Birch',  wood: [224, 208, 170], back: [190, 172, 132], shelf: [218, 201, 161], vert: [212, 194, 154], door: [221, 204, 164], p2d: '#d8c79f', e2d: '#efe3bd' },
  oak:    { label: 'Oak',    wood: [206, 176, 120], back: [168, 138, 88],  shelf: [200, 170, 114], vert: [194, 164, 108], door: [203, 173, 117], p2d: '#cdae78', e2d: '#e7d3a6' },
  walnut: { label: 'Walnut', wood: [124, 92, 60],   back: [92, 66, 42],    shelf: [116, 86, 56],   vert: [110, 82, 52],   door: [120, 90, 58],   p2d: '#8a6742', e2d: '#b08a5f' },
};
const woodPal = () => WOOD_THEMES[S.woodTheme] || WOOD_THEMES.birch;
// Fixed dark-wood palette for the 2D DESIGN view — deliberately independent of the setup wood theme so the
// white measurement text always reads well on a reference-style dark wood field.
const D2D = { field: '#814a28', frame: '#98592f', frameLine: '#4d2b15', part: '#a5642f', partEdge: '#5f3717' };
let dimMask = D2D.field;   // colour used to mask the dim line behind a measurement label (set per-render to the current field)
// The design canvas sits on the --card surface; with no back panel the interior shows THAT same colour
// (open carcass — indistinguishable from the surrounding canvas), not a separate tone.
const CANVAS_BG = (getComputedStyle(document.documentElement).getPropertyValue('--card') || '').trim() || '#2f343d';

let S = DEFAULTS();
S.name = '';   // dummy working state; no module is active until the user adds one

// ---------- Job ▸ Module wrapper (ARCH-001, phase 1) ----------
// A Job owns many Modules; each Module is a full S-shaped design state. The editor always
// operates on the active module through the global `S`. A job starts with no modules (active = -1)
// and stays that way until one is added — keeping the initial load light and the empty state clean.
let JOB = { name: 'Job 1', modules: [], active: -1, _mseq: 0 };
let cutScope = 'module';   // 'module' (active module only) | 'job' (all modules rolled up) — ARCH-001 phase 2
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MM_PER_IN = 25.4;

// ---------- Refs ----------
const $ = (id) => document.getElementById(id);
const inW = $('in-w'), inH = $('in-h'), inD = $('in-d'), inT = $('in-t'), inBack = $('in-back');
const inSW = $('in-sw'), inSH = $('in-sh'), inKerf = $('in-kerf'), inGrain = $('in-grain'), inPreset = $('in-preset');
const inReveal = $('in-reveal'), inExplode = $('in-explode'), inDims = $('in-dims');
const inBackType = $('in-back-type'), inBackThk = $('in-back-thk'), inBackGroove = $('in-back-groove'), inBackSetback = $('in-back-setback');
const inTopMount = $('in-top-mount'), inTopDepth = $('in-top-depth'), inTopAnchor = $('in-top-anchor');
const inBotMount = $('in-bot-mount'), inBotDepth = $('in-bot-depth'), inBotAnchor = $('in-bot-anchor');
const inTopOn = $('in-top-on'), inBotOn = $('in-bot-on'), inSideL = $('in-side-l'), inSideR = $('in-side-r');
const inWoodTheme = $('in-wood-theme');
const inTapeTh = $('in-tape-th'), inTapeWd = $('in-tape-wd');
// Drawer Setup step inputs (module-level default drawer)
const inDwH = $('in-dw-height'), inDwW = $('in-dw-width'), inDwD = $('in-dw-depth'), inDwT = $('in-dw-thick');
const inDwBackType = $('in-dw-back-type'), inDwBackThk = $('in-dw-back-thk'), inDwBackGroove = $('in-dw-back-groove'), inDwBackSetback = $('in-dw-back-setback');
const inDwBotOn = $('in-dw-bot-on'), inDwBotMount = $('in-dw-bot-mount'), inDwBotDepth = $('in-dw-bot-depth'), inDwBotAnchor = $('in-dw-bot-anchor');
let designCanvas = $('design-canvas');   // `let` so the production-pack exporter can temporarily retarget rendering to an off-screen canvas
const sheetCanvas = $('sheet-canvas'), roomCanvas = $('room-canvas');
let dctx = designCanvas.getContext('2d');
const sctx = sheetCanvas.getContext('2d');
const rctx = roomCanvas.getContext('2d');
const btnDelete = $('btn-delete');

// ---------- Units ----------
const toDisp = (mm) => S.unit === 'mm' ? mm : mm / MM_PER_IN;
const toMM = (v) => S.unit === 'mm' ? v : v * MM_PER_IN;
const fmt = (mm) => S.unit === 'mm' ? Math.round(toDisp(mm)).toString() : toDisp(mm).toFixed(3);
const fmtU = (mm) => `${fmt(mm)} ${S.unit}`;
const unitStep = () => S.unit === 'mm' ? 1 : 0.125;

// ---------- Banding helpers ----------
const edgeOn = (key, e) => !!(S.band[key] && S.band[key][e]);
const bandNotation = (key) => { const on = EDGES.filter(e => edgeOn(key, e)); return on.length ? on.map(e => edgeLabel(key, e)).join(', ') : '—'; };
const bandLen = (key, length, width) =>
  (edgeOn(key, 'L1') ? length : 0) + (edgeOn(key, 'L2') ? length : 0) +
  (edgeOn(key, 'W1') ? width : 0) + (edgeOn(key, 'W2') ? width : 0);
// Edge-tape spec (selectable). Thickness is subtracted from the raw cut size on each banded edge; width is
// the roll width (should be >= the board thickness so it covers the edge).
const EDGE_THICKS = [0.8, 1.3, 2], EDGE_WIDTHS = [22, 25, 30, 40, 45];
const tapeTh = () => (S.edgeTape && +S.edgeTape.thickness) || 0;
const tapeWd = () => (S.edgeTape && +S.edgeTape.width) || 0;
// W1/W2 sit at the length ends → reduce LENGTH; L1/L2 run along the length at the width ends → reduce WIDTH.
const bandLenReduce = (key) => (edgeOn(key, 'W1') ? tapeTh() : 0) + (edgeOn(key, 'W2') ? tapeTh() : 0);
const bandWidthReduce = (key) => (edgeOn(key, 'L1') ? tapeTh() : 0) + (edgeOn(key, 'L2') ? tapeTh() : 0);
// One-line banding summary for the selected-part panel (empty when nothing is banded on that part type).
const bandInfo = (key) => { const on = EDGES.filter(e => edgeOn(key, e)); return on.length ? ` · Edge tape ${on.map(e => edgeLabel(key, e)).join(', ')} · ${fmt(tapeTh())}×${fmt(tapeWd())} mm (cut = finished − tape)` : ''; };

// Back panel geometry derived from the configurable fixing type.
//  - overlay : full-size panel on the rear (length w × height h), front face at z = thickness
//  - groove / rabbet : inset panel housed in grooves/rebates; size = inner opening + 2× engagement,
//    recessed from the rear by `setback`; front face at z = setback + thickness
function backGeom() {
  const { w, h, t } = S.cab, bp = S.backPanel;
  if (bp.type === 'overlay') return { L: w, W: h, x0: 0, x1: w, y0: 0, y1: h, z0: 0, z1: bp.thickness, front: bp.thickness };
  const eng = Math.max(0, Math.min(bp.groove, t - 1));
  const x0 = t - eng, x1 = w - t + eng, y0 = t - eng, y1 = h - t + eng;
  const z0 = bp.setback, z1 = bp.setback + bp.thickness;
  return { L: x1 - x0, W: y1 - y0, x0, x1, y0, y1, z0, z1, front: z1 };
}
const backFront = () => S.cab.back ? backGeom().front : 0;   // z where the usable interior begins

// Usable interior depth = cabinet depth minus the back recess (back front face). Shelves/verticals can't exceed it.
const usableDepth = () => Math.max(1, S.cab.d - backFront());
// Effective depth (board width) of a shelf/vertical: its own override (clamped to usable), else the usable depth itself.
const compDepth = (c) => c.depth != null ? Math.max(1, Math.min(c.depth, usableDepth())) : usableDepth();

// ---------- Carcass top/bottom caps (editable) ----------
// Each cap: { mount:'inset'|'outset', depth:null|mm, anchor:'back'|'center'|'front' }.
//  - inset (default): sits between the sides — length w-2t, and the sides run the full height.
//  - outset: caps over the sides — length w (full width), and the sides shorten by t at that end.
// depth is the front-to-back board size (null = full cabinet depth); anchor places a shallow cap in depth.
const capOf = (which) => S.cab[which] || { mount: 'inset', depth: null, anchor: 'back' };
const capOutset = (which) => capOf(which).mount === 'outset';
const capDepth = (which) => { const c = capOf(which); return c.depth != null ? Math.max(1, c.depth) : S.cab.d; };   // loosely coupled: may exceed cabinet depth
const capWidth = (which) => capOutset(which) ? S.cab.w : Math.max(1, S.cab.w - 2 * S.cab.t);
const capXRange = (which) => capOutset(which) ? { x0: 0, x1: S.cab.w } : { x0: S.cab.t, x1: S.cab.w - S.cab.t };
function capZRange(which) {                                    // z=0 is the rear, z=d the front face
  const d = S.cab.d, dep = capDepth(which), a = capOf(which).anchor || 'back';
  const z0 = a === 'front' ? d - dep : a === 'center' ? (d - dep) / 2 : 0;
  return { z0, z1: z0 + dep };
}
// Panel presence (deletable). Missing flag => present (defensive for older saves).
const capOn = (which) => { const c = S.cab[which]; return !c || c.on !== false; };
const sideLOn = () => S.cab.sideL !== false;
const sideROn = () => S.cab.sideR !== false;
// Side panels sit between the outset caps, so they shorten where a present cap overlays them.
const sideY0 = () => (capOn('bottom') && capOutset('bottom')) ? S.cab.t : 0;
const sideY1 = () => (capOn('top') && capOutset('top')) ? S.cab.h - S.cab.t : S.cab.h;
const sideHeight = () => Math.max(1, sideY1() - sideY0());
// Interior envelope. A vertical divider (and every opening) lives BETWEEN the top & bottom panels:
// when a cap is present the divider sits on that cap's inner face (t or h−t), so it is ALWAYS inside the
// caps and never overlaps them. With a cap removed the interior runs out to that edge. Left/right follows
// the sides: between them when present, out to the edge when a side is removed.
const anySide = () => sideLOn() || sideROn();
const innerL = () => sideLOn() ? S.cab.t : 0;
const innerR = () => sideROn() ? S.cab.w - S.cab.t : S.cab.w;
const innerB = () => capOn('bottom') ? S.cab.t : 0;
const innerT = () => capOn('top') ? S.cab.h - S.cab.t : S.cab.h;

// ---------- Geometry: cells, spans, segments ----------
function normalizeComps() {
  for (const c of S.comps) {
    if (c.type === 'drawer' || c.type === 'door') continue;
    if (c.a0 == null || c.a1 == null) {
      if (c.type === 'shelf') { c.a0 = innerL(); c.a1 = innerR(); } else { c.a0 = innerB(); c.a1 = innerT(); }
    }
    // Pull the span inside the current envelope so a divider never overlaps the caps/sides —
    // e.g. a full-height vertical from an older layout is drawn back between the top & bottom panels.
    const lo = c.type === 'shelf' ? innerL() : innerB(), hi = c.type === 'shelf' ? innerR() : innerT();
    c.a0 = Math.max(lo, Math.min(c.a0, hi)); c.a1 = Math.max(c.a0, Math.min(c.a1, hi));
  }
}
// Panel thickness for a shelf/vertical: its own explicit override or the cabinet default material thickness.
const partThick = (c) => (c && c.thick != null) ? Math.max(1, c.thick) : S.cab.t;
// Cell (rectangle) containing point P, bounded by parts whose span crosses P. Excludes excludeId.
// opts.ignoreShelves / opts.ignoreVerticals let a door span across those dividers (covering several cells).
function cellAt(px, py, excludeId, opts) {
  const { w, h, t } = S.cab;
  const ignoreShelves = !!(opts && opts.ignoreShelves), ignoreVerticals = !!(opts && opts.ignoreVerticals);
  const ignoreIds = (opts && opts.ignoreIds) || null;   // e.g. a drawer's own flanks, so its fascia spans past them
  let left = innerL(), right = innerR(), bottom = innerB(), top = innerT();   // panel-aware: reaches the edge where a panel was removed
  for (const c of S.comps) {
    if (c.id === excludeId) continue;
    if (ignoreIds && ignoreIds.has(c.id)) continue;
    const ht = partThick(c) / 2;
    if (c.type === 'vertical' && !ignoreVerticals && c.a0 <= py && py <= c.a1) {
      if (c.pos <= px) left = Math.max(left, c.pos + ht); else right = Math.min(right, c.pos - ht);
    } else if (c.type === 'shelf' && !ignoreShelves && c.a0 <= px && px <= c.a1) {
      if (c.pos <= py) bottom = Math.max(bottom, c.pos + ht); else top = Math.min(top, c.pos - ht);
    }
  }
  return { left, right, bottom, top };
}
// What a door covers: 'cell' (default, one opening) | 'column' (ignore shelves) | 'row' (ignore verticals) | 'all' (whole interior).
const doorCoverOpts = (c) => ({ ignoreShelves: c.covers === 'column' || c.covers === 'all', ignoreVerticals: c.covers === 'row' || c.covers === 'all' });
// Split [a0,a1] at crossing parts (each {pos,thick} consuming its own thickness). Returns segments {lo,hi,len}.
function splitSegments(a0, a1, cuts) {
  const list = cuts.filter(c => c.pos > a0 && c.pos < a1).sort((x, y) => x.pos - y.pos);
  const segs = []; let cur = a0;
  for (const c of list) { const lo = c.pos - c.thick / 2; if (lo > cur) segs.push({ lo: cur, hi: lo, len: lo - cur }); cur = c.pos + c.thick / 2; }
  if (a1 > cur) segs.push({ lo: cur, hi: a1, len: a1 - cur });
  return segs.filter(s => s.len > 0.5);
}
// A divider only CUTS the other part when it strictly crosses its centerline. A vertical whose end merely meets the
// shelf (rests under / hangs onto it) touches but does not pierce it, so the shelf stays one continuous board —
// strict `<` (not `<=`) keeps a half-height divider from wrongly splitting a shelf that sits at its end.
const shelfSegments = (c) =>
  splitSegments(c.a0, c.a1, S.comps.filter(d => d.type === 'vertical' && d.a0 < c.pos && c.pos < d.a1).map(d => ({ pos: d.pos, thick: partThick(d) })));
const verticalSegments = (c) =>
  splitSegments(c.a0, c.a1, S.comps.filter(s => s.type === 'shelf' && s.a0 < c.pos && c.pos < s.a1).map(s => ({ pos: s.pos, thick: partThick(s) })));

// ---------- Doors (cell-bound component, like drawers) ----------
// A door component fills the cell at its anchor with 1 or 2 leaves (count), separated by the reveal gap.
// Mount mirrors drawers, but the two mounts size very differently:
//  - 'outset' (overlay, the default): the door covers the carcass edge-to-edge with NO deduction on any
//    side that meets the cabinet exterior — so a single full door equals the cabinet's outer face
//    (e.g. w x h). Where the door edge lands on an interior divider instead, it overlays half the divider
//    and gives back half the reveal so neighbouring overlay doors leave a `reveal` gap between them.
//  - 'inset': the door fits inside the opening with the reveal gap deducted on every side.
const doorMount = (c) => (c.mount === 'inset' ? 'inset' : 'outset');
// Every new door starts with a 1 mm gap on all four sides (a small reveal). Stored per-door (gapL/R/T/B) so the
// value persists with the component and shows in the door editor's Gap field; the user can still change it per side.
const DOOR_GAP = 1;   // mm
const newDoorGaps = () => ({ gapL: DOOR_GAP, gapR: DOOR_GAP, gapT: DOOR_GAP, gapB: DOOR_GAP });
// The opening a door fills: an explicit multi-cell `span` (built by picking cells) if present,
// otherwise the cell at its anchor expanded per its Covers mode. Shape: {left,right,bottom,top}.
const doorBase = (c) => c.span ? c.span : cellAt(c.ax, c.ay, null, doorCoverOpts(c));
// Vertical placement within the opening: optional Height (c.h) and From-bottom offset (c.yoff) let a door
// occupy just part of a column — e.g. above a drawer — with NO dividing shelf. `freeTop`/`freeBottom` mark
// the open edges introduced by that partial sizing (they get a clean reveal gap instead of an overlay lip).
function doorSpan(c) {
  const base = doorBase(c), ch = base.top - base.bottom;
  const H = c.h != null ? Math.max(1, Math.min(c.h, ch)) : ch;
  // Vertical anchor (top / middle / bottom) sets the default offset when a partial-height door isn't pinned by an
  // explicit From-bottom (c.yoff). An explicit yoff always wins.
  const va = c.valign || 'bottom';
  const anchoredOff = va === 'top' ? ch - H : va === 'middle' ? (ch - H) / 2 : 0;
  const off = c.yoff != null ? Math.max(0, Math.min(c.yoff, ch - H)) : anchoredOff;
  const bottom = base.bottom + off;
  return { left: base.left, right: base.right, bottom, top: bottom + H, freeBottom: off > 0.5, freeTop: (ch - off - H) > 0.5 };
}
function doorRectsFor(c) {
  const g = S.doors.reveal, t = S.cab.t, { w, h } = S.cab, mount = doorMount(c);
  const cell = doorSpan(c);
  let x0, x1, y0, y1;
  if (mount === 'inset') {
    // Inset: fit inside the opening, reveal deducted on all four sides.
    x0 = cell.left + g / 2; x1 = cell.right - g / 2;
    y0 = cell.bottom + g / 2; y1 = cell.top - g / 2;
  } else {
    // Overlay: NO deductions. Reach the carcass outer face on exterior sides, and the divider
    // centerline on interior sides (so the door overlays half the divider). An open edge from partial
    // sizing (freeTop/freeBottom) instead gets a reveal gap, so a stacked drawer + door sit flush.
    // eps tolerates float drift.
    const eps = 0.5;   // a cell edge at (or beyond) the carcass line reaches the outer face; an interior divider overlays half
    x0 = (cell.left   <= t + eps)     ? 0 : cell.left   - t / 2;
    x1 = (cell.right  >= w - t - eps) ? w : cell.right  + t / 2;
    y0 = cell.freeBottom ? cell.bottom + g / 2 : ((cell.bottom <= t + eps)     ? 0 : cell.bottom - t / 2);
    y1 = cell.freeTop    ? cell.top    - g / 2 : ((cell.top    >= h - t - eps) ? h : cell.top    + t / 2);
  }
  // Per-side gap overrides for THIS door (mm): pull each named side in by its own gap (e.g. 1 mm on the left).
  x0 += Math.max(0, c.gapL || 0); x1 -= Math.max(0, c.gapR || 0);
  y0 += Math.max(0, c.gapB || 0); y1 -= Math.max(0, c.gapT || 0);
  if (x1 - x0 < 1) { const m = (x0 + x1) / 2; x0 = m - 0.5; x1 = m + 0.5; }
  if (y1 - y0 < 1) { const m = (y0 + y1) / 2; y0 = m - 0.5; y1 = m + 0.5; }
  if ((c.count | 0) === 2) { const mid = (x0 + x1) / 2; return [{ x0, x1: mid - g / 2, y0, y1, id: c.id, side: 'L', mount }, { x0: mid + g / 2, x1, y0, y1, id: c.id, side: 'R', mount }]; }
  return [{ x0, x1, y0, y1, id: c.id, side: '1', mount }];
}
function doorRects() { const out = []; for (const c of S.comps) if (c.type === 'door') for (const r of doorRectsFor(c)) out.push(r); return out; }

// ---------- Drawers ----------
// A drawer component fills the cell at its anchor (bounded by surrounding shelves/verticals) with `count` stacked fronts.
const DRAWER = { gap: 3, sideClear: 13, boxHeightRatio: 0.5, runnerClearRatio: 0.25 };   // mm + ratios: reveal around fronts, channel/runner gap per side (flank-inner to box side); box (sides + back) height = 50% of the drawer height, seated in the middle of the fascia with 25% runner clearance beneath (remaining 25% above)
const defaultDrawerSetup = () => ({
  size: { height: 150, width: null, depth: null, thickness: null },
  backPanel: { type: 'groove', thickness: 6, groove: 6, setback: 19 },
  caps: { bottom: { on: true, mount: 'inset', depth: null, anchor: 'back' } }   // a drawer has a bottom (its base); no top (open box)
});
const drawerSetup = (c) => {
  if (!c || c.type !== 'drawer') return null;
  if (!c.drawerSetup) c.drawerSetup = defaultDrawerSetup();
  return c.drawerSetup;
};
const cloneDrawerSetup = (ds) => JSON.parse(JSON.stringify(ds || defaultDrawerSetup()));
// The module-level default drawer (the "Drawer Setup" step). Self-heals older module objects that predate it.
const moduleDrawerSetup = () => { if (!S.drawerSetup) S.drawerSetup = defaultDrawerSetup(); return S.drawerSetup; };
const drawerSizeHeight = (c) => {
  const ds = drawerSetup(c); if (ds && ds.size && ds.size.height != null && ds.size.height > 0) return ds.size.height;
  return c && c.h != null ? c.h : 150;
};
const drawerSizeWidth = (c) => {
  const ds = drawerSetup(c); if (ds && ds.size && ds.size.width != null && ds.size.width > 0) return ds.size.width;
  return c && c.w != null ? c.w : null;
};
const drawerSizeDepth = (c) => {
  const ds = drawerSetup(c); if (ds && ds.size && ds.size.depth != null && ds.size.depth > 0) return ds.size.depth;
  return c && c.depth != null ? c.depth : null;
};
const drawerMaterialThick = (c) => {
  const ds = drawerSetup(c); if (ds && ds.size && ds.size.thickness != null && ds.size.thickness > 0) return ds.size.thickness;
  return c && c.thick != null ? c.thick : S.cab.t;
};
const drawerBackPanel = (c) => {
  const ds = drawerSetup(c); return ds && ds.backPanel ? ds.backPanel : defaultDrawerSetup().backPanel;
};
const drawerBackType = (c) => drawerBackPanel(c).type || 'groove';
const drawerBackThickness = (c) => Math.max(1, drawerBackPanel(c).thickness || 6);
const drawerBackGroove = (c) => Math.max(0, drawerBackPanel(c).groove || 0);
const drawerBackSetback = (c) => Math.max(0, drawerBackPanel(c).setback || 0);
const drawerCapState = (c, which) => {
  const ds = drawerSetup(c); const fallback = defaultDrawerSetup().caps[which];
  return ds && ds.caps && ds.caps[which] ? ds.caps[which] : fallback;
};
const drawerCapOn = (c, which) => drawerCapState(c, which).on !== false;
const drawerCapMount = (c, which) => drawerCapState(c, which).mount || 'inset';
const drawerCapDepth = (c, which) => {
  const cap = drawerCapState(c, which);
  return cap.depth != null && cap.depth > 0 ? cap.depth : drawerSizeDepth(c) != null ? drawerSizeDepth(c) : compDepth(c);
};
const drawerCapAnchor = (c, which) => drawerCapState(c, which).anchor || 'back';
// The bank sits inside its cell (bounded by shelves/verticals). Optional w/h shrink it; it is centered horizontally and valign anchors it to the cell top or bottom.
function drawerRect(c) {
  const cell = cellAt(c.ax, c.ay, null);
  const cw = cell.right - cell.left, ch = cell.top - cell.bottom;
  const requestedW = c.w != null ? c.w : drawerSizeWidth(c);
  const requestedH = c.h != null ? c.h : drawerSizeHeight(c);
  const W = requestedW != null ? Math.max(1, Math.min(requestedW, cw)) : cw;
  const H = requestedH != null ? Math.max(1, Math.min(requestedH, ch)) : ch;
  let left = cell.left + (cw - W) / 2;
  left = Math.max(cell.left, Math.min(left, cell.right - W));
  // Vertical position: an explicit From-bottom offset (c.yoff) wins; otherwise the coarse valign anchor.
  let bottom;
  if (c.yoff != null) bottom = cell.bottom + Math.max(0, Math.min(c.yoff, ch - H));
  else bottom = (c.valign || 'bottom') === 'top' ? cell.top - H : cell.bottom;
  return { left, right: left + W, bottom, top: bottom + H };
}
// Keep a drawer's linked flank verticals (side panels) sized to the drawer's height. Called after the drawer is
// created or edited so the flanks track its vertical extent. A flank the user has deleted is simply skipped —
// and the drawer then widens to the next boundary on its own (drawerRect reads the live cell via cellAt).
function syncDrawerFlanks(d) {
  if (!d || d.type !== 'drawer' || !Array.isArray(d.flanks) || !d.flanks.length) return;
  const rect = drawerRect(d);   // band computed with the flanks still covering the current ay, so it's correct
  // Anchor the drawer inside its own vertical band: the flanks span that band, so keeping ay within it lets
  // cellAt (which bounds the drawer's width) actually see the flanks. Without this the drawer would ignore
  // flanks that no longer reach its old centre anchor and spill to the full cell width.
  d.ay = (rect.bottom + rect.top) / 2;
  // An INSET front sits inside the carcass and eats one board thickness of interior depth, so the flanks framing
  // the box stop a thickness short of the front. Outset (proud) leaves them at full depth (no override).
  const flankDepth = d.mount === 'inset' ? Math.max(1, usableDepth() - S.cab.t) : null;
  for (const fid of d.flanks) {
    const f = S.comps.find(x => x.id === fid && x.type === 'vertical');
    if (f) { f.a0 = rect.bottom; f.a1 = rect.top; if (flankDepth != null) f.depth = flankDepth; else delete f.depth; }
  }
}
// Add the two flank verticals (side panels) to an existing drawer and link them, sized to the current opening then
// shrunk to the drawer height by syncDrawerFlanks. No-op if the drawer already has flanks.
function addDrawerFlanks(c) {
  if (c.flanks && c.flanks.length) return;
  const t = S.cab.t, cell = cellAt(c.ax, c.ay, null);
  const ft = Math.min(t, Math.max(1, (cell.right - cell.left) / 2 - 1));
  const flankThick = ft < t ? { thick: ft } : {};
  const left = { id: S._seq++, type: 'vertical', pos: cell.left + ft / 2, a0: cell.bottom, a1: cell.top, ...flankThick };
  const right = { id: S._seq++, type: 'vertical', pos: cell.right - ft / 2, a0: cell.bottom, a1: cell.top, ...flankThick };
  clampComp(left); clampComp(right);
  c.flanks = [left.id, right.id];
  S.comps.push(left, right);
  syncDrawerFlanks(c);
}
// Remove a drawer's flank verticals and unlink them. The drawer then spans the full opening (only the channel gap
// each side remains), and 2D / 3D / cut list all follow automatically off the widened drawerRect.
function removeDrawerFlanks(c) {
  if (!c.flanks || !c.flanks.length) return;
  const ids = new Set(c.flanks);
  for (let i = S.comps.length - 1; i >= 0; i--) if (ids.has(S.comps[i].id)) S.comps.splice(i, 1);
  delete c.flanks;
}
// Per-side reveal gaps around each drawer front (Left/Right/Top/Bottom). Each defaults to half the global
// reveal so untouched drawers look the same; the drawer editor can override any side to fit the view.
const drawerGaps = (c) => ({
  l: c.gapL != null ? Math.max(0, c.gapL) : DRAWER.gap / 2,
  r: c.gapR != null ? Math.max(0, c.gapR) : DRAWER.gap / 2,
  t: c.gapT != null ? Math.max(0, c.gapT) : DRAWER.gap / 2,
  b: c.gapB != null ? Math.max(0, c.gapB) : DRAWER.gap / 2,
});
// The drawer fronts (one rect per stacked front). Inset fronts sit within the opening with a reveal gap;
// outset (overlay) fronts grow by the overlay (t/2 onto each surrounding member) so they cover the carcass edges.
function drawerFronts(c) {
  const t = S.cab.t, cell = drawerRect(c), full = cellAt(c.ax, c.ay, null), n = Math.max(1, c.count | 0), gp = drawerGaps(c);
  const ov = c.mount === 'inset' ? 0 : t, half = ov / 2;
  const x0 = cell.left - half, x1 = cell.right + half;
  // Overlay overhangs half the material onto surrounding carcass, but an OPEN edge (partial bank stacked
  // under a door, no shelf) recesses instead — so the fronts meet flush with no lip.
  const yLo = (cell.bottom > full.bottom + 0.5) ? cell.bottom : cell.bottom - half;
  const yHi = (cell.top < full.top - 0.5) ? cell.top : cell.top + half;
  const fband = (yHi - yLo) / n;
  const fronts = [];
  for (let i = 0; i < n; i++) {   // clamp so a big gap can't invert the front (fit the view)
    let fx0 = x0 + gp.l, fx1 = x1 - gp.r; if (fx1 - fx0 < 1) { const m = (x0 + x1) / 2; fx0 = m - 0.5; fx1 = m + 0.5; }
    const bandLo = yLo + i * fband, bandHi = yLo + (i + 1) * fband;
    let fy0 = bandLo + gp.b, fy1 = bandHi - gp.t; if (fy1 - fy0 < 1) { const m = (bandLo + bandHi) / 2; fy0 = m - 0.5; fy1 = m + 0.5; }
    fronts.push({ x0: fx0, x1: fx1, y0: fy0, y1: fy1 });
  }
  return fronts;
}
// Horizontal extent of a drawer's fascia. Base = the drawer's own cell (cellAt), so it sits BETWEEN the flanks
// when side panels are on (flanks visible beside it) and widens to the full opening when they're removed.
//  - inset  → exactly that cell (between the flanks / opening).
//  - outset → overlays the adjacent member like an overlay door: reach the cabinet outer face where it meets an
//             exterior side, otherwise lap half the bounding member (a flank when present, else an interior divider).
function drawerFasciaCell(c) {
  const cell = cellAt(c.ax, c.ay, null);
  if (c.mount === 'inset') return cell;
  const t = drawerMaterialThick(c), w = S.cab.w, eps = 0.5;
  const left  = cell.left  <= t + eps     ? 0 : cell.left  - t / 2;
  const right = cell.right >= w - t - eps ? w : cell.right + t / 2;
  return { left, right, bottom: cell.bottom, top: cell.top };
}
// The decorative fascia panels — the actual VISIBLE face shown in 2D/3D, one rect per stacked drawer. Horizontal
// extent comes from drawerFasciaCell (sits between the flanks when side panels are on, widens when removed; outset
// also overlays the adjacent member); its height is exactly the drawer height (the input) per band.
function drawerFascias(c) {
  const rect = drawerRect(c), fc = drawerFasciaCell(c), n = Math.max(1, c.count | 0);
  const band = (rect.top - rect.bottom) / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const mid = rect.bottom + (i + 0.5) * band, hh = band / 2;
    out.push({ x0: fc.left, x1: fc.right, y0: mid - hh, y1: mid + hh });
  }
  return out;
}
// Full drawer-box geometry for the 3D view (one box per stacked drawer): the four walls + bottom, inset from the
// flanks by the channel gap (DRAWER.sideClear) on EACH SIDE — so the runner/channel clearance is visible when you
// orbit. `part` tags each member so the caller can drop the front wall when the drawer's Box-front option is off.
function drawerBox3D(c) {
  const { d } = S.cab, t = drawerMaterialThick(c), cell = drawerRect(c), n = Math.max(1, c.count | 0), band = (cell.top - cell.bottom) / n;
  const bx0 = cell.left + DRAWER.sideClear, bx1 = cell.right - DRAWER.sideClear;   // box outer = opening between flanks, less the channel gap each side
  const depth = Math.max(1, compDepth(c) - (c.mount === 'inset' ? t : 0));
  const zFront = c.mount === 'inset' ? d - t : d, zBack = Math.max(0, zFront - depth);
  const boxH = Math.max(1, band * DRAWER.boxHeightRatio);   // sides + back = 50% of the drawer height
  const yRise = band * DRAWER.runnerClearRatio;             // 25% runner clearance beneath, so the box sits in the middle
  const out = [];
  if (bx1 - bx0 < 1) return out;
  // Back panel from the Drawer Setup: its own thickness; overlay = full-width flush on the rear; groove/rabbet =
  // housed between the sides (inset by the groove depth) and recessed forward from the rear by the setback.
  const tb = Math.max(1, drawerBackThickness(c)), overlay = drawerBackType(c) === 'overlay';
  const groove = overlay ? 0 : Math.max(0, Math.min(drawerBackGroove(c), (bx1 - bx0) / 2 - 1, boxH / 2 - 1));
  const sb = overlay ? 0 : Math.max(0, Math.min(drawerBackSetback(c), depth - tb));
  // A cap's x-range follows its mount (outset caps over the sides, inset sits between them); its z-range follows its
  // depth + anchor within the box, so a shallower top/bottom panel seats against the back, front or centre.
  const capX = (which) => drawerCapMount(c, which) === 'outset' ? { x0: bx0, x1: bx1 } : { x0: bx0 + t, x1: bx1 - t };
  const capZ = (which) => {
    const cd = Math.max(1, Math.min(drawerCapDepth(c, which), zFront - zBack));
    const a = drawerCapAnchor(c, which);
    const z0 = Math.max(zBack, a === 'front' ? zFront - cd : a === 'center' ? (zBack + zFront) / 2 - cd / 2 : zBack);
    return { z0, z1: Math.min(zFront, z0 + cd) };
  };
  for (let i = 0; i < n; i++) {
    const y0 = cell.bottom + i * band + yRise, y1 = y0 + boxH;   // seated in the middle of the band, runner gap beneath
    out.push({ part: 'front', x0: bx0, x1: bx1, y0, y1, z0: zFront - t, z1: zFront });
    out.push({ part: 'left',  x0: bx0, x1: bx0 + t, y0, y1, z0: zBack, z1: zFront });
    out.push({ part: 'right', x0: bx1 - t, x1: bx1, y0, y1, z0: zBack, z1: zFront });
    const bz0 = zBack + sb;
    out.push({ part: 'back', x0: overlay ? bx0 : bx0 + groove, x1: overlay ? bx1 : bx1 - groove, y0: overlay ? y0 : y0 + groove, y1: overlay ? y1 : y1 - groove, z0: bz0, z1: bz0 + tb });
    if (drawerCapOn(c, 'bottom')) { const x = capX('bottom'), z = capZ('bottom'); out.push({ part: 'bottom', x0: x.x0, x1: x.x1, y0, y1: y0 + t, z0: z.z0, z1: z.z1 }); }
  }
  return out;
}
function drawerParts(c) {
  const t = drawerMaterialThick(c), cell = drawerRect(c), fasciaCell = drawerFasciaCell(c);
  const Wc = cell.right - cell.left, Hc = cell.top - cell.bottom, WcFascia = Math.max(1, fasciaCell.right - fasciaCell.left);
  // An inset front is housed inside the carcass, so it consumes one board thickness of box depth; outset is proud.
  const depth = Math.max(1, compDepth(c) - (c.mount === 'inset' ? t : 0)), g = DRAWER.gap;
  const n = Math.max(1, c.count | 0), band = Hc / n;
  // Box outer width = opening between flanks (Wc) less the channel gap each side. Front & back are this full box
  // width (they capture the sides); the bottom fits between the sides (boxInnerW).
  const boxOuterW = Math.max(1, Wc - 2 * DRAWER.sideClear), boxInnerW = Math.max(1, boxOuterW - 2 * t);
  const boxH = Math.max(1, band * DRAWER.boxHeightRatio);   // sides + back = 50% of the drawer height (middle band; 25% runner clearance beneath)
  const backW = Math.max(1, boxOuterW - 2 * drawerBackGroove(c));
  const backH = Math.max(1, boxH - 2 * drawerBackGroove(c));
  const parts = [];
  for (let i = 0; i < n; i++) {
    // face maps [length,width] to spatial axes; the third axis carries the board thickness `t`.
    // The drawer-box FRONT wall is identical to the back — both are the full box width × box height. The visible
    // decorative panel is the separate 'Drawer fascia' below, not this structural front.
    // Optional: some boxes (metal-runner / modern) use the fascia as the front, so skip it when 'Box front' is off.
    if (c.boxFront !== false) parts.push({ name: 'Drawer front', key: 'DrawerBox', length: boxOuterW, width: boxH, face: 'WH', t });
    // Outer decorative fascia — one per drawer front, height = drawer height + a fixed overlay (200 → 250) so it
    // laps the reveal top & bottom; width follows the opening. Banded like a front (key 'Door').
    parts.push({ name: 'Drawer fascia', key: 'Door', length: band, width: WcFascia, face: 'HW', t });
    parts.push({ name: 'Drawer side', key: 'DrawerBox', length: depth, width: boxH, face: 'DH', t });
    parts.push({ name: 'Drawer side', key: 'DrawerBox', length: depth, width: boxH, face: 'DH', t });
    parts.push({ name: 'Drawer back', key: 'DrawerBox', length: backW, width: backH, face: 'WH', t: drawerBackThickness(c) });
    // The drawer bottom (its base) — a single panel gated by the "Include bottom panel" toggle; no top (open box).
    if (drawerCapOn(c, 'bottom')) parts.push({ name: 'Drawer bottom', key: 'DrawerBox', length: boxInnerW, width: depth, face: 'WD', t });
  }
  return parts;
}

// ---------- Cut list ----------
// Every instance carries a `srcId` linking it back to the design part it came from:
// carcass faces use string ids ('L','R','T','B','BK'), components/doors/drawers use their numeric id.
function cutListInstances() {
  const { w, h, d, t, back } = S.cab;
  const items = [];
  // Banded edges reduce the raw cut size (finished − tape thickness). `flen`/`fwid` keep the finished size for reference.
  // Each part carries spatial dims w/h/d (left-right / top-bottom / front-back) + thickness `thick`: `face` maps the
  // two cut dims [length,width] to their axes and the remaining axis takes the board thickness. length/width are kept
  // for sheet nesting, board-area and edge-banding math; w/h/d/thick drive the human-readable cut list & editors.
  const add = (name, key, length, width, srcId, face, thick) => {
    const cutL = Math.max(1, length - bandLenReduce(key)), cutW = Math.max(1, width - bandWidthReduce(key));
    const ax = { W: thick, H: thick, D: thick }; ax[face[0]] = cutL; ax[face[1]] = cutW;
    items.push({ name, key, srcId, face, flen: length, fwid: width, length: cutL, width: cutW, w: ax.W, h: ax.H, d: ax.D, thick });
  };
  // Sides span the cabinet height × depth; the board thickness is their left-right width. Skip removed sides.
  if (sideLOn()) add('Side', 'Side', sideHeight(), d, 'L', 'HD', t);
  if (sideROn()) add('Side', 'Side', sideHeight(), d, 'R', 'HD', t);
  // Top/bottom caps span the cabinet width (inset = w-2t, outset = w) × the cap's own depth; thickness is their height. Skip removed caps.
  const topOn = capOn('top'), botOn = capOn('bottom');
  const topLen = capWidth('top'), topW = capDepth('top'), botLen = capWidth('bottom'), botW = capDepth('bottom');
  if (topOn && botOn && topLen === botLen && topW === botW) {   // both present & identical: grouped "Top / Bottom" (qty 2)
    add('Top / Bottom', 'TopBottom', topLen, topW, 'T', 'WD', t); add('Top / Bottom', 'TopBottom', botLen, botW, 'B', 'WD', t);
  } else {                                                      // otherwise list whichever are present, separately
    if (topOn) add('Top', 'TopBottom', topLen, topW, 'T', 'WD', t);
    if (botOn) add('Bottom', 'TopBottom', botLen, botW, 'B', 'WD', t);
  }
  // Back panel spans the cabinet width × height; thickness is its own (thinner) board depth.
  if (back) { const g = backGeom(); add('Back', 'Back', g.L, g.W, 'BK', 'WH', S.backPanel.thickness); }
  for (const c of S.comps) {
    if (c.type === 'shelf') for (const s of shelfSegments(c)) add('Shelf', 'Shelf', s.len, compDepth(c), c.id, 'WD', partThick(c));
    else if (c.type === 'vertical') for (const s of verticalSegments(c)) add('Vertical', 'Vertical', s.len, compDepth(c), c.id, 'HD', partThick(c));
    else if (c.type === 'drawer') for (const p of drawerParts(c)) add(p.name, p.key, p.length, p.width, c.id, p.face, p.t);
  }
  for (const r of doorRects()) add('Door', 'Door', r.y1 - r.y0, r.x1 - r.x0, r.id, 'HW', t);
  return items;
}
const groupKey = (it) => `${it.name}|${Math.round(it.length)}|${Math.round(it.width)}|${Math.round(it.thick || 0)}|${it.key}`;
// Map each cut-list group back to a representative design part id, so clicking a cutlist row
// or a sheet piece can select the matching component/face in the 2D/3D design.
function groupKeyToSrc() {
  const map = new Map();
  for (const it of cutListInstances()) if (!map.has(groupKey(it))) map.set(groupKey(it), it.srcId);
  return map;
}
function cutList() {
  const map = new Map();
  for (const it of cutListInstances()) {
    const k = groupKey(it);
    if (map.has(k)) map.get(k).qty++; else map.set(k, { ...it, qty: 1 });
  }
  return [...map.values()];
}

// ---------- Job-wide rollup (ARCH-001 phase 2) ----------
// Reuse every per-module geometry function by temporarily pointing the global S at each module.
function withModule(m, fn) { const prev = S; S = m; try { return fn(); } finally { S = prev; } }
const isJobScope = () => cutScope === 'job';
// All cut-list instances across every module (each tagged with its source module index/name).
function jobCutListInstances() {
  const out = [];
  JOB.modules.forEach((m, mi) => withModule(m, () => {
    for (const it of cutListInstances()) out.push({ ...it, mi, mname: m.name || `Module ${mi + 1}` });
  }));
  return out;
}
// Consolidated job cut list: identical parts merged across modules, banding from the first contributor.
function jobCutList() {
  const map = new Map();
  JOB.modules.forEach((m, mi) => withModule(m, () => {
    for (const it of cutListInstances()) {
      const k = groupKey(it);
      if (map.has(k)) map.get(k).qty++;
      else map.set(k, { ...it, qty: 1, band: bandNotation(it.key) });
    }
  }));
  return [...map.values()];
}
// Totals summed with each module's own banding (tape) and geometry (area) — correct even when modules band differently.
function jobTotals() {
  let tapeMM = 0, areaMM2 = 0, partCount = 0;
  JOB.modules.forEach((m) => withModule(m, () => {
    for (const it of cutListInstances()) { tapeMM += bandLen(it.key, it.length, it.width); areaMM2 += it.length * it.width; partCount++; }
  }));
  return { tapeMM, areaMM2, partCount };
}
// One nesting pass over every module's parts → fewer sheets than nesting each module alone.
// Uses the active module's sheet spec + grain lock as the job sheet (settings are still per-module).
function jobNest() { return nest(jobCutListInstances()); }
// Cut-list instances produced by the currently selected component or carcass face. Derived straight from
// cutListInstances (filtered by the part's srcId) so the highlighted rows always match the REAL cut sizes — this
// keeps the selection honest under every rule (cap inset/outset changes the side height + cap width, banding, etc.)
// instead of recomputing sizes here where they could drift out of step with the cut list.
function instancesForSelection() {
  const id = S.selectedId; if (id == null) return [];
  return cutListInstances().filter(it => it.srcId === id);
}
const selectedGroupKeys = () => new Set(instancesForSelection().map(groupKey));

function renderCutList() {
  const job = isJobScope();
  const parts = job ? jobCutList() : cutList();
  const selKeys = selectedGroupKeys();
  const tbody = document.querySelector('#cutlist tbody');
  tbody.innerHTML = parts.map(p => {
    const bn = job ? (p.band || '—') : bandNotation(p.key);
    return `<tr data-gkey="${groupKey(p)}"${selKeys.has(groupKey(p)) ? ' class="cl-selected"' : ''}><td>${p.name}</td><td>${p.qty}</td><td>${fmt(p.w)}</td><td>${fmt(p.h)}</td><td>${fmt(p.d)}</td><td>${fmt(p.thick)}</td><td>${bn}</td></tr>`;
  }).join('');
  const ths = document.querySelectorAll('#cutlist thead th');
  ths[2].textContent = `Width (${S.unit})`; ths[3].textContent = `Height (${S.unit})`; ths[4].textContent = `Depth (${S.unit})`; ths[5].textContent = `Thick (${S.unit})`;

  const totals = job ? jobTotals() : null;
  const totalParts = job ? totals.partCount : parts.reduce((n, p) => n + p.qty, 0);
  const areaMM2 = job ? totals.areaMM2 : parts.reduce((a, p) => a + p.qty * p.length * p.width, 0);
  const tapeMM = job ? totals.tapeMM : parts.reduce((a, p) => a + p.qty * bandLen(p.key, p.length, p.width), 0);
  const pack = job ? jobNest() : nest(cutListInstances());
  // Tape width is a purchasing spec (it covers the board EDGE) — it never changes cut sizes; but warn when the
  // chosen roll is too narrow to cover the edge. Updates live because the width control calls render().
  const tapeWarn = (tapeMM > 0 && tapeWd() > 0 && tapeWd() < S.cab.t)
    ? `<br><span style="color:var(--danger)">⚠ Tape width ${Math.round(tapeWd())} mm &lt; board ${Math.round(S.cab.t)} mm — won't cover the edge</span>` : '';
  $('cutlist-summary').innerHTML =
    (job ? `Scope: <b>whole job</b> · ${JOB.modules.length} module(s)<br>` : '') +
    `Parts: <b>${totalParts}</b><br>Board area: <b>${(areaMM2 / 1e6).toFixed(3)} m²</b><br>` +
    `Edge tape: <b>${(tapeMM / 1000).toFixed(2)} m</b> <span class="muted">(${fmt(tapeTh())}×${fmt(tapeWd())} mm)</span>${tapeWarn}<br>` +
    `Sheets needed: <b>${pack.sheets.length}</b> · Utilisation: <b>${(Math.min(1, pack.utilisation) * 100).toFixed(1)}%</b>`;
  return pack;
}

// ---------- Sheet nesting (FFDH shelf packing) ----------
function nest(items) {
  const { w: SW, h: SH, kerf } = S.sheet, lock = S.grainLock;
  const rects = items.map(it => ({ name: it.name, len: it.length, wid: it.width, gkey: groupKey(it), srcId: it.srcId }));
  rects.sort((a, b) => Math.max(b.len, b.wid) - Math.max(a.len, a.wid));
  const sheets = [];
  const newSheet = () => { const s = { levels: [], placements: [] }; sheets.push(s); return s; };
  const tryFootprint = (sheet, fw, fh) => {
    for (const lvl of sheet.levels) if (lvl.x + fw <= SW && fh <= lvl.h) { const p = { x: lvl.x, y: lvl.y, w: fw, h: fh }; lvl.x += fw + kerf; return p; }
    const top = sheet.levels.length ? (sheet.levels.at(-1).y + sheet.levels.at(-1).h + kerf) : 0;
    if (top + fh <= SH && fw <= SW) { sheet.levels.push({ y: top, h: fh, x: fw + kerf }); return { x: 0, y: top, w: fw, h: fh }; }
    return null;
  };
  const tag = (p, r, rot) => ({ ...p, name: r.name, gkey: r.gkey, srcId: r.srcId, rot });
  const tryPlace = (sheet, r) => {
    let p = tryFootprint(sheet, r.len, r.wid); if (p) return tag(p, r, false);
    if (lock) return null;
    p = tryFootprint(sheet, r.wid, r.len); if (p) return tag(p, r, true);
    return null;
  };
  for (const r of rects) {
    let placed = null;
    for (const sheet of sheets) { placed = tryPlace(sheet, r); if (placed) { sheet.placements.push(placed); break; } }
    if (!placed) { const sheet = newSheet(); const p = tryPlace(sheet, r); if (p) sheet.placements.push(p); }
  }
  const partArea = rects.reduce((a, r) => a + r.len * r.wid, 0);
  const sheetArea = sheets.length * SW * SH;
  return { sheets, utilisation: sheetArea ? partArea / sheetArea : 0, SW, SH };
}

// ---------- Scale bar (adaptive ruler) ----------
// Draws a bottom-right ruler whose length is a round 1/2/5 value in the current unit, sized to the view's
// px-per-mm. Lets you gauge any component by eye and shows the active UOM. In 3D (orthographic) it's a
// close approximation along the view axes.
function drawScaleBar(ctx, cw, ch, pxPerMm) {
  if (!(pxPerMm > 0) || !isFinite(pxPerMm)) return;
  const mmPerDisp = S.unit === 'mm' ? 1 : MM_PER_IN, pxPerDisp = pxPerMm * mmPerDisp;
  const targetPx = Math.max(56, Math.min(140, cw * 0.2));
  const rawDisp = targetPx / pxPerDisp;
  if (!(rawDisp > 0) || !isFinite(rawDisp)) return;
  const pow = Math.pow(10, Math.floor(Math.log10(rawDisp)));
  let niceDisp = pow; for (const m of [1, 2, 5, 10]) if (m * pow <= rawDisp) niceDisp = m * pow;
  const barPx = niceDisp * pxPerDisp, x1 = cw - 16, x0 = x1 - barPx, y = ch - 16;
  ctx.save();
  ctx.strokeStyle = 'rgba(174,183,198,0.9)'; ctx.fillStyle = 'rgba(174,183,198,0.95)';
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y - 5); ctx.lineTo(x0, y + 5); ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y + 5); ctx.stroke();
  ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const lbl = S.unit === 'mm' ? `${niceDisp} mm` : `${+niceDisp.toFixed(3)} in`;
  ctx.fillText(lbl, (x0 + x1) / 2, y - 7);
  ctx.restore();
}

// ---------- Measure + dimension overlays ----------
// Click-to-measure: points are stored in screen space; distance = screen length ÷ view px-per-mm (exact in
// 2D, close in orthographic 3D). Cleared whenever the view is panned/zoomed/orbited so it never goes stale.
// Snap a screen point to the nearest candidate (module/part corner or edge midpoint) within `tol` px.
function nearestSnap(p, pts, tol) {
  let best = p, bd = (tol || 12) * (tol || 12), snapped = false;
  for (const s of pts) { const dx = s.x - p.x, dy = s.y - p.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = s; snapped = true; } }
  return { x: best.x, y: best.y, snapped };
}
// Generic measure overlay: draws the two points, the connecting line and the distance chip on any ctx.
function drawMeasureOverlay(ctx, measure) {
  if (!measure) return;
  const { a, b, dist } = measure;
  ctx.save();
  const dot = (p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, 7); ctx.fillStyle = '#ffb454'; ctx.fill(); if (p.snapped) { ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, 7); ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 1.5; ctx.stroke(); } };
  ctx.strokeStyle = '#ffb454'; ctx.lineWidth = 1.5;
  dot(a);
  if (b) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); dot(b);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, txt = fmtU(dist);
    ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const wpx = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(20,24,30,0.85)'; ctx.fillRect(mx - wpx / 2 - 6, my - 9, wpx + 12, 18);
    ctx.fillStyle = '#ffffff'; ctx.fillText(txt, mx, my);
  } else {
    ctx.fillStyle = '#9aa3b2'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('Click the second point…', a.x + 8, a.y - 8);
  }
  ctx.restore();
}
// Add a screen point to a measure state, snapping to `pts` and freezing the distance once both points exist.
function addMeasurePoint(measure, rawPt, pts, pxPerMm) {
  const p = nearestSnap(rawPt, pts, 12);
  if (!measure || measure.b) return { a: p };
  const sc = pxPerMm || 1;
  return { a: measure.a, b: p, dist: Math.hypot(p.x - measure.a.x, p.y - measure.a.y) / sc };
}
// A dimension line between two screen points with end ticks + a labelled chip.
function dimLineScreen(x0, y0, x1, y1, text) {
  rctx.save();
  rctx.strokeStyle = DIMCOL; rctx.lineWidth = 1;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 4, ny = dx / L * 4;
  rctx.beginPath(); rctx.moveTo(x0, y0); rctx.lineTo(x1, y1);
  rctx.moveTo(x0 - nx, y0 - ny); rctx.lineTo(x0 + nx, y0 + ny);
  rctx.moveTo(x1 - nx, y1 - ny); rctx.lineTo(x1 + nx, y1 + ny); rctx.stroke();
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  rctx.font = '11px system-ui, sans-serif'; rctx.textAlign = 'center'; rctx.textBaseline = 'middle';
  const wpx = rctx.measureText(text).width;
  rctx.fillStyle = 'rgba(20,24,30,0.8)'; rctx.fillRect(mx - wpx / 2 - 4, my - 8, wpx + 8, 15);
  rctx.fillStyle = '#aeb7c6'; rctx.fillText(text, mx, my);
  rctx.restore();
}
// Room 2D: per-module width (below) + height (right) callouts, offset in screen space so zoom keeps them tidy.
function drawModuleDims2D(m, worldToScreen) {
  const p = modPlace(m);
  const bl = worldToScreen(p.offsetX, p.baseHeight), br = worldToScreen(p.offsetX + m.cab.w, p.baseHeight);
  const tr = worldToScreen(p.offsetX + m.cab.w, p.baseHeight + m.cab.h);
  dimLineScreen(bl[0], bl[1] + 22, br[0], br[1] + 22, fmtU(m.cab.w));
  dimLineScreen(br[0] + 22, br[1], tr[0] + 22, tr[1], fmtU(m.cab.h));
}

// ---------- 2D design view ----------
function partRect(c) {
  const ht = partThick(c) / 2;
  if (c.type === 'shelf') return { x0: c.a0, x1: c.a1, y0: c.pos - ht, y1: c.pos + ht };
  return { x0: c.pos - ht, x1: c.pos + ht, y0: c.a0, y1: c.a1 };
}
function clampComp(c) {
  const t = S.cab.t, ht = partThick(c) / 2;
  if (c.type === 'door' && c.span) {                 // keep the picked region inside the carcass, preserving its size where possible
    const w = S.cab.w, h = S.cab.h, s = c.span;
    const sw = Math.min(s.right - s.left, w - 2 * t), sh = Math.min(s.top - s.bottom, h - 2 * t);
    s.left = Math.max(t, Math.min(s.left, w - t - sw)); s.right = s.left + sw;
    s.bottom = Math.max(t, Math.min(s.bottom, h - t - sh)); s.top = s.bottom + sh;
    c.ax = (s.left + s.right) / 2; c.ay = (s.bottom + s.top) / 2; return;
  }
  if (c.type === 'drawer' || c.type === 'door') { c.ax = Math.max(t, Math.min(c.ax, S.cab.w - t)); c.ay = Math.max(t, Math.min(c.ay, S.cab.h - t)); return; }
  if (c.type === 'shelf') { const cell = cellAt((c.a0 + c.a1) / 2, c.pos, c.id); c.pos = Math.min(Math.max(c.pos, cell.bottom + ht), cell.top - ht); }
  else { const cell = cellAt(c.pos, (c.a0 + c.a1) / 2, c.id); c.pos = Math.min(Math.max(c.pos, cell.left + ht), cell.right - ht); }
}
// Snap a shelf/vertical against one side/end of its current cell — the anchor dropdowns act as a seating command
// (like the drawer's Top/Bottom). axis 'pos' seats its position across the opening; 'span' seats the resizable
// span (a0..a1) along the opening, keeping its current size. clampComp then keeps the result legal.
function seatComp(c, axis, anchor) {
  const cell = c.type === 'shelf'
    ? cellAt((c.a0 + c.a1) / 2, c.pos, c.id)
    : cellAt(c.pos, (c.a0 + c.a1) / 2, c.id);
  const ht = partThick(c) / 2;
  if (axis === 'pos') {
    const lo = c.type === 'shelf' ? cell.bottom : cell.left;
    const hi = c.type === 'shelf' ? cell.top : cell.right;
    c.pos = anchor === 'start' ? lo + ht : anchor === 'end' ? hi - ht : (lo + hi) / 2;
  } else {   // seat the span
    const lo = c.type === 'shelf' ? cell.left : cell.bottom;
    const hi = c.type === 'shelf' ? cell.right : cell.top;
    const len = Math.max(1, Math.min(c.a1 - c.a0, hi - lo));
    if (anchor === 'start') { c.a0 = lo; c.a1 = lo + len; }
    else if (anchor === 'end') { c.a1 = hi; c.a0 = hi - len; }
    else { const ctr = (lo + hi) / 2; c.a0 = ctr - len / 2; c.a1 = ctr + len / 2; }
  }
  clampComp(c);
}

// CAP: when set (by the production-pack exporter) fitCanvas sizes the target to an explicit
// off-screen resolution instead of the on-screen CSS box, so drawings export crisp at print DPI.
let CAP = null;
function fitCanvas(canvas, ctx) {
  const dpr = CAP ? CAP.dpr : (window.devicePixelRatio || 1);
  const r = CAP ? { width: CAP.w, height: CAP.h } : canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cw: r.width, ch: r.height };
}
let view = { scale: 1, ox: 0, oy: 0 };
const fitScale2D = (cw, ch) => { const pad = 64; return Math.min((cw - 2 * pad) / S.cab.w, (ch - 2 * pad) / S.cab.h); };
function computeView(cw, ch) {
  const { w, h } = S.cab, scale = fitScale2D(cw, ch) * S.zoom;
  view = { scale, ox: (cw - w * scale) / 2 + S.pan.x, oy: (ch - h * scale) / 2 + S.pan.y };
}
// Zoom the 2D view about a screen point (keeps that point under the cursor).
function zoom2DAt(x, y, factor) {
  const mx = (x - view.ox) / view.scale, my = S.cab.h - (y - view.oy) / view.scale;
  S.zoom = Math.max(0.3, Math.min(8, S.zoom * factor));
  const r = designCanvas.getBoundingClientRect(), scale = fitScale2D(r.width, r.height) * S.zoom;
  S.pan.x = x - mx * scale - (r.width - S.cab.w * scale) / 2;
  S.pan.y = y - (S.cab.h - my) * scale - (r.height - S.cab.h * scale) / 2;
  render();
}
const sx = (xmm) => view.ox + xmm * view.scale;
const sy = (ymm) => view.oy + (S.cab.h - ymm) * view.scale;
function fillRectMM(ctx, r0, fill, stroke) {
  const x = sx(r0.x0), y = sy(r0.y1), wpx = (r0.x1 - r0.x0) * view.scale, hpx = (r0.y1 - r0.y0) * view.scale;
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, wpx, hpx); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, wpx - 1, hpx - 1); }
}
function dimLabel(ctx, text, x, y, vertical) {
  ctx.save(); ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const wpx = ctx.measureText(text).width + 8;
  ctx.translate(x, y); if (vertical) ctx.rotate(-Math.PI / 2);
  // No black box: mask the dim line behind the number with the wood field colour (invisible against the
  // field). Pure flat white text — no glow/shadow/emboss.
  ctx.fillStyle = dimMask; ctx.fillRect(-wpx / 2, -8, wpx, 16);
  ctx.fillStyle = '#ffffff'; ctx.fillText(text, 0, 0); ctx.restore();
}
// Small FILLED triangular arrowheads for dimension lines. Self-contained (own path + fill), so call them
// AFTER stroking the dimension line — never while the line's path is still open (the beginPath would reset it).
const DIMCOL = '#8a97a8', AHEAD = 4;
function arrowH(ctx, x, y, sign) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sign * AHEAD, y - 2); ctx.lineTo(x + sign * AHEAD, y + 2); ctx.closePath(); ctx.fillStyle = DIMCOL; ctx.fill(); }
function arrowV(ctx, x, y, sign) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + sign * AHEAD); ctx.lineTo(x + 2, y + sign * AHEAD); ctx.closePath(); ctx.fillStyle = DIMCOL; ctx.fill(); }

// Interior openings as NON-OVERLAPPING maximal rectangles, used by both 2D and 3D dimensioning. Built on an
// elementary grid of EVERY part edge on BOTH axes (a vertical contributes its x-faces AND its y-span ends;
// a shelf the reverse), then open elementary cells are joined into horizontal runs and runs stacked while the
// band below matches. Result: a divider only splits the openings along the height it actually spans — a
// partial/short divider no longer splits the clear opening above or below it into two phantom widths.
function enumerateOpenings() {
  const xs = new Set([innerL(), innerR()]), ys = new Set([innerB(), innerT()]);
  for (const c of S.comps) {
    if (c.type !== 'shelf' && c.type !== 'vertical') continue;   // drawers/doors carry no span (would inject NaN)
    const ht = partThick(c) / 2;
    if (c.type === 'vertical') { xs.add(c.pos - ht); xs.add(c.pos + ht); ys.add(c.a0); ys.add(c.a1); }
    else { ys.add(c.pos - ht); ys.add(c.pos + ht); xs.add(c.a0); xs.add(c.a1); }
  }
  const xa = [...xs].filter(Number.isFinite).sort((a, b) => a - b);
  const ya = [...ys].filter(Number.isFinite).sort((a, b) => a - b);
  const nx = xa.length - 1, ny = ya.length - 1;
  if (nx < 1 || ny < 1) return [];
  const openCell = (i, j) => {                       // is elementary cell (col i, row j) clear of every part?
    const cx = (xa[i] + xa[i + 1]) / 2, cy = (ya[j] + ya[j + 1]) / 2;
    for (const c of S.comps) {
      if (c.type !== 'shelf' && c.type !== 'vertical') continue;
      const r = partRect(c);
      if (cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1) return false;
    }
    return true;
  };
  const rowRuns = [];                                // per row band: maximal horizontal runs [i0,i1] of open cells
  for (let j = 0; j < ny; j++) {
    const runs = []; let i = 0;
    while (i < nx) {
      if (!openCell(i, j)) { i++; continue; }
      let k = i; while (k + 1 < nx && openCell(k + 1, j)) k++;
      runs.push([i, k]); i = k + 1;
    }
    rowRuns.push(runs);
  }
  const used = rowRuns.map(runs => runs.map(() => false)), out = [];
  for (let j = 0; j < ny; j++) for (let ri = 0; ri < rowRuns[j].length; ri++) {
    if (used[j][ri]) continue;
    const [i0, i1] = rowRuns[j][ri]; let j2 = j;
    while (j2 + 1 < ny) {                             // extend the rectangle down while the band below has the same run
      const b = rowRuns[j2 + 1].findIndex(r => r[0] === i0 && r[1] === i1);
      if (b < 0 || used[j2 + 1][b]) break;
      used[j2 + 1][b] = true; j2++;
    }
    used[j][ri] = true;
    out.push({ left: xa[i0], right: xa[i1 + 1], bottom: ya[j], top: ya[j2 + 1] });
  }
  return out;
}

// Plain centred label with a background chip (used for 3D dims where rotation varies).
function label3D(text, x, y) {
  dctx.save(); dctx.font = '600 11px system-ui, sans-serif'; dctx.textAlign = 'center'; dctx.textBaseline = 'middle';
  const wpx = dctx.measureText(text).width + 8;
  dctx.fillStyle = 'rgba(20,24,30,0.9)'; dctx.fillRect(x - wpx / 2, y - 8, wpx, 16);
  dctx.fillStyle = '#ffffff'; dctx.fillText(text, x, y); dctx.restore();
}

// One compact, non-overlapping dimension per opening cell: height just inside the left edge and width
// just inside the top edge. Each axis is skipped when the cell is too small to label cleanly, so tight
// openings stay uncluttered instead of stacking labels.
function cellDim(ctx, cell) {
  const xL = sx(cell.left), xR = sx(cell.right), yT = sy(cell.top), yB = sy(cell.bottom);   // yT < yB on screen
  const wPx = xR - xL, hPx = yB - yT, INSET = 14;
  if (hPx >= 24 && wPx >= 18) {                       // height — vertical, inside the left edge
    const x = xL + INSET;
    ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(x, yT + 3); ctx.lineTo(x, yB - 3); ctx.stroke();
    arrowV(ctx, x, yT + 3, 1); arrowV(ctx, x, yB - 3, -1);
    dimLabel(ctx, fmtU(cell.top - cell.bottom), x, (yT + yB) / 2, true);
  }
  if (wPx >= 30 && hPx >= 18) {                       // width — horizontal, inside the top edge
    const y = yT + INSET;
    ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(xL + 3, y); ctx.lineTo(xR - 3, y); ctx.stroke();
    arrowH(ctx, xL + 3, y, 1); arrowH(ctx, xR - 3, y, -1);
    dimLabel(ctx, fmtU(cell.right - cell.left), (xL + xR) / 2, y, false);
  }
}
// Second width dimension for a drawer: the box-OUTER width (opening between flanks less the channel gap each side),
// drawn at mid-height so it reads separately from the opening/fascia width (e.g. 230 at the top, 204 here).
function drawerBoxDim(ctx, c) {
  const cell = drawerRect(c), bx0 = cell.left + DRAWER.sideClear, bx1 = cell.right - DRAWER.sideClear;
  if (bx1 - bx0 < 1) return;
  const xL = sx(bx0), xR = sx(bx1), y = (sy(cell.top) + sy(cell.bottom)) / 2;
  if (xR - xL < 30) return;
  ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(xL + 3, y); ctx.lineTo(xR - 3, y); ctx.stroke();
  arrowH(ctx, xL + 3, y, 1); arrowH(ctx, xR - 3, y, -1);
  dimLabel(ctx, fmtU(bx1 - bx0), (xL + xR) / 2, y, false);
}

// Overall outside dimensions: height to the LEFT of the carcass, width along the BOTTOM — each with two
// extension lines, filled arrowheads and a masked label, like the reference elevation.
function drawOverallDims(w, h) {
  const x0 = sx(0), x1 = sx(w), yB = sy(0), yT = sy(h), OFF = 32;
  dctx.strokeStyle = DIMCOL; dctx.lineWidth = 1;
  const hx = x0 - OFF;                                // height dimension, left of the carcass
  dctx.beginPath();
  dctx.moveTo(x0, yB); dctx.lineTo(hx - 4, yB);      // bottom extension line
  dctx.moveTo(x0, yT); dctx.lineTo(hx - 4, yT);      // top extension line
  dctx.moveTo(hx, yB); dctx.lineTo(hx, yT);          // dimension line
  dctx.stroke();
  arrowV(dctx, hx, yB, -1); arrowV(dctx, hx, yT, 1);
  dimLabel(dctx, fmtU(h), hx, (yB + yT) / 2, true);
  const wy = yB + OFF;                                // width dimension, below the carcass
  dctx.beginPath();
  dctx.moveTo(x0, yB); dctx.lineTo(x0, wy + 4);      // left extension line
  dctx.moveTo(x1, yB); dctx.lineTo(x1, wy + 4);      // right extension line
  dctx.moveTo(x0, wy); dctx.lineTo(x1, wy);          // dimension line
  dctx.stroke();
  arrowH(dctx, x0, wy, 1); arrowH(dctx, x1, wy, -1);
  dimLabel(dctx, fmtU(w), (x0 + x1) / 2, wy, false);
  // Side-panel cut height — drawn on the RIGHT (mirroring the overall height on the left) ONLY when an outset cap
  // shortens the side below the overall height, so it never duplicates the overall in the all-inset case. Switching a
  // cap inset⇄outset makes this dimension appear and its number track the mount (e.g. 600 overall → 584 side).
  const sh = sideHeight();
  if (Math.abs(sh - h) > 0.5) {
    const yA = sy(sideY0()), yZ = sy(sideY1()), shx = x1 + OFF;   // right of the carcass
    dctx.beginPath();
    dctx.moveTo(x1, yA); dctx.lineTo(shx + 4, yA);
    dctx.moveTo(x1, yZ); dctx.lineTo(shx + 4, yZ);
    dctx.moveTo(shx, yA); dctx.lineTo(shx, yZ);
    dctx.stroke();
    arrowV(dctx, shx, yA, -1); arrowV(dctx, shx, yZ, 1);
    dimLabel(dctx, fmtU(sh), shx, (yA + yZ) / 2, true);
  }
}

function drawDrawer2D(c) {
  const sel = c.id === S.selectedId;
  for (const f of drawerFascias(c)) {
    const y1 = f.y1, r = { x0: f.x0, x1: f.x1, y0: f.y0, y1 };
    fillRectMM(dctx, r, sel ? 'rgba(255,180,84,0.92)' : D2D.part, sel ? '#ffd9a0' : D2D.partEdge);
    const cx = sx((r.x0 + r.x1) / 2), hy = sy(y1) + 14;          // handle near the top of each front
    dctx.strokeStyle = '#2a1d02'; dctx.lineWidth = 2; dctx.beginPath(); dctx.moveTo(cx - 18, hy); dctx.lineTo(cx + 18, hy); dctx.stroke();
  }
}
function renderDesign() {
  const { cw, ch } = fitCanvas(designCanvas, dctx);
  dctx.clearRect(0, 0, cw, ch);
  if (S.cab.w <= 0 || S.cab.h <= 0) return;
  computeView(cw, ch);
  const { w, h, t } = S.cab;

  // Fixed dark-wood look for the design view (D2D), independent of the setup wood theme. The interior field
  // shows the back panel's wood ONLY when a back is fitted; with no back the carcass is open (dark).
  const field = S.cab.back ? D2D.field : CANVAS_BG;
  dimMask = field;
  fillRectMM(dctx, { x0: innerL(), x1: innerR(), y0: innerB(), y1: innerT() }, field, null);
  const wall = D2D.frame, wline = D2D.frameLine;
  const sy0 = sideY0(), sy1 = sideY1(), bX = capXRange('bottom'), tX = capXRange('top');
  if (sideLOn()) fillRectMM(dctx, { x0: 0, x1: t, y0: sy0, y1: sy1 }, wall, wline);
  if (sideROn()) fillRectMM(dctx, { x0: w - t, x1: w, y0: sy0, y1: sy1 }, wall, wline);
  if (capOn('bottom')) fillRectMM(dctx, { x0: bX.x0, x1: bX.x1, y0: 0, y1: t }, wall, wline);
  if (capOn('top')) fillRectMM(dctx, { x0: tX.x0, x1: tX.x1, y0: h - t, y1: h }, wall, wline);
  dctx.save();   // soft drop shadow gives shelves/dividers/drawers depth against the brighter wood field
  dctx.shadowColor = 'rgba(0,0,0,0.4)'; dctx.shadowBlur = 6; dctx.shadowOffsetX = 1; dctx.shadowOffsetY = 3;
  for (const c of S.comps) {
    if (c.type === 'drawer') continue;
    const sel = c.id === S.selectedId;
    fillRectMM(dctx, partRect(c), sel ? '#ffb454' : D2D.part, sel ? '#ffd9a0' : D2D.partEdge);
  }
  for (const c of S.comps) if (c.type === 'drawer') drawDrawer2D(c);
  dctx.restore();
  // ONE compact dimension per opening — width along its top, height down its left. Opening-based, so the
  // shelf/divider segment sizes are never drawn a second time on top of the opening sizes (that duplicate
  // height label was the overlap). Cut sizes still live in the cut-list table.
  for (const cell of enumerateOpenings()) cellDim(dctx, cell);
  for (const c of S.comps) if (c.type === 'drawer') drawerBoxDim(dctx, c);   // add the box-outer width (204) alongside the opening width (230)

  // doors overlay (translucent so internals stay visible)
  for (const r of doorRects()) {
    const sel = r.id === S.selectedId;
    fillRectMM(dctx, r, sel ? 'rgba(255,180,84,0.30)' : 'rgba(190,160,105,0.22)', sel ? '#ffd9a0' : '#d9c08a');
    const hx = r.side === 'R' ? r.x0 + 18 : r.x1 - 18;   // handle near opening (meeting) edge
    dctx.fillStyle = sel ? '#ffd9a0' : '#d9c08a';
    dctx.fillRect(sx(hx) - 1.5, sy((r.y0 + r.y1) / 2) - 13, 3, 26);
  }

  // cell-pick overlay: outline every bay; fill the ones currently chosen for the door
  if (cellMode) {
    for (const cell of enumerateOpenings())
      fillRectMM(dctx, { x0: cell.left, x1: cell.right, y0: cell.bottom, y1: cell.top }, null, 'rgba(125,176,255,0.55)');
    for (const cell of cellSel)
      fillRectMM(dctx, { x0: cell.left, x1: cell.right, y0: cell.bottom, y1: cell.top }, 'rgba(90,150,255,0.28)', '#7db0ff');
  }

  // Overall outside dimensions (height left, width bottom) as real dimension lines. Labels mask against
  // the canvas background since they sit outside the carcass.
  dimMask = CANVAS_BG;
  drawOverallDims(w, h);
  dctx.fillStyle = '#9aa3b2'; dctx.font = '12px system-ui, sans-serif'; dctx.textAlign = 'left';
  dctx.fillText(`depth ${fmtU(S.cab.d)}`, 12, ch - 12);
  dSnapPts = [];   // carcass + part corners for measure snapping
  const addSnap = (xmm, ymm) => dSnapPts.push({ x: sx(xmm), y: sy(ymm) });
  [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2]].forEach(([X, Y]) => addSnap(X, Y));
  for (const c of S.comps) { const r = partRect(c); [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]].forEach(([X, Y]) => addSnap(X, Y)); }
  drawScaleBar(dctx, cw, ch, view.scale);
  drawMeasureOverlay(dctx, dMeasure);
}

// ---------- 3D preview ----------
function buildBoxes() {
  const { w, h, d, t, back } = S.cab;
  const P = woodPal();   // active wood finish (Birch / Oak / Walnut)
  const wood = P.wood, backCol = P.back, shelfCol = P.shelf, vertCol = P.vert, doorCol = P.door;
  const boxes = [];
  const push = (x0, x1, y0, y1, z0, z1, base, id, alpha) => boxes.push({ x0, x1, y0, y1, z0, z1, base, id, alpha: alpha || 1 });
  const sy0 = sideY0(), sy1 = sideY1();
  if (sideLOn()) push(0, t, sy0, sy1, 0, d, wood, 'L');
  if (sideROn()) push(w - t, w, sy0, sy1, 0, d, wood, 'R');
  if (capOn('bottom')) { const bX = capXRange('bottom'), bZ = capZRange('bottom'); push(bX.x0, bX.x1, 0, t, bZ.z0, bZ.z1, wood, 'B'); }
  if (capOn('top')) { const tX = capXRange('top'), tZ = capZRange('top'); push(tX.x0, tX.x1, h - t, h, tZ.z0, tZ.z1, wood, 'T'); }
  const bg = back ? backGeom() : null;
  const zF = bg ? bg.front : 0;
  if (bg) push(bg.x0, bg.x1, bg.y0, bg.y1, bg.z0, bg.z1, backCol, 'BK');
  for (const c of S.comps) {
    const z0 = Math.max(0, zF + (c.setback || 0));        // positioned from the back panel front face
    const z1 = Math.min(d, z0 + compDepth(c));
    const ht = partThick(c) / 2;
    if (c.type === 'shelf') for (const s of shelfSegments(c)) push(s.lo, s.hi, c.pos - ht, c.pos + ht, z0, z1, shelfCol, c.id);
    else if (c.type === 'vertical') for (const s of verticalSegments(c)) push(c.pos - ht, c.pos + ht, s.lo, s.hi, z0, z1, vertCol, c.id);
    else if (c.type === 'drawer') {
      const fz0 = c.mount === 'inset' ? d - t : d, fz1 = fz0 + t;   // inset = flush within the opening; outset = proud of the cabinet face
      for (const f of drawerFascias(c)) push(f.x0, f.x1, f.y0, f.y1, fz0, fz1, doorCol, c.id);
      // The drawer box itself — inset from the flanks by the channel gap on each side so that clearance is visible
      // on orbit. The front wall is dropped when the drawer's Box-front option is off (fascia is then the front).
      for (const b of drawerBox3D(c)) { if (b.part === 'front' && c.boxFront === false) continue; push(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1, b.part === 'back' ? backCol : shelfCol, c.id); }
    }
  }
  for (const r of doorRects()) { const z0 = r.mount === 'inset' ? d - t : d; push(r.x0, r.x1, r.y0, r.y1, z0, z0 + t, doorCol, r.id, 0.55); }
  return boxes;
}
const pointInPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
};
let last3DFaces = [];
function renderDesign3D() {
  const { cw, ch } = fitCanvas(designCanvas, dctx);
  dctx.clearRect(0, 0, cw, ch);
  const { w, h, d } = S.cab;
  if (w <= 0 || h <= 0 || d <= 0) { last3DFaces = []; return; }
  const cen = [w / 2, h / 2, d / 2], ex = S.explode;
  const { yaw, pitch } = S.cam;
  const cY = Math.cos(yaw), sYa = Math.sin(yaw), cX = Math.cos(pitch), sXa = Math.sin(pitch);
  const rot = (x, y, z) => {
    x -= cen[0]; y -= cen[1]; z -= cen[2];
    const x1 = x * cY + z * sYa, z1 = -x * sYa + z * cY, y1 = y;
    return [x1, y1 * cX - z1 * sXa, y1 * sXa + z1 * cX];
  };
  const FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const boxes = buildBoxes().map(b => {
    const bc = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
    const off = [(bc[0] - cen[0]) * ex, (bc[1] - cen[1]) * ex, (bc[2] - cen[2]) * ex];
    const corners = [
      [b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0],
      [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1],
    ].map(c => rot(c[0] + off[0], c[1] + off[1], c[2] + off[2]));
    corners.forEach(p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
    return { b, rc: corners };
  });
  const pad = 56, scale = Math.min((cw - 2 * pad) / Math.max(1, maxX - minX), (ch - 2 * pad) / Math.max(1, maxY - minY)) * S.zoom3d;
  const panX = (S.pan3d && S.pan3d.x) || 0, panY = (S.pan3d && S.pan3d.y) || 0;   // screen-space drag-to-move
  const offX = (cw - (maxX + minX) * scale) / 2 + panX, offY = (ch + (maxY + minY) * scale) / 2 + panY;
  const proj = (p) => [offX + p[0] * scale, offY - p[1] * scale];
  lastDesign3dScale = scale;
  dSnapPts = []; for (const { rc } of boxes) for (const c of rc) { const s = proj(c); dSnapPts.push({ x: s[0], y: s[1] }); }   // box corners for measure snapping

  const Lv = (() => { const v = [-0.3, 0.65, 0.7], m = Math.hypot(v[0], v[1], v[2]); return v.map(k => k / m); })();
  const faces = [];
  for (const { b, rc } of boxes) {
    const base = b.id === S.selectedId ? [255, 180, 84] : b.base;
    for (const f of FACES) {
      const p0 = rc[f[0]], p1 = rc[f[1]], p2 = rc[f[2]];
      const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nm = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(k => k / nm);
      const sh = 0.42 + 0.58 * Math.abs(n[0] * Lv[0] + n[1] * Lv[1] + n[2] * Lv[2]);
      const depth = (rc[f[0]][2] + rc[f[1]][2] + rc[f[2]][2] + rc[f[3]][2]) / 4;
      const rgb = base.map(k => Math.round(k * sh));
      faces.push({ pts: f.map(i => proj(rc[i])), depth, id: b.id, color: b.alpha < 1 ? `rgba(${rgb.join(',')},${b.alpha})` : `rgb(${rgb.join(',')})` });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  for (const fc of faces) {
    dctx.beginPath(); dctx.moveTo(fc.pts[0][0], fc.pts[0][1]);
    for (let i = 1; i < fc.pts.length; i++) dctx.lineTo(fc.pts[i][0], fc.pts[i][1]);
    dctx.closePath(); dctx.fillStyle = fc.color; dctx.fill();
    dctx.strokeStyle = 'rgba(18,22,28,0.55)'; dctx.lineWidth = 1; dctx.stroke();
  }
  last3DFaces = faces;

  // Dimensions (only on the assembled model, i.e. not exploded), projected through the same camera.
  if (ex < 0.001 && S.showDims) {
    const OFF = Math.max(60, Math.min(w, h, d) * 0.12);
    const projW = (p) => proj(rot(p[0], p[1], p[2]));
    const dim3 = (p0, p1, off, text) => {
      const A = projW([p0[0] + off[0], p0[1] + off[1], p0[2] + off[2]]);
      const B = projW([p1[0] + off[0], p1[1] + off[1], p1[2] + off[2]]);
      const E0 = projW(p0), E1 = projW(p1);
      dctx.strokeStyle = DIMCOL; dctx.lineWidth = 1; dctx.beginPath();
      dctx.moveTo(E0[0], E0[1]); dctx.lineTo(A[0], A[1]);   // extension lines from the box edge
      dctx.moveTo(E1[0], E1[1]); dctx.lineTo(B[0], B[1]);
      dctx.moveTo(A[0], A[1]); dctx.lineTo(B[0], B[1]);     // the dimension line
      dctx.stroke();
      label3D(text, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2);
    };
    // overall W / H / D along front edges
    dim3([0, 0, d], [w, 0, d], [0, -OFF, 0], fmtU(w));   // width  — front bottom, below
    dim3([w, 0, d], [w, h, d], [OFF, 0, 0], fmtU(h));    // height — front right, to the right
    // Side-panel cut height — inboard of the overall height, only when an outset cap shortens it below the overall
    // (so switching a cap inset⇄outset makes this appear and reflect the mount, matching the 2D view).
    const sh = sideHeight();
    if (Math.abs(sh - h) > 0.5) dim3([w, sideY0(), d], [w, sideY1(), d], [OFF * 0.5, 0, 0], fmtU(sh));
    dim3([w, 0, d], [w, 0, 0], [0, -OFF, 0], fmtU(d));   // depth  — right bottom, below (carcass depth)
    // interior/shelf usable depth (carcass depth minus the back recess) — shown on the left bottom edge, inset
    // from the back, only when a back recess makes it differ from the carcass depth so it never duplicates it.
    const z0 = backFront(), uDep = d - z0;
    if (z0 > 0.5 && uDep > 0.5) dim3([0, 0, z0], [0, 0, d], [0, -OFF, 0], fmtU(uDep));
    // opening heights along the front-left edge (mirrors the 2D view, left column)
    if (S.comps.some(c => c.type === 'shelf'))
      for (const cell of enumerateOpenings())
        if (Math.round(cell.left) === Math.round(S.cab.t))
          dim3([0, cell.bottom, d], [0, cell.top, d], [-OFF, 0, 0], fmtU(cell.top - cell.bottom));
  }

  dctx.fillStyle = '#9aa3b2'; dctx.font = '12px system-ui, sans-serif'; dctx.textAlign = 'left';
  dctx.fillText(`3D · drag to orbit · click a face to select · ${fmtU(w)} × ${fmtU(h)} × ${fmtU(d)}`, 12, ch - 12);
  drawScaleBar(dctx, cw, ch, scale);
  drawMeasureOverlay(dctx, dMeasure);
}

// ---------- Sheet view ----------
// opts: { highlight, sheetNo } — highlight recolours the piece; sheetNo labels which sheet it sits on.
function drawPlacement(ctx, p, ox, oy, scale, showText, opts) {
  opts = opts || {};
  const hi = !!opts.highlight, sheetNo = opts.sheetNo;
  const px = ox + p.x * scale, py = oy + p.y * scale, pw = p.w * scale, ph = p.h * scale;
  ctx.fillStyle = hi ? '#e8873a' : '#3a78d6'; ctx.fillRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.strokeStyle = hi ? '#ffd9a0' : '#f1e4ba'; ctx.lineWidth = hi ? 2 : 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.strokeStyle = hi ? 'rgba(255,232,200,0.45)' : 'rgba(207,224,255,0.30)'; ctx.lineWidth = 1; ctx.beginPath();
  if (p.rot) { for (let gx = px + pw / 4; gx < px + pw; gx += pw / 4) { ctx.moveTo(gx, py + 3); ctx.lineTo(gx, py + ph - 3); } }
  else { for (let gy = py + ph / 4; gy < py + ph; gy += ph / 4) { ctx.moveTo(px + 3, gy); ctx.lineTo(px + pw - 3, gy); } }
  ctx.stroke();
  if (!showText) return;
  const lenW = p.rot ? p.h : p.w, widW = p.rot ? p.w : p.h;   // original part length × width
  const dim = `${fmt(lenW)}×${fmt(widW)}`;
  const sLabel = sheetNo != null ? `S${sheetNo}` : '';
  ctx.fillStyle = '#fbf3da'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (pw > 56 && ph > 30) {                       // room for name + sheet/dim on two lines
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(p.name, px + pw / 2, py + ph / 2 - 7);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText(`${sLabel} · ${dim}`.replace(/^ · /, ''), px + pw / 2, py + ph / 2 + 7);
  } else if (pw > 40 && ph > 18) {                // one line: name + dim
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`${p.name} ${fmt(lenW)}`, px + pw / 2, py + ph / 2);
  } else if (pw > 14 && ph > 12) {                // tiny: first letter only
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(p.name[0], px + pw / 2, py + ph / 2);
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}
// Screen-space rectangles of placed pieces, recorded each render so the sheet canvas is clickable.
let lastSheetRects = [];
function renderSheet(pack) {
  const { cw, ch } = fitCanvas(sheetCanvas, sctx);
  sctx.clearRect(0, 0, cw, ch);
  lastSheetRects = [];
  const sheets = pack.sheets;
  if (!sheets.length) { sctx.fillStyle = '#9aa3b2'; sctx.font = '14px system-ui'; sctx.textAlign = 'center'; sctx.fillText('No parts to nest.', cw / 2, ch / 2); sctx.textAlign = 'left'; return; }
  const selKeys = selectedGroupKeys();
  const pad = 24, gap = 20;
  const cols = Math.min(sheets.length, Math.max(1, Math.floor((cw - pad) / 220)));
  const rows = Math.ceil(sheets.length / cols);
  const cellW = (cw - pad - gap * (cols - 1)) / cols, cellH = (ch - pad - gap * (rows - 1)) / rows - 18;
  const scale = Math.min(cellW / pack.SW, cellH / pack.SH), dw = pack.SW * scale, dh = pack.SH * scale;
  sctx.font = '11px system-ui, sans-serif';
  sheets.forEach((sheet, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad / 2 + col * (cellW + gap) + (cellW - dw) / 2, y = pad / 2 + row * (cellH + 18 + gap);
    sctx.fillStyle = '#1b2027'; sctx.strokeStyle = '#5b6573'; sctx.lineWidth = 1;
    sctx.fillRect(x, y, dw, dh); sctx.strokeRect(x, y, dw, dh);
    sheet.placements.forEach(p => {
      const hi = p.gkey != null && selKeys.has(p.gkey);
      drawPlacement(sctx, p, x, y, scale, true, { highlight: hi, sheetNo: i + 1 });
      lastSheetRects.push({ x: x + p.x * scale, y: y + p.y * scale, w: p.w * scale, h: p.h * scale, gkey: p.gkey, srcId: p.srcId });
    });
    sctx.fillStyle = '#9aa3b2'; sctx.textAlign = 'left'; sctx.textBaseline = 'alphabetic'; sctx.fillText(`Sheet ${i + 1}`, x, y + dh + 13);
  });
}

// ---------- Room / Run view (ARCH-001 phase 3) ----------
// Composes every module side-by-side on one floor line (front elevation). Each module carries
// placement {offsetX, baseHeight}; baseHeight is set manually (drag up) so users stack as they like.
let lastRoomRects = [], lastRoomScale = 1, roomView = { zoom: 1, pan: { x: 0, y: 0 } }, roomDrag = null;
let roomMode = '2d';   // Room view: '2d' front elevation | '3d' composed scene
let roomCam = { yaw: -0.6, pitch: 0.42 }, roomZoom3d = 1, roomPan3d = { x: 0, y: 0 };
let measureMode = false, roomMeasure = null, lastRoom3dScale = 1, roomDimsOn = false, roomSnapPts = [];   // click-to-measure + per-module dim callouts
let dMeasureMode = false, dMeasure = null, dSnapPts = [], lastDesign3dScale = 1;   // measure tool for the main Design 2D/3D view
// Shared 3D painter: projects a list of {x0,x1,y0,y1,z0,z1,base,alpha,id} boxes through one camera and draws
// them back-to-front. Returns the projected faces (for optional hit-testing). Used by the Room 3D view.
const FACES3D = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
function paint3D(ctx, boxes3d, cen, cam, zoom, pan, cw, ch, selId) {
  const { yaw, pitch } = cam;
  const cY = Math.cos(yaw), sYa = Math.sin(yaw), cX = Math.cos(pitch), sXa = Math.sin(pitch);
  const rot = (x, y, z) => { x -= cen[0]; y -= cen[1]; z -= cen[2]; const x1 = x * cY + z * sYa, z1 = -x * sYa + z * cY, y1 = y; return [x1, y1 * cX - z1 * sXa, y1 * sXa + z1 * cX]; };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const mapped = boxes3d.map(b => {
    const corners = [
      [b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0],
      [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1],
    ].map(c => rot(c[0], c[1], c[2]));
    corners.forEach(p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
    return { b, rc: corners };
  });
  const pad = 60, scale = Math.min((cw - 2 * pad) / Math.max(1, maxX - minX), (ch - 2 * pad) / Math.max(1, maxY - minY)) * zoom;
  const offX = (cw - (maxX + minX) * scale) / 2 + (pan.x || 0), offY = (ch + (maxY + minY) * scale) / 2 + (pan.y || 0);
  const proj = (p) => [offX + p[0] * scale, offY - p[1] * scale];
  const Lv = (() => { const v = [-0.3, 0.65, 0.7], m = Math.hypot(v[0], v[1], v[2]); return v.map(k => k / m); })();
  const faces = [];
  for (const { b, rc } of mapped) {
    const base = (selId != null && b.id === selId) ? [255, 180, 84] : b.base;
    for (const f of FACES3D) {
      const p0 = rc[f[0]], p1 = rc[f[1]], p2 = rc[f[2]];
      const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const nm = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(k => k / nm);
      const sh = 0.42 + 0.58 * Math.abs(n[0] * Lv[0] + n[1] * Lv[1] + n[2] * Lv[2]);
      const depth = (rc[f[0]][2] + rc[f[1]][2] + rc[f[2]][2] + rc[f[3]][2]) / 4;
      const rgb = base.map(k => Math.round(k * sh));
      faces.push({ pts: f.map(i => proj(rc[i])), depth, id: b.id, color: b.alpha < 1 ? `rgba(${rgb.join(',')},${b.alpha})` : `rgb(${rgb.join(',')})` });
    }
  }
  faces.sort((a, b) => a.depth - b.depth);
  for (const fc of faces) {
    ctx.beginPath(); ctx.moveTo(fc.pts[0][0], fc.pts[0][1]);
    for (let i = 1; i < fc.pts.length; i++) ctx.lineTo(fc.pts[i][0], fc.pts[i][1]);
    ctx.closePath(); ctx.fillStyle = fc.color; ctx.fill();
    ctx.strokeStyle = 'rgba(18,22,28,0.5)'; ctx.lineWidth = 1; ctx.stroke();
  }
  return { faces, scale, proj, rot };
}
// Every visible module's boxes, translated to its place on the wall (offsetX along X, baseHeight up Y).
function composeRoomBoxes() {
  const out = [];
  for (const { m } of roomVisibleModules()) {
    const p = modPlace(m);
    withModule(m, () => {
      for (const b of buildBoxes()) out.push({
        x0: b.x0 + p.offsetX, x1: b.x1 + p.offsetX, y0: b.y0 + p.baseHeight, y1: b.y1 + p.baseHeight,
        z0: b.z0, z1: b.z1, base: b.base, alpha: b.alpha, id: null,
      });
    });
  }
  return out;
}
function renderRoom3D() {
  const { cw, ch } = fitCanvas(roomCanvas, rctx);
  rctx.clearRect(0, 0, cw, ch);
  lastRoomRects = [];
  const boxes = JOB.modules.length ? composeRoomBoxes() : [];
  if (!boxes.length) {
    rctx.fillStyle = '#9aa3b2'; rctx.font = '13px system-ui, sans-serif'; rctx.textAlign = 'center';
    rctx.fillText(JOB.modules.length ? 'No modules ticked — choose which to show in the list.' : 'No modules yet.', cw / 2, ch / 2);
    rctx.textAlign = 'left'; return;
  }
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const b of boxes) { bx0 = Math.min(bx0, b.x0); bx1 = Math.max(bx1, b.x1); by0 = Math.min(by0, b.y0); by1 = Math.max(by1, b.y1); bz0 = Math.min(bz0, b.z0); bz1 = Math.max(bz1, b.z1); }
  const span = Math.max(bx1 - bx0, by1 - by0, bz1 - bz0);
  const floor = { x0: bx0 - span * 0.06, x1: bx1 + span * 0.06, y0: by0 - Math.max(8, span * 0.012), y1: by0, z0: bz0 - span * 0.15, z1: bz1 + span * 0.06, base: [64, 70, 80], alpha: 1, id: 'floor' };
  const cen = [(bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2];
  const r3 = paint3D(rctx, [floor, ...boxes], cen, roomCam, roomZoom3d, roomPan3d, cw, ch, null);
  lastRoom3dScale = r3.scale;
  roomSnapPts = [];   // projected box corners of each module, for measure snapping
  for (const { m } of roomVisibleModules()) {
    const p = modPlace(m);
    for (const X of [p.offsetX, p.offsetX + m.cab.w]) for (const Y of [p.baseHeight, p.baseHeight + m.cab.h]) for (const Z of [0, m.cab.d]) {
      const a = r3.proj(r3.rot(X, Y, Z)); roomSnapPts.push({ x: a[0], y: a[1] });
    }
  }
  if (roomDimsOn) {   // W×H×D callout floating above each module
    rctx.font = '11px system-ui, sans-serif'; rctx.textAlign = 'center'; rctx.textBaseline = 'middle';
    for (const { m } of roomVisibleModules()) {
      const p = modPlace(m), a = r3.proj(r3.rot(p.offsetX + m.cab.w / 2, p.baseHeight + m.cab.h, m.cab.d));
      const txt = `${fmt(m.cab.w)}×${fmt(m.cab.h)}×${fmt(m.cab.d)}`, wpx = rctx.measureText(txt).width;
      rctx.fillStyle = 'rgba(20,24,30,0.82)'; rctx.fillRect(a[0] - wpx / 2 - 5, a[1] - 22, wpx + 10, 16);
      rctx.fillStyle = '#aeb7c6'; rctx.fillText(txt, a[0], a[1] - 14);
    }
  }
  rctx.fillStyle = '#9aa3b2'; rctx.font = '12px system-ui, sans-serif'; rctx.textAlign = 'left';
  rctx.fillText('Room 3D · drag to orbit · right/Shift-drag to pan · scroll to zoom', 12, ch - 12);
  drawScaleBar(rctx, cw, ch, r3.scale);
  drawMeasureOverlay(rctx, roomMeasure);
}
function modPlace(m) { if (!m.placement) m.placement = { offsetX: 0, baseHeight: 0 }; return m.placement; }
function ensureRunLayout() {   // give any module without a placement the next slot to the right, on the floor
  let cursor = 0;
  JOB.modules.forEach(m => {
    if (!m.placement) m.placement = { offsetX: cursor, baseHeight: 0 };
    cursor = Math.max(cursor, m.placement.offsetX + m.cab.w);
  });
}
function roomBBox() {
  let maxX = 1, maxY = 1;
  JOB.modules.forEach(m => { const p = modPlace(m); maxX = Math.max(maxX, p.offsetX + m.cab.w); maxY = Math.max(maxY, p.baseHeight + m.cab.h); });
  return { w: maxX, h: maxY };
}
function fillRectWorld(ctx, r, fill, stroke, tf) {
  const a = tf(r.x0, r.y1), b = tf(r.x1, r.y0);   // (x0,y1)=top-left, (x1,y0)=bottom-right in screen space
  const x = a[0], y = a[1], wpx = b[0] - a[0], hpx = b[1] - a[1];
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, wpx, hpx); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, wpx - 1, hpx - 1); }
}
// Draws one module's front elevation through `worldToScreen`, reusing the per-module geometry helpers.
function drawModuleElevation(ctx, m, worldToScreen) {
  const p = modPlace(m);
  const tf = (xmm, ymm) => worldToScreen(p.offsetX + xmm, p.baseHeight + ymm);
  withModule(m, () => {
    const { w, h, t } = S.cab, fillR = (r, f, s) => fillRectWorld(ctx, r, f, s, tf);
    fillR({ x0: innerL(), x1: innerR(), y0: innerB(), y1: innerT() }, '#222831', null);
    const wall = '#6b7686', wline = '#aeb7c6';
    const sy0 = sideY0(), sy1 = sideY1(), bX = capXRange('bottom'), tX = capXRange('top');
    if (sideLOn()) fillR({ x0: 0, x1: t, y0: sy0, y1: sy1 }, wall, wline);
    if (sideROn()) fillR({ x0: w - t, x1: w, y0: sy0, y1: sy1 }, wall, wline);
    if (capOn('bottom')) fillR({ x0: bX.x0, x1: bX.x1, y0: 0, y1: t }, wall, wline);
    if (capOn('top')) fillR({ x0: tX.x0, x1: tX.x1, y0: h - t, y1: h }, wall, wline);
    const Pe = woodPal();
    for (const c of S.comps) { if (c.type === 'drawer') continue; fillR(partRect(c), Pe.p2d, Pe.e2d); }
    for (const c of S.comps) if (c.type === 'drawer') for (const f of drawerFascias(c)) fillR({ x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1 }, Pe.p2d, Pe.e2d);
    for (const r of doorRects()) fillR({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 }, 'rgba(190,160,105,0.30)', '#d9c08a');
  });
}
// Modules ticked for the wall (default: all visible). roomHidden lives on the module object.
const roomVisibleModules = () => JOB.modules.map((m, i) => ({ m, i })).filter(o => !o.m.roomHidden);
function renderRoom() {
  renderRoomModuleList();
  if (roomMode === '3d') { renderRoom3D(); return; }
  const { cw, ch } = fitCanvas(roomCanvas, rctx);
  rctx.clearRect(0, 0, cw, ch);
  if (!JOB.modules.length) return;
  ensureRunLayout();
  const vis = roomVisibleModules(), pad = 72;
  if (!vis.length) {   // nothing ticked — just the floor line + a nudge
    const fy = ch - pad + roomView.pan.y;
    rctx.strokeStyle = '#5b6573'; rctx.lineWidth = 1; rctx.beginPath(); rctx.moveTo(40, fy + 0.5); rctx.lineTo(cw - 40, fy + 0.5); rctx.stroke();
    rctx.fillStyle = '#9aa3b2'; rctx.font = '13px system-ui, sans-serif'; rctx.textAlign = 'center';
    rctx.fillText('No modules ticked — choose which to show in the list (top-left).', cw / 2, ch / 2); rctx.textAlign = 'left';
    lastRoomRects = []; return;
  }
  // Frame tightly to the VISIBLE modules; their placements never change, so ticking never nudges the others.
  let minX = Infinity, maxX = 1, maxY = 1;
  for (const { m } of vis) { const p = modPlace(m); minX = Math.min(minX, p.offsetX); maxX = Math.max(maxX, p.offsetX + m.cab.w); maxY = Math.max(maxY, p.baseHeight + m.cab.h); }
  minX = Math.min(minX, maxX - 1);
  const bbW = Math.max(1, maxX - minX), bbH = Math.max(1, maxY);
  const baseScale = Math.min((cw - 2 * pad) / bbW, (ch - 2 * pad) / bbH);
  const scale = Math.max(0.0001, baseScale) * roomView.zoom; lastRoomScale = scale;
  const totalW = bbW * scale, ox = (cw - totalW) / 2 + roomView.pan.x, floorY = ch - pad + roomView.pan.y;
  const worldToScreen = (wx, wy) => [ox + (wx - minX) * scale, floorY - wy * scale];
  rctx.strokeStyle = '#5b6573'; rctx.lineWidth = 1; rctx.beginPath(); rctx.moveTo(ox - 24, floorY + 0.5); rctx.lineTo(ox + totalW + 24, floorY + 0.5); rctx.stroke();
  lastRoomRects = [];
  vis.forEach(({ m, i }) => {
    drawModuleElevation(rctx, m, worldToScreen);
    const p = modPlace(m), tl = worldToScreen(p.offsetX, p.baseHeight + m.cab.h), br = worldToScreen(p.offsetX + m.cab.w, p.baseHeight);
    const rx = tl[0], ry = tl[1], rw = br[0] - tl[0], rh = br[1] - tl[1];
    lastRoomRects.push({ i, x: rx, y: ry, w: rw, h: rh });
    if (i === JOB.active) { rctx.strokeStyle = '#ffb454'; rctx.lineWidth = 2; rctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2); }
    rctx.fillStyle = i === JOB.active ? '#ffd9a0' : '#9aa3b2'; rctx.font = '12px system-ui, sans-serif'; rctx.textAlign = 'center';
    rctx.fillText(`${m.name || `Module ${i + 1}`} · ${fmt(m.cab.w)}×${fmt(m.cab.h)}`, rx + rw / 2, ry - 8);
    if (p.baseHeight > 0) rctx.fillText(`↑ ${fmtU(p.baseHeight)}`, rx + rw / 2, br[1] + 16);
  });
  rctx.fillStyle = '#9aa3b2'; rctx.font = '12px system-ui, sans-serif'; rctx.textAlign = 'left';
  rctx.fillText('Room · drag a cabinet to position · drag up to lift (manual stack) · click to make it active', 12, ch - 12);
  roomSnapPts = [];   // corners + edge midpoints of each module, for measure snapping
  for (const r of lastRoomRects) roomSnapPts.push(
    { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y + r.h },
    { x: r.x + r.w / 2, y: r.y }, { x: r.x + r.w / 2, y: r.y + r.h }, { x: r.x, y: r.y + r.h / 2 }, { x: r.x + r.w, y: r.y + r.h / 2 });
  if (roomDimsOn) vis.forEach(({ m }) => drawModuleDims2D(m, worldToScreen));
  drawScaleBar(rctx, cw, ch, lastRoomScale);
  drawMeasureOverlay(rctx, roomMeasure);
}
// Floating list that toggles which modules appear on the wall (only shown while the Room tab is active).
function renderRoomModuleList() {
  const box = $('room-modules'); if (!box) return;
  const roomActive = roomCanvas.classList.contains('active');
  const tgl = $('room-view-toggle'); if (tgl) tgl.classList.toggle('hidden', !(roomActive && JOB.modules.length > 0));
  const show = roomActive && JOB.modules.length > 0;
  box.classList.toggle('hidden', !show);
  if (!show) return;
  $('rm-list').innerHTML = JOB.modules.map((m, i) => {
    const on = !m.roomHidden, nm = escapeHtml(m.name || `Module ${i + 1}`);
    return `<label class="rm-item${i === JOB.active ? ' active' : ''}"><input type="checkbox" data-mi="${i}"${on ? ' checked' : ''}><span>${nm}</span></label>`;
  }).join('');
}
$('rm-list').addEventListener('change', (e) => {
  const cb = e.target.closest('input[data-mi]'); if (!cb) return;
  const m = JOB.modules[parseInt(cb.dataset.mi, 10)];
  if (m) { if (cb.checked) delete m.roomHidden; else m.roomHidden = true; }
  renderRoom();
});
$('rm-all').addEventListener('click', () => { JOB.modules.forEach(m => delete m.roomHidden); renderRoom(); });
$('rm-none').addEventListener('click', () => { JOB.modules.forEach(m => m.roomHidden = true); renderRoom(); });
// Collapse / expand (default collapsed) — click the chevron to reveal the list.
$('rm-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  const box = $('room-modules'), collapsed = box.classList.toggle('collapsed');
  $('rm-toggle').setAttribute('aria-expanded', String(!collapsed));
});
// Draggable by its header (buttons still click through); overlay so the wall canvas is never resized.
(function makeRoomListDraggable() {
  const box = $('room-modules'), head = box && box.querySelector('.rm-head');
  if (!box || !head) return;
  let pan = null; const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  head.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;   // let the chevron / All / None work
    const r = box.getBoundingClientRect(), pr = box.parentElement.getBoundingClientRect();
    pan = { dx: e.clientX - r.left, dy: e.clientY - r.top }; box.classList.add('dragging'); e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!pan) return;
    const pr = box.parentElement.getBoundingClientRect();
    box.style.right = 'auto';
    box.style.left = clamp(e.clientX - pr.left - pan.dx, 0, Math.max(0, pr.width - box.offsetWidth)) + 'px';
    box.style.top = clamp(e.clientY - pr.top - pan.dy, 0, Math.max(0, pr.height - box.offsetHeight)) + 'px';
  });
  window.addEventListener('mouseup', () => { if (pan) { pan = null; box.classList.remove('dragging'); } });
})();
const roomXY = (e) => { const r = roomCanvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
roomCanvas.addEventListener('mousedown', (e) => {
  if (measureMode) {   // click point A then B (snapped to corners); a third click starts over
    roomMeasure = addMeasurePoint(roomMeasure, roomXY(e), roomSnapPts, roomMode === '3d' ? lastRoom3dScale : lastRoomScale);
    renderRoom(); return;
  }
  roomMeasure = null;   // navigating clears a stale measurement
  if (roomMode === '3d') {   // orbit (left) / pan (right, middle, Shift) the composed scene
    const panIt = e.button === 1 || e.button === 2 || e.shiftKey;
    roomDrag = { type: panIt ? 'rpan3d' : 'rorbit', x: e.clientX, y: e.clientY };
    roomCanvas.style.cursor = 'grabbing'; e.preventDefault(); return;
  }
  const { x, y } = roomXY(e); let hit = null;
  for (let i = lastRoomRects.length - 1; i >= 0; i--) { const r = lastRoomRects[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { hit = r; break; } }
  if (hit) roomDrag = { type: 'module', mi: hit.i, sx: e.clientX, sy: e.clientY, start: { ...modPlace(JOB.modules[hit.i]) }, moved: 0 };
  else roomDrag = { type: 'pan', x: e.clientX, y: e.clientY };
  roomCanvas.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (e) => {
  if (!roomDrag) return;
  if (roomDrag.type === 'rorbit') { roomCam.yaw += (e.clientX - roomDrag.x) * 0.01; roomCam.pitch = Math.max(-1.45, Math.min(1.45, roomCam.pitch + (e.clientY - roomDrag.y) * 0.01)); roomDrag.x = e.clientX; roomDrag.y = e.clientY; renderRoom(); return; }
  if (roomDrag.type === 'rpan3d') { roomPan3d.x += e.clientX - roomDrag.x; roomPan3d.y += e.clientY - roomDrag.y; roomDrag.x = e.clientX; roomDrag.y = e.clientY; renderRoom(); return; }
  if (roomDrag.type === 'pan') { roomView.pan.x += e.clientX - roomDrag.x; roomView.pan.y += e.clientY - roomDrag.y; roomDrag.x = e.clientX; roomDrag.y = e.clientY; renderRoom(); return; }
  const dx = (e.clientX - roomDrag.sx) / lastRoomScale, dUp = -(e.clientY - roomDrag.sy) / lastRoomScale;
  roomDrag.moved += Math.abs(e.clientX - roomDrag.sx) + Math.abs(e.clientY - roomDrag.sy);
  const p = modPlace(JOB.modules[roomDrag.mi]);
  p.offsetX = Math.max(0, roomDrag.start.offsetX + dx);
  let bh = Math.max(0, roomDrag.start.baseHeight + dUp); if (bh < 30) bh = 0;   // snap to the floor
  p.baseHeight = bh; renderRoom();
});
window.addEventListener('mouseup', () => {
  if (!roomDrag) return;
  if (roomDrag.type === 'module' && roomDrag.moved < 5 && roomDrag.mi !== JOB.active) switchTo(roomDrag.mi);
  roomDrag = null; roomCanvas.style.cursor = 'grab';
});
roomCanvas.addEventListener('wheel', (e) => { e.preventDefault(); roomMeasure = null; const f = e.deltaY < 0 ? 1.12 : 1 / 1.12; if (roomMode === '3d') roomZoom3d = Math.max(0.3, Math.min(6, roomZoom3d * f)); else roomView.zoom = Math.max(0.3, Math.min(6, roomView.zoom * f)); renderRoom(); }, { passive: false });
roomCanvas.addEventListener('contextmenu', (e) => e.preventDefault());   // right-drag pans in 3D without the menu
function setRoomMode(m) {
  roomMode = m === '3d' ? '3d' : '2d';
  $('rv-2d').classList.toggle('active', roomMode === '2d');
  $('rv-3d').classList.toggle('active', roomMode === '3d');
  roomMeasure = null; roomCanvas.style.cursor = measureMode ? 'crosshair' : 'grab'; renderRoom();
}
$('rv-2d').addEventListener('click', () => setRoomMode('2d'));
$('rv-3d').addEventListener('click', () => setRoomMode('3d'));
$('rv-measure').addEventListener('click', () => {
  measureMode = !measureMode; roomMeasure = null;
  $('rv-measure').classList.toggle('active', measureMode);
  roomCanvas.style.cursor = measureMode ? 'crosshair' : 'grab'; renderRoom();
});
$('rv-dims').addEventListener('click', () => { roomDimsOn = !roomDimsOn; $('rv-dims').classList.toggle('active', roomDimsOn); renderRoom(); });

// ---------- Master render ----------
// Empty job (all modules deleted): clear everything and prompt to add one.
function renderEmptyJob() {
  document.body.classList.add('no-modules');
  renderModuleBar();
  lastRoomRects = [];
  document.querySelector('#cutlist tbody').innerHTML = '';
  $('cutlist-summary').innerHTML = 'No modules in this job. Click <b>+ New</b> to add one.';
  $('card-selected').classList.add('hidden');
  btnDelete.disabled = true;
  ['view-toggle', 'zoom-ctl', 'explode-wrap', 'dims-wrap', 'sheet-stats'].forEach(id => $(id).classList.add('hidden'));
  const drawMsg = (canvas, ctx) => {
    const { cw, ch } = fitCanvas(canvas, ctx); ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#9aa3b2'; ctx.font = '15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No modules — click “+ New” to add one', cw / 2, ch / 2); ctx.textAlign = 'left';
  };
  if (designCanvas.classList.contains('active')) drawMsg(designCanvas, dctx);
  if (roomCanvas.classList.contains('active')) drawMsg(roomCanvas, rctx);
  if (sheetCanvas.classList.contains('active')) drawMsg(sheetCanvas, sctx);
}
function render() {
  if (!JOB.modules.length) { renderEmptyJob(); return; }
  document.body.classList.remove('no-modules');
  const pack = renderCutList();
  const designActive = designCanvas.classList.contains('active');
  if (designActive) (S.viewMode === '3d' ? renderDesign3D : renderDesign)();
  if (sheetCanvas.classList.contains('active')) renderSheet(pack);
  if (roomCanvas.classList.contains('active')) renderRoom();
  $('view-toggle').classList.toggle('hidden', !designActive);
  $('zoom-ctl').classList.toggle('hidden', !designActive);
  $('btn-measure').classList.toggle('hidden', !designActive);
  if (designActive) { const zp = Math.round((S.viewMode === '3d' ? S.zoom3d : S.zoom) * 100); const zf = $('zoom-fit'); if (zf) zf.textContent = zp === 100 ? 'Fit' : zp + '%'; }
  $('explode-wrap').classList.toggle('hidden', !(designActive && S.viewMode === '3d'));
  $('dims-wrap').classList.toggle('hidden', !(designActive && S.viewMode === '3d'));
  btnDelete.disabled = !(typeof S.selectedId === 'number' || ['T', 'B', 'L', 'R', 'BK'].includes(S.selectedId));
  renderSelectionPanel(); syncBackUI();
  const sheetActive = sheetCanvas.classList.contains('active');
  $('sheet-stats').classList.toggle('hidden', !sheetActive);
  if (sheetActive) $('sheet-stats').innerHTML =
    `${isJobScope() ? `<b>Job</b> (${JOB.modules.length} modules) · ` : ''}` +
    `<b>${pack.sheets.length}</b> sheet(s) of ${fmt(S.sheet.w)}×${fmt(S.sheet.h)} ${S.unit} · kerf ${fmtU(S.sheet.kerf)} · ` +
    `utilisation <b>${(Math.min(1, pack.utilisation) * 100).toFixed(1)}%</b> · grain <b>${S.grainLock ? 'locked' : 'free'}</b>`;
}

// ---------- Banding grid UI ----------
function buildBandGrid() {
  // Each checkbox is labelled with that part's own edge name (Front/Back/…), so there's no shared L1/L2 header.
  let html = '';
  for (const [key, label] of PART_TYPES)
    html += `<span class="rl">${label}</span>` + EDGES.map(e => `<label class="bc" title="${edgeLabel(key, e)} edge (${e})"><input type="checkbox" data-key="${key}" data-edge="${e}"><span>${edgeLabel(key, e)}</span></label>`).join('');
  const grid = $('band-grid'); grid.innerHTML = html;
  grid.addEventListener('change', (e) => {
    const el = e.target; if (!el.dataset.key) return;
    (S.band[el.dataset.key] = S.band[el.dataset.key] || {})[el.dataset.edge] = el.checked; render();
  });
}
function syncBandGrid() {
  document.querySelectorAll('#band-grid input').forEach(el => { el.checked = edgeOn(el.dataset.key, el.dataset.edge); });
}

// ---------- Input sync ----------
function syncInputs() {
  inW.value = fmt(S.cab.w); inH.value = fmt(S.cab.h); inD.value = fmt(S.cab.d); inT.value = fmt(S.cab.t);
  inBack.checked = S.cab.back;
  inSW.value = fmt(S.sheet.w); inSH.value = fmt(S.sheet.h); inKerf.value = fmt(S.sheet.kerf);
  inGrain.checked = S.grainLock; inPreset.value = S.preset;
  if (inWoodTheme) inWoodTheme.value = S.woodTheme || 'birch';
  if (inTapeTh) inTapeTh.value = String(tapeTh()); if (inTapeWd) inTapeWd.value = String(tapeWd());
  inReveal.value = fmt(S.doors.reveal); inExplode.value = S.explode; inDims.checked = S.showDims;
  inBackType.value = S.backPanel.type; inBackThk.value = fmt(S.backPanel.thickness);
  inBackGroove.value = fmt(S.backPanel.groove); inBackSetback.value = fmt(S.backPanel.setback);
  const top = capOf('top'), bot = capOf('bottom');
  inTopMount.value = top.mount || 'inset'; inTopAnchor.value = top.anchor || 'back'; inTopDepth.value = fmt(capDepth('top'));
  inBotMount.value = bot.mount || 'inset'; inBotAnchor.value = bot.anchor || 'back'; inBotDepth.value = fmt(capDepth('bottom'));
  const topOn = capOn('top'), botOn = capOn('bottom');
  inTopOn.checked = topOn; inBotOn.checked = botOn; inSideL.checked = sideLOn(); inSideR.checked = sideROn();
  [inTopMount, inTopDepth, inTopAnchor].forEach(el => el.disabled = !topOn);   // grey out a removed cap's props
  [inBotMount, inBotDepth, inBotAnchor].forEach(el => el.disabled = !botOn);
  const step = unitStep(); [inW, inH, inD, inT, inSW, inSH, inBackThk, inBackGroove, inBackSetback, inTopDepth, inBotDepth].forEach(el => el.step = step);
  inKerf.step = S.unit === 'mm' ? 0.1 : 0.01; inReveal.step = S.unit === 'mm' ? 0.5 : 0.01;
  $('unit-mm').classList.toggle('active', S.unit === 'mm'); $('unit-in').classList.toggle('active', S.unit === 'in');
  $('v2d').classList.toggle('active', S.viewMode !== '3d'); $('v3d').classList.toggle('active', S.viewMode === '3d');
  document.querySelectorAll('.unit-label').forEach(el => el.textContent = `(${S.unit})`);
  syncBandGrid(); syncBackUI(); syncDrawerSetupInputs();
}
function syncBackUI() {
  const overlay = S.backPanel.type === 'overlay';
  $('card-back').classList.toggle('hidden', !S.cab.back);
  $('lbl-back-groove').classList.toggle('hidden', overlay);
  $('lbl-back-setback').classList.toggle('hidden', overlay);
}
// ---------- Drawer Setup step (module-level default drawer) ----------
// Dependent-UI only (grey out removed caps' props, hide groove/setback for overlay) — no value rewrites, so it is safe
// to call on every keystroke without disturbing the field being typed.
function syncDrawerSetupUI() {
  if (!inDwH) return;
  [inDwBotMount, inDwBotDepth, inDwBotAnchor].forEach(el => el.disabled = !inDwBotOn.checked);
  const overlay = inDwBackType.value === 'overlay';
  $('lbl-dw-back-groove').classList.toggle('hidden', overlay);
  $('lbl-dw-back-setback').classList.toggle('hidden', overlay);
}
// Full rewrite of every field from the model — for tab load, module switch, unit change (not during live typing).
function syncDrawerSetupInputs() {
  if (!inDwH) return;
  const ds = moduleDrawerSetup(), sz = ds.size || {}, bp = ds.backPanel || {};
  const bot = (ds.caps && ds.caps.bottom) || {};
  const opt = (v) => v != null && v > 0 ? fmt(v) : '';   // nullable size fields show blank ("follow default")
  inDwH.value = sz.height != null && sz.height > 0 ? fmt(sz.height) : '';
  inDwW.value = opt(sz.width); inDwD.value = opt(sz.depth); inDwT.value = opt(sz.thickness);
  inDwBackType.value = bp.type || 'groove';
  inDwBackThk.value = fmt(bp.thickness != null ? bp.thickness : 6);
  inDwBackGroove.value = fmt(bp.groove != null ? bp.groove : 0);
  inDwBackSetback.value = fmt(bp.setback != null ? bp.setback : 0);
  inDwBotOn.checked = bot.on !== false;
  inDwBotMount.value = bot.mount === 'outset' ? 'outset' : 'inset';
  inDwBotDepth.value = opt(bot.depth);
  inDwBotAnchor.value = ['back', 'center', 'front'].includes(bot.anchor) ? bot.anchor : 'back';
  const step = unitStep();
  [inDwH, inDwW, inDwD, inDwT, inDwBackThk, inDwBackGroove, inDwBackSetback, inDwBotDepth].forEach(el => el.step = step);
  syncDrawerSetupUI();
}
// Copy the module Drawer Setup onto every existing drawer, mirror its size fields, then re-fit — so a setup edit
// recalculates and reflects on every drawer at once (same size-mirroring rules as insertion and the prop panel).
function applyModuleDrawerSetupToAll() {
  const ds = moduleDrawerSetup();
  for (const c of S.comps) {
    if (c.type !== 'drawer') continue;
    c.drawerSetup = cloneDrawerSetup(ds);
    const sz = c.drawerSetup.size || {};
    if (sz.height != null && sz.height > 0) c.h = sz.height;
    if (sz.width != null && sz.width > 0) c.w = sz.width; else delete c.w;
    if (sz.depth != null && sz.depth > 0) c.depth = sz.depth; else delete c.depth;
    if (sz.thickness != null && sz.thickness > 0) c.thick = sz.thickness; else delete c.thick;
  }
  resyncComponents();   // clamps to live cells + re-syncs each drawer's flanks
  render();
}
function readDrawerSetup() {
  const ds = moduleDrawerSetup();
  const posMM = (el) => { const v = toMM(parseFloat(el.value)); return isFinite(v) && v > 0.5 ? v : null; };
  ds.size.height = (() => { const v = posMM(inDwH); return v != null ? Math.max(1, v) : 150; })();
  ds.size.width = (() => { const v = posMM(inDwW); return v != null ? Math.max(1, v) : null; })();
  ds.size.depth = (() => { const v = posMM(inDwD); return v != null ? Math.max(1, v) : null; })();
  ds.size.thickness = (() => { const v = posMM(inDwT); return v != null ? Math.max(1, v) : null; })();
  ds.backPanel.type = ['groove', 'rabbet', 'overlay'].includes(inDwBackType.value) ? inDwBackType.value : 'groove';
  ds.backPanel.thickness = (() => { const v = toMM(parseFloat(inDwBackThk.value) || 0); return v > 0.5 ? Math.max(1, v) : 6; })();
  ds.backPanel.groove = Math.max(0, toMM(parseFloat(inDwBackGroove.value) || 0));
  ds.backPanel.setback = Math.max(0, toMM(parseFloat(inDwBackSetback.value) || 0));
  const rdCap = (cap, onEl, mountEl, depthEl, anchorEl) => {
    cap.on = !!onEl.checked;
    cap.mount = mountEl.value === 'outset' ? 'outset' : 'inset';
    cap.anchor = ['back', 'center', 'front'].includes(anchorEl.value) ? anchorEl.value : 'back';
    const dep = toMM(parseFloat(depthEl.value) || 0);
    cap.depth = dep > 0.5 ? Math.max(1, dep) : null;
  };
  rdCap(ds.caps.bottom, inDwBotOn, inDwBotMount, inDwBotDepth, inDwBotAnchor);
  syncDrawerSetupUI();                // reflect grey-outs / overlay hiding without disturbing the typed field
  applyModuleDrawerSetupToAll();      // recalc + reflect on every drawer
}
// Re-fit EVERY existing component to the current carcass after any setup/layout change, so all calculations stay
// correct: clamp shelf/vertical spans and depth/setback, clamp drawer/door size overrides to their live cells, and
// re-sync each drawer's linked flanks (span + depth). Call from every setup handler before rendering.
function resyncComponents() {
  // Pass 1 — dividers first, so drawer/door cells (which read these) are already up to date in pass 2.
  for (const c of S.comps) {
    if (c.type === 'shelf' || c.type === 'vertical') {
      const lo = c.type === 'shelf' ? innerL() : innerB(), hi = c.type === 'shelf' ? innerR() : innerT();
      c.a0 = Math.max(lo, Math.min(c.a0, hi)); c.a1 = Math.max(c.a0, Math.min(c.a1, hi));
    }
    if (c.depth != null) c.depth = Math.min(c.depth, S.cab.d);
    if (c.setback != null) c.setback = Math.min(c.setback, S.cab.d);
    clampComp(c);
  }
  // Pass 2 — re-fit banks: clamp stored Width/Height overrides to the live cell, re-sync flanks to the drawer.
  for (const c of S.comps) {
    if (c.type === 'drawer') {
      const cell = cellAt(c.ax, c.ay, null), cw = cell.right - cell.left, ch = cell.top - cell.bottom;
      if (c.w != null) c.w = Math.max(1, Math.min(c.w, cw));
      if (c.h != null) c.h = Math.max(1, Math.min(c.h, ch));
      syncDrawerFlanks(c);
    } else if (c.type === 'door') {
      const ch = doorBase(c).top - doorBase(c).bottom;
      if (c.h != null) c.h = Math.max(1, Math.min(c.h, ch));
    }
  }
}
function readInputs() {
  const oldD = S.cab.d;
  S.cab.w = Math.max(1, toMM(parseFloat(inW.value) || 0)); S.cab.h = Math.max(1, toMM(parseFloat(inH.value) || 0));
  S.cab.d = Math.max(1, toMM(parseFloat(inD.value) || 0)); S.cab.t = Math.max(1, toMM(parseFloat(inT.value) || 0));
  S.cab.back = inBack.checked;
  S.sheet.w = Math.max(1, toMM(parseFloat(inSW.value) || 0)); S.sheet.h = Math.max(1, toMM(parseFloat(inSH.value) || 0));
  S.sheet.kerf = Math.max(0, toMM(parseFloat(inKerf.value) || 0));
  // Top/Bottom panel depths follow the cabinet depth: a cap that matched the old depth (including the tracking
  // null) stays matched to the new one, and its depth field is refreshed so the mm value updates automatically.
  if (Math.abs(S.cab.d - oldD) > 0.5) {
    for (const which of ['top', 'bottom']) { const c = S.cab[which]; if (c && c.depth != null && Math.abs(c.depth - oldD) < 0.5) c.depth = null; }
    inTopDepth.value = fmt(capDepth('top')); inBotDepth.value = fmt(capDepth('bottom'));
  }
  resyncComponents();
  render();
}

// ---------- Component actions ----------
function addComp(type) {
  if (!JOB.modules.length) return;
  const { w, h, t } = S.cab;
  const p = S.lastPoint || { x: w / 2, y: h / 2 };
  if (type === 'drawer') {
    const cell = cellAt(p.x, p.y, null);
    const setup = cloneDrawerSetup(moduleDrawerSetup());   // seed the new drawer from the module "Drawer Setup" step
    const seedH = setup.size.height != null && setup.size.height > 0 ? setup.size.height : 150;
    const seedExtra = {};
    if (setup.size.width != null && setup.size.width > 0) seedExtra.w = setup.size.width;
    if (setup.size.depth != null && setup.size.depth > 0) seedExtra.depth = setup.size.depth;
    if (setup.size.thickness != null && setup.size.thickness > 0) seedExtra.thick = setup.size.thickness;
    const c = { id: S._seq++, type: 'drawer', ax: (cell.left + cell.right) / 2, ay: (cell.bottom + cell.top) / 2, count: drawerCount(), valign: 'top', h: seedH, boxFront: drawerBoxFront(), drawerSetup: setup, ...seedExtra };   // defaults: 1 drawer, anchored to top; side panels + box front follow the (default-off) header checkboxes; sizes from the module drawer setup
    const created = [];
    // Optional: frame the drawer with a vertical flank (side panel) on the left and right, sized to the drawer
    // height and linked to it so they track the drawer as it resizes. Toggle via the "Side panels" checkbox.
    if (drawerSidePanels()) {
      // Flank thickness follows the cabinet material (same as every other panel), only clamped so it never
      // exceeds half the opening. A `thick` override is stored ONLY when that clamp bites (very narrow opening);
      // otherwise it is left unset so the flank tracks the cabinet default if the material thickness changes.
      const ft = Math.min(t, Math.max(1, (cell.right - cell.left) / 2 - 1));
      const flankThick = ft < t ? { thick: ft } : {};
      const left = { id: S._seq++, type: 'vertical', pos: cell.left + ft / 2, a0: cell.bottom, a1: cell.top, ...flankThick };
      const right = { id: S._seq++, type: 'vertical', pos: cell.right - ft / 2, a0: cell.bottom, a1: cell.top, ...flankThick };
      clampComp(left); clampComp(right);
      c.flanks = [left.id, right.id];
      created.push(left, right);
    }
    clampComp(c);
    S.comps.push(...created, c);
    syncDrawerFlanks(c);                       // shrink the flanks to the drawer's height
    S.selectedId = c.id; render(); return;
  }
  if (type === 'door') {
    // Fits the single clicked cell. To span several bays across shelves, use "Pick cells for door".
    const c = { id: S._seq++, type: 'door', ax: p.x, ay: p.y, count: doorLeaves(), ...newDoorGaps() };
    clampComp(c); S.comps.push(c); S.selectedId = c.id; render(); return;
  }
  const cell = cellAt(p.x, p.y, null);
  const c = { id: S._seq++, type };
  if (type === 'shelf') { c.a0 = cell.left; c.a1 = cell.right; c.pos = (cell.bottom + cell.top) / 2; }
  else { c.a0 = cell.bottom; c.a1 = cell.top; c.pos = (cell.left + cell.right) / 2; }
  clampComp(c); S.comps.push(c); S.selectedId = c.id; render();
}
const drawerCount = () => { const v = parseInt(($('in-drawer-count') || {}).value, 10) || 1; return Math.max(1, Math.min(12, v)); };
// Side-panels checkbox: when on (default), a new drawer is framed with two flank verticals sized to its height.
const drawerSidePanels = () => { const el = $('in-drawer-sides'); return el ? !!el.checked : true; };
// Box-front checkbox: when on (default), the drawer box gets a structural front wall (a 'Drawer front' part, same
// size as the back, listed in the cut list and drawn in 3D). Off = the fascia is the front, no separate box front.
const drawerBoxFront = () => { const el = $('in-drawer-front'); return el ? !!el.checked : true; };
const doorLeaves = () => (parseInt(($('in-door-leaves') || {}).value, 10) === 2 ? 2 : 1);
function deleteSelected() {
  const id = S.selectedId;
  if (id == null) return;
  if (typeof id === 'number') {                                             // a component
    const comp = S.comps.find(c => c.id === id);
    const remove = new Set([id]);
    // Deleting a drawer removes its linked side panels (flanks) too. Deleting a flank on its own is allowed —
    // the drawer then widens to the next boundary automatically (drawerRect reads the live cell).
    if (comp && comp.type === 'drawer' && Array.isArray(comp.flanks)) comp.flanks.forEach(fid => remove.add(fid));
    S.comps = S.comps.filter(c => !remove.has(c.id));
  }
  else if (id === 'T') { if (S.cab.top) S.cab.top.on = false; }             // carcass panels: flag off (restore via setup toggles)
  else if (id === 'B') { if (S.cab.bottom) S.cab.bottom.on = false; }
  else if (id === 'L') S.cab.sideL = false;
  else if (id === 'R') S.cab.sideR = false;
  else if (id === 'BK') S.cab.back = false;
  else return;   // unknown/undeletable
  S.selectedId = null; syncInputs(); render();
}

// ---------- Selected-component editor ----------
// Fixed carcass/door parts (selected by clicking a face in 3D) have a string id; report their size read-only.
function carcassPartInfo(id) {
  const { d, t } = S.cab;
  // Spatial w/h/d (left-right / top-bottom / front-back) + board thickness for each fixed part.
  if (id === 'L' || id === 'R') return { name: 'Side', w: t, h: sideHeight(), d, thick: t };
  if (id === 'T') return { name: 'Top', w: capWidth('top'), h: t, d: capDepth('top'), thick: t };
  if (id === 'B') return { name: 'Bottom', w: capWidth('bottom'), h: t, d: capDepth('bottom'), thick: t };
  if (id === 'BK') { if (!S.cab.back) return null; const g = backGeom(); return { name: 'Back', w: g.L, h: g.W, d: S.backPanel.thickness, thick: S.backPanel.thickness }; }
  if (id === 'DOOR' || id === 'DOORL' || id === 'DOORR') { const r = doorRects().find(r => r.id === id); return r ? { name: 'Door', w: r.x1 - r.x0, h: r.y1 - r.y0, d: t, thick: t } : null; }
  return null;
}
let lastAnchor = 'center';    // resize anchor for the span field (shelf Width / vertical Height)
let lastVAnchor = 'center';   // position anchor for the pos field (shelf Height / vertical Position): which face the value refers to
let doorGapSide = 'l';        // which side the door editor's single Gap field currently edits (l/r/t/b)
function renderSelectionPanel() {
  const card = $('card-selected'), fields = $('sel-fields'), derived = $('sel-derived'), actions = $('sel-actions'), title = $('sel-title');
  const id = S.selectedId;
  if (id == null) { card.classList.add('hidden'); fields.innerHTML = ''; fields.dataset.editId = ''; return; }
  // While the user is actively typing/selecting in this component's fields, don't rebuild them (keeps caret/focus for live edits).
  if (fields.dataset.editId === String(id) && document.activeElement && fields.contains(document.activeElement)) { card.classList.remove('hidden'); return; }
  const u = S.unit, step = unitStep();
  $('sel-delete').classList.remove('hidden'); $('sel-update').classList.remove('hidden');   // default both visible; branches adjust
  const comp = typeof id === 'number' ? S.comps.find(c => c.id === id) : null;
  const row = (rid, label, val) => `<label class="sel-row"><span>${label}</span><input id="${rid}" type="number" step="${step}" value="${val}"></label>`;
  const sel = (v) => lastAnchor === v ? ' selected' : '';
  if (comp && comp.type === 'door') {
    const base = doorBase(comp), Wc = base.right - base.left, Hc = base.top - base.bottom, two = (comp.count | 0) === 2;
    const cov = comp.covers || 'cell', mnt = doorMount(comp);
    const optC = (v, lbl) => `<option value="${v}"${cov === v ? ' selected' : ''}>${lbl}</option>`;
    const optM = (v, lbl) => `<option value="${v}"${mnt === v ? ' selected' : ''}>${lbl}</option>`;
    const dva = comp.valign || 'bottom';
    const optV = (v, lbl) => `<option value="${v}"${dva === v ? ' selected' : ''}>${lbl}</option>`;
    const gapKeyOf = (s) => 'gap' + s.toUpperCase();
    const optG = (v, lbl) => `<option value="${v}"${doorGapSide === v ? ' selected' : ''}>${lbl}</option>`;
    title.innerHTML = `Door front <small>(${u})</small>`;
    // A span door (built from picked cells) controls its own region, so the Covers mode doesn't apply.
    const coverRow = comp.span
      ? `<div class="sel-ro">Region <b>picked cells</b> · <button type="button" id="sel-door-uncombine" class="linkish">use single cell</button></div>`
      : `<label class="sel-row"><span>Covers</span><select id="sel-covers">${optC('cell', 'This cell')}${optC('column', 'Full column (ignore shelves)')}${optC('row', 'Full row (ignore verticals)')}${optC('all', 'Whole interior')}</select></label>`;
    const span = doorSpan(comp), spanH = span.top - span.bottom, off = span.bottom - base.bottom;
    fields.innerHTML =
      `<label class="sel-row"><span>Leaves</span><select id="sel-leaves"><option value="1"${two ? '' : ' selected'}>1 door</option><option value="2"${two ? ' selected' : ''}>2 doors</option></select></label>` +
      `<label class="sel-row"><span>Front</span><select id="sel-mount">${optM('outset', 'Outset (overlay)')}${optM('inset', 'Inset')}</select></label>` +
      row('sel-h', 'Height', fmt(spanH)) +
      `<label class="sel-row"><span>Anchor</span><select id="sel-door-valign">${optV('top', 'Top')}${optV('middle', 'Middle')}${optV('bottom', 'Bottom')}</select></label>` +
      row('sel-yoff', 'From bottom', fmt(off)) +
      `<label class="sel-row"><span>Gap side</span><select id="sel-gap-side">${optG('l', 'Left')}${optG('r', 'Right')}${optG('t', 'Top')}${optG('b', 'Bottom')}</select></label>` +
      row('sel-gap-val', 'Gap (mm)', fmt(comp[gapKeyOf(doorGapSide)] || 0)) +
      coverRow;
    const dr = doorRectsFor(comp)[0];
    derived.textContent = `Opening ${fmtU(Wc)} × ${fmtU(Hc)}. Door occupies ${fmtU(off)}–${fmtU(off + spanH)} up the column (front ${fmtU(dr.x1 - dr.x0)} × ${fmtU(dr.y1 - dr.y0)} W×H). Set Height + From bottom to place a drawer below and this door above — no shelf needed.` + bandInfo('Door');
    actions.classList.remove('hidden');
  } else if (comp && comp.type === 'drawer') {
    const cell = cellAt(comp.ax, comp.ay, null), rect = drawerRect(comp);
    const cw = cell.right - cell.left, ch = cell.top - cell.bottom;
    const W = rect.right - rect.left, H = rect.top - rect.bottom, n = Math.max(1, comp.count | 0), va = comp.valign || 'bottom', mnt = comp.mount || 'outset';
    const opt = (v, lbl) => `<option value="${v}"${va === v ? ' selected' : ''}>${lbl}</option>`;
    const optM = (v, lbl) => `<option value="${v}"${mnt === v ? ' selected' : ''}>${lbl}</option>`;
    const ds = drawerSetup(comp);
    const bp = ds.backPanel || defaultDrawerSetup().backPanel;
    const botCap = ds.caps && ds.caps.bottom ? ds.caps.bottom : defaultDrawerSetup().caps.bottom;
    title.innerHTML = `Drawer bank <small>(${u})</small>`;
    const off = rect.bottom - cell.bottom, gp = drawerGaps(comp);
    fields.innerHTML =
      `<label class="sel-row"><span>Drawers</span><input id="sel-count" type="number" min="1" max="12" step="1" value="${comp.count}"></label>` +
      row('sel-w', 'Width', fmt(W)) +
      row('sel-h', 'Height', fmt(H)) +
      row('sel-yoff', 'From bottom', fmt(off)) +
      `<label class="sel-row"><span>Anchor</span><select id="sel-valign">${opt('top', 'Top')}${opt('bottom', 'Bottom')}</select></label>` +
      row('sel-depth', 'Box depth', fmt(compDepth(comp))) +
      `<label class="sel-row"><span>Front</span><select id="sel-mount">${optM('outset', 'Outset')}${optM('inset', 'Inset')}</select></label>` +
      `<label class="sel-row"><span>Side panels</span><input id="sel-sides" type="checkbox"${(comp.flanks && comp.flanks.length) ? ' checked' : ''}></label>` +
      `<div class="sel-sub">Drawer setup</div>` +
      row('sel-drawer-height', 'Height', fmt(drawerSizeHeight(comp))) +
      row('sel-drawer-width', 'Width', fmt(drawerSizeWidth(comp) != null ? drawerSizeWidth(comp) : W)) +
      row('sel-drawer-depth', 'Depth', fmt(drawerSizeDepth(comp) != null ? drawerSizeDepth(comp) : compDepth(comp))) +
      row('sel-drawer-thick', 'Material thickness', fmt(drawerMaterialThick(comp))) +
      `<label class="sel-row"><span>Back fixing</span><select id="sel-drawer-back-type"><option value="groove"${bp.type === 'groove' ? ' selected' : ''}>Groove / dado</option><option value="rabbet"${bp.type === 'rabbet' ? ' selected' : ''}>Rabbet / rebate</option><option value="overlay"${bp.type === 'overlay' ? ' selected' : ''}>Overlay</option></select></label>` +
      row('sel-drawer-back-thk', 'Back thickness', fmt(drawerBackThickness(comp))) +
      row('sel-drawer-back-groove', 'Groove / rebate depth', fmt(drawerBackGroove(comp))) +
      row('sel-drawer-back-setback', 'Setback from rear', fmt(drawerBackSetback(comp))) +
      `<label class="sel-row"><span>Include bottom panel</span><input id="sel-drawer-bottom-on" type="checkbox"${botCap.on === false ? '' : ' checked'}></label>` +
      `<label class="sel-row"><span>Bottom mount</span><select id="sel-drawer-bottom-mount"><option value="inset"${botCap.mount === 'inset' ? ' selected' : ''}>Inset</option><option value="outset"${botCap.mount === 'outset' ? ' selected' : ''}>Outset</option></select></label>` +
      row('sel-drawer-bottom-depth', 'Bottom depth', fmt(drawerCapDepth(comp, 'bottom'))) +
      `<label class="sel-row"><span>Bottom anchor</span><select id="sel-drawer-bottom-anchor"><option value="back"${botCap.anchor === 'back' ? ' selected' : ''}>Back</option><option value="center"${botCap.anchor === 'center' ? ' selected' : ''}>Center</option><option value="front"${botCap.anchor === 'front' ? ' selected' : ''}>Front</option></select></label>` +
      `<div class="sel-sub">Front gap (mm)</div>` +
      row('sel-gap-l', 'Left', fmt(gp.l)) +
      row('sel-gap-r', 'Right', fmt(gp.r)) +
      row('sel-gap-t', 'Top', fmt(gp.t)) +
      row('sel-gap-b', 'Bottom', fmt(gp.b));
    const ff = drawerFascias(comp)[0];
    derived.textContent = `Cell ${fmtU(cw)} × ${fmtU(ch)}. Bank occupies ${fmtU(off)}–${fmtU(off + H)} up the column · ${n} ${mnt} fascia ${fmtU(ff.x1 - ff.x0)} × ${fmtU(ff.y1 - ff.y0)} each. Drawer setup changes recalculate the box and cut list instantly.`;
    actions.classList.remove('hidden');
  } else if (comp) {
    const isShelf = comp.type === 'shelf';
    const selV = (v) => lastVAnchor === v ? ' selected' : '';
    // The position value refers to the anchored face: end = top/right (pos + ht), start = bottom/left (pos - ht), center = middle.
    const htp = partThick(comp) / 2, voff = lastVAnchor === 'end' ? htp : lastVAnchor === 'start' ? -htp : 0;
    title.innerHTML = `${isShelf ? 'Shelf' : 'Vertical'} <small>(${u})</small>`;
    fields.innerHTML =
      row('sel-pos', isShelf ? 'Height' : 'Position', fmt(comp.pos + voff)) +
      `<label class="sel-row"><span>${isShelf ? 'Height anchor' : 'Position anchor'}</span><select id="sel-vanchor">` +
        `<option value="start"${selV('start')}>${isShelf ? 'Bottom' : 'Left'}</option>` +
        `<option value="center"${selV('center')}>Middle</option>` +
        `<option value="end"${selV('end')}>${isShelf ? 'Top' : 'Right'}</option></select></label>` +
      row('sel-len', isShelf ? 'Width' : 'Height', fmt(comp.a1 - comp.a0)) +
      `<label class="sel-row"><span>${isShelf ? 'Width anchor' : 'Height anchor'}</span><select id="sel-anchor">` +
        `<option value="start"${sel('start')}>${isShelf ? 'Left' : 'Bottom'}</option>` +
        `<option value="center"${sel('center')}>${isShelf ? 'Center' : 'Middle'}</option>` +
        `<option value="end"${sel('end')}>${isShelf ? 'Right' : 'Top'}</option></select></label>` +
      row('sel-thick', 'Thickness', fmt(partThick(comp))) +
      row('sel-depth', 'Depth', fmt(compDepth(comp))) +
      row('sel-setback', 'Setback from back', fmt(comp.setback || 0));
    const segs = isShelf ? shelfSegments(comp) : verticalSegments(comp), usable = usableDepth();
    derived.textContent =
      (segs.length > 1 ? `Cut into ${segs.length} pieces · ` : '') +
      (comp.depth != null ? 'Custom depth' : `Depth = usable ${fmtU(usable)}`) +
      ` · Setback = gap from the back panel front face.` +
      bandInfo(isShelf ? 'Shelf' : 'Vertical');
    actions.classList.remove('hidden');
  } else if (id === 'T' || id === 'B') {
    // Editable top/bottom cap — same props as the setup card, reachable by selecting the panel in 2D/3D/cut list.
    const which = id === 'T' ? 'top' : 'bottom', cap = capOf(which);
    const mnt = capOutset(which) ? 'outset' : 'inset', anc = cap.anchor || 'back';
    const optM = (v, lbl) => `<option value="${v}"${mnt === v ? ' selected' : ''}>${lbl}</option>`;
    const optA = (v, lbl) => `<option value="${v}"${anc === v ? ' selected' : ''}>${lbl}</option>`;
    title.innerHTML = `${which === 'top' ? 'Top' : 'Bottom'} panel <small>(${u})</small>`;
    fields.innerHTML =
      `<label class="sel-row"><span>Mount</span><select id="sel-cap-mount">${optM('inset', 'Inset (between sides)')}${optM('outset', 'Outset (over sides)')}</select></label>` +
      row('sel-cap-depth', 'Depth', fmt(capDepth(which))) +
      `<label class="sel-row"><span>Anchor</span><select id="sel-cap-anchor">${optA('back', 'Back')}${optA('center', 'Center')}${optA('front', 'Front')}</select></label>`;
    derived.textContent = `Panel ${fmtU(capWidth(which))} × ${fmtU(capDepth(which))} · ${mnt}. Sides now ${fmtU(sideHeight())}. Depth = full ⇒ aligned to sides. Delete removes it (restore in Setup).`;
    actions.classList.remove('hidden');   // both Update and Delete available
  } else {
    const info = carcassPartInfo(id);
    if (!info) { card.classList.add('hidden'); fields.innerHTML = ''; return; }
    const deletable = (id === 'L' || id === 'R' || id === 'BK');   // sides + back can be removed; restore via Setup toggles
    title.innerHTML = `${info.name} <small>(${u})</small>`;
    fields.innerHTML =
      `<div class="sel-ro">Width <b>${fmtU(info.w)}</b></div>` +
      `<div class="sel-ro">Height <b>${fmtU(info.h)}</b></div>` +
      `<div class="sel-ro">Depth <b>${fmtU(info.d)}</b></div>` +
      `<div class="sel-ro">Thickness <b>${fmtU(info.thick)}</b></div>`;
    derived.textContent = deletable
      ? 'Read-only size (set via cabinet Sizes). Delete removes this panel — restore it from Setup.'
      : 'Fixed part — change its size via the cabinet Sizes above.';
    if (deletable) { actions.classList.remove('hidden'); $('sel-update').classList.add('hidden'); }   // Delete only
    else actions.classList.add('hidden');
  }
  fields.dataset.editId = String(id);
  card.classList.remove('hidden');
}
function applySelectedEdit() {
  if (S.selectedId === 'T' || S.selectedId === 'B') {
    const which = S.selectedId === 'T' ? 'top' : 'bottom';
    const cap = S.cab[which] || (S.cab[which] = { mount: 'inset', depth: null, anchor: 'back' });
    cap.mount = (($('sel-cap-mount') || {}).value) === 'outset' ? 'outset' : 'inset';
    const av = ($('sel-cap-anchor') || {}).value; cap.anchor = ['back', 'center', 'front'].includes(av) ? av : 'back';
    const dep = toMM(parseFloat(($('sel-cap-depth') || {}).value) || 0);
    cap.depth = (dep > 0.5 && Math.abs(dep - S.cab.d) > 0.5) ? Math.max(1, dep) : null;   // equal to cabinet depth ⇒ aligned; otherwise stored, may exceed it
    syncInputs(); render(); return;   // syncInputs keeps the setup-card fields in step
  }
  const c = typeof S.selectedId === 'number' ? S.comps.find(x => x.id === S.selectedId) : null;
  if (!c) return;
  const get = (rid) => { const el = $(rid); return el ? toMM(parseFloat(el.value) || 0) : 0; };
  if (c.type === 'door') {
    c.count = parseInt(($('sel-leaves') || {}).value, 10) === 2 ? 2 : 1;
    const cov = (($('sel-covers') || {}).value) || 'cell'; if (cov === 'cell') delete c.covers; else c.covers = cov;
    if ((($('sel-mount') || {}).value) === 'inset') c.mount = 'inset'; else delete c.mount;   // outset is the default
    // Vertical placement: Anchor (top/middle/bottom) + Height (store only when shorter than the opening) + From-bottom.
    const prevVA = c.valign || 'bottom';
    c.valign = (($('sel-door-valign') || {}).value) || 'bottom';
    const ch = doorBase(c).top - doorBase(c).bottom;
    const H = get('sel-h'); if (H > 0 && Math.abs(H - ch) > 0.5) c.h = Math.max(1, Math.min(H, ch)); else delete c.h;
    const bandH = c.h != null ? c.h : ch, maxOff = ch - bandH;
    const anchoredOff = c.valign === 'top' ? maxOff : c.valign === 'middle' ? maxOff / 2 : 0;
    if (c.valign !== prevVA) {                       // switching Anchor re-seats the door against the chosen edge
      delete c.yoff; const yo = $('sel-yoff'); if (yo) yo.value = fmt(anchoredOff);
    } else {                                         // otherwise keep an explicit From-bottom only when it differs from the anchored position
      const off = get('sel-yoff');
      if (off > 0.5 && Math.abs(off - anchoredOff) > 0.5) c.yoff = Math.max(0, Math.min(off, maxOff)); else delete c.yoff;
    }
    // Per-side gap: the single Gap field applies to whichever side the dropdown shows (doorGapSide). 0 clears it.
    const gv = get('sel-gap-val'), gk = 'gap' + doorGapSide.toUpperCase();
    if (gv > 0.5) c[gk] = Math.max(0, gv); else delete c[gk];
    render(); return;
  }
  if (c.type === 'drawer') {
    // Side-panels toggle handled first: adding/removing the flanks changes the whole opening, so on a state change
    // we drop any fixed width (let the drawer fill the new space), re-render and return — other fields apply next edit.
    const wantSides = !!(($('sel-sides') || {}).checked), hasSides = !!(c.flanks && c.flanks.length);
    if (wantSides !== hasSides) {
      if (wantSides) addDrawerFlanks(c); else removeDrawerFlanks(c);
      delete c.w; clampComp(c); syncDrawerFlanks(c); render(); return;
    }
    const cnt = parseInt(($('sel-count') || {}).value, 10) || 1; c.count = Math.max(1, Math.min(12, cnt));
    const prevVA = c.valign || 'bottom';
    c.valign = (($('sel-valign') || {}).value) || 'bottom';
    const cell = cellAt(c.ax, c.ay, null), cw = cell.right - cell.left, ch = cell.top - cell.bottom;
    const W = get('sel-w'), H = get('sel-h');   // store only when smaller than the cell, so a full-cell bank keeps tracking the cell
    if (W > 0 && Math.abs(W - cw) > 0.5) c.w = Math.max(1, Math.min(W, cw)); else delete c.w;
    if (H > 0 && Math.abs(H - ch) > 0.5) c.h = Math.max(1, Math.min(H, ch)); else delete c.h;
    const ds = drawerSetup(c);
    const h = get('sel-drawer-height');
    if (h > 0.5) { c.h = Math.max(1, Math.min(h, ch)); ds.size.height = Math.max(1, h); }
    else { ds.size.height = null; }
    const w = get('sel-drawer-width');
    if (w > 0.5) { c.w = Math.max(1, Math.min(w, cw)); ds.size.width = Math.max(1, w); }
    else { ds.size.width = null; }
    const dep = get('sel-drawer-depth');
    if (dep > 0.5) { c.depth = Math.max(1, Math.min(dep, usableDepth())); ds.size.depth = Math.max(1, dep); }
    else { ds.size.depth = null; }
    const thick = get('sel-drawer-thick');
    if (thick > 0.5) { c.thick = Math.max(1, thick); ds.size.thickness = Math.max(1, thick); }
    else { delete c.thick; ds.size.thickness = null; }
    // From-bottom offset overrides valign. Switching the Anchor re-seats the bank against the chosen edge (drop the
    // stale offset); otherwise only keep the offset when it actually differs from the anchored position, so an
    // untouched bank keeps following its Top/Bottom anchor instead of freezing where it happens to sit.
    const bandH = c.h != null ? c.h : ch, maxOff = ch - bandH, anchoredOff = c.valign === 'top' ? maxOff : 0;
    if (c.valign !== prevVA) {
      delete c.yoff;                                          // re-seat the bank against the newly chosen edge
      const yo = $('sel-yoff'); if (yo) yo.value = fmt(anchoredOff);   // and reflect it in the From-bottom field
    } else {
      const off = get('sel-yoff');
      if (off > 0.5 && Math.abs(off - anchoredOff) > 0.5) c.yoff = Math.max(0, Math.min(off, maxOff)); else delete c.yoff;
    }
    const usable = usableDepth();
    if (dep > 0.5) { c.depth = Math.max(1, Math.min(dep, usable)); ds.size.depth = Math.max(1, dep); }
    else delete c.depth;
    if ((($('sel-mount') || {}).value) === 'inset') c.mount = 'inset'; else delete c.mount;
    ds.backPanel.type = (($('sel-drawer-back-type') || {}).value) || 'groove';
    const backThk = get('sel-drawer-back-thk'); ds.backPanel.thickness = backThk > 0.5 ? Math.max(1, backThk) : 6;
    const backGroove = get('sel-drawer-back-groove'); ds.backPanel.groove = backGroove > 0.5 ? Math.max(0, backGroove) : 0;
    const backSetback = get('sel-drawer-back-setback'); ds.backPanel.setback = backSetback > 0.5 ? Math.max(0, backSetback) : 0;
    if (!ds.caps.bottom) ds.caps.bottom = { on: true, mount: 'inset', depth: null, anchor: 'back' };
    delete ds.caps.top;   // drawer has no top panel (open box); drop any stale value from older saves
    ds.caps.bottom.on = !!(($('sel-drawer-bottom-on') || {}).checked);
    ds.caps.bottom.mount = (($('sel-drawer-bottom-mount') || {}).value) === 'outset' ? 'outset' : 'inset';
    const botDepth = get('sel-drawer-bottom-depth'); ds.caps.bottom.depth = botDepth > 0.5 ? Math.max(1, botDepth) : null;
    ds.caps.bottom.anchor = (($('sel-drawer-bottom-anchor') || {}).value) || 'back';
    // Per-side front gaps (dummy reveal) — recalculates the front size, cut list, 2D and 3D.
    c.gapL = Math.max(0, get('sel-gap-l')); c.gapR = Math.max(0, get('sel-gap-r'));
    c.gapT = Math.max(0, get('sel-gap-t')); c.gapB = Math.max(0, get('sel-gap-b'));
    syncDrawerFlanks(c);                        // keep linked side panels sized to the new drawer height
    render(); return;
  }
  const lo = c.type === 'shelf' ? innerL() : innerB(), hi = c.type === 'shelf' ? innerR() : innerT();
  // Resize from the span field (shelf Width / vertical Height) + Anchor, measured against the component's current span.
  const anchor = ($('sel-anchor') || {}).value || lastAnchor; lastAnchor = anchor;
  let len = get('sel-len'); if (!(len > 0)) len = c.a1 - c.a0;
  let a0, a1;
  if (anchor === 'start') { a0 = c.a0; a1 = a0 + len; }            // left/bottom edge stays
  else if (anchor === 'end') { a1 = c.a1; a0 = a1 - len; }         // right/top edge stays
  else { const ctr = (c.a0 + c.a1) / 2; a0 = ctr - len / 2; a1 = ctr + len / 2; }   // midpoint stays
  a0 = Math.max(lo, Math.min(a0, hi - 1));
  a1 = Math.max(a0 + 1, Math.min(a1, hi));
  c.a0 = a0; c.a1 = a1;
  // Position from the anchored face: Height/Position value refers to top/right (end), bottom/left (start) or middle (center).
  const vanchor = ($('sel-vanchor') || {}).value || lastVAnchor; lastVAnchor = vanchor;
  const htp = partThick(c) / 2, voff = vanchor === 'end' ? htp : vanchor === 'start' ? -htp : 0;
  c.pos = get('sel-pos') - voff;
  // Panel thickness (e.g. a 25 mm flank): store an override only when it differs from the cabinet default.
  const thk = get('sel-thick');
  if (thk > 0 && Math.abs(thk - S.cab.t) > 0.5) c.thick = Math.max(1, thk); else delete c.thick;
  // Depth: store an override only when it differs from the usable depth; equal value clears it (so it follows the back panel).
  const usable = usableDepth(), depth = get('sel-depth');
  if (depth > 0 && Math.abs(depth - usable) > 0.5) c.depth = Math.max(1, Math.min(depth, usable));
  else delete c.depth;
  // Setback from the back panel front face (0 = sits against the back).
  const setback = get('sel-setback');
  if (setback > 0.5) c.setback = Math.max(0, Math.min(setback, S.cab.d)); else delete c.setback;
  clampComp(c); render();   // recalculates cut list, sheets, BOM
}

// ---------- Cell-pick mode (build a door spanning several combined bays) ----------
let cellMode = false;          // when on, clicking the 2D design toggles bays into the pick set
let cellSel = [];              // chosen cells {left,right,bottom,top}
const cellSig = (c) => `${Math.round(c.left)},${Math.round(c.right)},${Math.round(c.bottom)},${Math.round(c.top)}`;
function updateCellModeUI() {
  const bar = $('door-cells-bar'), btn = $('btn-door-cells'), place = $('btn-door-place');
  if (bar) bar.classList.toggle('hidden', !cellMode);
  if (btn) btn.classList.toggle('hidden', cellMode);
  if (place) { place.textContent = `Place door (${cellSel.length})`; place.disabled = !cellSel.length; }
  designCanvas.style.cursor = cellMode ? 'crosshair' : 'grab';
}
function setCellMode(on) { cellMode = on; if (!on) cellSel = []; updateCellModeUI(); render(); }
function toggleCellAt(mx, my) {
  const cell = cellAt(mx, my, null), sig = cellSig(cell);
  const i = cellSel.findIndex(c => cellSig(c) === sig);
  if (i >= 0) cellSel.splice(i, 1); else cellSel.push(cell);
  updateCellModeUI(); render();
}
function placeDoorFromCells() {
  if (!cellSel.length) return;
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const c of cellSel) { left = Math.min(left, c.left); right = Math.max(right, c.right); bottom = Math.min(bottom, c.bottom); top = Math.max(top, c.top); }
  const c = { id: S._seq++, type: 'door', ax: (left + right) / 2, ay: (bottom + top) / 2, count: doorLeaves(), span: { left, right, bottom, top }, ...newDoorGaps() };
  S.comps.push(c); S.selectedId = c.id; setCellMode(false);   // setCellMode renders
}

// ---------- Design interaction ----------
function canvasXY(e) { const r = designCanvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function eventToMM(e) { const { x, y } = canvasXY(e); return { mx: (x - view.ox) / view.scale, my: S.cab.h - (y - view.oy) / view.scale }; }
function hitTest(mx, my) {
  const tol = 6 / view.scale;
  for (let i = S.comps.length - 1; i >= 0; i--) {
    const c = S.comps[i];
    if (c.type === 'drawer') { const cl = drawerRect(c); if (mx >= cl.left && mx <= cl.right && my >= cl.bottom && my <= cl.top) return c; continue; }
    if (c.type === 'door') { const cl = doorSpan(c); if (mx >= cl.left && mx <= cl.right && my >= cl.bottom && my <= cl.top) return c; continue; }
    const r = partRect(c); if (mx >= r.x0 - tol && mx <= r.x1 + tol && my >= r.y0 - tol && my <= r.y1 + tol) return c;
  }
  // Carcass rails (top/bottom caps + sides): fall through to these only if no component was hit.
  const { w, h, t } = S.cab, tX = capXRange('top'), bX = capXRange('bottom'), sy0 = sideY0(), sy1 = sideY1();
  if (capOn('top') && my >= h - t - tol && my <= h + tol && mx >= tX.x0 - tol && mx <= tX.x1 + tol) return { id: 'T' };
  if (capOn('bottom') && my >= -tol && my <= t + tol && mx >= bX.x0 - tol && mx <= bX.x1 + tol) return { id: 'B' };
  if (sideLOn() && mx >= -tol && mx <= t + tol && my >= sy0 - tol && my <= sy1 + tol) return { id: 'L' };
  if (sideROn() && mx >= w - t - tol && mx <= w + tol && my >= sy0 - tol && my <= sy1 + tol) return { id: 'R' };
  return null;
}
let drag = null;
designCanvas.addEventListener('mousedown', (e) => {
  if (dMeasureMode) {   // click point A then B (snapped to corners); a third click starts over
    dMeasure = addMeasurePoint(dMeasure, canvasXY(e), dSnapPts, S.viewMode === '3d' ? lastDesign3dScale : view.scale);
    render(); return;
  }
  dMeasure = null;   // any interaction clears a stale measurement
  if (S.viewMode === '3d') {
    const panIt = e.button === 1 || e.button === 2 || e.shiftKey;   // right / middle / Shift+drag pans; left-drag orbits
    drag = { type: panIt ? 'pan3d' : 'orbit', x: e.clientX, y: e.clientY, moved: 0 };
    designCanvas.style.cursor = 'grabbing'; e.preventDefault(); return;
  }
  const { mx, my } = eventToMM(e); S.lastPoint = { x: mx, y: my };
  if (cellMode) { toggleCellAt(mx, my); return; }   // pick/unpick a bay; no drag while combining cells
  const hit = hitTest(mx, my); S.selectedId = hit ? hit.id : null;
  if (hit && typeof hit.id === 'number') drag = { type: 'part', comp: hit };   // only real components drag
  else if (!hit) drag = { type: 'pan', x: e.clientX, y: e.clientY };            // drag empty space to pan
  // a carcass rail (string id) just selects — no drag
  designCanvas.style.cursor = 'grabbing';
  render();
});
window.addEventListener('mousemove', (e) => {
  if (!drag) return;
  if (drag.type === 'orbit') {
    S.cam.yaw += (e.clientX - drag.x) * 0.01;
    S.cam.pitch = Math.max(-1.45, Math.min(1.45, S.cam.pitch + (e.clientY - drag.y) * 0.01));
    drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
    drag.x = e.clientX; drag.y = e.clientY; render(); return;
  }
  if (drag.type === 'pan') {
    S.pan.x += e.clientX - drag.x; S.pan.y += e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; render(); return;
  }
  if (drag.type === 'pan3d') {
    S.pan3d = S.pan3d || { x: 0, y: 0 };
    S.pan3d.x += e.clientX - drag.x; S.pan3d.y += e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; render(); return;
  }
  const { mx, my } = eventToMM(e);
  if (drag.comp.type === 'door' && drag.comp.span) {
    const s = drag.comp.span, dx = mx - drag.comp.ax, dy = my - drag.comp.ay;
    s.left += dx; s.right += dx; s.bottom += dy; s.top += dy; drag.comp.ax = mx; drag.comp.ay = my;
  } else if (drag.comp.type === 'drawer' || drag.comp.type === 'door') { drag.comp.ax = mx; drag.comp.ay = my; }
  else drag.comp.pos = drag.comp.type === 'shelf' ? my : mx;
  clampComp(drag.comp);
  if (drag.comp.type === 'drawer') syncDrawerFlanks(drag.comp);   // keep linked side panels sized to the drawer
  render();
});
designCanvas.addEventListener('wheel', (e) => {
  e.preventDefault(); dMeasure = null;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  if (S.viewMode === '3d') { S.zoom3d = Math.max(0.3, Math.min(6, S.zoom3d * factor)); render(); return; }
  const { x, y } = canvasXY(e); zoom2DAt(x, y, factor);
}, { passive: false });
window.addEventListener('mouseup', (e) => {
  if (drag && drag.type === 'orbit' && drag.moved < 5) {     // treat as click → pick a face
    const { x, y } = canvasXY(e); let id = null;
    for (let i = last3DFaces.length - 1; i >= 0; i--) if (pointInPoly(x, y, last3DFaces[i].pts)) { id = last3DFaces[i].id; break; }
    S.selectedId = id; render();
  }
  if (drag) { drag = null; designCanvas.style.cursor = 'grab'; }
});

// ---------- Cross-highlight: cutlist ⇄ sheet layout ⇄ 2D/3D design ----------
// Selecting by group key resolves to a representative design part, so the cutlist row,
// the sheet pieces, and the 2D/3D part all light up together off the one S.selectedId.
function selectByGroupKey(gkey) {
  if (gkey == null) return;
  const src = groupKeyToSrc().get(gkey);
  S.selectedId = src != null ? src : null;
  render();
}
// Click a cut-list row → highlight its pieces in the sheet layout and select the part in 2D/3D.
document.querySelector('#cutlist tbody').addEventListener('click', (e) => {
  const tr = e.target.closest('tr'); if (!tr || !tr.dataset.gkey) return;
  selectByGroupKey(tr.dataset.gkey);
});
// Click a piece in the sheet layout → same cross-selection.
sheetCanvas.addEventListener('click', (e) => {
  const r = sheetCanvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  for (let i = lastSheetRects.length - 1; i >= 0; i--) {
    const p = lastSheetRects[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) { selectByGroupKey(p.gkey); return; }
  }
  S.selectedId = null; render();   // click empty sheet space clears the selection
});

// ---------- Tabs / view ----------
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  if (cellMode && tab.dataset.tab !== 'design') setCellMode(false);
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  if (['setup', 'drawer-setup', 'room'].includes(tab.dataset.tab)) S.selectedId = null;   // these views have no part selection; close the floating sheet
  designCanvas.classList.toggle('active', tab.dataset.tab === 'design');
  sheetCanvas.classList.toggle('active', tab.dataset.tab === 'sheet');
  roomCanvas.classList.toggle('active', tab.dataset.tab === 'room');
  $('setup-view').classList.toggle('active', tab.dataset.tab === 'setup');
  $('drawer-setup-view').classList.toggle('active', tab.dataset.tab === 'drawer-setup');
  render();
  renderRoomModuleList();   // show the wall list when entering Room, hide it when leaving
}));
function setViewMode(m) { S.viewMode = m; dMeasure = null; if (m === '3d') { S.showDims = false; inDims.checked = false; if (cellMode) setCellMode(false); } $('v2d').classList.toggle('active', m === '2d'); $('v3d').classList.toggle('active', m === '3d'); designCanvas.style.cursor = cellMode ? 'crosshair' : 'grab'; render(); }
$('v2d').addEventListener('click', () => setViewMode('2d'));
$('v3d').addEventListener('click', () => setViewMode('3d'));
$('btn-measure').addEventListener('click', () => {
  dMeasureMode = !dMeasureMode; dMeasure = null;
  $('btn-measure').classList.toggle('active', dMeasureMode);
  designCanvas.style.cursor = dMeasureMode ? 'crosshair' : 'grab'; render();
});
function zoomStep(f) {
  if (S.viewMode === '3d') { S.zoom3d = Math.max(0.3, Math.min(6, S.zoom3d * f)); render(); }
  else { const r = designCanvas.getBoundingClientRect(); zoom2DAt(r.width / 2, r.height / 2, f); }
}
$('zoom-in').addEventListener('click', () => zoomStep(1.2));
$('zoom-out').addEventListener('click', () => zoomStep(1 / 1.2));
$('zoom-fit').addEventListener('click', () => { S.zoom = 1; S.pan = { x: 0, y: 0 }; S.zoom3d = 1; S.pan3d = { x: 0, y: 0 }; render(); });
designCanvas.addEventListener('contextmenu', (e) => e.preventDefault());   // allow right-drag to pan without the menu

// ---------- Modules (Job ▸ Module switcher) ----------
// The active module is always the global `S`; mutations land in JOB.modules[active] because
// it is the same object reference. We only re-sync the slot when `S` is reassigned (switch/load/reset).
function renderModuleBar() {
  const bar = $('module-bar'); if (!bar) return;
  const chips = JOB.modules.map((m, i) => {
    const active = i === JOB.active, name = escapeHtml(m.name || `Module ${i + 1}`);
    const x = active
      ? ` <span class="mod-edit" data-edit="${i}" title="Rename module">✎</span> <span class="mod-x" data-del="${i}" title="Delete module">✕</span>`
      : '';
    const tip = `${m.code ? `Code ${escapeHtml(m.code)} · ` : ''}Click to switch · ✎ or double-click to rename`;
    return `<button class="mod-chip${active ? ' active' : ''}" data-mi="${i}" type="button" title="${tip}">${name}${x}</button>`;
  }).join('');
  const label = JOB.modules.length ? 'Modules' : 'No modules';
  bar.innerHTML = `<span class="mod-label">${label}</span>${chips}<button id="mod-add" class="mod-add" type="button" title="Add a module to this job"><span class="mod-add-ico" aria-hidden="true">+</span>New</button>`;
}
function switchTo(i) {
  if (i < 0 || i >= JOB.modules.length) return;
  if (JOB.active >= 0 && JOB.modules[JOB.active]) JOB.modules[JOB.active] = S;   // commit current (skip when coming from empty)
  if (i === JOB.active) { renderModuleBar(); return; }
  JOB.active = i; S = JOB.modules[i];
  if (cellMode) setCellMode(false);
  S.selectedId = null; normalizeComps(); renderModuleBar(); syncInputs(); render();
}
function addModule(name, code) {
  if (JOB.active >= 0 && JOB.modules[JOB.active]) JOB.modules[JOB.active] = S;
  const m = DEFAULTS(); JOB._mseq = (JOB._mseq || JOB.modules.length) + 1;
  m.name = (name && name.trim()) || `Module ${JOB._mseq}`;
  if (code && code.trim()) m.code = code.trim();
  JOB.modules.push(m); switchTo(JOB.modules.length - 1);
}
// The code+name panel is shared for creating and renaming: moduleEditIndex null = add, number = rename that module.
let moduleEditIndex = null;
function openModulePanel(editIndex) {
  const panel = $('module-add-panel'); if (!panel) return;
  moduleEditIndex = editIndex;
  const editing = editIndex != null;
  const m = editing ? JOB.modules[editIndex] : null;
  const next = (JOB._mseq || JOB.modules.length) + 1;
  $('map-title').textContent = editing ? 'Rename module' : 'New module';
  $('mod-add-confirm').textContent = editing ? 'Save' : 'Add';
  $('mod-code').value = editing ? (m.code || '') : '';
  $('mod-name').value = editing ? (m.name || `Module ${editIndex + 1}`) : `Module ${next}`;
  panel.classList.remove('hidden');
  $('mod-name').focus(); $('mod-name').select();
}
const openAddModulePanel = () => openModulePanel(null);
function closeAddModulePanel() { const p = $('module-add-panel'); if (p) p.classList.add('hidden'); moduleEditIndex = null; }
function confirmAddModule() {
  const name = $('mod-name').value, code = $('mod-code').value;
  if (moduleEditIndex != null) {   // rename mode: update name + code in place, keep the module selected
    const m = JOB.modules[moduleEditIndex];
    if (m) { m.name = name.trim() || m.name || `Module ${moduleEditIndex + 1}`; const cd = code.trim(); if (cd) m.code = cd; else delete m.code; }
    closeAddModulePanel(); renderModuleBar(); return;
  }
  addModule(name, code); closeAddModulePanel();
}
function deleteModule(i) {
  if (i < 0 || i >= JOB.modules.length) return;
  if (!confirm(`Delete "${JOB.modules[i].name || `Module ${i + 1}`}"? This cannot be undone.`)) return;
  JOB.modules.splice(i, 1);
  if (JOB.modules.length === 0) {
    JOB.active = -1; S = DEFAULTS(); S.name = '';   // empty job: dummy S so helpers never touch null
  } else {
    JOB.active = (i < JOB.active) ? JOB.active - 1 : Math.min(JOB.active, JOB.modules.length - 1);
    S = JOB.modules[JOB.active];
  }
  if (cellMode) setCellMode(false);
  S.selectedId = null; normalizeComps(); renderModuleBar(); syncInputs(); render();
}
// Rename opens the shared inline panel (no browser prompt — friendlier and works in Electron).
function renameModule(i) { if (i >= 0 && i < JOB.modules.length) openModulePanel(i); }

// ---------- Persistence ----------
const STORE_KEY = 'cabinet-cutlist-prototype';   // legacy single-module save (read once for migration)
const JOB_KEY = 'cabinet-cutlist-job';           // current job (multi-module) save
function hydrateModule(raw) {
  const m = Object.assign(DEFAULTS(), raw);
  if (!m.cab.top) m.cab.top = { mount: 'inset', depth: null, anchor: 'back' };        // older saves predate editable caps
  if (!m.cab.bottom) m.cab.bottom = { mount: 'inset', depth: null, anchor: 'back' };
  if (!m.edgeTape) m.edgeTape = { thickness: 0.8, width: 25 };                           // older saves predate tape spec
  if (!m.drawerSetup) m.drawerSetup = defaultDrawerSetup();                               // older saves predate the Drawer Setup step
  for (const c of m.comps) if (c.type === 'divider') c.type = 'vertical';   // migrate old terminology
  if (m.band && m.band.Divider) { m.band.Vertical = m.band.Divider; delete m.band.Divider; }
  m.band = Object.assign(defaultBand(), m.band || {});
  return m;
}
function applyJob(job) {
  const mods = (job.modules || []).map(hydrateModule);
  mods.forEach((m, i) => { if (!m.name) m.name = `Module ${i + 1}`; });
  JOB = { name: job.name || 'Job 1', modules: mods, active: mods.length ? 0 : -1, _mseq: Math.max(job._mseq || 0, mods.length) };
  if (mods.length) {
    JOB.active = Math.min(Math.max(0, job.active | 0), mods.length - 1);
    for (const m of mods) { S = m; normalizeComps(); }   // normalizeComps reads the global S
    S = JOB.modules[JOB.active];
  } else {
    S = DEFAULTS(); S.name = '';
  }
  if (cellMode) setCellMode(false);
  renderModuleBar(); syncInputs(); render();
}
function save() { if (JOB.active >= 0 && JOB.modules[JOB.active]) JOB.modules[JOB.active] = S; localStorage.setItem(JOB_KEY, JSON.stringify(JOB)); flash($('btn-save'), 'Saved'); }
function load() {
  const rawJob = localStorage.getItem(JOB_KEY), rawLegacy = localStorage.getItem(STORE_KEY);
  if (!rawJob && !rawLegacy) { flash($('btn-load'), 'Nothing saved'); return; }
  try {
    const job = rawJob ? JSON.parse(rawJob) : { name: 'Job 1', modules: [JSON.parse(rawLegacy)], active: 0 };
    applyJob(job); flash($('btn-load'), 'Loaded');
  }
  catch { flash($('btn-load'), 'Load failed'); }
}
function reset() {
  S = DEFAULTS(); S.name = '';
  JOB = { name: 'Job 1', modules: [], active: -1, _mseq: 0 };
  if (cellMode) setCellMode(false);
  renderModuleBar(); syncInputs(); render();
}
function flash(btn, msg) { const old = btn.textContent; btn.textContent = msg; setTimeout(() => { btn.textContent = old; }, 1100); }

// ---------- Export ----------
function exportCSV() {
  if (!JOB.modules.length) { flash($('btn-export'), 'No modules'); return; }
  const job = isJobScope();
  const parts = job ? jobCutList() : cutList();
  const rows = [['Part', 'Qty', `Width (${S.unit})`, `Height (${S.unit})`, `Depth (${S.unit})`, `Thick (${S.unit})`, 'Banded edges']];
  parts.forEach(p => rows.push([p.name, p.qty, fmt(p.w), fmt(p.h), fmt(p.d), fmt(p.thick), `"${job ? (p.band || '—') : bandNotation(p.key)}"`]));
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cutlist.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function exportPDF() {
  if (!JOB.modules.length) { flash($('btn-pdf'), 'No modules'); return; }
  const job = isJobScope();
  const pack = job ? jobNest() : nest(cutListInstances());
  const parts = job ? jobCutList() : cutList();
  const scale = 680 / Math.max(pack.SW, pack.SH);
  const imgs = pack.sheets.map((sheet, i) => {
    const c = document.createElement('canvas'); c.width = Math.round(pack.SW * scale); c.height = Math.round(pack.SH * scale);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = '#333'; x.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    sheet.placements.forEach(p => drawPlacement(x, p, 0, 0, scale, true, { sheetNo: i + 1 }));
    return `<figure><img src="${c.toDataURL('image/png')}"/><figcaption>Sheet ${i + 1} — ${fmt(pack.SW)}×${fmt(pack.SH)} ${S.unit}</figcaption></figure>`;
  }).join('');
  const tape = (job ? jobTotals().tapeMM : parts.reduce((a, p) => a + p.qty * bandLen(p.key, p.length, p.width), 0)) / 1000;
  const rows = parts.map(p => `<tr><td>${p.name}</td><td>${p.qty}</td><td>${fmt(p.w)}</td><td>${fmt(p.h)}</td><td>${fmt(p.d)}</td><td>${fmt(p.thick)}</td><td>${job ? (p.band || '—') : bandNotation(p.key)}</td></tr>`).join('');
  const heading = job
    ? `Job ${escapeHtml(JOB.name || 'Job 1')} · ${JOB.modules.length} module(s) · grain ${S.grainLock ? 'locked' : 'free'} · edge tape ${tape.toFixed(2)} m`
    : `Cabinet ${fmt(S.cab.w)}×${fmt(S.cab.h)}×${fmt(S.cab.d)} ${S.unit} · material ${fmtU(S.cab.t)} · doors ${doorRects().length} · grain ${S.grainLock ? 'locked' : 'free'} · edge tape ${tape.toFixed(2)} m`;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Cut list</title><style>
    body{font:13px system-ui,sans-serif;color:#111;margin:24px}h1{font-size:18px}h2{font-size:14px;margin-top:24px}
    table{border-collapse:collapse;width:100%;max-width:560px}th,td{border:1px solid #999;padding:4px 8px;text-align:right}th:first-child,td:first-child{text-align:left}
    figure{margin:0 0 18px;page-break-inside:avoid}img{max-width:100%;border:1px solid #ccc}figcaption{color:#555;font-size:12px;margin-top:4px}@media print{button{display:none}}
  </style></head><body>
    <h1>Cabinet &amp; Cupboard — Cut List</h1>
    <p>${heading}</p>
    <table><thead><tr><th>Part</th><th>Qty</th><th>Width (${S.unit})</th><th>Height (${S.unit})</th><th>Depth (${S.unit})</th><th>Thick (${S.unit})</th><th>Edges</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Sheet layout — ${pack.sheets.length} sheet(s), utilisation ${(Math.min(1, pack.utilisation) * 100).toFixed(1)}%</h2>${imgs}
    <button onclick="window.print()">Print / Save as PDF</button></body></html>`);
  win.document.close(); setTimeout(() => win.print(), 350);
}

// ---------- Production pack (shop drawings) ----------
// Render one module's 2D elevation or 3D isometric to an off-screen canvas at print DPI and return a PNG data URL.
// Reuses the live renderDesign / renderDesign3D so the drawing (and its dimensions) matches exactly what the user sees,
// but with neutral framing: fit-to-view, no pan, assembled (no explode), dimensions on.
function captureDesign(m, mode, w, h) {
  const cv = document.createElement('canvas');
  const pC = designCanvas, pD = dctx, pCAP = CAP;
  designCanvas = cv; dctx = cv.getContext('2d'); CAP = { w, h, dpr: 2 };
  try {
    return withModule(m, () => {
      const saved = { zoom: m.zoom, pan: m.pan, zoom3d: m.zoom3d, pan3d: m.pan3d, explode: m.explode, showDims: m.showDims };
      m.zoom = 1; m.pan = { x: 0, y: 0 }; m.zoom3d = 1; m.pan3d = { x: 0, y: 0 }; m.explode = 0; m.showDims = true;
      (mode === '3d' ? renderDesign3D : renderDesign)();
      Object.assign(m, saved);
      // Composite onto white so the drawing sits on paper (canvas transparency reads as black in some PDF viewers).
      const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height;
      const o = out.getContext('2d'); o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height); o.drawImage(cv, 0, 0);
      return out.toDataURL('image/png');
    });
  } finally { designCanvas = pC; dctx = pD; CAP = pCAP; }
}

function exportProductionPack() {
  if (!JOB.modules.length) { flash($('btn-prod'), 'No modules'); return; }
  if (JOB.active >= 0 && JOB.modules[JOB.active]) JOB.modules[JOB.active] = S;   // fold in-progress edits into the job
  flash($('btn-prod'), 'Rendering…');
  const job = isJobScope();   // respect the cut-list Module ⇄ Job toggle: Module = active module only, Job = all modules
  const active = (JOB.active >= 0 && JOB.modules[JOB.active]) ? JOB.modules[JOB.active] : S;
  const mods = job ? JOB.modules : [active];
  // Size each capture to the cabinet's own proportions at a steady ~px/mm, so the dimension labels stay as roomy
  // as the on-screen views instead of being squeezed together — a tall cabinet gets a tall image, a wide one a
  // wide image. The extra margins leave room for the outside dimension lines (height left, width/depth below).
  const PXMM = 0.30, clampImg = (v) => Math.max(340, Math.min(1200, Math.round(v)));
  const blocks = mods.map((m, i) => {
    const W2 = clampImg(m.cab.w * PXMM + 128), H2 = clampImg(m.cab.h * PXMM + 128);
    const W3 = clampImg(m.cab.w * PXMM + 220), H3 = clampImg(m.cab.h * PXMM + 170);   // isometric spreads with depth
    const img2d = captureDesign(m, '2d', W2, H2);
    const img3d = captureDesign(m, '3d', W3, H3);
    const info = withModule(m, () => {
      const parts = cutList();
      const rows = parts.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.qty}</td><td>${fmt(p.w)}</td><td>${fmt(p.h)}</td><td>${fmt(p.d)}</td><td>${fmt(p.thick)}</td><td>${bandNotation(p.key)}</td></tr>`).join('');
      const tape = parts.reduce((a, p) => a + p.qty * bandLen(p.key, p.length, p.width), 0) / 1000;
      return {
        title: `${escapeHtml(m.name || `Module ${i + 1}`)}${m.code ? ` · ${escapeHtml(m.code)}` : ''}`,
        spec: `${fmt(m.cab.w)}×${fmt(m.cab.h)}×${fmt(m.cab.d)} ${m.unit} · material ${fmtU(m.cab.t)} · doors ${doorRects().length} · edge tape ${tape.toFixed(2)} m`,
        unit: m.unit, rows
      };
    });
    return `<section class="mod">
      <h2><span class="num">${i + 1}</span> ${info.title}</h2>
      <p class="spec">${info.spec}</p>
      <div class="views">
        <figure><img src="${img2d}"><figcaption>Front elevation — dimensioned</figcaption></figure>
        <figure><img src="${img3d}"><figcaption>3D isometric</figcaption></figure>
      </div>
      <table><thead><tr><th>Part</th><th>Qty</th><th>Width (${info.unit})</th><th>Height (${info.unit})</th><th>Depth (${info.unit})</th><th>Thick (${info.unit})</th><th>Edges</th></tr></thead><tbody>${info.rows}</tbody></table>
    </section>`;
  }).join('');

  // Sheet nesting + totals for the chosen scope.
  const pack = job ? jobNest() : nest(cutListInstances());
  const scale = 680 / Math.max(pack.SW, pack.SH);
  const sheetImgs = pack.sheets.map((sheet, i) => {
    const c = document.createElement('canvas'); c.width = Math.round(pack.SW * scale); c.height = Math.round(pack.SH * scale);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = '#333'; x.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    sheet.placements.forEach(p => drawPlacement(x, p, 0, 0, scale, true, { sheetNo: i + 1 }));
    return `<figure><img src="${c.toDataURL('image/png')}"><figcaption>Sheet ${i + 1} — ${fmt(pack.SW)}×${fmt(pack.SH)} ${S.unit}</figcaption></figure>`;
  }).join('');
  const tapeMM = job ? jobTotals().tapeMM : cutList().reduce((a, p) => a + p.qty * bandLen(p.key, p.length, p.width), 0);
  const when = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(JOB.name || 'Job')} — Production Pack</title><style>
    :root{--ink:#161a20;--mut:#5b6470;--line:#c9cfd8;--accent:#2f6b4f}
    *{box-sizing:border-box}body{font:13px/1.45 system-ui,Segoe UI,sans-serif;color:var(--ink);margin:0;padding:28px 32px}
    header.cover{border-bottom:2px solid var(--accent);padding-bottom:14px;margin-bottom:22px}
    .brand{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
    h1{font-size:22px;margin:4px 0 6px}.meta{color:var(--mut);font-size:12.5px}
    section.mod{page-break-inside:avoid;border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:0 0 18px}
    section.mod h2{font-size:15px;margin:0 0 2px;display:flex;align-items:center;gap:8px}
    .num{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:var(--accent);color:#fff;font-size:12px}
    .spec{color:var(--mut);margin:0 0 10px;font-size:12.5px}
    .views{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:12px}
    .views figure{margin:0;flex:1 1 240px;min-width:220px}
    .views img{width:100%;height:auto;border:1px solid var(--line);border-radius:6px;background:#fff}
    figcaption{color:var(--mut);font-size:11.5px;margin-top:4px;text-align:center}
    table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{border:1px solid var(--line);padding:3px 8px;text-align:right}th:first-child,td:first-child{text-align:left}
    thead th{background:#f2f4f7}
    h2.sec{font-size:16px;border-bottom:1px solid var(--line);padding-bottom:6px;margin:26px 0 14px;page-break-before:auto}
    .sheets{display:flex;flex-wrap:wrap;gap:16px}.sheets figure{margin:0}.sheets img{max-width:340px;border:1px solid var(--line)}
    .totals{display:flex;gap:26px;flex-wrap:wrap;margin:10px 0 0;font-size:13px}.totals b{font-size:16px;color:var(--accent)}
    footer{margin-top:26px;color:var(--mut);font-size:11px;border-top:1px solid var(--line);padding-top:10px}
    button.print{position:fixed;top:14px;right:16px;padding:8px 16px;border:0;border-radius:6px;background:var(--accent);color:#fff;font-size:13px;cursor:pointer}
    @media print{button.print{display:none}body{padding:0}}
  </style></head><body>
    <button class="print" onclick="window.print()">Print / Save as PDF</button>
    <header class="cover">
      <div class="brand">WallView · Production Pack</div>
      <h1>${escapeHtml(JOB.name || 'Job')}</h1>
      <div class="meta">${mods.length} module(s) · ${job ? 'whole job' : 'single module'} · grain ${S.grainLock ? 'locked' : 'free'} · generated ${when}</div>
    </header>
    ${blocks}
    <h2 class="sec">Sheet layout — ${pack.sheets.length} sheet(s), utilisation ${(Math.min(1, pack.utilisation) * 100).toFixed(1)}%</h2>
    <div class="totals">
      <span>Sheets<br><b>${pack.sheets.length}</b> × ${fmt(pack.SW)}×${fmt(pack.SH)} ${S.unit}</span>
      <span>Edge tape<br><b>${(tapeMM / 1000).toFixed(2)}</b> m</span>
      <span>Utilisation<br><b>${(Math.min(1, pack.utilisation) * 100).toFixed(1)}</b> %</span>
    </div>
    <div class="sheets" style="margin-top:14px">${sheetImgs}</div>
    <footer>Generated by WallView — Scale · Design · Cut. All dimensions in the unit shown per module. Verify on site before cutting.</footer>
  </body></html>`);
  win.document.close();
  render();                                     // restore the on-screen view (capture overwrote transient render globals)
  setTimeout(() => { try { win.focus(); } catch (e) {} }, 200);
  flash($('btn-prod'), 'Opened ✓');
}

// ---------- Wire up ----------
[inW, inH, inD, inT, inSW, inSH, inKerf].forEach(el => el.addEventListener('input', () => { S.preset = 'custom'; inPreset.value = 'custom'; readInputs(); }));
inBack.addEventListener('change', readInputs);
function readBack() {
  S.backPanel.type = inBackType.value;
  S.backPanel.thickness = Math.max(1, toMM(parseFloat(inBackThk.value) || 0));
  S.backPanel.groove = Math.max(0, toMM(parseFloat(inBackGroove.value) || 0));
  S.backPanel.setback = Math.max(0, toMM(parseFloat(inBackSetback.value) || 0));
  syncBackUI(); resyncComponents(); render();
}
inBackType.addEventListener('change', readBack);
[inBackThk, inBackGroove, inBackSetback].forEach(el => el.addEventListener('input', readBack));
function readCaps() {
  const rd = (which, mountEl, depthEl, anchorEl) => {
    const c = S.cab[which] || (S.cab[which] = { mount: 'inset', depth: null, anchor: 'back' });
    c.mount = mountEl.value === 'outset' ? 'outset' : 'inset';
    c.anchor = ['back', 'center', 'front'].includes(anchorEl.value) ? anchorEl.value : 'back';
    const dep = toMM(parseFloat(depthEl.value) || 0);
    c.depth = (dep > 0.5 && Math.abs(dep - S.cab.d) > 0.5) ? Math.max(1, dep) : null;   // equal to cabinet depth => aligned (null); otherwise stored, may exceed it
  };
  rd('top', inTopMount, inTopDepth, inTopAnchor);
  rd('bottom', inBotMount, inBotDepth, inBotAnchor);
  resyncComponents(); render();
}
[inTopMount, inTopAnchor, inBotMount, inBotAnchor].forEach(el => el.addEventListener('change', readCaps));
[inTopDepth, inBotDepth].forEach(el => el.addEventListener('input', readCaps));
// Drawer Setup step: every field writes to the module default drawer, then recalculates all drawers.
if (inDwH) {
  [inDwH, inDwW, inDwD, inDwT, inDwBackThk, inDwBackGroove, inDwBackSetback, inDwBotDepth].forEach(el => el.addEventListener('input', readDrawerSetup));
  [inDwBackType, inDwBotMount, inDwBotAnchor, inDwBotOn].forEach(el => el.addEventListener('change', readDrawerSetup));
}
// Panel presence toggles (remove / restore). Keep the cap objects so their props survive a round-trip.
inTopOn.addEventListener('change', () => { (S.cab.top || (S.cab.top = { mount: 'inset', depth: null, anchor: 'back' })).on = inTopOn.checked; syncInputs(); resyncComponents(); render(); });
inBotOn.addEventListener('change', () => { (S.cab.bottom || (S.cab.bottom = { mount: 'inset', depth: null, anchor: 'back' })).on = inBotOn.checked; syncInputs(); resyncComponents(); render(); });
inSideL.addEventListener('change', () => { S.cab.sideL = inSideL.checked; resyncComponents(); render(); });
inSideR.addEventListener('change', () => { S.cab.sideR = inSideR.checked; resyncComponents(); render(); });
inGrain.addEventListener('change', () => { S.grainLock = inGrain.checked; render(); });
if (inWoodTheme) inWoodTheme.addEventListener('change', () => { S.woodTheme = inWoodTheme.value; render(); });
if (inTapeTh) inTapeTh.addEventListener('change', () => { (S.edgeTape || (S.edgeTape = { thickness: 0.8, width: 25 })).thickness = parseFloat(inTapeTh.value) || 0; render(); });
if (inTapeWd) inTapeWd.addEventListener('change', () => { (S.edgeTape || (S.edgeTape = { thickness: 0.8, width: 25 })).width = parseFloat(inTapeWd.value) || 0; render(); });
inPreset.addEventListener('change', () => { S.preset = inPreset.value; if (PRESETS[S.preset]) { Object.assign(S.cab, PRESETS[S.preset]); readInputs(); syncInputs(); } });
$('btn-add-door').addEventListener('click', () => addComp('door'));
$('btn-door-cells').addEventListener('click', () => setCellMode(true));
$('btn-door-cancel').addEventListener('click', () => setCellMode(false));
$('btn-door-place').addEventListener('click', placeDoorFromCells);
inReveal.addEventListener('input', () => { S.doors.reveal = Math.max(0, toMM(parseFloat(inReveal.value) || 0)); render(); });
inExplode.addEventListener('input', () => { S.explode = parseFloat(inExplode.value) || 0; render(); });
inDims.addEventListener('change', () => { S.showDims = inDims.checked; render(); });
$('btn-add-shelf').addEventListener('click', () => addComp('shelf'));
$('btn-add-vertical').addEventListener('click', () => addComp('vertical'));
$('btn-add-drawer').addEventListener('click', () => addComp('drawer'));
// The header "Side panels" checkbox is the default for NEW drawers AND a live bulk toggle: flipping it adds/removes
// the flanks on EVERY existing drawer at once (so it always visibly changes the design, no selection required).
{ const el = $('in-drawer-sides'); if (el) el.addEventListener('change', (e) => {
  const on = e.target.checked; let changed = false;
  for (const c of S.comps.filter(x => x.type === 'drawer')) {
    const has = !!(c.flanks && c.flanks.length);
    if (on && !has) { addDrawerFlanks(c); delete c.w; clampComp(c); syncDrawerFlanks(c); changed = true; }
    else if (!on && has) { removeDrawerFlanks(c); delete c.w; clampComp(c); changed = true; }
  }
  if (changed) render();
}); }
// The header "Box front" checkbox is the default for NEW drawers AND a live bulk toggle: flipping it adds/removes the
// structural front wall on EVERY existing drawer at once, then recalculates the cut list and redraws 2D/3D.
{ const el = $('in-drawer-front'); if (el) el.addEventListener('change', (e) => {
  const on = e.target.checked; let changed = false;
  for (const c of S.comps.filter(x => x.type === 'drawer')) {
    const hasFront = c.boxFront !== false;
    if (hasFront !== on) { if (on) delete c.boxFront; else c.boxFront = false; changed = true; }   // c.boxFront === false drops the front wall
  }
  if (changed) render();
}); }
btnDelete.addEventListener('click', deleteSelected);
$('sel-update').addEventListener('click', applySelectedEdit);
$('sel-delete').addEventListener('click', deleteSelected);
$('sel-close').addEventListener('click', () => { S.selectedId = null; render(); });
// ---------- Draggable props panel (grab the header to move it clear of the view) ----------
(function makePropsPanelDraggable() {
  const card = $('card-selected'), head = card && card.querySelector('.sel-head');
  if (!card || !head) return;
  let pan = null;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const place = (leftPx, topPx) => {
    const pr = card.parentElement.getBoundingClientRect();
    card.style.right = 'auto'; card.style.bottom = 'auto';
    card.style.left = clamp(leftPx, 0, Math.max(0, pr.width - card.offsetWidth)) + 'px';
    card.style.top = clamp(topPx, 0, Math.max(0, pr.height - card.offsetHeight)) + 'px';
  };
  head.addEventListener('mousedown', (e) => {
    if (e.target.closest('.sel-close')) return;   // don't hijack the close button
    const r = card.getBoundingClientRect(), pr = card.parentElement.getBoundingClientRect();
    pan = { dx: e.clientX - r.left, dy: e.clientY - r.top, pr };
    card.classList.add('dragging'); e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!pan) return;
    place(e.clientX - pan.pr.left - pan.dx, e.clientY - pan.pr.top - pan.dy);
  });
  window.addEventListener('mouseup', () => { if (pan) { pan = null; card.classList.remove('dragging'); } });
  // Double-click the header to snap back to the default top-right corner.
  head.addEventListener('dblclick', (e) => { if (e.target.closest('.sel-close')) return; card.style.left = 'auto'; card.style.bottom = 'auto'; card.style.top = '12px'; card.style.right = '12px'; });
  // Keep it on-screen if the window/panel resizes after a manual move.
  window.addEventListener('resize', () => { if (card.style.left && card.style.left !== 'auto') place(parseFloat(card.style.left), parseFloat(card.style.top)); });
})();
$('sel-fields').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applySelectedEdit(); } });
// Drawer banks apply live as you type; drawer + door dropdowns apply on change (other parts still use the Update button).
const isCapSel = () => S.selectedId === 'T' || S.selectedId === 'B';
const liveDrawer = () => { const c = typeof S.selectedId === 'number' ? S.comps.find(x => x.id === S.selectedId) : null; if ((c && (c.type === 'drawer' || c.type === 'door')) || isCapSel()) applySelectedEdit(); };
const liveChange = () => { const c = typeof S.selectedId === 'number' ? S.comps.find(x => x.id === S.selectedId) : null; if ((c && (c.type === 'drawer' || c.type === 'door')) || isCapSel()) applySelectedEdit(); };
$('sel-fields').addEventListener('input', liveDrawer);
$('sel-fields').addEventListener('change', liveChange);
// Door per-side gap: switching the "Gap side" dropdown just refreshes the single Gap field to that side's stored
// value (the value itself is applied to the selected side by applySelectedEdit). Runs after liveChange above.
$('sel-fields').addEventListener('change', (e) => {
  if (e.target.id !== 'sel-gap-side') return;
  doorGapSide = e.target.value;
  const c = typeof S.selectedId === 'number' ? S.comps.find(x => x.id === S.selectedId) : null;
  const el = $('sel-gap-val'); if (el && c) el.value = fmt(c['gap' + doorGapSide.toUpperCase()] || 0);
});
// The shelf/vertical anchor dropdowns are seating commands: changing one snaps the part to that side/end of its
// opening (like the drawer's Top/Bottom). Position anchor seats it across the opening; Height/Width anchor seats
// the resizable span along it. The numeric Position/Height fields still fine-tune from the seated position.
$('sel-fields').addEventListener('change', (e) => {
  const isPos = e.target.id === 'sel-vanchor', isSpan = e.target.id === 'sel-anchor';
  if (!isPos && !isSpan) return;
  const c = typeof S.selectedId === 'number' ? S.comps.find(x => x.id === S.selectedId) : null;
  if (!c || (c.type !== 'shelf' && c.type !== 'vertical')) return;
  const a = e.target.value;
  if (isPos) lastVAnchor = a; else lastAnchor = a;
  seatComp(c, isPos ? 'pos' : 'span', a);
  render();
  // The panel isn't rebuilt while the select holds focus, so refresh the numeric fields to the seated values.
  const posEl = $('sel-pos'); if (posEl) { const ht = partThick(c) / 2, off = lastVAnchor === 'end' ? ht : lastVAnchor === 'start' ? -ht : 0; posEl.value = fmt(c.pos + off); }
  const lenEl = $('sel-len'); if (lenEl) lenEl.value = fmt(c.a1 - c.a0);
});
$('sel-fields').addEventListener('click', (e) => {
  if (e.target.id !== 'sel-door-uncombine') return;
  const c = typeof S.selectedId === 'number' ? S.comps.find(x => x.id === S.selectedId) : null;
  if (c && c.type === 'door') { delete c.span; clampComp(c); render(); }   // revert to the cell at its anchor
});
$('btn-save').addEventListener('click', save);
$('btn-load').addEventListener('click', load);
$('btn-reset').addEventListener('click', reset);
$('btn-export').addEventListener('click', exportCSV);
$('btn-pdf').addEventListener('click', exportPDF);
$('btn-prod').addEventListener('click', exportProductionPack);
$('unit-mm').addEventListener('click', () => { if (S.unit !== 'mm') { S.unit = 'mm'; syncInputs(); render(); } });
$('unit-in').addEventListener('click', () => { if (S.unit !== 'in') { S.unit = 'in'; syncInputs(); render(); } });
window.addEventListener('resize', render);
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && (typeof S.selectedId === 'number' || ['T', 'B', 'L', 'R', 'BK'].includes(S.selectedId)) && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') { e.preventDefault(); deleteSelected(); }
});

// ---------- AI / programmatic API ----------
// A clean surface the chat "Design Copilot" agent calls as tools. All lengths in mm.
function clampAllComps() {
  for (const c of S.comps) {
    if (c.type === 'shelf' || c.type === 'vertical') { const lim = c.type === 'shelf' ? S.cab.w - S.cab.t : S.cab.h - S.cab.t; c.a0 = Math.max(S.cab.t, Math.min(c.a0, lim)); c.a1 = Math.max(c.a0, Math.min(c.a1, lim)); }
    if (c.depth != null) c.depth = Math.min(c.depth, S.cab.d); if (c.setback != null) c.setback = Math.min(c.setback, S.cab.d); clampComp(c);
  }
}
function aiSetDimensions(o = {}) {
  if (o.width != null) S.cab.w = Math.max(1, o.width);
  if (o.height != null) S.cab.h = Math.max(1, o.height);
  if (o.depth != null) S.cab.d = Math.max(1, o.depth);
  if (o.thickness != null) S.cab.t = Math.max(1, o.thickness);
  if (o.back != null) S.cab.back = !!o.back;
  S.preset = 'custom'; clampAllComps(); syncInputs(); render();
}
function aiApplyPreset(name) {
  if (!PRESETS[name]) return { error: `unknown preset "${name}"`, options: Object.keys(PRESETS) };
  Object.assign(S.cab, PRESETS[name]); S.preset = name; clampAllComps(); syncInputs(); render();
  return { ok: true };
}
function aiSetDoors(count, reveal) {
  if (reveal != null) S.doors.reveal = Math.max(0, reveal);
  if (count != null) {   // doors are now cell-bound; replace any existing door fronts with one covering the main interior
    S.comps = S.comps.filter(c => c.type !== 'door');
    const n = Math.max(0, Math.min(2, count | 0));
    if (n >= 1) { const c = { id: S._seq++, type: 'door', ax: S.cab.w / 2, ay: S.cab.h / 2, count: n }; clampComp(c); S.comps.push(c); }
  }
  syncInputs(); render();
}
function aiAddShelves(count, fromMM, toMM) {
  const a0 = fromMM != null ? fromMM : innerL(), a1 = toMM != null ? toMM : innerR();
  const lo = innerB(), hi = innerT(), n = Math.max(1, Math.min(50, count | 0));
  for (let k = 1; k <= n; k++) S.comps.push({ id: S._seq++, type: 'shelf', a0, a1, pos: lo + (hi - lo) * k / (n + 1) });
  S.selectedId = null; render(); return { ok: true, added: n };
}
function aiAddVerticals(count, fromMM, toMM) {
  const a0 = fromMM != null ? fromMM : innerB(), a1 = toMM != null ? toMM : innerT();
  const lo = innerL(), hi = innerR(), n = Math.max(1, Math.min(50, count | 0));
  for (let k = 1; k <= n; k++) S.comps.push({ id: S._seq++, type: 'vertical', a0, a1, pos: lo + (hi - lo) * k / (n + 1) });
  S.selectedId = null; render(); return { ok: true, added: n };
}
function aiClearComponents() { S.comps = []; S.selectedId = null; render(); return { ok: true }; }
function aiSetSheet(o = {}) {
  if (o.width != null) S.sheet.w = Math.max(1, o.width);
  if (o.height != null) S.sheet.h = Math.max(1, o.height);
  if (o.kerf != null) S.sheet.kerf = Math.max(0, o.kerf);
  syncInputs(); render();
}
function aiSetGrainLock(locked) { S.grainLock = !!locked; syncInputs(); render(); }
function aiSetBanding(part, edges) {
  if (!PART_TYPES.some(([k]) => k === part)) return { error: `unknown part "${part}"`, options: PART_TYPES.map(p => p[0]) };
  S.band[part] = {}; (edges || []).forEach(e => { if (EDGES.includes(e)) S.band[part][e] = true; });
  syncInputs(); render(); return { ok: true };
}
function aiGetState() {
  return {
    unit: S.unit, preset: S.preset,
    cabinet: { width: S.cab.w, height: S.cab.h, depth: S.cab.d, thickness: S.cab.t, back: S.cab.back },
    doors: { fronts: doorRects().length, reveal: S.doors.reveal },
    components: { shelves: S.comps.filter(c => c.type === 'shelf').length, verticals: S.comps.filter(c => c.type === 'vertical').length },
    sheet: { width: S.sheet.w, height: S.sheet.h, kerf: S.sheet.kerf, grainLock: S.grainLock },
  };
}
function aiGetCutList() {
  const parts = cutList(), instances = cutListInstances(), pack = nest(instances);
  const areaMM2 = parts.reduce((a, p) => a + p.qty * p.length * p.width, 0);
  const tapeMM = parts.reduce((a, p) => a + p.qty * bandLen(p.key, p.length, p.width), 0);
  return {
    parts: parts.map(p => ({ name: p.name, qty: p.qty, width: Math.round(p.w), height: Math.round(p.h), depth: Math.round(p.d), thickness: Math.round(p.thick), edges: bandNotation(p.key) })),
    totals: {
      partCount: parts.reduce((n, p) => n + p.qty, 0),
      boardAreaM2: +(areaMM2 / 1e6).toFixed(3), edgeTapeM: +(tapeMM / 1000).toFixed(2),
      sheetsNeeded: pack.sheets.length, utilisationPct: +(Math.min(1, pack.utilisation) * 100).toFixed(1),
    },
  };
}
// Job-wide cut list rollup (all modules) for the AI copilot.
function aiGetJobCutList() {
  const parts = jobCutList(), pack = jobNest(), totals = jobTotals();
  return {
    modules: JOB.modules.map((m, i) => ({ index: i, name: m.name || `Module ${i + 1}` })),
    parts: parts.map(p => ({ name: p.name, qty: p.qty, width: Math.round(p.w), height: Math.round(p.h), depth: Math.round(p.d), thickness: Math.round(p.thick), edges: p.band })),
    totals: {
      partCount: totals.partCount,
      boardAreaM2: +(totals.areaMM2 / 1e6).toFixed(3), edgeTapeM: +(totals.tapeMM / 1000).toFixed(2),
      sheetsNeeded: pack.sheets.length, utilisationPct: +(Math.min(1, pack.utilisation) * 100).toFixed(1),
    },
  };
}
// Priced bill of materials with inferred hardware. Prices overridable; defaults in GBP.
// opts.scope === 'job' rolls up every module; otherwise the active module only.
function aiEstimateBOM(opts = {}) {
  const job = opts.scope === 'job';
  const p = Object.assign({ sheet: 45, tapePerM: 0.8, hinge: 1.2, handle: 3, shelfPin: 0.1, screwsPerCabinet: 1.5 }, opts.prices || {});
  const parts = job ? jobCutList() : cutList(), instances = job ? jobCutListInstances() : cutListInstances(), pack = job ? jobNest() : nest(instances);
  const sheets = pack.sheets.length;
  const tapeM = (job ? jobTotals().tapeMM : parts.reduce((a, q) => a + q.qty * bandLen(q.key, q.length, q.width), 0)) / 1000;
  const shelfCount = instances.filter(i => i.name === 'Shelf').length;
  const leaves = job ? JOB.modules.flatMap(m => withModule(m, () => doorRects())) : doorRects(), doorCount = leaves.length;
  const hingeFor = (dh) => dh <= 900 ? 2 : dh <= 1500 ? 3 : dh <= 2000 ? 4 : 5;
  const hingesTotal = leaves.reduce((a, r) => a + hingeFor(r.y1 - r.y0), 0);
  const hingesPerDoor = doorCount ? Math.round(hingesTotal / doorCount) : 0;
  const lines = [
    { item: `Sheet ${fmt(S.sheet.w)}×${fmt(S.sheet.h)} ${S.unit}`, qty: sheets, unit: 'sheet', unitCost: p.sheet },
    { item: 'Edge banding tape', qty: +tapeM.toFixed(2), unit: 'm', unitCost: p.tapePerM },
    { item: `Hinges (~${hingesPerDoor}/door)`, qty: hingesTotal, unit: 'ea', unitCost: p.hinge },
    { item: 'Handles', qty: doorCount, unit: 'ea', unitCost: p.handle },
    { item: 'Shelf pins', qty: shelfCount * 4, unit: 'ea', unitCost: p.shelfPin },
    { item: 'Screws / fixings', qty: job ? JOB.modules.length : 1, unit: 'cabinet', unitCost: p.screwsPerCabinet },
  ].filter(l => l.qty > 0).map(l => ({ ...l, lineCost: +(l.qty * l.unitCost).toFixed(2) }));
  return {
    currency: opts.currency || 'GBP', lines,
    total: +lines.reduce((a, l) => a + l.lineCost, 0).toFixed(2),
    assumptions: { sheets, hingesPerDoor, shelfPinsPerShelf: 4, edgeTapeM: +tapeM.toFixed(2) },
  };
}
window.Cabinet = {
  getState: aiGetState, getCutList: aiGetCutList, getJobCutList: aiGetJobCutList, estimateBOM: aiEstimateBOM,
  setDimensions: aiSetDimensions, applyPreset: aiApplyPreset, setDoors: aiSetDoors,
  addShelves: aiAddShelves, addVerticals: aiAddVerticals, clearComponents: aiClearComponents,
  setSheet: aiSetSheet, setGrainLock: aiSetGrainLock, setBanding: aiSetBanding,
};

// Module bar: switch / add / delete / rename
$('module-bar').addEventListener('click', (e) => {
  const del = e.target.closest('.mod-x');
  if (del) { e.stopPropagation(); deleteModule(parseInt(del.dataset.del, 10)); return; }
  const edit = e.target.closest('.mod-edit');
  if (edit) { e.stopPropagation(); renameModule(parseInt(edit.dataset.edit, 10)); return; }
  if (e.target.closest('#mod-add')) { openAddModulePanel(); return; }
  const chip = e.target.closest('.mod-chip');
  if (chip) switchTo(parseInt(chip.dataset.mi, 10));
});
$('module-bar').addEventListener('dblclick', (e) => {
  const chip = e.target.closest('.mod-chip'); if (!chip) return;
  renameModule(parseInt(chip.dataset.mi, 10));
});
$('mod-add-confirm').addEventListener('click', confirmAddModule);
$('mod-add-cancel').addEventListener('click', closeAddModulePanel);
$('module-add-panel').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); confirmAddModule(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeAddModulePanel(); }
});

// Cut-list / sheet scope: this module vs the whole job
function setCutScope(s) {
  cutScope = (s === 'job') ? 'job' : 'module';
  $('scope-module').classList.toggle('active', cutScope === 'module');
  $('scope-job').classList.toggle('active', cutScope === 'job');
  render();
}
$('scope-module').addEventListener('click', () => setCutScope('module'));
$('scope-job').addEventListener('click', () => setCutScope('job'));

// ---------- Boot ----------
// Build tag shown IN THE APP (bottom-right) so anyone can confirm the loaded version without the console.
const BUILD = 'tape-warn';
(() => {
  const el = document.createElement('div'); el.id = 'build-badge'; el.textContent = 'build · ' + BUILD; el.title = 'App build';
  el.style.cssText = 'position:fixed;right:8px;bottom:6px;z-index:60;font:11px system-ui,sans-serif;color:var(--muted,#9aa3b2);opacity:.55;pointer-events:none;user-select:none';
  document.body.appendChild(el);
})();
buildBandGrid(); renderModuleBar(); syncInputs(); render();
