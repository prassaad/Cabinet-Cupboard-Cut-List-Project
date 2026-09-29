/* Headless loader for the real cabinet engine.
 *
 * Loads the SAME prototype app.js the browser designer uses, but in Node with
 * the DOM/canvas stubbed out, and exposes its pure compute functions. This is
 * the "single engine" strategy: no re-port, no parity drift — the server runs
 * the exact code, and the browser bundle no longer needs to.
 *
 * The engine draws to a canvas during applyJob()/render(); we feed it a
 * universal no-op stub so those calls are harmless while the pure math (cut
 * list, nesting, BOM) runs for real.
 */
'use strict';
const fs = require('fs');

/** Universal no-op: every property is itself, callable/constructable, coerces to 0/"" and iterates empty. */
const any = new Proxy(function () {}, {
  get(_t, p) {
    if (p === Symbol.toPrimitive) return () => 0;
    if (p === Symbol.iterator) return function* () {};
    if (p === 'length') return 0;
    return any;
  },
  apply() { return any; },
  construct() { return any; },
  set() { return true; },
  has() { return true; },
});

function domGlobals() {
  return {
    document: any,
    window: any,
    navigator: any,
    location: any,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    matchMedia: () => any,
    getComputedStyle: () => any,
    Image: function () { return any; },
    Path2D: function () { return any; },
    alert() {}, confirm: () => false, prompt: () => null,
  };
}

/**
 * @param {string} appSrc  the contents of app.js
 * @returns engine API bound to fresh module state
 */
function loadEngine(appSrc) {
  const g = domGlobals();
  const names = Object.keys(g);

  // Appended inside app.js's own scope so it can see every top-level function
  // and the mutable JOB/S/cutScope bindings.
  // compute() runs inside app.js's scope, so it can freely use every internal
  // helper (bandLen, jobTotals, …). It mirrors what renderCutList/renderSheet
  // compute today, but returns DATA — the render model the client will draw.
  const footer = `
    ;function __render2d() {
      // Record every 2D rectangle the engine would DRAW (carcass, parts, drawers,
      // doors) in mm — by intercepting fillRectMM instead of painting. No geometry
      // is re-implemented; the real renderDesign() drives it. Label/overlay drawers
      // are silenced so only rectangles are captured and nothing can throw on the
      // stubbed canvas.
      var rects = [], curId = null;
      var origFill = fillRectMM, origPartRect = partRect;
      var hasDrawer = (typeof drawDrawer2D !== 'undefined');
      var origDrawer = hasDrawer ? drawDrawer2D : null;
      var saved = {};
      var silence = ['cellDim', 'drawerBoxDim', 'drawOverallDims', 'drawScaleBar', 'drawMeasureOverlay'];
      silence.forEach(function (n) { try { saved[n] = eval(n); eval(n + ' = function(){}'); } catch (e) {} });
      // Tag each captured rect with its source part id: partRect(c)/drawDrawer2D(c)
      // set the current id just before their fillRectMM calls; door rects carry .id.
      partRect = function (c) { curId = c ? c.id : null; return origPartRect(c); };
      if (hasDrawer) drawDrawer2D = function (c) { curId = c ? c.id : null; return origDrawer(c); };
      fillRectMM = function (ctx, r0, fill, stroke) {
        if (r0 && typeof r0.x0 === 'number') {
          rects.push({ x0: r0.x0, x1: r0.x1, y0: r0.y0, y1: r0.y1, fill: fill || null, stroke: stroke || null,
                       srcId: (r0.id != null ? r0.id : curId) });
        }
      };
      try { renderDesign(); } catch (e) { /* partial capture is fine */ }
      fillRectMM = origFill; partRect = origPartRect; if (hasDrawer) drawDrawer2D = origDrawer;
      silence.forEach(function (n) { try { if (saved[n] !== undefined) eval(n + ' = saved[n]'); } catch (e) {} });

      // Dimension labels (mm, y-up) computed cleanly from the opening rectangles
      // + overall size — so the thin client draws the same dims the prototype shows.
      var labels = [];
      try {
        var cw = S.cab.w, ch = S.cab.h, cells = enumerateOpenings();
        // fmt() is unit-aware (respects S.unit) — labels come pre-formatted.
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i];
          if (c.right - c.left > 60) labels.push({ text: fmt(c.right - c.left), x: (c.left + c.right) / 2, y: c.top, vertical: false });
          if (c.top - c.bottom > 60) labels.push({ text: fmt(c.top - c.bottom), x: c.left, y: (c.bottom + c.top) / 2, vertical: true });
        }
        labels.push({ text: fmt(cw), x: cw / 2, y: 0, vertical: false, overall: true });
        labels.push({ text: fmt(ch), x: 0, y: ch / 2, vertical: true, overall: true });
      } catch (e) {}
      var openings = [];
      try { openings = enumerateOpenings().map(function (c) { return { left: c.left, right: c.right, bottom: c.bottom, top: c.top }; }); } catch (e) {}
      var sides = null;
      try { sides = { height: sideHeight(), y0: sideY0(), y1: sideY1() }; } catch (e) {}
      // Carcass rects (sides/caps/back) are tagged at the source: renderDesign puts the part's own id on
      // each rect it draws, so the thin client can select them + cross-highlight from the cut list. A
      // carcass split by dual verticals has several tops/bottoms/backs, so geometry alone cannot identify
      // them — the id must come from the engine, never be guessed here.
      // Door + drawer handles (mm positions; the client draws them screen-space).
      var handles = [];
      try {
        var drs = doorRects();
        for (var hd = 0; hd < drs.length; hd++) { var hr = drs[hd]; handles.push({ kind: 'door', x: hr.side === 'R' ? hr.x0 + 18 : hr.x1 - 18, y: (hr.y0 + hr.y1) / 2 }); }
        for (var hc = 0; hc < S.comps.length; hc++) {
          if (S.comps[hc].type === 'drawer') { var hfs = drawerFascias(S.comps[hc]); for (var hf = 0; hf < hfs.length; hf++) handles.push({ kind: 'drawer', x: (hfs[hf].x0 + hfs[hf].x1) / 2, y: hfs[hf].y1 }); }
        }
      } catch (e) {}
      // Drawer box-outer width dimensions.
      var boxDims = [];
      try {
        for (var bd = 0; bd < S.comps.length; bd++) {
          if (S.comps[bd].type === 'drawer') { var bcell = drawerRect(S.comps[bd]), bx0 = bcell.left + DRAWER.sideClear, bx1 = bcell.right - DRAWER.sideClear; if (bx1 - bx0 > 1) boxDims.push({ x0: bx0, x1: bx1, y: (bcell.top + bcell.bottom) / 2 }); }
        }
      } catch (e) {}
      return { cab: { w: S.cab.w, h: S.cab.h, d: S.cab.d, t: S.cab.t }, rects: rects, labels: labels, openings: openings, sides: sides, handles: handles, boxDims: boxDims };
    }
    ;function __deepMerge(target, patch) {
      // Merge plain objects recursively; scalars/arrays replace. Used by the
      // generic 'patch' config op. (Banding uses set_banding to replace edges.)
      for (var k in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
        var v = patch[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
          __deepMerge(target[k], v);
        } else {
          target[k] = v;
        }
      }
      return target;
    }
    ;function __findModule(id) {
      // Modules are addressed by their stable id (applyJob guarantees one).
      for (var i = 0; i < JOB.modules.length; i++) if (JOB.modules[i].id === id) return JOB.modules[i];
      return null;
    }
    ;function __renderRoom() {
      // Job/wall elevation: each module's 2D rects positioned at its wall
      // placement (auto left-to-right run). withModule() points S at each module
      // so __render2d captures that module's rectangles.
      // Every pre-existing key is kept exactly as it was; the wall designer's data
      // (wall envelope, snap guides, issues, dimension chain) is added alongside.
      ensureLayout();
      var run = activeRun(), wall = ensureWall(run);
      var mods = [], boxes = [], maxX = 1, maxY = 1, maxD = 1;
      JOB.modules.forEach(function (m, i) {
        withModule(m, function () {
          var r2 = __render2d();
          var p = modPlace(m);
          mods.push({ id: m.id, index: i, name: m.name || ('Module ' + (i + 1)),
                      type: m.type || 'custom', runId: p.runId, hidden: !!m.roomHidden,
                      offsetX: p.offsetX, baseHeight: p.baseHeight, cab: r2.cab, rects: r2.rects });
          // 3D boxes translated onto the wall (offsetX along X, baseHeight up Y).
          try {
            var bs = buildBoxes();
            for (var bi = 0; bi < bs.length; bi++) {
              var b = bs[bi];
              boxes.push({ x0: b.x0 + p.offsetX, x1: b.x1 + p.offsetX, y0: b.y0 + p.baseHeight, y1: b.y1 + p.baseHeight, z0: b.z0, z1: b.z1, base: b.base, id: i + ':' + b.id, mid: m.id, alpha: b.alpha });
            }
          } catch (e) {}
          maxX = Math.max(maxX, p.offsetX + m.cab.w);
          maxY = Math.max(maxY, p.baseHeight + m.cab.h);
          maxD = Math.max(maxD, m.cab.d || 560);
        });
      });
      // Unit types, pre-sized, so the client's palette needs no geometry knowledge.
      var types = {};
      for (var tk in MODULE_TYPES) {
        if (!Object.prototype.hasOwnProperty.call(MODULE_TYPES, tk) || tk === 'custom') continue;
        var td = MODULE_TYPES[tk], ps = td.preset ? PRESETS[td.preset] : null;
        types[tk] = { key: tk, label: td.label, hint: td.hint, baseHeight: td.baseHeight,
                      w: ps ? ps.w : null, h: ps ? ps.h : null, d: ps ? ps.d : null };
      }
      return { room: { w: maxX, h: maxY, d: maxD }, modules: mods, boxes: boxes,
               wall: { id: run.id, name: run.name, w: wall.w, h: wall.h, d: wall.d },
               guides: wallGuides(run.id), issues: wallIssues(run.id),
               dimChain: wallDimChain(run.id), types: types,
               unit: (JOB.settings && JOB.settings.unit) || (S && S.unit) || 'mm' };
    }
    ;function __edit(design, op, args, scope, opts) {
      // Apply one edit intent server-side (the real engine mutates the active
      // module) then return the updated design document + fresh render model.
      applyJob(design); args = args || {};
      switch (op) {
        case 'patch':          __deepMerge(S, args.patch || {}); if (typeof clampAllComps === 'function') clampAllComps(); break;
        case 'add_module': {
          // args: {name?, code?, type?: 'base'|'wall'|'tall', offsetX?, baseHeight?, tol?}
          // A bare {name} behaves exactly as before. With a type, the unit arrives
          // already sized, already at the right height and already parked in the first
          // free stretch of wall — the "zero typing" path for the palette.
          var ty = MODULE_TYPES[args.type] && args.type !== 'custom' ? args.type : null;
          var nm = args.name || (ty ? MODULE_TYPES[ty].label + ' ' + (JOB.modules.length + 1)
                                    : 'Module ' + (JOB.modules.length + 1));
          var nmod = hydrateModule({ name: nm, type: ty || 'custom' });
          if (args.code) nmod.code = args.code;
          JOB.modules.push(nmod);
          JOB.active = JOB.modules.length - 1;
          JOB._mseq = (JOB._mseq || 0) + 1;
          S = JOB.modules[JOB.active];        // aiApplyPreset writes through S — must point at the NEW module
          ensureLayout();                     // gives it an id + runId + a provisional offsetX
          if (ty) {
            if (MODULE_TYPES[ty].preset) aiApplyPreset(MODULE_TYPES[ty].preset);
            nmod.placement.baseHeight = MODULE_TYPES[ty].baseHeight;
          }
          if (args.baseHeight != null) nmod.placement.baseHeight = Math.max(0, Math.round(+args.baseHeight));
          if (args.offsetX != null) {
            var sp = snapPlacement(nmod, +args.offsetX, nmod.placement.baseHeight, args.tol);
            nmod.placement.offsetX = sp.offsetX; nmod.placement.baseHeight = sp.baseHeight;
          } else {
            var slots = wallFreeSlots(nmod.placement.runId, nmod.placement.baseHeight, nmod.cab.h, nmod.id);
            var slot = null;
            for (var si = 0; si < slots.length; si++) if (slots[si].mm >= nmod.cab.w) { slot = slots[si]; break; }
            nmod.placement.offsetX = slot ? slot.x0 : roomBBox().w;
          }
          break;
        }
        case 'place_module': {
          // args: {id?|index?, offsetX, baseHeight, runId?, snap? (default true), tol?, pinned?}
          var pm = args.id != null ? __findModule(args.id) : JOB.modules[args.index];
          if (pm) {
            var pp = modPlace(pm);
            if (args.runId) pp.runId = args.runId;
            var pl = (args.snap === false)
              ? { offsetX: +args.offsetX || 0, baseHeight: +args.baseHeight || 0 }
              : snapPlacement(pm, args.offsetX, args.baseHeight, args.tol);
            pp.offsetX = Math.round(pl.offsetX);
            pp.baseHeight = Math.max(0, Math.round(pl.baseHeight));
            if (args.pinned != null) pp.pinned = !!args.pinned;
          }
          break;
        }
        case 'set_wall': {
          // args: {runId?, w?, h?, d?, name?} — the wall the units stand against.
          var wrun = findRun(args.runId);
          if (wrun) {
            ensureWall(wrun);
            if (args.w != null) wrun.wall.w = Math.max(300, Math.round(+args.w));
            if (args.h != null) wrun.wall.h = Math.max(300, Math.round(+args.h));
            if (args.d != null) wrun.wall.d = Math.max(100, Math.round(+args.d));
            if (args.name) wrun.name = String(args.name);
          }
          break;
        }
        case 'set_module_type': {
          // args: {id, type, moveToDefaultHeight? (default true)}
          var tm = __findModule(args.id) || JOB.modules[JOB.active];
          if (tm && MODULE_TYPES[args.type]) {
            if (MODULE_TYPES[args.type].preset) withModule(tm, function () { aiApplyPreset(MODULE_TYPES[args.type].preset); });
            tm.type = args.type;
            if (args.moveToDefaultHeight !== false) modPlace(tm).baseHeight = MODULE_TYPES[args.type].baseHeight;
          }
          break;
        }
        case 'set_module_visible': {
          // No id = every unit on the wall (the All / None buttons).
          if (args.id == null) { JOB.modules.forEach(function (x) { x.roomHidden = !args.visible; }); break; }
          var vm = __findModule(args.id);
          if (vm) vm.roomHidden = !args.visible;
          break;
        }
        case 'tidy_wall':      tidyRun(findRun(args.runId).id, args.mode || 'pack'); break;
        case 'delete_module':  {
          var di = args.index;
          if (di >= 0 && di < JOB.modules.length) {
            JOB.modules.splice(di, 1);
            JOB.active = JOB.modules.length === 0 ? -1 : ((di < JOB.active) ? JOB.active - 1 : Math.min(JOB.active, JOB.modules.length - 1));
          }
          break;
        }
        case 'rename_module':  { var rm = JOB.modules[args.index]; if (rm) rm.name = args.name; break; }
        case 'set_dimensions': aiSetDimensions(args); break;
        case 'apply_preset':   aiApplyPreset(args.name); break;
        case 'set_doors':      aiSetDoors(args.count, args.reveal); break;
        case 'add_shelves':    aiAddShelves(args.count, null, null, !!args.dual); break;
        case 'add_verticals':  aiAddVerticals(args.count, null, null, !!args.dual); break;
        case 'add_comp': {
          // Insert a component into the clicked cell (real addComp: cell-bounded). args.dual (verticals
          // only) makes it a dual panel: two boards that split the carcass into separate boxes.
          S.lastPoint = (args.point && args.point.x != null) ? { x: args.point.x, y: args.point.y } : null;
          addComp(args.type, !!args.dual);
          var nc = (typeof S.selectedId === 'number') ? S.comps.find(function (c) { return c.id === S.selectedId; }) : null;
          if (nc) {
            if (args.type === 'door' && args.count) { nc.count = Math.max(1, Math.min(2, args.count | 0)); clampComp(nc); }
            if (args.type === 'drawer') {
              if (args.count) nc.count = Math.max(1, Math.min(12, args.count | 0));
              if (args.front != null) nc.boxFront = !!args.front;
              if (args.sides === false && nc.flanks && nc.flanks.length) {
                var fl = nc.flanks; S.comps = S.comps.filter(function (c) { return fl.indexOf(c.id) < 0; }); nc.flanks = [];
              }
              clampComp(nc); if (typeof syncDrawerFlanks === 'function') syncDrawerFlanks(nc);
            }
          }
          break;
        }
        case 'add_drawer': {
          var cells = enumerateOpenings(), best = null, ba = -1;
          for (var ci = 0; ci < cells.length; ci++) { var a = (cells[ci].right - cells[ci].left) * (cells[ci].top - cells[ci].bottom); if (a > ba) { ba = a; best = cells[ci]; } }
          S.lastPoint = best ? { x: (best.left + best.right) / 2, y: (best.bottom + best.top) / 2 } : { x: S.cab.w / 2, y: S.cab.h / 2 };
          addComp('drawer');
          break;
        }
        case 'add_span_door': {
          var cells = args.cells || [];
          if (cells.length) {
            var left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
            for (var si2 = 0; si2 < cells.length; si2++) { var cc = cells[si2]; left = Math.min(left, cc.left); right = Math.max(right, cc.right); bottom = Math.min(bottom, cc.bottom); top = Math.max(top, cc.top); }
            var gaps = (typeof newDoorGaps === 'function') ? newDoorGaps() : {};
            var sdoor = Object.assign({ id: S._seq++, type: 'door', ax: (left + right) / 2, ay: (bottom + top) / 2,
              count: Math.max(1, Math.min(2, (args.count | 0) || 1)), span: { left: left, right: right, bottom: bottom, top: top } }, gaps);
            if (typeof clampComp === 'function') clampComp(sdoor);
            S.comps.push(sdoor); S.selectedId = sdoor.id;
          }
          break;
        }
        case 'clear':          aiClearComponents(); break;
        case 'set_sheet':      aiSetSheet(args); break;
        case 'set_grain':      aiSetGrainLock(args.locked); break;
        case 'set_banding':    aiSetBanding(args.part, args.edges); break;
        case 'delete':         S.selectedId = args.id; deleteSelected(); break;
        case 'move': {
          var mc = null; for (var mi = 0; mi < S.comps.length; mi++) if (S.comps[mi].id === args.id) mc = S.comps[mi];
          if (mc) { if (args.pos != null) mc.pos = args.pos; clampComp(mc); }
          break;
        }
        case 'patch_comp': {
          var xc = null; for (var xi = 0; xi < S.comps.length; xi++) if (S.comps[xi].id === args.id) xc = S.comps[xi];
          if (xc) {
            __deepMerge(xc, args.patch || {});
            // Ticking "Dual panel" is a request for separate boxes: the divider runs the full interior height
            // so it actually splits the carcass (each box then gets its own top, bottom and back).
            if (typeof seatDualFull === 'function') seatDualFull(xc);
            if (typeof clampComp === 'function') clampComp(xc);
            if (xc.type === 'drawer' && typeof syncDrawerFlanks === 'function') syncDrawerFlanks(xc);
          }
          break;
        }
        default: throw new Error('unknown op: ' + op);
      }
      // After any geometry edit, re-clamp all dividers to live cells AND re-sync each
      // drawer's linked flanks (side panels) — matches what every prototype setup
      // handler does. Without this, moving/deleting a shelf shifts a drawer's cell but
      // leaves its flank verticals behind. Skip for pure module-structure ops.
      // Wall-layout ops move whole cabinets around; they never touch a cabinet's insides.
      if (['add_module', 'delete_module', 'rename_module', 'place_module', 'set_wall',
           'set_module_type', 'set_module_visible', 'tidy_wall'].indexOf(op) < 0
          && typeof resyncComponents === 'function') resyncComponents();
      var d = JSON.parse(JSON.stringify(JOB));
      // Defaults reproduce the original behaviour exactly (render on, room off). The
      // Wall tab asks for room:true so one round trip refreshes the wall AND the cut list.
      return { design: d, model: __compute(d, { scope: scope,
        render: !opts || opts.render !== false, room: !!(opts && opts.room) }) };
    }
    ;function __compute(design, opts) {
      opts = opts || {};
      applyJob(design);
      // Empty job (all modules deleted) — return an empty model, never the phantom DEFAULTS cabinet.
      if (!JOB.modules.length) {
        var empty = { scope: opts.scope === 'job' ? 'job' : 'module', cutList: [],
          totals: { parts: 0, areaM2: 0, tapeM: 0 },
          sheets: { SW: S.sheet.w, SH: S.sheet.h, utilisation: 0, sheets: [] },
          bom: { currency: opts.currency || 'GBP', lines: [], total: 0, assumptions: {} } };
        if (opts.render) { empty.module2d = { cab: { w: 0, h: 0, d: 0, t: 0 }, rects: [], labels: [], openings: [] }; empty.module3d = { boxes: [] }; }
        // An empty job still gets a wall — the user needs somewhere to drop the first unit.
        if (opts.room) { try { empty.room = __renderRoom(); } catch (e) {} }
        return empty;
      }
      var scope = opts.scope === 'job' ? 'job' : 'module';
      cutScope = scope;
      var job = scope === 'job';
      // Each row carries a sequential unique Part No. and its Module name (job scope = the part's own module;
      // module scope = the active module). Part names themselves stay standard (Side/Top/Bottom/…).
      var activeMod = JOB.modules[JOB.active] || null;
      var activeName = (activeMod && activeMod.name) || ('Module ' + ((JOB.active | 0) + 1));
      var rows = (job ? jobCutList() : cutList()).map(function (p, i) {
        return { partNo: i + 1, module: job ? (p.mname || '—') : activeName,
                 name: p.name, qty: p.qty, w: p.w, h: p.h, d: p.d, thick: p.thick,
                 length: p.length, width: p.width, key: p.key, srcId: (p.srcId != null ? p.srcId : null),
                 // Every panel this row covers, so clicking any of them finds it (srcId is just the first).
                 srcIds: (p.srcIds && p.srcIds.length ? p.srcIds : (p.srcId != null ? [p.srcId] : [])),
                 band: p.band || '—', tapeLen: p.tapeLen || 0,
                 // Panel colour / decor code — the board this part is cut from. '' when none is set.
                 colour: p.colour || '' };
      });
      var instances = job ? jobCutListInstances() : cutListInstances();
      var pack = job ? jobNest() : nest(instances);
      var parts, area, tape;
      if (job) { var t = jobTotals(); parts = t.partCount; area = t.areaMM2; tape = t.tapeMM; }
      else {
        parts = rows.reduce(function (a, p) { return a + p.qty; }, 0);
        area = rows.reduce(function (a, p) { return a + p.qty * p.length * p.width; }, 0);
        tape = rows.reduce(function (a, p) { return a + p.qty * (p.tapeLen || 0); }, 0);
      }
      var bom = aiEstimateBOM({ scope: scope, currency: opts.currency, prices: opts.prices });
      var out = {
        scope: scope,
        cutList: rows,
        totals: { parts: parts, areaM2: area / 1e6, tapeM: tape / 1000 },
        sheets: { SW: pack.SW, SH: pack.SH, utilisation: pack.utilisation,
                  // How many boards of each colour to buy — the purchasing answer, per decor.
                  byColour: pack.byColour || [],
                  // Parts too big for the stock sheet: they are on no board, so the shop must be told rather
                  // than have them silently absent from the layout (and absent from the order quantity).
                  oversize: (pack.oversize || []).map(function (o) {
                    return { name: o.name, length: o.len, width: o.wid, colour: o.colour || '', srcId: o.srcId != null ? o.srcId : null };
                  }),
                  // Each sheet is ONE physical board, so it carries the colour/decor its parts are cut from
                  // plus its number WITHIN that colour ("Oak 2 of 3").
                  sheets: pack.sheets.map(function (s) {
                    return { placements: s.placements, colour: s.colour || '', colourNo: s.colourNo || 1, colourTotal: s.colourTotal || 1 };
                  }) },
        bom: bom
      };
      if (opts.render) {
        // Active-module render model — the thin client draws these; it holds no engine.
        out.module2d = __render2d();
        try { out.module3d = { boxes: buildBoxes() }; } catch (e) { out.module3d = { boxes: [] }; }
      }
      if (opts.room) { try { out.room = __renderRoom(); } catch (e) { out.room = { room: { w: 1, h: 1 }, modules: [] }; } }
      return out;
    }
    ;return {
      compute: __compute,
      edit: __edit,
      DEFAULTS: DEFAULTS, applyJob: applyJob,
      cutList: cutList, jobCutList: jobCutList, jobTotals: jobTotals,
      cutListInstances: cutListInstances, nest: nest, aiEstimateBOM: aiEstimateBOM,
      setScope: function (s) { cutScope = s; },
    };`;

  // eslint-disable-next-line no-new-func
  const factory = new Function(...names, appSrc + footer);
  return factory(...names.map((n) => g[n]));
}

module.exports = { loadEngine, loadEngineFromFile: (p) => loadEngine(fs.readFileSync(p, 'utf8')) };
