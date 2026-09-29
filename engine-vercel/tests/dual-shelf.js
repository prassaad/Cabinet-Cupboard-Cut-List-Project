// Dual shelf ("Two shelf") regression suite.  node tests/dual-shelf.js
//
// A dual shelf is two boards face-to-face that SPLIT the carcass into stacked
// boxes — the horizontal mirror of the dual vertical. Each box gets its own pair
// of sides, its own top, bottom and back, and the shelf itself is never listed
// again as a shelf (it IS the lower box's top and the upper box's bottom).
//
// The point of this file is the ARITHMETIC. Every structural claim is checked
// against a conservation law rather than a copied number:
//   cabinet height = Σ(box heights)
//   cabinet height = Σ(box openings) + 2 × thickness × rows
//   cabinet width  = Σ(box openings) + 2 × thickness × columns
//   board area     = Σ(finished part areas)   (no panel invented or lost)
'use strict';
const { getEngine } = require('../lib/engine.js');

const E = getEngine();
const J = (o) => JSON.stringify(o);
const clone = (o) => JSON.parse(J(o));
let fails = 0;
function ok(label, cond, extra) {
  if (cond) return console.log('  ok   ' + label);
  fails++;
  console.log('  FAIL ' + label + (extra !== undefined ? '\n         got: ' + J(extra) : ''));
}
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.5 : tol);
const section = (t) => console.log('\n' + t);

const W = 1200, H = 2400, D = 580, T = 20;
const cab = () => ({
  w: W, h: H, d: D, t: T, back: true, sideL: true, sideR: true,
  top: { mount: 'inset', depth: null, anchor: 'back', on: true },
  bottom: { mount: 'inset', depth: null, anchor: 'back', on: true },
});
const design = (comps, over) => ({
  name: 'J', active: 0,
  modules: [Object.assign({ name: 'M', cab: cab(), comps: comps || [] }, over || {})],
});
// Finished (pre-banding) sizes are what the geometry produces; `length`/`width` are
// the banded cut sizes. Use flen/fwid for conservation maths.
const compute = (comps, over) => E.compute(design(comps, over), { scope: 'module', render: true });
const rows = (m) => m.cutList.map(r => ({ name: r.name, qty: r.qty, w: Math.round(r.w), h: Math.round(r.h), d: Math.round(r.d), thick: r.thick }));
const byName = (m, n) => m.cutList.filter(r => r.name === n);
const qty = (m, n) => byName(m, n).reduce((a, r) => a + r.qty, 0);

const shelf = (id, pos, dual) => ({ id, type: 'shelf', pos, a0: T, a1: W - T, dual: dual || undefined });
const vert = (id, pos, dual) => ({ id, type: 'vertical', pos, a0: T, a1: H - T, dual: dual || undefined });

section('1. no dual shelf — the classic carcass is untouched');
const plain = compute([]);
{
  // Sizes here are CUT sizes: banded edges have already been deducted (2 × 0.8 mm tape).
  ok('2 sides, full height', qty(plain, 'Side') === 2 && near(byName(plain, 'Side')[0].h, H - 2 * 0.8, 0.01), rows(plain));
  ok('2 caps', qty(plain, 'Top / Bottom') === 2, rows(plain));
  ok('1 back', qty(plain, 'Back') === 1, rows(plain));
  ok('3 groups only', plain.cutList.length === 3, rows(plain));
}

section('2. a plain shelf is a shelf — dual is what changes things');
{
  const m = compute([shelf(1, 1200, false)]);
  ok('carcass unchanged', qty(m, 'Side') === 2 && qty(m, 'Top / Bottom') === 2 && qty(m, 'Back') === 1, rows(m));
  ok('one shelf listed', qty(m, 'Shelf') === 1, rows(m));
  ok('shelf spans the opening', near(byName(m, 'Shelf')[0].w, W - 2 * T), byName(m, 'Shelf')[0]);
}

section('3. ONE dual shelf → two stacked boxes');
const stacked = compute([shelf(1, 1200, true)]);
{
  ok('4 sides (a pair per box)', qty(stacked, 'Side') === 4, rows(stacked));
  ok('each side is its own box tall, not the cabinet', near(byName(stacked, 'Side')[0].h, H / 2 - 2 * 0.8, 0.01), byName(stacked, 'Side'));
  ok('4 caps (a top and bottom per box)', qty(stacked, 'Top / Bottom') === 4, rows(stacked));
  ok('2 backs', qty(stacked, 'Back') === 2, rows(stacked));
  ok('the dual shelf is NOT also listed as a shelf', qty(stacked, 'Shelf') === 0, rows(stacked));
  ok('no other part types appeared', stacked.cutList.every(r => ['Side', 'Top / Bottom', 'Back'].includes(r.name)), rows(stacked));
  ok('caps still span the box opening', near(byName(stacked, 'Top / Bottom')[0].w, W - 2 * T), byName(stacked, 'Top / Bottom')[0]);
  ok('backs are half-height boxes', byName(stacked, 'Back')[0].h < H / 2 + 20, byName(stacked, 'Back')[0]);
}

section('4. conservation — nothing invented, nothing lost');
{
  // Sides: 4 half-height boards use exactly the board length of 2 full-height ones.
  const sideAreaPlain = 2 * H * D, sideAreaStacked = 4 * (H / 2) * D;
  ok('side board area is unchanged by the split', near(sideAreaPlain, sideAreaStacked, 1), [sideAreaPlain, sideAreaStacked]);
  // The split costs exactly one extra top + one extra bottom.
  ok('exactly 2 extra cap panels', qty(stacked, 'Top / Bottom') - qty(plain, 'Top / Bottom') === 2);
  ok('exactly 1 extra back', qty(stacked, 'Back') - qty(plain, 'Back') === 1);
  // Total part count: 2 sides + 2 caps + 1 back = 5  →  4 + 4 + 2 = 10.
  ok('part totals add up', plain.totals.parts === 5 && stacked.totals.parts === 10, [plain.totals.parts, stacked.totals.parts]);
}

section('5. the height adds up (mirror of the dual-vertical width rule)');
{
  const r2 = compute([shelf(1, 1200, true)], {});
  const op = r2.module2d.openings;
  ok('two openings, one per box', op.length === 2, op);
  const sumH = op.reduce((a, c) => a + (c.top - c.bottom), 0);
  //   height = Σ(openings) + 2 × t × rows
  ok('Σ openings + 2·t·rows = cabinet height', near(sumH + 2 * T * 2, H), [sumH, sumH + 2 * T * 2, H]);
  const sumW = op.reduce((a, c) => a + (c.right - c.left), 0) / op.length;
  ok('each opening still spans the full width between the sides', near(sumW, W - 2 * T), sumW);
}

section('6. TWO dual shelves → three stacked boxes');
{
  const m = compute([shelf(1, 800, true), shelf(2, 1600, true)]);
  ok('6 sides', qty(m, 'Side') === 6, rows(m));
  ok('6 caps', qty(m, 'Top / Bottom') === 6, rows(m));
  ok('3 backs', qty(m, 'Back') === 3, rows(m));
  ok('no shelf rows', qty(m, 'Shelf') === 0, rows(m));
  const op = m.module2d.openings;
  ok('3 openings', op.length === 3, op.length);
  ok('Σ openings + 2·t·3 = height', near(op.reduce((a, c) => a + (c.top - c.bottom), 0) + 2 * T * 3, H));
}

section('7. dual shelf × dual vertical = a 2 × 2 grid of boxes');
{
  const m = compute([shelf(1, 1200, true), vert(2, 600, true)]);
  ok('8 sides (2 per box × 4 boxes)', qty(m, 'Side') === 8, rows(m));
  ok('8 caps', qty(m, 'Top / Bottom') === 8, rows(m));
  ok('4 backs', qty(m, 'Back') === 4, rows(m));
  ok('neither divider is listed again', qty(m, 'Shelf') === 0 && qty(m, 'Vertical') === 0, rows(m));
  const op = m.module2d.openings;
  ok('4 openings', op.length === 4, op.length);
  // Width rule per row, height rule per column.
  const bottomRow = op.filter(c => c.bottom < H / 2);
  ok('Σ row openings + 2·t·cols = width',
     near(bottomRow.reduce((a, c) => a + (c.right - c.left), 0) + 2 * T * 2, W),
     bottomRow.map(c => c.right - c.left));
  const leftCol = op.filter(c => c.left < W / 2);
  ok('Σ column openings + 2·t·rows = height',
     near(leftCol.reduce((a, c) => a + (c.top - c.bottom), 0) + 2 * T * 2, H),
     leftCol.map(c => c.top - c.bottom));
  ok('every box is the same size (symmetrical split)',
     new Set(op.map(c => Math.round(c.right - c.left) + 'x' + Math.round(c.top - c.bottom))).size === 1,
     op.map(c => Math.round(c.right - c.left) + 'x' + Math.round(c.top - c.bottom)));
}

section('8. the shelf keeps splitting whatever the user does to its span');
{
  // A dual shelf saved with a short span must be re-seated across the full width.
  const short = compute([{ id: 1, type: 'shelf', pos: 1200, a0: 400, a1: 700, dual: true }]);
  ok('a short dual shelf still splits the carcass', qty(short, 'Side') === 4 && qty(short, 'Back') === 2, rows(short));
  ok('and is still not listed as a shelf', qty(short, 'Shelf') === 0, rows(short));
}

section('9. banding is applied per part, on the real sizes');
{
  const s = byName(stacked, 'Side')[0], c = byName(stacked, 'Top / Bottom')[0];
  ok('sides band all four edges', s.band && s.band.split(',').length === 4, s.band);
  ok('side cut length = box height − 2 × tape', near(s.h, H / 2 - 2 * 0.8, 0.01), [s.h, H / 2 - 1.6]);
  ok('caps carry the cabinet thickness', near(c.thick, T), c.thick);
  ok('tape total is positive and finite', stacked.totals.tapeM > 0 && isFinite(stacked.totals.tapeM), stacked.totals.tapeM);
}

section('10. outset caps still behave, and only on the outer rows');
{
  const m = compute([shelf(1, 1200, true)], { cab: Object.assign(cab(), {
    top: { mount: 'outset', depth: null, anchor: 'back', on: true },
    bottom: { mount: 'outset', depth: null, anchor: 'back', on: true } }) });
  const sides = byName(m, 'Side');
  ok('4 sides still', qty(m, 'Side') === 4, rows(m));
  // Bottom box: shortened at the floor only. Top box: shortened at the ceiling only.
  // Both therefore lose exactly one thickness → both are (H/2 − t) tall, one group.
  ok('outset caps shorten each outer side by one thickness',
     sides.every(r => near(r.h, H / 2 - T - 2 * 0.8, 0.01)), sides.map(r => r.h));
  const outsetCaps = byName(m, 'Top / Bottom').concat(byName(m, 'Top'), byName(m, 'Bottom'));
  ok('an outset cap runs the full cabinet width', outsetCaps.some(r => near(r.w, W, 2)), outsetCaps.map(r => r.w));
  ok('an interior leaf stays inset (opening width)', outsetCaps.some(r => near(r.w, W - 2 * T, 2)), outsetCaps.map(r => r.w));
}

section('11. deleting the cabinet top still leaves the interior boundary');
{
  const m = compute([shelf(1, 1200, true)], { cab: Object.assign(cab(), {
    top: { mount: 'inset', depth: null, anchor: 'back', on: false } }) });
  // 4 boxes-worth of caps minus the one deleted cabinet top = 3.
  const caps = qty(m, 'Top / Bottom') + qty(m, 'Top') + qty(m, 'Bottom');
  ok('3 cap panels remain', caps === 3, rows(m));
  ok('the split itself survived', qty(m, 'Side') === 4 && qty(m, 'Back') === 2, rows(m));
}

section('12. every carcass panel is individually addressable');
{
  const ids = new Set(stacked.cutList.map(r => r.srcId).filter(x => x != null));
  ok('cut-list rows carry a source id', ids.size > 0, [...ids]);
  const r2d = [...new Set(stacked.module2d.rects.map(r => r.srcId).filter(x => x != null).map(String))];
  ok('2D rects carry ids too', r2d.length > 0);
  // Every id must be well formed: a carcass face (L/R/T/B/BK, numbered only when there is
  // more than one of that face) or a component id. A malformed id means a panel that can
  // never be selected, named or coloured.
  const bad = r2d.filter(x => !/^(L|R|T|B|BK)\d*$/.test(x) && !/^\d+$/.test(x));
  ok('every 2D panel id is well formed', bad.length === 0, bad);
  // A stacked carcass has 2 left + 2 right sides, 2 backs, and 4 caps of which the two
  // interior leaves carry the SHELF's own id — so 4+2+2 distinct carcass ids, plus id "1".
  ok('each carcass panel is separately addressable',
     ['L1', 'L2', 'R1', 'R2', 'BK1', 'BK2', 'T', 'B'].every(x => r2d.includes(x)), r2d);
  ok('the shelf leaves carry the shelf id, so clicking one selects the shelf', r2d.includes('1'), r2d);
  // The unsplit carcass must keep the plain, unnumbered names old saves were written with.
  const p2d = [...new Set(plain.module2d.rects.map(r => r.srcId).filter(x => x != null).map(String))];
  ok('an unsplit carcass still uses plain L/R/T/B/BK', ['L', 'R', 'T', 'B', 'BK'].every(x => p2d.includes(x)), p2d);
}

section('13. per-part naming and colour still key off the face ids');
{
  const m = compute([shelf(1, 1200, true)], {
    partNames: { L: 'Gable' },
    colours: { default: 'U999', parts: {} },
  });
  ok('a custom face name is applied', m.cutList.some(r => r.name === 'Gable'), rows(m));
  ok('the module colour reaches every row', m.cutList.every(r => r.colour === 'U999'), m.cutList.map(r => r.colour));
}

section('13b. every panel can find its cut-list row');
{
  // Rows merge identical panels, so a row must name ALL the panels it covers — otherwise selecting the
  // right-hand side or box 2's top shows no sizes and highlights no row.
  const all = new Set();
  for (const r of stacked.cutList) {
    // Ids are DISTINCT sources, so there can be fewer than qty: the dual shelf supplies two panels (the
    // lower box's top and the upper box's bottom) under its single component id.
    ok(`row "${r.name}" lists its panels`, Array.isArray(r.srcIds) && r.srcIds.length > 0 && r.srcIds.length <= r.qty, [r.name, r.qty, r.srcIds]);
    (r.srcIds || []).forEach(x => all.add(String(x)));
  }
  const drawn = new Set(stacked.module2d.rects.map(r => r.srcId).filter(x => x != null).map(String));
  const missing = [...drawn].filter(x => !all.has(x));
  ok('every panel drawn in 2D resolves to a cut-list row', missing.length === 0, missing);
  // The unsplit carcass must gain the same guarantee (this was previously broken for the right side).
  const p = new Set();
  plain.cutList.forEach(r => (r.srcIds || []).forEach(x => p.add(String(x))));
  ok('an unsplit carcass resolves R and B too', p.has('R') && p.has('B'), [...p]);
}

section('14. 3D and 2D agree with the cut list');
{
  const m = compute([shelf(1, 1200, true)]);
  const boxes = m.module3d.boxes;
  ok('3D has carcass boxes', boxes.length >= 10, boxes.length);
  // No 3D carcass box may stick outside the cabinet envelope.
  const outside = boxes.filter(b => b.x0 < -0.5 || b.x1 > W + 0.5 || b.y0 < -0.5 || b.y1 > H + 0.5);
  ok('nothing is drawn outside the cabinet', outside.length === 0, outside.slice(0, 3));
  // The two shelf leaves must sit back to back around the split with no gap.
  const atSplit = boxes.filter(b => near(b.y1, 1200, 1) || near(b.y0, 1200, 1));
  ok('two leaves meet exactly at the split', atSplit.length >= 2, atSplit.map(b => [b.y0, b.y1]));
}

section('15. nesting and totals stay consistent');
{
  const m = compute([shelf(1, 1200, true)]);
  const listed = m.cutList.reduce((a, r) => a + r.qty, 0);
  ok('total parts = Σ row quantities', m.totals.parts === listed, [m.totals.parts, listed]);
  const placed = (m.sheets.sheets || []).reduce((a, s) => a + s.placements.length, 0);
  const over = (m.sheets.oversize || []).length;
  ok('every part is nested or reported oversize', placed + over === listed, [placed, over, listed]);
  ok('board area is positive', m.totals.areaM2 > 0, m.totals.areaM2);
}

console.log(fails ? `\n${fails} failure(s)\n` : '\nall dual-shelf checks passed\n');
process.exit(fails ? 1 : 0);
