/* Cabinet & Cupboard Cut List — vanilla prototype (zero dependency)
   Design (2D drag + 3D orbit/pick) · Sizes · Cutlist · Sheet nesting
   Nested cell-bounded shelves/dividers · per-edge banding · doors · exploded 3D · on-canvas units.
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
  ['Divider', 'Dividers'], ['Door', 'Doors'], ['Back', 'Back'],
];
const EDGES = ['L1', 'L2', 'W1', 'W2'];   // L edges run along length, W edges along width

const defaultBand = () => ({
  Side: { L1: true }, TopBottom: { L1: true }, Shelf: { L1: true }, Divider: { L1: true },
  Door: { L1: true, L2: true, W1: true, W2: true }, Back: {},
});

const DEFAULTS = () => ({
  unit: 'mm',
  preset: 'custom',
  cab: { w: 1200, h: 2400, d: 580, t: 20, back: true },
  backPanel: { type: 'groove', thickness: 6, groove: 8, setback: 12 },   // type: groove | rabbet | overlay
  comps: [],                 // {id,type:'shelf'|'divider',pos, a0,a1}  span: shelf=x-range, divider=y-range
  doors: { reveal: 2 },   // reveal is the global gap; door fronts are now cell-bound components
  sheet: { w: 2440, h: 1220, kerf: 3.2 },
  grainLock: false,
  band: defaultBand(),
  viewMode: '2d',
  cam: { yaw: -0.65, pitch: 0.5 },
  explode: 0,
  showDims: false,           // 3D measurement labels — default off, user can switch on per 3D session
  zoom: 1, pan: { x: 0, y: 0 },   // 2D view zoom + pan
  zoom3d: 1,                      // 3D view zoom
  lastPoint: null,           // mm point used as insertion cell anchor
  selectedId: null,
  _seq: 1,
});

let S = DEFAULTS();
const MM_PER_IN = 25.4;

// ---------- Refs ----------
const $ = (id) => document.getElementById(id);
const inW = $('in-w'), inH = $('in-h'), inD = $('in-d'), inT = $('in-t'), inBack = $('in-back');
const inSW = $('in-sw'), inSH = $('in-sh'), inKerf = $('in-kerf'), inGrain = $('in-grain'), inPreset = $('in-preset');
const inReveal = $('in-reveal'), inExplode = $('in-explode'), inDims = $('in-dims');
const inBackType = $('in-back-type'), inBackThk = $('in-back-thk'), inBackGroove = $('in-back-groove'), inBackSetback = $('in-back-setback');
const designCanvas = $('design-canvas'), sheetCanvas = $('sheet-canvas');
const dctx = designCanvas.getContext('2d');
const sctx = sheetCanvas.getContext('2d');
const btnDelete = $('btn-delete');

// ---------- Units ----------
const toDisp = (mm) => S.unit === 'mm' ? mm : mm / MM_PER_IN;
const toMM = (v) => S.unit === 'mm' ? v : v * MM_PER_IN;
const fmt = (mm) => S.unit === 'mm' ? Math.round(toDisp(mm)).toString() : toDisp(mm).toFixed(3);
const fmtU = (mm) => `${fmt(mm)} ${S.unit}`;
const unitStep = () => S.unit === 'mm' ? 1 : 0.125;

// ---------- Banding helpers ----------
const edgeOn = (key, e) => !!(S.band[key] && S.band[key][e]);
const bandNotation = (key) => { const on = EDGES.filter(e => edgeOn(key, e)); return on.length ? on.join(',') : '—'; };
const bandLen = (key, length, width) =>
  (edgeOn(key, 'L1') ? length : 0) + (edgeOn(key, 'L2') ? length : 0) +
  (edgeOn(key, 'W1') ? width : 0) + (edgeOn(key, 'W2') ? width : 0);

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

// Effective depth (board width) of a shelf/divider: its own override, else the usable depth (cabinet depth minus the back recess).
const compDepth = (c) => c.depth != null ? Math.max(1, Math.min(c.depth, S.cab.d)) : Math.max(1, S.cab.d - backFront());

// ---------- Geometry: cells, spans, segments ----------
function normalizeComps() {
  const { w, h, t } = S.cab;
  for (const c of S.comps) {
    if (c.type === 'drawer' || c.type === 'door') continue;
    if (c.a0 == null || c.a1 == null) {
      if (c.type === 'shelf') { c.a0 = t; c.a1 = w - t; } else { c.a0 = t; c.a1 = h - t; }
    }
  }
}
// Cell (rectangle) containing point P, bounded by parts whose span crosses P. Excludes excludeId.
function cellAt(px, py, excludeId) {
  const { w, h, t } = S.cab;
  let left = t, right = w - t, bottom = t, top = h - t;
  for (const c of S.comps) {
    if (c.id === excludeId) continue;
    if (c.type === 'divider' && c.a0 <= py && py <= c.a1) {
      if (c.pos <= px) left = Math.max(left, c.pos + t / 2); else right = Math.min(right, c.pos - t / 2);
    } else if (c.type === 'shelf' && c.a0 <= px && px <= c.a1) {
      if (c.pos <= py) bottom = Math.max(bottom, c.pos + t / 2); else top = Math.min(top, c.pos - t / 2);
    }
  }
  return { left, right, bottom, top };
}
// Split [a0,a1] at cut centres (each consuming thickness t). Returns segments {lo,hi,len}.
function splitSegments(a0, a1, cutCentres) {
  const t = S.cab.t;
  const cuts = cutCentres.filter(c => c > a0 && c < a1).sort((x, y) => x - y);
  const segs = []; let cur = a0;
  for (const cx of cuts) { const lo = cx - t / 2; if (lo > cur) segs.push({ lo: cur, hi: lo, len: lo - cur }); cur = cx + t / 2; }
  if (a1 > cur) segs.push({ lo: cur, hi: a1, len: a1 - cur });
  return segs.filter(s => s.len > 0.5);
}
const shelfSegments = (c) =>
  splitSegments(c.a0, c.a1, S.comps.filter(d => d.type === 'divider' && d.a0 <= c.pos && c.pos <= d.a1).map(d => d.pos));
const dividerSegments = (c) =>
  splitSegments(c.a0, c.a1, S.comps.filter(s => s.type === 'shelf' && s.a0 <= c.pos && c.pos <= s.a1).map(s => s.pos));

// ---------- Doors (cell-bound component, like drawers) ----------
// A door component fills the cell at its anchor with 1 or 2 leaves (count), inset by the reveal gap.
function doorRectsFor(c) {
  const g = S.doors.reveal, cell = cellAt(c.ax, c.ay, null);
  const x0 = cell.left + g / 2, x1 = cell.right - g / 2, y0 = cell.bottom + g / 2, y1 = cell.top - g / 2;
  if ((c.count | 0) === 2) { const mid = (x0 + x1) / 2; return [{ x0, x1: mid - g / 2, y0, y1, id: c.id, side: 'L' }, { x0: mid + g / 2, x1, y0, y1, id: c.id, side: 'R' }]; }
  return [{ x0, x1, y0, y1, id: c.id, side: '1' }];
}
function doorRects() { const out = []; for (const c of S.comps) if (c.type === 'door') for (const r of doorRectsFor(c)) out.push(r); return out; }

// ---------- Drawers ----------
// A drawer component fills the cell at its anchor (bounded by surrounding shelves/dividers) with `count` stacked fronts.
const DRAWER = { gap: 3, sideClear: 13, boxHeadClear: 40 };   // mm: reveal around fronts, runner clearance per side, box height clearance
const drawerCell = (c) => cellAt(c.ax, c.ay, null);           // cell is bounded by shelves/dividers, not by drawers
function drawerParts(c) {
  const t = S.cab.t, cell = drawerCell(c);
  const Wc = cell.right - cell.left, Hc = cell.top - cell.bottom;
  const n = Math.max(1, c.count | 0), band = Hc / n, depth = compDepth(c), g = DRAWER.gap;
  const boxOuterW = Math.max(1, Wc - 2 * DRAWER.sideClear), boxInnerW = Math.max(1, boxOuterW - 2 * t);
  const boxH = Math.max(1, band - DRAWER.boxHeadClear);
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push({ name: 'Drawer front', key: 'Door', length: Math.max(1, band - g), width: Math.max(1, Wc - g) });
    parts.push({ name: 'Drawer side', key: 'DrawerBox', length: depth, width: boxH });
    parts.push({ name: 'Drawer side', key: 'DrawerBox', length: depth, width: boxH });
    parts.push({ name: 'Drawer back', key: 'DrawerBox', length: boxInnerW, width: boxH });
    parts.push({ name: 'Drawer bottom', key: 'DrawerBox', length: boxInnerW, width: depth });
  }
  return parts;
}

// ---------- Cut list ----------
function cutListInstances() {
  const { w, h, d, t, back } = S.cab;
  const innerW = Math.max(0, w - 2 * t);
  const items = [];
  const add = (name, key, length, width) => items.push({ name, key, length, width });
  add('Side', 'Side', h, d); add('Side', 'Side', h, d);
  add('Top / Bottom', 'TopBottom', innerW, d); add('Top / Bottom', 'TopBottom', innerW, d);
  if (back) { const g = backGeom(); add('Back', 'Back', g.L, g.W); }
  for (const c of S.comps) {
    if (c.type === 'shelf') for (const s of shelfSegments(c)) add('Shelf', 'Shelf', s.len, compDepth(c));
    else if (c.type === 'divider') for (const s of dividerSegments(c)) add('Divider', 'Divider', s.len, compDepth(c));
    else if (c.type === 'drawer') for (const p of drawerParts(c)) add(p.name, p.key, p.length, p.width);
  }
  for (const r of doorRects()) add('Door', 'Door', r.y1 - r.y0, r.x1 - r.x0);
  return items;
}
const groupKey = (it) => `${it.name}|${Math.round(it.length)}|${Math.round(it.width)}|${it.key}`;
function cutList() {
  const map = new Map();
  for (const it of cutListInstances()) {
    const k = groupKey(it);
    if (map.has(k)) map.get(k).qty++; else map.set(k, { ...it, qty: 1 });
  }
  return [...map.values()];
}
// Cut-list instances produced by the currently selected component or carcass face.
function instancesForSelection() {
  const id = S.selectedId; if (id == null) return [];
  if (typeof id === 'number') {
    const c = S.comps.find(x => x.id === id); if (!c) return [];
    if (c.type === 'drawer') return drawerParts(c).map(p => ({ name: p.name, key: p.key, length: p.length, width: p.width }));
    if (c.type === 'door') return doorRectsFor(c).map(r => ({ name: 'Door', key: 'Door', length: r.y1 - r.y0, width: r.x1 - r.x0 }));
    const d = compDepth(c);
    return (c.type === 'shelf' ? shelfSegments(c) : dividerSegments(c))
      .map(s => ({ name: c.type === 'shelf' ? 'Shelf' : 'Divider', key: c.type === 'shelf' ? 'Shelf' : 'Divider', length: s.len, width: d }));
  }
  const { w, h, d, t } = S.cab, innerW = Math.max(0, w - 2 * t);
  if (id === 'L' || id === 'R') return [{ name: 'Side', key: 'Side', length: h, width: d }];
  if (id === 'T' || id === 'B') return [{ name: 'Top / Bottom', key: 'TopBottom', length: innerW, width: d }];
  if (id === 'BK') { if (!S.cab.back) return []; const g = backGeom(); return [{ name: 'Back', key: 'Back', length: g.L, width: g.W }]; }
  if (id === 'DOOR' || id === 'DOORL' || id === 'DOORR') { const r = doorRects().find(r => r.id === id); return r ? [{ name: 'Door', key: 'Door', length: r.y1 - r.y0, width: r.x1 - r.x0 }] : []; }
  return [];
}
const selectedGroupKeys = () => new Set(instancesForSelection().map(groupKey));

function renderCutList() {
  const parts = cutList();
  const selKeys = selectedGroupKeys();
  const tbody = document.querySelector('#cutlist tbody');
  tbody.innerHTML = parts.map(p =>
    `<tr${selKeys.has(groupKey(p)) ? ' class="cl-selected"' : ''}><td>${p.name}</td><td>${p.qty}</td><td>${fmt(p.length)}</td><td>${fmt(p.width)}</td><td>${bandNotation(p.key)}</td></tr>`
  ).join('');
  const ths = document.querySelectorAll('#cutlist thead th');
  ths[2].textContent = `Length (${S.unit})`; ths[3].textContent = `Width (${S.unit})`;

  const totalParts = parts.reduce((n, p) => n + p.qty, 0);
  const areaMM2 = parts.reduce((a, p) => a + p.qty * p.length * p.width, 0);
  const tapeMM = parts.reduce((a, p) => a + p.qty * bandLen(p.key, p.length, p.width), 0);
  const pack = nest(cutListInstances());
  $('cutlist-summary').innerHTML =
    `Parts: <b>${totalParts}</b><br>Board area: <b>${(areaMM2 / 1e6).toFixed(3)} m²</b><br>` +
    `Edge tape: <b>${(tapeMM / 1000).toFixed(2)} m</b><br>` +
    `Sheets needed: <b>${pack.sheets.length}</b> · Utilisation: <b>${(Math.min(1, pack.utilisation) * 100).toFixed(1)}%</b>`;
  return pack;
}

// ---------- Sheet nesting (FFDH shelf packing) ----------
function nest(items) {
  const { w: SW, h: SH, kerf } = S.sheet, lock = S.grainLock;
  const rects = items.map(it => ({ name: it.name, len: it.length, wid: it.width }));
  rects.sort((a, b) => Math.max(b.len, b.wid) - Math.max(a.len, a.wid));
  const sheets = [];
  const newSheet = () => { const s = { levels: [], placements: [] }; sheets.push(s); return s; };
  const tryFootprint = (sheet, fw, fh) => {
    for (const lvl of sheet.levels) if (lvl.x + fw <= SW && fh <= lvl.h) { const p = { x: lvl.x, y: lvl.y, w: fw, h: fh }; lvl.x += fw + kerf; return p; }
    const top = sheet.levels.length ? (sheet.levels.at(-1).y + sheet.levels.at(-1).h + kerf) : 0;
    if (top + fh <= SH && fw <= SW) { sheet.levels.push({ y: top, h: fh, x: fw + kerf }); return { x: 0, y: top, w: fw, h: fh }; }
    return null;
  };
  const tryPlace = (sheet, r) => {
    let p = tryFootprint(sheet, r.len, r.wid); if (p) return { ...p, name: r.name, rot: false };
    if (lock) return null;
    p = tryFootprint(sheet, r.wid, r.len); if (p) return { ...p, name: r.name, rot: true };
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

// ---------- 2D design view ----------
function partRect(c) {
  const t = S.cab.t;
  if (c.type === 'shelf') return { x0: c.a0, x1: c.a1, y0: c.pos - t / 2, y1: c.pos + t / 2 };
  return { x0: c.pos - t / 2, x1: c.pos + t / 2, y0: c.a0, y1: c.a1 };
}
function clampComp(c) {
  const t = S.cab.t;
  if (c.type === 'drawer' || c.type === 'door') { c.ax = Math.max(t, Math.min(c.ax, S.cab.w - t)); c.ay = Math.max(t, Math.min(c.ay, S.cab.h - t)); return; }
  if (c.type === 'shelf') { const cell = cellAt((c.a0 + c.a1) / 2, c.pos, c.id); c.pos = Math.min(Math.max(c.pos, cell.bottom + t / 2), cell.top - t / 2); }
  else { const cell = cellAt(c.pos, (c.a0 + c.a1) / 2, c.id); c.pos = Math.min(Math.max(c.pos, cell.left + t / 2), cell.right - t / 2); }
}

function fitCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
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
  ctx.save(); ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const wpx = ctx.measureText(text).width + 8;
  ctx.translate(x, y); if (vertical) ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#262b33'; ctx.fillRect(-wpx / 2, -8, wpx, 16);
  ctx.fillStyle = '#f1e4ba'; ctx.fillText(text, 0, 0); ctx.restore();
}
// thin double-headed dimension arrows drawn BESIDE a part (not on it)
const DIMCOL = '#8a97a8';
const arrowH = (ctx, x, y, sign) => { ctx.moveTo(x, y); ctx.lineTo(x + sign * 5, y - 3); ctx.moveTo(x, y); ctx.lineTo(x + sign * 5, y + 3); };
const arrowV = (ctx, x, y, sign) => { ctx.moveTo(x, y); ctx.lineTo(x - 3, y + sign * 5); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + sign * 5); };
function hDim(ctx, x0mm, x1mm, ymm, sdir, valMM) {   // sdir -1 = arrow above part, +1 = below
  const half = (S.cab.t / 2) * view.scale, xA = sx(x0mm), xB = sx(x1mm);
  const nearEdge = sy(ymm) + sdir * half, lineY = nearEdge + sdir * 14;
  if (Math.abs(xB - xA) >= 18) {
    ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(xA, nearEdge); ctx.lineTo(xA, lineY);
    ctx.moveTo(xB, nearEdge); ctx.lineTo(xB, lineY);
    ctx.moveTo(xA, lineY); ctx.lineTo(xB, lineY);
    arrowH(ctx, xA, lineY, 1); arrowH(ctx, xB, lineY, -1);
    ctx.stroke();
  }
  dimLabel(ctx, fmtU(valMM), (xA + xB) / 2, lineY, false);
}
function vDim(ctx, y0mm, y1mm, xmm, sdir, valMM) {   // sdir +1 = arrow right of part, -1 = left
  const half = (S.cab.t / 2) * view.scale, yA = sy(y0mm), yB = sy(y1mm);
  const nearEdge = sx(xmm) + sdir * half, lineX = nearEdge + sdir * 14;
  if (Math.abs(yA - yB) >= 18) {
    ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(nearEdge, yA); ctx.lineTo(lineX, yA);
    ctx.moveTo(nearEdge, yB); ctx.lineTo(lineX, yB);
    ctx.moveTo(lineX, yA); ctx.lineTo(lineX, yB);
    arrowV(ctx, lineX, yA, 1); arrowV(ctx, lineX, yB, -1);
    ctx.stroke();
  }
  dimLabel(ctx, fmtU(valMM), lineX, (yA + yB) / 2, true);
}

// Unique opening cells (gaps bounded by parts), used by both 2D and 3D dimensioning.
function enumerateOpenings() {
  const { w, h, t } = S.cab;
  const xs = new Set([t, w - t]), ys = new Set([t, h - t]);
  for (const c of S.comps) {
    if (c.type === 'divider') { xs.add(c.pos - t / 2); xs.add(c.pos + t / 2); }
    else { ys.add(c.pos - t / 2); ys.add(c.pos + t / 2); }
  }
  const xa = [...xs].sort((a, b) => a - b), ya = [...ys].sort((a, b) => a - b), seen = new Set(), out = [];
  for (let i = 0; i < xa.length - 1; i++) {
    const mx = (xa[i] + xa[i + 1]) / 2;
    for (let j = 0; j < ya.length - 1; j++) {
      const cell = cellAt(mx, (ya[j] + ya[j + 1]) / 2, null);
      const sig = `${Math.round(cell.left)},${Math.round(cell.bottom)},${Math.round(cell.top)}`;
      if (seen.has(sig)) continue; seen.add(sig); out.push(cell);
    }
  }
  return out;
}

// Plain centred label with a background chip (used for 3D dims where rotation varies).
function label3D(text, x, y) {
  dctx.save(); dctx.font = '11px system-ui, sans-serif'; dctx.textAlign = 'center'; dctx.textBaseline = 'middle';
  const wpx = dctx.measureText(text).width + 8;
  dctx.fillStyle = '#262b33'; dctx.fillRect(x - wpx / 2, y - 8, wpx, 16);
  dctx.fillStyle = '#f1e4ba'; dctx.fillText(text, x, y); dctx.restore();
}

// Clear vertical opening height, drawn just inside the left edge of a cell.
function openingDim(ctx, yLoMM, yHiMM, xLeftMM) {
  const yA = sy(yLoMM), yB = sy(yHiMM);
  if (Math.abs(yA - yB) < 16) return;   // too small to label legibly
  const x = sx(xLeftMM) + 16;
  ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(x, yA); ctx.lineTo(x, yB);
  arrowV(ctx, x, yA, 1); arrowV(ctx, x, yB, -1);
  ctx.stroke();
  dimLabel(ctx, fmtU(yHiMM - yLoMM), x, (yA + yB) / 2, true);
}

function drawDrawer2D(c) {
  const cell = drawerCell(c), n = Math.max(1, c.count | 0), sel = c.id === S.selectedId;
  const band = (cell.top - cell.bottom) / n, g = DRAWER.gap;
  for (let i = 0; i < n; i++) {
    const y0 = cell.bottom + i * band + g / 2, y1 = cell.bottom + (i + 1) * band - g / 2;
    const r = { x0: cell.left + g / 2, x1: cell.right - g / 2, y0, y1 };
    fillRectMM(dctx, r, sel ? 'rgba(255,180,84,0.92)' : 'rgba(203,160,58,0.92)', sel ? '#ffd9a0' : '#f1e4ba');
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

  fillRectMM(dctx, { x0: t, x1: w - t, y0: t, y1: h - t }, '#222831', null);
  const wall = '#6b7686', wline = '#aeb7c6';
  fillRectMM(dctx, { x0: 0, x1: t, y0: 0, y1: h }, wall, wline);
  fillRectMM(dctx, { x0: w - t, x1: w, y0: 0, y1: h }, wall, wline);
  fillRectMM(dctx, { x0: t, x1: w - t, y0: 0, y1: t }, wall, wline);
  fillRectMM(dctx, { x0: t, x1: w - t, y0: h - t, y1: h }, wall, wline);

  for (const c of S.comps) {
    if (c.type === 'drawer') continue;
    const sel = c.id === S.selectedId;
    fillRectMM(dctx, partRect(c), sel ? '#ffb454' : '#cba03a', sel ? '#ffd9a0' : '#f1e4ba');
  }
  for (const c of S.comps) if (c.type === 'drawer') drawDrawer2D(c);
  // dimension arrows BESIDE each part (shelf: above, divider: right)
  for (const c of S.comps) {
    if (c.type === 'shelf') for (const s of shelfSegments(c)) hDim(dctx, s.lo, s.hi, c.pos, -1, s.len);
    else if (c.type === 'divider') for (const s of dividerSegments(c)) vDim(dctx, s.lo, s.hi, c.pos, 1, s.len);
  }
  // clear opening heights between shelves (and floor/top), per cell
  if (S.comps.some(c => c.type === 'shelf'))
    for (const cell of enumerateOpenings()) openingDim(dctx, cell.bottom, cell.top, cell.left);

  // doors overlay (translucent so internals stay visible)
  for (const r of doorRects()) {
    const sel = r.id === S.selectedId;
    fillRectMM(dctx, r, sel ? 'rgba(255,180,84,0.30)' : 'rgba(190,160,105,0.22)', sel ? '#ffd9a0' : '#d9c08a');
    const hx = r.side === 'R' ? r.x0 + 18 : r.x1 - 18;   // handle near opening (meeting) edge
    dctx.fillStyle = sel ? '#ffd9a0' : '#d9c08a';
    dctx.fillRect(sx(hx) - 1.5, sy((r.y0 + r.y1) / 2) - 13, 3, 26);
  }

  dctx.fillStyle = '#9aa3b2'; dctx.font = '12px system-ui, sans-serif'; dctx.textAlign = 'center';
  dctx.fillText(`W ${fmtU(w)}`, sx(w / 2), view.oy - 22);
  dctx.save(); dctx.translate(view.ox - 30, sy(h / 2)); dctx.rotate(-Math.PI / 2);
  dctx.fillText(`H ${fmtU(h)}`, 0, 0); dctx.restore();
  dctx.textAlign = 'left'; dctx.fillText(`depth ${fmtU(S.cab.d)}`, 12, ch - 12);
}

// ---------- 3D preview ----------
function buildBoxes() {
  const { w, h, d, t, back } = S.cab;
  const wood = [196, 165, 110], backCol = [138, 107, 63], shelfCol = [185, 143, 87], divCol = [173, 130, 75], doorCol = [170, 140, 95];
  const boxes = [];
  const push = (x0, x1, y0, y1, z0, z1, base, id, alpha) => boxes.push({ x0, x1, y0, y1, z0, z1, base, id, alpha: alpha || 1 });
  push(0, t, 0, h, 0, d, wood, 'L'); push(w - t, w, 0, h, 0, d, wood, 'R');
  push(t, w - t, 0, t, 0, d, wood, 'B'); push(t, w - t, h - t, h, 0, d, wood, 'T');
  const bg = back ? backGeom() : null;
  const zF = bg ? bg.front : 0;
  if (bg) push(bg.x0, bg.x1, bg.y0, bg.y1, bg.z0, bg.z1, backCol, 'BK');
  for (const c of S.comps) {
    const z0 = Math.max(0, zF + (c.setback || 0));        // positioned from the back panel front face
    const z1 = Math.min(d, z0 + compDepth(c));
    if (c.type === 'shelf') for (const s of shelfSegments(c)) push(s.lo, s.hi, c.pos - t / 2, c.pos + t / 2, z0, z1, shelfCol, c.id);
    else if (c.type === 'divider') for (const s of dividerSegments(c)) push(c.pos - t / 2, c.pos + t / 2, s.lo, s.hi, z0, z1, divCol, c.id);
    else if (c.type === 'drawer') {
      const cell = drawerCell(c), n = Math.max(1, c.count | 0), band = (cell.top - cell.bottom) / n, g = DRAWER.gap;
      for (let i = 0; i < n; i++) push(cell.left + g / 2, cell.right - g / 2, cell.bottom + i * band + g / 2, cell.bottom + (i + 1) * band - g / 2, d, d + t, doorCol, c.id);
    }
  }
  for (const r of doorRects()) push(r.x0, r.x1, r.y0, r.y1, d, d + t, doorCol, r.id, 0.55);
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
  const offX = (cw - (maxX + minX) * scale) / 2, offY = (ch + (maxY + minY) * scale) / 2;
  const proj = (p) => [offX + p[0] * scale, offY - p[1] * scale];

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
    dim3([w, 0, d], [w, 0, 0], [0, -OFF, 0], fmtU(d));   // depth  — right bottom, below
    // opening heights along the front-left edge (mirrors the 2D view, left column)
    if (S.comps.some(c => c.type === 'shelf'))
      for (const cell of enumerateOpenings())
        if (Math.round(cell.left) === Math.round(S.cab.t))
          dim3([0, cell.bottom, d], [0, cell.top, d], [-OFF, 0, 0], fmtU(cell.top - cell.bottom));
  }

  dctx.fillStyle = '#9aa3b2'; dctx.font = '12px system-ui, sans-serif'; dctx.textAlign = 'left';
  dctx.fillText(`3D · drag to orbit · click a face to select · ${fmtU(w)} × ${fmtU(h)} × ${fmtU(d)}`, 12, ch - 12);
}

// ---------- Sheet view ----------
function drawPlacement(ctx, p, ox, oy, scale, showText) {
  const px = ox + p.x * scale, py = oy + p.y * scale, pw = p.w * scale, ph = p.h * scale;
  ctx.fillStyle = '#3a78d6'; ctx.fillRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.strokeStyle = '#f1e4ba'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  ctx.strokeStyle = 'rgba(207,224,255,0.30)'; ctx.beginPath();
  if (p.rot) { for (let gx = px + pw / 4; gx < px + pw; gx += pw / 4) { ctx.moveTo(gx, py + 3); ctx.lineTo(gx, py + ph - 3); } }
  else { for (let gy = py + ph / 4; gy < py + ph; gy += ph / 4) { ctx.moveTo(px + 3, gy); ctx.lineTo(px + pw - 3, gy); } }
  ctx.stroke();
  if (showText && pw > 40 && ph > 18) {
    ctx.fillStyle = '#fbf3da'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`${p.name[0]} ${fmt(p.rot ? p.h : p.w)}`, px + pw / 2, py + ph / 2); ctx.textBaseline = 'alphabetic';
  } else if (showText && pw > 14 && ph > 12) {
    ctx.fillStyle = '#fbf3da'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.name[0], px + pw / 2, py + ph / 2); ctx.textBaseline = 'alphabetic';
  }
}
function renderSheet(pack) {
  const { cw, ch } = fitCanvas(sheetCanvas, sctx);
  sctx.clearRect(0, 0, cw, ch);
  const sheets = pack.sheets;
  if (!sheets.length) { sctx.fillStyle = '#9aa3b2'; sctx.font = '14px system-ui'; sctx.textAlign = 'center'; sctx.fillText('No parts to nest.', cw / 2, ch / 2); sctx.textAlign = 'left'; return; }
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
    sheet.placements.forEach(p => drawPlacement(sctx, p, x, y, scale, true));
    sctx.fillStyle = '#9aa3b2'; sctx.textAlign = 'left'; sctx.textBaseline = 'alphabetic'; sctx.fillText(`Sheet ${i + 1}`, x, y + dh + 13);
  });
}

// ---------- Master render ----------
function render() {
  const pack = renderCutList();
  const designActive = designCanvas.classList.contains('active');
  if (designActive) (S.viewMode === '3d' ? renderDesign3D : renderDesign)();
  if (sheetCanvas.classList.contains('active')) renderSheet(pack);
  $('view-toggle').classList.toggle('hidden', !designActive);
  $('zoom-ctl').classList.toggle('hidden', !designActive);
  $('explode-wrap').classList.toggle('hidden', !(designActive && S.viewMode === '3d'));
  $('dims-wrap').classList.toggle('hidden', !(designActive && S.viewMode === '3d'));
  btnDelete.disabled = typeof S.selectedId !== 'number';
  renderSelectionPanel(); syncBackUI();
  const sheetActive = sheetCanvas.classList.contains('active');
  $('sheet-stats').classList.toggle('hidden', !sheetActive);
  if (sheetActive) $('sheet-stats').innerHTML =
    `<b>${pack.sheets.length}</b> sheet(s) of ${fmt(S.sheet.w)}×${fmt(S.sheet.h)} ${S.unit} · kerf ${fmtU(S.sheet.kerf)} · ` +
    `utilisation <b>${(Math.min(1, pack.utilisation) * 100).toFixed(1)}%</b> · grain <b>${S.grainLock ? 'locked' : 'free'}</b>`;
}

// ---------- Banding grid UI ----------
function buildBandGrid() {
  let html = '<span></span>' + EDGES.map(e => `<span class="bh">${e}</span>`).join('');
  for (const [key, label] of PART_TYPES)
    html += `<span class="rl">${label}</span>` + EDGES.map(e => `<span class="bc"><input type="checkbox" data-key="${key}" data-edge="${e}"></span>`).join('');
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
  inReveal.value = fmt(S.doors.reveal); inExplode.value = S.explode; inDims.checked = S.showDims;
  inBackType.value = S.backPanel.type; inBackThk.value = fmt(S.backPanel.thickness);
  inBackGroove.value = fmt(S.backPanel.groove); inBackSetback.value = fmt(S.backPanel.setback);
  const step = unitStep(); [inW, inH, inD, inT, inSW, inSH, inBackThk, inBackGroove, inBackSetback].forEach(el => el.step = step);
  inKerf.step = S.unit === 'mm' ? 0.1 : 0.01; inReveal.step = S.unit === 'mm' ? 0.5 : 0.01;
  $('unit-mm').classList.toggle('active', S.unit === 'mm'); $('unit-in').classList.toggle('active', S.unit === 'in');
  $('v2d').classList.toggle('active', S.viewMode !== '3d'); $('v3d').classList.toggle('active', S.viewMode === '3d');
  document.querySelectorAll('.unit-label').forEach(el => el.textContent = `(${S.unit})`);
  syncBandGrid(); syncBackUI();
}
function syncBackUI() {
  const overlay = S.backPanel.type === 'overlay';
  $('card-back').classList.toggle('hidden', !S.cab.back);
  $('lbl-back-groove').classList.toggle('hidden', overlay);
  $('lbl-back-setback').classList.toggle('hidden', overlay);
}
function readInputs() {
  S.cab.w = Math.max(1, toMM(parseFloat(inW.value) || 0)); S.cab.h = Math.max(1, toMM(parseFloat(inH.value) || 0));
  S.cab.d = Math.max(1, toMM(parseFloat(inD.value) || 0)); S.cab.t = Math.max(1, toMM(parseFloat(inT.value) || 0));
  S.cab.back = inBack.checked;
  S.sheet.w = Math.max(1, toMM(parseFloat(inSW.value) || 0)); S.sheet.h = Math.max(1, toMM(parseFloat(inSH.value) || 0));
  S.sheet.kerf = Math.max(0, toMM(parseFloat(inKerf.value) || 0));
  // keep spans inside the (possibly resized) carcass
  for (const c of S.comps) { if (c.type === 'shelf' || c.type === 'divider') { const lim = c.type === 'shelf' ? S.cab.w - S.cab.t : S.cab.h - S.cab.t; c.a0 = Math.max(S.cab.t, Math.min(c.a0, lim)); c.a1 = Math.max(c.a0, Math.min(c.a1, lim)); } if (c.depth != null) c.depth = Math.min(c.depth, S.cab.d); if (c.setback != null) c.setback = Math.min(c.setback, S.cab.d); clampComp(c); }
  render();
}

// ---------- Component actions ----------
function addComp(type) {
  const { w, h, t } = S.cab;
  const p = S.lastPoint || { x: w / 2, y: h / 2 };
  if (type === 'drawer') { const c = { id: S._seq++, type: 'drawer', ax: p.x, ay: p.y, count: drawerCount() }; clampComp(c); S.comps.push(c); S.selectedId = c.id; render(); return; }
  if (type === 'door') { const c = { id: S._seq++, type: 'door', ax: p.x, ay: p.y, count: doorLeaves() }; clampComp(c); S.comps.push(c); S.selectedId = c.id; render(); return; }
  const cell = cellAt(p.x, p.y, null);
  const c = { id: S._seq++, type };
  if (type === 'shelf') { c.a0 = cell.left; c.a1 = cell.right; c.pos = (cell.bottom + cell.top) / 2; }
  else { c.a0 = cell.bottom; c.a1 = cell.top; c.pos = (cell.left + cell.right) / 2; }
  clampComp(c); S.comps.push(c); S.selectedId = c.id; render();
}
const drawerCount = () => { const v = parseInt(($('in-drawer-count') || {}).value, 10) || 3; return Math.max(1, Math.min(12, v)); };
const doorLeaves = () => (parseInt(($('in-door-leaves') || {}).value, 10) === 2 ? 2 : 1);
function deleteSelected() { if (S.selectedId != null) { if (typeof S.selectedId === 'number') S.comps = S.comps.filter(c => c.id !== S.selectedId); S.selectedId = null; render(); } }

// ---------- Selected-component editor ----------
// Fixed carcass/door parts (selected by clicking a face in 3D) have a string id; report their size read-only.
function carcassPartInfo(id) {
  const { w, h, d, t } = S.cab;
  if (id === 'L' || id === 'R') return { name: 'Side', length: h, width: d };
  if (id === 'T' || id === 'B') return { name: 'Top / Bottom', length: Math.max(0, w - 2 * t), width: d };
  if (id === 'BK') { if (!S.cab.back) return null; const g = backGeom(); return { name: 'Back', length: g.L, width: g.W }; }
  if (id === 'DOOR' || id === 'DOORL' || id === 'DOORR') { const r = doorRects().find(r => r.id === id); return r ? { name: 'Door', length: r.y1 - r.y0, width: r.x1 - r.x0 } : null; }
  return null;
}
let lastAnchor = 'center';   // resize anchor for the single Length/Height field
function renderSelectionPanel() {
  const card = $('card-selected'), fields = $('sel-fields'), derived = $('sel-derived'), actions = $('sel-actions'), title = $('sel-title');
  const id = S.selectedId;
  if (id == null) { card.classList.add('hidden'); fields.innerHTML = ''; return; }
  const u = S.unit, step = unitStep();
  const comp = typeof id === 'number' ? S.comps.find(c => c.id === id) : null;
  const row = (rid, label, val) => `<label class="sel-row"><span>${label}</span><input id="${rid}" type="number" step="${step}" value="${val}"></label>`;
  const sel = (v) => lastAnchor === v ? ' selected' : '';
  if (comp && comp.type === 'door') {
    const cell = cellAt(comp.ax, comp.ay, null), Wc = cell.right - cell.left, Hc = cell.top - cell.bottom, two = (comp.count | 0) === 2;
    title.innerHTML = `Door front <small>(${u})</small>`;
    fields.innerHTML =
      `<label class="sel-row"><span>Leaves</span><select id="sel-leaves"><option value="1"${two ? '' : ' selected'}>1 door</option><option value="2"${two ? ' selected' : ''}>2 doors</option></select></label>`;
    derived.textContent = `Opening ${fmtU(Wc)} × ${fmtU(Hc)} · reveal ${fmtU(S.doors.reveal)} (set in Fronts / doors).`;
    actions.classList.remove('hidden');
  } else if (comp && comp.type === 'drawer') {
    const cell = drawerCell(comp), Wc = cell.right - cell.left, Hc = cell.top - cell.bottom, n = Math.max(1, comp.count | 0);
    title.innerHTML = `Drawer bank <small>(${u})</small>`;
    fields.innerHTML =
      `<label class="sel-row"><span>Drawers</span><input id="sel-count" type="number" min="1" max="12" step="1" value="${comp.count}"></label>` +
      row('sel-depth', 'Box depth', fmt(compDepth(comp))) +
      row('sel-setback', 'Setback from back', fmt(comp.setback || 0));
    derived.textContent = `Opening ${fmtU(Wc)} × ${fmtU(Hc)} · ${n} front(s) ≈ ${fmtU(Hc / n - DRAWER.gap)} high each.`;
    actions.classList.remove('hidden');
  } else if (comp) {
    const isShelf = comp.type === 'shelf';
    title.innerHTML = `${isShelf ? 'Shelf' : 'Divider'} <small>(${u})</small>`;
    fields.innerHTML =
      row('sel-pos', isShelf ? 'Height' : 'Position', fmt(comp.pos)) +
      row('sel-len', isShelf ? 'Length' : 'Height', fmt(comp.a1 - comp.a0)) +
      row('sel-depth', 'Depth', fmt(compDepth(comp))) +
      row('sel-setback', 'Setback from back', fmt(comp.setback || 0)) +
      `<label class="sel-row"><span>Anchor</span><select id="sel-anchor">` +
        `<option value="start"${sel('start')}>${isShelf ? 'Left' : 'Bottom'}</option>` +
        `<option value="center"${sel('center')}>Center</option>` +
        `<option value="end"${sel('end')}>${isShelf ? 'Right' : 'Top'}</option></select></label>`;
    const segs = isShelf ? shelfSegments(comp) : dividerSegments(comp), usable = Math.max(1, S.cab.d - backFront());
    derived.textContent =
      (segs.length > 1 ? `Cut into ${segs.length} pieces · ` : '') +
      (comp.depth != null ? 'Custom depth' : `Depth = usable ${fmtU(usable)}`) +
      ` · Setback = gap from the back panel front face.`;
    actions.classList.remove('hidden');
  } else {
    const info = carcassPartInfo(id);
    if (!info) { card.classList.add('hidden'); fields.innerHTML = ''; return; }
    title.innerHTML = `${info.name} <small>(${u})</small>`;
    fields.innerHTML =
      `<div class="sel-ro">Length <b>${fmtU(info.length)}</b></div>` +
      `<div class="sel-ro">Width <b>${fmtU(info.width)}</b></div>` +
      `<div class="sel-ro">Thickness <b>${fmtU(S.cab.t)}</b></div>`;
    derived.textContent = 'Fixed part — change its size via the cabinet Sizes above.';
    actions.classList.add('hidden');
  }
  card.classList.remove('hidden');
}
function applySelectedEdit() {
  const c = typeof S.selectedId === 'number' ? S.comps.find(x => x.id === S.selectedId) : null;
  if (!c) return;
  const get = (rid) => { const el = $(rid); return el ? toMM(parseFloat(el.value) || 0) : 0; };
  if (c.type === 'door') { c.count = parseInt(($('sel-leaves') || {}).value, 10) === 2 ? 2 : 1; render(); return; }
  if (c.type === 'drawer') {
    const cnt = parseInt(($('sel-count') || {}).value, 10) || 1; c.count = Math.max(1, Math.min(12, cnt));
    const dep = get('sel-depth'); if (dep > 0 && Math.abs(dep - S.cab.d) > 0.5) c.depth = Math.max(1, Math.min(dep, S.cab.d)); else delete c.depth;
    const sb = get('sel-setback'); if (sb > 0.5) c.setback = Math.max(0, Math.min(sb, S.cab.d)); else delete c.setback;
    render(); return;
  }
  const { w, h, t } = S.cab, max = c.type === 'shelf' ? w - t : h - t;
  // Resize from Length + Anchor, measured against the component's current span.
  const anchor = ($('sel-anchor') || {}).value || lastAnchor; lastAnchor = anchor;
  let len = get('sel-len'); if (!(len > 0)) len = c.a1 - c.a0;
  let a0, a1;
  if (anchor === 'start') { a0 = c.a0; a1 = a0 + len; }            // left/bottom edge stays
  else if (anchor === 'end') { a1 = c.a1; a0 = a1 - len; }         // right/top edge stays
  else { const ctr = (c.a0 + c.a1) / 2; a0 = ctr - len / 2; a1 = ctr + len / 2; }   // midpoint stays
  a0 = Math.max(t, Math.min(a0, max - 1));
  a1 = Math.max(a0 + 1, Math.min(a1, max));
  c.a0 = a0; c.a1 = a1; c.pos = get('sel-pos');
  // Depth: store an override only when it differs from the cabinet depth; equal value clears it (follows cabinet).
  const depth = get('sel-depth');
  if (depth > 0 && Math.abs(depth - S.cab.d) > 0.5) c.depth = Math.max(1, Math.min(depth, S.cab.d));
  else delete c.depth;
  // Setback from the back panel front face (0 = sits against the back).
  const setback = get('sel-setback');
  if (setback > 0.5) c.setback = Math.max(0, Math.min(setback, S.cab.d)); else delete c.setback;
  clampComp(c); render();   // recalculates cut list, sheets, BOM
}

// ---------- Design interaction ----------
function canvasXY(e) { const r = designCanvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function eventToMM(e) { const { x, y } = canvasXY(e); return { mx: (x - view.ox) / view.scale, my: S.cab.h - (y - view.oy) / view.scale }; }
function hitTest(mx, my) {
  const tol = 6 / view.scale;
  for (let i = S.comps.length - 1; i >= 0; i--) {
    const c = S.comps[i];
    if (c.type === 'drawer' || c.type === 'door') { const cl = cellAt(c.ax, c.ay, null); if (mx >= cl.left && mx <= cl.right && my >= cl.bottom && my <= cl.top) return c; continue; }
    const r = partRect(c); if (mx >= r.x0 - tol && mx <= r.x1 + tol && my >= r.y0 - tol && my <= r.y1 + tol) return c;
  }
  return null;
}
let drag = null;
designCanvas.addEventListener('mousedown', (e) => {
  if (S.viewMode === '3d') { drag = { type: 'orbit', x: e.clientX, y: e.clientY, moved: 0 }; designCanvas.style.cursor = 'grabbing'; return; }
  const { mx, my } = eventToMM(e); S.lastPoint = { x: mx, y: my };
  const hit = hitTest(mx, my); S.selectedId = hit ? hit.id : null;
  if (hit) drag = { type: 'part', comp: hit };
  else drag = { type: 'pan', x: e.clientX, y: e.clientY };   // drag empty space to pan
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
  const { mx, my } = eventToMM(e); drag.comp.pos = drag.comp.type === 'shelf' ? my : mx; clampComp(drag.comp); render();
});
designCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
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

// ---------- Tabs / view ----------
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  designCanvas.classList.toggle('active', tab.dataset.tab === 'design');
  sheetCanvas.classList.toggle('active', tab.dataset.tab === 'sheet');
  render();
}));
function setViewMode(m) { S.viewMode = m; if (m === '3d') { S.showDims = false; inDims.checked = false; } $('v2d').classList.toggle('active', m === '2d'); $('v3d').classList.toggle('active', m === '3d'); designCanvas.style.cursor = 'grab'; render(); }
$('v2d').addEventListener('click', () => setViewMode('2d'));
$('v3d').addEventListener('click', () => setViewMode('3d'));
function zoomStep(f) {
  if (S.viewMode === '3d') { S.zoom3d = Math.max(0.3, Math.min(6, S.zoom3d * f)); render(); }
  else { const r = designCanvas.getBoundingClientRect(); zoom2DAt(r.width / 2, r.height / 2, f); }
}
$('zoom-in').addEventListener('click', () => zoomStep(1.2));
$('zoom-out').addEventListener('click', () => zoomStep(1 / 1.2));
$('zoom-fit').addEventListener('click', () => { S.zoom = 1; S.pan = { x: 0, y: 0 }; S.zoom3d = 1; render(); });

// ---------- Persistence ----------
const STORE_KEY = 'cabinet-cutlist-prototype';
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(S)); flash($('btn-save'), 'Saved'); }
function load() {
  const raw = localStorage.getItem(STORE_KEY); if (!raw) { flash($('btn-load'), 'Nothing saved'); return; }
  try { S = Object.assign(DEFAULTS(), JSON.parse(raw)); S.band = Object.assign(defaultBand(), S.band || {}); normalizeComps(); syncInputs(); render(); flash($('btn-load'), 'Loaded'); }
  catch { flash($('btn-load'), 'Load failed'); }
}
function reset() { S = DEFAULTS(); seedShelf(); syncInputs(); render(); }
function flash(btn, msg) { const old = btn.textContent; btn.textContent = msg; setTimeout(() => { btn.textContent = old; }, 1100); }

// ---------- Export ----------
function exportCSV() {
  const parts = cutList();
  const rows = [['Part', 'Qty', `Length (${S.unit})`, `Width (${S.unit})`, 'Banded edges']];
  parts.forEach(p => rows.push([p.name, p.qty, fmt(p.length), fmt(p.width), `"${bandNotation(p.key)}"`]));
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cutlist.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function exportPDF() {
  const pack = nest(cutListInstances()), parts = cutList();
  const scale = 680 / Math.max(pack.SW, pack.SH);
  const imgs = pack.sheets.map((sheet, i) => {
    const c = document.createElement('canvas'); c.width = Math.round(pack.SW * scale); c.height = Math.round(pack.SH * scale);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = '#333'; x.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    sheet.placements.forEach(p => drawPlacement(x, p, 0, 0, scale, true));
    return `<figure><img src="${c.toDataURL('image/png')}"/><figcaption>Sheet ${i + 1} — ${fmt(pack.SW)}×${fmt(pack.SH)} ${S.unit}</figcaption></figure>`;
  }).join('');
  const tape = parts.reduce((a, p) => a + p.qty * bandLen(p.key, p.length, p.width), 0) / 1000;
  const rows = parts.map(p => `<tr><td>${p.name}</td><td>${p.qty}</td><td>${fmt(p.length)}</td><td>${fmt(p.width)}</td><td>${bandNotation(p.key)}</td></tr>`).join('');
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Cut list</title><style>
    body{font:13px system-ui,sans-serif;color:#111;margin:24px}h1{font-size:18px}h2{font-size:14px;margin-top:24px}
    table{border-collapse:collapse;width:100%;max-width:560px}th,td{border:1px solid #999;padding:4px 8px;text-align:right}th:first-child,td:first-child{text-align:left}
    figure{margin:0 0 18px;page-break-inside:avoid}img{max-width:100%;border:1px solid #ccc}figcaption{color:#555;font-size:12px;margin-top:4px}@media print{button{display:none}}
  </style></head><body>
    <h1>Cabinet &amp; Cupboard — Cut List</h1>
    <p>Cabinet ${fmt(S.cab.w)}×${fmt(S.cab.h)}×${fmt(S.cab.d)} ${S.unit} · material ${fmtU(S.cab.t)} · doors ${doorRects().length} · grain ${S.grainLock ? 'locked' : 'free'} · edge tape ${tape.toFixed(2)} m</p>
    <table><thead><tr><th>Part</th><th>Qty</th><th>Length (${S.unit})</th><th>Width (${S.unit})</th><th>Edges</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Sheet layout — ${pack.sheets.length} sheet(s), utilisation ${(Math.min(1, pack.utilisation) * 100).toFixed(1)}%</h2>${imgs}
    <button onclick="window.print()">Print / Save as PDF</button></body></html>`);
  win.document.close(); setTimeout(() => win.print(), 350);
}

// ---------- Wire up ----------
[inW, inH, inD, inT, inSW, inSH, inKerf].forEach(el => el.addEventListener('input', () => { S.preset = 'custom'; inPreset.value = 'custom'; readInputs(); }));
inBack.addEventListener('change', readInputs);
function readBack() {
  S.backPanel.type = inBackType.value;
  S.backPanel.thickness = Math.max(1, toMM(parseFloat(inBackThk.value) || 0));
  S.backPanel.groove = Math.max(0, toMM(parseFloat(inBackGroove.value) || 0));
  S.backPanel.setback = Math.max(0, toMM(parseFloat(inBackSetback.value) || 0));
  syncBackUI(); render();
}
inBackType.addEventListener('change', readBack);
[inBackThk, inBackGroove, inBackSetback].forEach(el => el.addEventListener('input', readBack));
inGrain.addEventListener('change', () => { S.grainLock = inGrain.checked; render(); });
inPreset.addEventListener('change', () => { S.preset = inPreset.value; if (PRESETS[S.preset]) { Object.assign(S.cab, PRESETS[S.preset]); readInputs(); syncInputs(); } });
$('btn-add-door').addEventListener('click', () => addComp('door'));
inReveal.addEventListener('input', () => { S.doors.reveal = Math.max(0, toMM(parseFloat(inReveal.value) || 0)); render(); });
inExplode.addEventListener('input', () => { S.explode = parseFloat(inExplode.value) || 0; render(); });
inDims.addEventListener('change', () => { S.showDims = inDims.checked; render(); });
$('btn-add-shelf').addEventListener('click', () => addComp('shelf'));
$('btn-add-divider').addEventListener('click', () => addComp('divider'));
$('btn-add-drawer').addEventListener('click', () => addComp('drawer'));
btnDelete.addEventListener('click', deleteSelected);
$('sel-update').addEventListener('click', applySelectedEdit);
$('sel-delete').addEventListener('click', deleteSelected);
$('sel-fields').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applySelectedEdit(); } });
$('btn-save').addEventListener('click', save);
$('btn-load').addEventListener('click', load);
$('btn-reset').addEventListener('click', reset);
$('btn-export').addEventListener('click', exportCSV);
$('btn-pdf').addEventListener('click', exportPDF);
$('unit-mm').addEventListener('click', () => { if (S.unit !== 'mm') { S.unit = 'mm'; syncInputs(); render(); } });
$('unit-in').addEventListener('click', () => { if (S.unit !== 'in') { S.unit = 'in'; syncInputs(); render(); } });
window.addEventListener('resize', render);
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && typeof S.selectedId === 'number' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') { e.preventDefault(); deleteSelected(); }
});

// ---------- AI / programmatic API ----------
// A clean surface the chat "Design Copilot" agent calls as tools. All lengths in mm.
function clampAllComps() {
  for (const c of S.comps) {
    if (c.type === 'shelf' || c.type === 'divider') { const lim = c.type === 'shelf' ? S.cab.w - S.cab.t : S.cab.h - S.cab.t; c.a0 = Math.max(S.cab.t, Math.min(c.a0, lim)); c.a1 = Math.max(c.a0, Math.min(c.a1, lim)); }
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
  const { w, h, t } = S.cab, a0 = fromMM != null ? fromMM : t, a1 = toMM != null ? toMM : w - t;
  const lo = t, hi = h - t, n = Math.max(1, Math.min(50, count | 0));
  for (let k = 1; k <= n; k++) S.comps.push({ id: S._seq++, type: 'shelf', a0, a1, pos: lo + (hi - lo) * k / (n + 1) });
  S.selectedId = null; render(); return { ok: true, added: n };
}
function aiAddDividers(count, fromMM, toMM) {
  const { w, h, t } = S.cab, a0 = fromMM != null ? fromMM : t, a1 = toMM != null ? toMM : h - t;
  const lo = t, hi = w - t, n = Math.max(1, Math.min(50, count | 0));
  for (let k = 1; k <= n; k++) S.comps.push({ id: S._seq++, type: 'divider', a0, a1, pos: lo + (hi - lo) * k / (n + 1) });
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
    components: { shelves: S.comps.filter(c => c.type === 'shelf').length, dividers: S.comps.filter(c => c.type === 'divider').length },
    sheet: { width: S.sheet.w, height: S.sheet.h, kerf: S.sheet.kerf, grainLock: S.grainLock },
  };
}
function aiGetCutList() {
  const parts = cutList(), instances = cutListInstances(), pack = nest(instances);
  const areaMM2 = parts.reduce((a, p) => a + p.qty * p.length * p.width, 0);
  const tapeMM = parts.reduce((a, p) => a + p.qty * bandLen(p.key, p.length, p.width), 0);
  return {
    parts: parts.map(p => ({ name: p.name, qty: p.qty, length: Math.round(p.length), width: Math.round(p.width), edges: bandNotation(p.key) })),
    totals: {
      partCount: parts.reduce((n, p) => n + p.qty, 0),
      boardAreaM2: +(areaMM2 / 1e6).toFixed(3), edgeTapeM: +(tapeMM / 1000).toFixed(2),
      sheetsNeeded: pack.sheets.length, utilisationPct: +(Math.min(1, pack.utilisation) * 100).toFixed(1),
    },
  };
}
// Priced bill of materials with inferred hardware. Prices overridable; defaults in GBP.
function aiEstimateBOM(opts = {}) {
  const p = Object.assign({ sheet: 45, tapePerM: 0.8, hinge: 1.2, handle: 3, shelfPin: 0.1, screwsPerCabinet: 1.5 }, opts.prices || {});
  const parts = cutList(), instances = cutListInstances(), pack = nest(instances);
  const sheets = pack.sheets.length;
  const tapeM = parts.reduce((a, q) => a + q.qty * bandLen(q.key, q.length, q.width), 0) / 1000;
  const shelfCount = instances.filter(i => i.name === 'Shelf').length;
  const leaves = doorRects(), doorCount = leaves.length;
  const hingeFor = (dh) => dh <= 900 ? 2 : dh <= 1500 ? 3 : dh <= 2000 ? 4 : 5;
  const hingesTotal = leaves.reduce((a, r) => a + hingeFor(r.y1 - r.y0), 0);
  const hingesPerDoor = doorCount ? Math.round(hingesTotal / doorCount) : 0;
  const lines = [
    { item: `Sheet ${fmt(S.sheet.w)}×${fmt(S.sheet.h)} ${S.unit}`, qty: sheets, unit: 'sheet', unitCost: p.sheet },
    { item: 'Edge banding tape', qty: +tapeM.toFixed(2), unit: 'm', unitCost: p.tapePerM },
    { item: `Hinges (~${hingesPerDoor}/door)`, qty: hingesTotal, unit: 'ea', unitCost: p.hinge },
    { item: 'Handles', qty: doorCount, unit: 'ea', unitCost: p.handle },
    { item: 'Shelf pins', qty: shelfCount * 4, unit: 'ea', unitCost: p.shelfPin },
    { item: 'Screws / fixings', qty: 1, unit: 'cabinet', unitCost: p.screwsPerCabinet },
  ].filter(l => l.qty > 0).map(l => ({ ...l, lineCost: +(l.qty * l.unitCost).toFixed(2) }));
  return {
    currency: opts.currency || 'GBP', lines,
    total: +lines.reduce((a, l) => a + l.lineCost, 0).toFixed(2),
    assumptions: { sheets, hingesPerDoor, shelfPinsPerShelf: 4, edgeTapeM: +tapeM.toFixed(2) },
  };
}
window.Cabinet = {
  getState: aiGetState, getCutList: aiGetCutList, estimateBOM: aiEstimateBOM,
  setDimensions: aiSetDimensions, applyPreset: aiApplyPreset, setDoors: aiSetDoors,
  addShelves: aiAddShelves, addDividers: aiAddDividers, clearComponents: aiClearComponents,
  setSheet: aiSetSheet, setGrainLock: aiSetGrainLock, setBanding: aiSetBanding,
};

// ---------- Boot ----------
function seedShelf() { S.comps.push({ id: S._seq++, type: 'shelf', a0: S.cab.t, a1: S.cab.w - S.cab.t, pos: S.cab.h / 2 }); }
buildBandGrid(); seedShelf(); syncInputs(); render();
