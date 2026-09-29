// Wall designer regression suite.  node tests/wall-parity.js  (exit 1 on failure)
//
// Two jobs:
//   1. PARITY — a design saved before the Wall designer existed must produce a
//      byte-identical cut list, totals, sheet nesting and 2D render afterwards.
//      The wall is derived on read, so no saved project may shift by a millimetre.
//   2. BEHAVIOUR — the wall intents (place/add/tidy/resize) and the derived data
//      the thin client draws from (guides, issues, dimension chain).
'use strict';
const path = require('path');
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
const section = (t) => console.log('\n' + t);

const cab = (w, h, d) => ({
  w, h, d: d || 560, t: 18, back: true, sideL: true, sideR: true,
  top: { mount: 'inset', depth: null, anchor: 'back', on: true },
  bottom: { mount: 'inset', depth: null, anchor: 'back', on: true },
});

// A pre-wall (schema v1) job: no id, no type, no placement, no layout.
const LEGACY = {
  name: 'Kitchen', active: 0,
  modules: [
    { name: 'Sink run', preset: 'base', cab: cab(800, 720),
      comps: [{ id: 1, type: 'shelf', pos: 360, a0: 0, a1: 800 }] },
    { name: 'Larder', cab: cab(600, 2100),
      comps: [{ id: 1, type: 'vertical', pos: 300, a0: 0, a1: 2100 }] },
  ],
};

section('1. parity — a pre-wall design is untouched by the migration');
{
  const before = E.compute(clone(LEGACY), { scope: 'job', render: true });
  // Round-trip it through an edit so it comes back fully migrated, then re-derive.
  const migrated = E.edit(clone(LEGACY), 'rename_module', { index: 0, name: 'Sink run' }, 'job').design;
  const after = E.compute(clone(migrated), { scope: 'job', render: true });

  ok('cut list identical', J(before.cutList) === J(after.cutList));
  ok('totals identical', J(before.totals) === J(after.totals));
  ok('sheet nesting identical', J(before.sheets) === J(after.sheets));
  ok('2D render identical', J(before.module2d) === J(after.module2d));
  ok('3D boxes identical', J(before.module3d) === J(after.module3d));
  ok('cut list is not empty (the comparison means something)', before.cutList.length > 0, before.cutList.length);

  ok('migration added ids', migrated.modules.map((m) => m.id).join(',') === 'm1,m2', migrated.modules.map((m) => m.id));
  ok('type derived from the old preset', migrated.modules[0].type === 'base', migrated.modules[0].type);
  ok('type falls back to custom', migrated.modules[1].type === 'custom', migrated.modules[1].type);
  ok('schemaVersion stamped', migrated.schemaVersion === 2, migrated.schemaVersion);
  ok('modules laid out left to right', migrated.modules.map((m) => m.placement.offsetX).join(',') === '0,800',
     migrated.modules.map((m) => m.placement.offsetX));
}

section('2. unknown top-level keys survive an edit');
{
  const doc = Object.assign(clone(LEGACY), { customerRef: 'ACME-42' });
  const out = E.edit(doc, 'rename_module', { index: 0, name: 'x' }, 'job').design;
  ok('layout created', !!(out.layout && out.layout.runs[0].wall.w > 0), out.layout);
  ok('caller key preserved', out.customerRef === 'ACME-42', out.customerRef);
}

section('3. ids are stable and unique');
{
  let d = E.edit(clone(LEGACY), 'rename_module', { index: 0, name: 'x' }, 'job').design;
  const again = E.edit(clone(d), 'rename_module', { index: 1, name: 'y' }, 'job').design;
  ok('unchanged across edits', again.modules.map((m) => m.id).join(',') === 'm1,m2', again.modules.map((m) => m.id));

  const dup = clone(d); dup.modules[1].id = 'm1';
  const fixed = E.edit(dup, 'rename_module', { index: 0, name: 'x' }, 'job').design;
  ok('duplicate reassigned, first keeps it', fixed.modules.map((m) => m.id).join(',') === 'm1,m2', fixed.modules.map((m) => m.id));

  const del = E.edit(clone(d), 'delete_module', { index: 0 }, 'job').design;
  ok('survivor keeps its own id after a delete', del.modules[0].id === 'm2', del.modules.map((m) => m.id));
}

section('4. the wall');
{
  let d = E.edit(clone(LEGACY), 'set_wall', { w: 4000, h: 2400 }, 'job', { room: true, render: false });
  ok('stored on the design', d.design.layout.runs[0].wall.w === 4000, d.design.layout.runs[0].wall);
  ok('returned in the same trip as the edit', !!d.model.room, Object.keys(d.model));
  ok('render:false skips the module render', !d.model.module2d, Object.keys(d.model));
  ok('module records carry id/type/hidden', d.model.room.modules.every((m) => m.id && m.type && 'hidden' in m));
  ok('3D boxes carry their module id', d.model.room.boxes.every((b) => !!b.mid));

  const auto = E.compute(clone(LEGACY), { scope: 'job', room: true }).room;
  ok('an unsized wall is derived from its contents', auto.wall.w >= 1400 && auto.wall.h >= 2400, auto.wall);

  const empty = E.compute({ name: 'New', modules: [], active: -1 }, { scope: 'job', room: true, render: true });
  ok('an empty job still gets a wall to drop onto', empty.room && empty.room.wall.w === 3000, empty.room && empty.room.wall);
}

section('5. placing and snapping');
{
  const base = E.edit(clone(LEGACY), 'set_wall', { w: 4000 }, 'job').design;
  // "Sink run" occupies 0..800. Drop "Larder" 6mm shy of flush and 4mm off the floor.
  const r = E.edit(clone(base), 'place_module', { id: 'm2', offsetX: 806, baseHeight: 4 }, 'job', { room: true, render: false });
  ok('snapped flush to its neighbour', r.design.modules[1].placement.offsetX === 800, r.design.modules[1].placement);
  ok('snapped down to the floor', r.design.modules[1].placement.baseHeight === 0, r.design.modules[1].placement);
  ok('no errors once flush', r.model.room.issues.filter((i) => i.severity === 'error').length === 0, r.model.room.issues);

  const free = E.edit(clone(base), 'place_module', { id: 'm2', offsetX: 806, baseHeight: 4, snap: false }, 'job').design;
  ok('snap:false places exactly where asked', free.modules[1].placement.offsetX === 806 && free.modules[1].placement.baseHeight === 4,
     free.modules[1].placement);

  const tight = E.edit(clone(base), 'place_module', { id: 'm2', offsetX: 806, baseHeight: 4, tol: 1 }, 'job').design;
  ok('a tighter tolerance refuses the same snap', tight.modules[1].placement.offsetX === 806, tight.modules[1].placement);

  const guides = E.compute(clone(base), { scope: 'job', room: true }).room.guides;
  ok('guides name themselves for a layman', guides.some((g) => /Next to “Sink run”/.test(g.label)), guides.map((g) => g.label).slice(0, 12));
  ok('a guide never points at its own module for that module', guides.filter((g) => g.sourceId === 'm1').every((g) => /Sink run/.test(g.label)));
  ok('floor + standard wall height offered', guides.some((g) => g.kind === 'floor') && guides.some((g) => g.kind === 'standard-wall'));
}

section('6. problems, phrased for a layman');
{
  const base = E.edit(clone(LEGACY), 'set_wall', { w: 4000 }, 'job').design;
  const over = E.edit(clone(base), 'place_module', { id: 'm2', offsetX: 760, snap: false }, 'job', { room: true, render: false });
  const ov = over.model.room.issues.find((i) => i.kind === 'overlap');
  ok('overlap detected with the right amount', !!ov && ov.mm === 40, ov);
  ok('overlap names both units and says what to do', !!ov && /“Sink run” and “Larder” overlap by 40 mm — drag one apart\./.test(ov.message), ov && ov.message);
  ok('overlap carries the band to shade', !!ov && ov.x1 > ov.x0 && ov.y1 > ov.y0, ov);

  const past = E.edit(clone(base), 'place_module', { id: 'm2', offsetX: 3800, snap: false }, 'job', { room: true, render: false });
  ok('past the end of the wall is reported', past.model.room.issues.some((i) => i.kind === 'past-end'), past.model.room.issues.map((i) => i.kind));

  const short = E.edit(clone(base), 'set_wall', { h: 1000 }, 'job', { room: true, render: false });
  ok('too tall for the wall is reported', short.model.room.issues.some((i) => i.kind === 'too-tall'), short.model.room.issues.map((i) => i.message));

  const gapDoc = E.edit(clone(base), 'place_module', { id: 'm2', offsetX: 900, snap: false }, 'job', { room: true, render: false });
  const gap = gapDoc.model.room.issues.find((i) => i.kind === 'gap' && i.mm === 100);
  ok('a small gap suggests a filler', !!gap && /add a filler panel or widen a unit/.test(gap.message), gap && gap.message);
  ok('a big gap invites another unit', gapDoc.model.room.issues.some((i) => i.kind === 'gap' && i.severity === 'info'));
}

section('7. dimension chain');
{
  let d = E.edit(clone(LEGACY), 'set_wall', { w: 4000 }, 'job').design;
  d = E.edit(clone(d), 'add_module', { type: 'wall' }, 'job').design;   // lands at 1500
  const chain = E.compute(clone(d), { scope: 'job', room: true }).room.dimChain;
  ok('one chain per height band', chain.rows.length === 2, chain.rows.map((r) => r.band));
  for (const row of chain.rows) {
    ok(`band ${row.band}: segments span the whole wall`,
       row.segments.reduce((a, s) => a + s.mm, 0) === chain.wallW,
       row.segments.map((s) => s.kind + ':' + s.mm));
  }
  ok('modules are named in the chain', chain.rows[0].segments.some((s) => s.kind === 'module' && s.name === 'Sink run'));
  ok('the leftover at the end is flagged', chain.rows[0].segments.some((s) => s.kind === 'gap' && s.end));
}

section('8. adding units with zero typing');
{
  const empty = { name: 'New', modules: [], active: -1 };
  let d = E.edit(clone(empty), 'add_module', { type: 'base' }, 'job').design;
  ok('base unit sized from the preset', d.modules[0].cab.w === 600 && d.modules[0].cab.h === 720, d.modules[0].cab);
  ok('base unit sits on the floor at the left end', d.modules[0].placement.offsetX === 0 && d.modules[0].placement.baseHeight === 0,
     d.modules[0].placement);
  ok('named in plain language', d.modules[0].name === 'Base unit 1', d.modules[0].name);

  d = E.edit(clone(d), 'add_module', { type: 'base' }, 'job').design;
  ok('the next one parks beside it, not on it', d.modules[1].placement.offsetX === 600, d.modules[1].placement);

  d = E.edit(clone(d), 'add_module', { type: 'wall' }, 'job').design;
  ok('a wall unit hangs at the standard height', d.modules[2].placement.baseHeight === 1500, d.modules[2].placement);
  ok('and takes the free left end of its own band', d.modules[2].placement.offsetX === 0, d.modules[2].placement);
  ok('a preset never leaks onto the previous module', d.modules[0].cab.d === 560 && d.modules[2].cab.d === 320,
     [d.modules[0].cab.d, d.modules[2].cab.d]);

  const plain = E.edit(clone(empty), 'add_module', { name: 'Odd shape' }, 'job').design;
  ok('a bare add_module is unchanged (no preset applied)', plain.modules[0].cab.w === 1200 && plain.modules[0].name === 'Odd shape',
     [plain.modules[0].name, plain.modules[0].cab.w]);

  const typed = E.edit(clone(d), 'set_module_type', { id: d.modules[0].id, type: 'tall' }, 'job').design;
  ok('set_module_type resizes and re-hangs', typed.modules[0].cab.h === 2100 && typed.modules[0].type === 'tall',
     [typed.modules[0].cab.h, typed.modules[0].type]);
}

section('9. tidy up');
{
  let d = E.edit({ name: 'N', modules: [], active: -1 }, 'add_module', { type: 'base' }, 'job').design;
  d = E.edit(clone(d), 'add_module', { type: 'base' }, 'job').design;
  d = E.edit(clone(d), 'place_module', { id: 'm1', offsetX: 1500, snap: false }, 'job').design;
  d = E.edit(clone(d), 'place_module', { id: 'm2', offsetX: 2600, snap: false }, 'job').design;

  const packed = E.edit(clone(d), 'tidy_wall', { mode: 'pack' }, 'job', { room: true, render: false });
  ok('everything pushed together from the left', packed.design.modules.map((m) => m.placement.offsetX).join(',') === '0,600',
     packed.design.modules.map((m) => m.placement.offsetX));
  ok('no gaps left between units', !packed.model.room.dimChain.rows[0].segments.some((s) => s.kind === 'gap' && !s.end));

  const pin = clone(d); pin.modules[0].placement.pinned = true;
  const kept = E.edit(pin, 'tidy_wall', { mode: 'pack' }, 'job').design;
  ok('a pinned unit is left exactly where it was', kept.modules[0].placement.offsetX === 1500,
     kept.modules.map((m) => m.placement.offsetX));
}

section('10. visibility');
{
  let d = E.edit(clone(LEGACY), 'set_module_visible', { id: 'm2', visible: false }, 'job', { room: true, render: false });
  ok('one unit hidden', d.model.room.modules.find((m) => m.id === 'm2').hidden === true);
  ok('hidden units drop out of the dimension chain',
     !d.model.room.dimChain.rows.some((r) => r.segments.some((s) => s.name === 'Larder')),
     d.model.room.dimChain.rows.map((r) => r.segments.map((s) => s.name)));
  d = E.edit(clone(d.design), 'set_module_visible', { visible: true }, 'job', { room: true, render: false });
  ok('no id = all of them (the All button)', d.model.room.modules.every((m) => !m.hidden));
}

console.log(fails ? `\n${fails} failure(s)\n` : '\nall wall-parity checks passed\n');
process.exit(fails ? 1 : 0);
