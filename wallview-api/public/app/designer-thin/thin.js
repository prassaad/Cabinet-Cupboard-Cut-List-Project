/* WallView THIN designer — prototype shell, engine-free (ARCH-004 E2, stage 1).
 *
 * Reuses the prototype's exact HTML/CSS shell but contains NO engine: no
 * geometry, cut-list rules, nesting, pricing or constants. It loads a saved
 * design, asks the server for the render model (2D rects + 3D boxes + cut list
 * + nesting + priced BOM) and draws it. The client only does presentation:
 * camera (pan/zoom/orbit) and painting. Stage 2 adds editing via intents.
 */
(() => {
  'use strict';

  const MOUNT = location.pathname.replace(/app\/designer-thin\/(index\.html)?$/, '');
  const API = MOUNT.replace(/\/$/, '') + '/api/v1';
  const LOGIN = MOUNT + 'app/';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => { const v = Math.round((+n) * 100) / 100; return (v % 1 === 0 ? v.toFixed(0) : String(v)); };

  // ── Global activity indicator ──
  // A small non-blocking pill, shown while any server request (PHP → Node engine)
  // is in flight, so the round-trip lag is acknowledged. A short delay keeps fast
  // responses from flashing it; a counter keeps it up while requests overlap.
  let _pending = 0, _showT = null;
  function loadEl() {
    let n = document.getElementById('wv-loading');
    if (!n) {
      const st = document.createElement('style');
      st.textContent = '#wv-loading{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:500;display:none;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(20,25,32,.92);color:#e9edf3;border:1px solid rgba(255,255,255,.14);font:600 12.5px/1 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:none}#wv-loading.on{display:inline-flex}#wv-loading .sp{width:14px;height:14px;border:2px solid rgba(224,169,58,.35);border-top-color:#e0a93a;border-radius:50%;animation:wv-spin .7s linear infinite}@keyframes wv-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
      n = document.createElement('div'); n.id = 'wv-loading';
      n.innerHTML = '<span class="sp"></span><span class="tx">Working…</span>';
      (document.body || document.documentElement).appendChild(n);
    }
    return n;
  }
  function loadStart(label) {
    _pending++;
    if (label) loadEl().querySelector('.tx').textContent = label;
    if (!_showT && !loadEl().classList.contains('on')) _showT = setTimeout(() => { _showT = null; if (_pending > 0) loadEl().classList.add('on'); }, 160);
  }
  function loadStop() {
    _pending = Math.max(0, _pending - 1);
    if (_pending === 0) { if (_showT) { clearTimeout(_showT); _showT = null; } const n = loadEl(); n.classList.remove('on'); n.querySelector('.tx').textContent = 'Working…'; }
  }

  // ── Session ──
  let session; try { session = JSON.parse(localStorage.getItem('wv_session') || 'null'); } catch { session = null; }
  if (!session || !session.refreshToken) { location.href = LOGIN; return; }
  let accessToken = null;
  const T = () => encodeURIComponent(session.tenant);

  async function http(method, path, body, auth) {
    loadStart();
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (auth && accessToken) headers['Authorization'] = 'Bearer ' + accessToken;
      const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const text = await res.text(); const data = text ? JSON.parse(text) : null;
      if (!res.ok) { const e = new Error((data && data.error && data.error.message) || ('HTTP ' + res.status)); e.status = res.status; throw e; }
      return data;
    } finally { loadStop(); }
  }
  async function refresh() {
    const r = await http('POST', '/refresh', { refreshToken: session.refreshToken });
    accessToken = r.accessToken; session = { refreshToken: r.refreshToken, tenant: r.user.tenant, user: r.user };
    localStorage.setItem('wv_session', JSON.stringify(session));
  }
  async function api(method, path, body) {
    try { return await http(method, path, body, true); }
    catch (e) { if (e.status === 401) { await refresh(); return http(method, path, body, true); } throw e; }
  }
  let toastT;
  function toast(msg, err) { const t = $('#wv-toast'); t.textContent = msg; t.className = 'wv-toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2800); }

  // ── State ──
  let design = null, projId = null, projName = '', scope = 'module', active = 0, model = null;
  let tab = 'design', mode = '2d';
  let selectedId = null, dragPart = null, dragPreview = null, sheetRects = [];
  const cam2 = { scale: 1, ox: 0, oy: 0, fit: true };
  const cam3 = { yaw: -0.6, pitch: 0.5, scale: 1, ox: 0, oy: 0, fit: true };

  const comps = () => (design && design.modules && design.modules[active] && design.modules[active].comps) || [];
  const compById = (id) => comps().find((c) => c.id === id) || null;

  // Units (client presentation): the engine sends mm; the client displays mm or inch.
  const MM_PER_IN = 25.4;
  const curUnit = () => (design && design.modules && design.modules[active] && design.modules[active].unit) || 'mm';
  const toDisp = (mm) => curUnit() === 'in' ? mm / MM_PER_IN : mm;
  const toMM = (v) => curUnit() === 'in' ? v * MM_PER_IN : v;
  const fmtU = (mm) => curUnit() === 'in' ? (mm / MM_PER_IN).toFixed(3) : String(Math.round(mm));
  let showDims = true, measureOn = false, measurePts = [], lastClickMM = null, explode = 0;
  let cellMode = false, cellSel = [];   // multi-bay door pick
  const cellSig = (c) => `${Math.round(c.left)},${Math.round(c.right)},${Math.round(c.bottom)},${Math.round(c.top)}`;

  const dcv = $('#design-canvas'), dctx = dcv.getContext('2d');
  const scv = $('#sheet-canvas'), sctx = scv.getContext('2d');
  const rcv = $('#room-canvas'), rctx = rcv.getContext('2d');
  // Right / middle-drag pans the 3D views — stop the browser's image context menu
  // from popping up on those canvases while you drag.
  [dcv, rcv, scv].forEach((c) => c && c.addEventListener('contextmenu', (e) => e.preventDefault()));
  let roomModel = null, roomMode = '2d';
  const roomCam = { yaw: -0.6, pitch: 0.5, scale: 1, ox: 0, oy: 0, fit: true };
  const roomHidden = new Set();   // module indices toggled off the wall

  function fit(cv, ctx) {
    const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: r.width, h: r.height };
  }

  // ── Dimension drawing (faithful port of cellDim / drawOverallDims — presentation) ──
  const DIMCOL = '#8a97a8', AHEAD = 4;
  function arrowH(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * AHEAD, y - 2); ctx.lineTo(x + s * AHEAD, y + 2); ctx.closePath(); ctx.fillStyle = DIMCOL; ctx.fill(); }
  function arrowV(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + s * AHEAD); ctx.lineTo(x + 2, y + s * AHEAD); ctx.closePath(); ctx.fillStyle = DIMCOL; ctx.fill(); }
  function dimLabel(ctx, text, x, y, vertical, mask, textColor) {
    ctx.save(); ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const wpx = ctx.measureText(text).width + 8;
    ctx.translate(x, y); if (vertical) ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = mask; ctx.fillRect(-wpx / 2, -8, wpx, 16);
    ctx.fillStyle = textColor || '#ffffff'; ctx.fillText(text, 0, 0); ctx.restore();
  }
  function cellDim(ctx, cell, sx, sy, mask, tc) {
    const xL = sx(cell.left), xR = sx(cell.right), yT = sy(cell.top), yB = sy(cell.bottom);
    const wPx = xR - xL, hPx = yB - yT, INSET = 14;
    if (hPx >= 24 && wPx >= 18) {
      const x = xL + INSET;
      ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yT + 3); ctx.lineTo(x, yB - 3); ctx.stroke();
      arrowV(ctx, x, yT + 3, 1); arrowV(ctx, x, yB - 3, -1);
      dimLabel(ctx, fmtU(cell.top - cell.bottom), x, (yT + yB) / 2, true, mask, tc);
    }
    if (wPx >= 30 && hPx >= 18) {
      const y = yT + INSET;
      ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xL + 3, y); ctx.lineTo(xR - 3, y); ctx.stroke();
      arrowH(ctx, xL + 3, y, 1); arrowH(ctx, xR - 3, y, -1);
      dimLabel(ctx, fmtU(cell.right - cell.left), (xL + xR) / 2, y, false, mask, tc);
    }
  }
  function drawOverallDims(ctx, w, h, sides, sx, sy, mask, tc) {
    const x0 = sx(0), x1 = sx(w), yB = sy(0), yT = sy(h), OFF = 32;
    ctx.strokeStyle = DIMCOL; ctx.lineWidth = 1;
    const hx = x0 - OFF;
    ctx.beginPath(); ctx.moveTo(x0, yB); ctx.lineTo(hx - 4, yB); ctx.moveTo(x0, yT); ctx.lineTo(hx - 4, yT); ctx.moveTo(hx, yB); ctx.lineTo(hx, yT); ctx.stroke();
    arrowV(ctx, hx, yB, -1); arrowV(ctx, hx, yT, 1);
    dimLabel(ctx, fmtU(h), hx, (yB + yT) / 2, true, mask, tc);
    const wy = yB + OFF;
    ctx.beginPath(); ctx.moveTo(x0, yB); ctx.lineTo(x0, wy + 4); ctx.moveTo(x1, yB); ctx.lineTo(x1, wy + 4); ctx.moveTo(x0, wy); ctx.lineTo(x1, wy); ctx.stroke();
    arrowH(ctx, x0, wy, 1); arrowH(ctx, x1, wy, -1);
    dimLabel(ctx, fmtU(w), (x0 + x1) / 2, wy, false, mask, tc);
    if (sides && Math.abs(sides.height - h) > 0.5) {
      const yA = sy(sides.y0), yZ = sy(sides.y1), shx = x1 + OFF;
      ctx.beginPath(); ctx.moveTo(x1, yA); ctx.lineTo(shx + 4, yA); ctx.moveTo(x1, yZ); ctx.lineTo(shx + 4, yZ); ctx.moveTo(shx, yA); ctx.lineTo(shx, yZ); ctx.stroke();
      arrowV(ctx, shx, yA, -1); arrowV(ctx, shx, yZ, 1);
      dimLabel(ctx, fmtU(sides.height), shx, (yA + yZ) / 2, true, mask, tc);
    }
  }

  // ── 2D (design) ──
  function draw2D() {
    const box = fit(dcv, dctx); dctx.clearRect(0, 0, box.w, box.h);
    if (!model || !model.module2d) return;
    const { w, h } = model.module2d.cab;
    if (w <= 0 || h <= 0) return;   // empty job (no module) — blank canvas, no phantom dims
    if (cam2.fit) { const s = Math.min(box.w / (w || 1), box.h / (h || 1)) * 0.86; cam2.scale = s; cam2.ox = (box.w - w * s) / 2; cam2.oy = (box.h - h * s) / 2; cam2.fit = false; }
    const S = cam2.scale, ox = cam2.ox, oy = cam2.oy, cabH = h;
    const off = (rc) => (dragPreview && rc.srcId === dragPreview.id) ? dragPreview : null;
    for (const rc of model.module2d.rects) {
      const o = off(rc), dx = o ? o.dx : 0, dy = o ? o.dy : 0;
      const x = ox + (rc.x0 + dx) * S, y = oy + (cabH - (rc.y1 + dy)) * S, ww = (rc.x1 - rc.x0) * S, hh = (rc.y1 - rc.y0) * S;
      if (rc.fill) { dctx.fillStyle = rc.fill; dctx.fillRect(x, y, ww, hh); }
      if (rc.stroke) { dctx.strokeStyle = rc.stroke; dctx.lineWidth = 1.3; dctx.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1); }
    }
    // Selection highlight — amber fill over the selected part's rects (like the prototype).
    if (selectedId != null) {
      for (const rc of model.module2d.rects) {
        if (String(rc.srcId) !== String(selectedId)) continue;
        const o = off(rc), dx = o ? o.dx : 0, dy = o ? o.dy : 0;
        const x = ox + (rc.x0 + dx) * S, y = oy + (cabH - (rc.y1 + dy)) * S, ww = (rc.x1 - rc.x0) * S, hh = (rc.y1 - rc.y0) * S;
        dctx.fillStyle = 'rgba(255,180,84,0.55)'; dctx.fillRect(x, y, ww, hh);
        dctx.strokeStyle = '#ffd9a0'; dctx.lineWidth = 1.5; dctx.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1);
      }
    }
    // Door + drawer handles (screen-space, over the parts).
    for (const H of (model.module2d.handles || [])) {
      const hx = ox + H.x * S, hy = oy + (cabH - H.y) * S;
      if (H.kind === 'door') { dctx.fillStyle = '#d9c08a'; dctx.fillRect(hx - 1.5, hy - 13, 3, 26); }
      else { dctx.strokeStyle = '#2a1d02'; dctx.lineWidth = 2; dctx.beginPath(); dctx.moveTo(hx - 18, hy + 14); dctx.lineTo(hx + 18, hy + 14); dctx.stroke(); }
    }
    if (showDims) {
      const sx = (xmm) => ox + xmm * S, sy = (ymm) => oy + (cabH - ymm) * S;
      for (const cell of (model.module2d.openings || [])) cellDim(dctx, cell, sx, sy, '#814a28');
      for (const bd of (model.module2d.boxDims || [])) {   // drawer box-outer width
        const xL = sx(bd.x0), xR = sx(bd.x1), y = sy(bd.y);
        if (xR - xL < 30) continue;
        dctx.strokeStyle = DIMCOL; dctx.lineWidth = 1; dctx.beginPath(); dctx.moveTo(xL + 3, y); dctx.lineTo(xR - 3, y); dctx.stroke();
        arrowH(dctx, xL + 3, y, 1); arrowH(dctx, xR - 3, y, -1);
        dimLabel(dctx, fmtU(bd.x1 - bd.x0), (xL + xR) / 2, y, false, '#814a28');
      }
      drawOverallDims(dctx, w, h, model.module2d.sides, sx, sy, '#1b212a');
    }
    if (cellMode && model.module2d.openings) {
      for (const o of model.module2d.openings) {
        const X = ox + o.left * S, Y = oy + (cabH - o.top) * S, W = (o.right - o.left) * S, H = (o.top - o.bottom) * S;
        if (cellSel.some((c) => cellSig(c) === cellSig(o))) { dctx.fillStyle = 'rgba(90,150,255,0.28)'; dctx.fillRect(X, Y, W, H); }
        dctx.strokeStyle = 'rgba(125,176,255,0.6)'; dctx.lineWidth = 1.5; dctx.strokeRect(X, Y, W, H);
      }
    }
    drawScaleBar(box.w, box.h, cam2.scale);
    drawMeasure(ox, oy, S, cabH);
  }

  // Adaptive ruler (bottom-right), unit-aware — port of the prototype's scale bar.
  function drawScaleBar(cw, ch, pxPerMm) {
    if (!(pxPerMm > 0) || !isFinite(pxPerMm)) return;
    const mmPerDisp = curUnit() === 'in' ? MM_PER_IN : 1, pxPerDisp = pxPerMm * mmPerDisp;
    const rawDisp = Math.max(56, Math.min(140, cw * 0.2)) / pxPerDisp;
    if (!(rawDisp > 0) || !isFinite(rawDisp)) return;
    const pow = Math.pow(10, Math.floor(Math.log10(rawDisp)));
    let nice = pow; for (const m of [1, 2, 5, 10]) if (m * pow <= rawDisp) nice = m * pow;
    const barPx = nice * pxPerDisp, x1 = cw - 16, x0 = x1 - barPx, y = ch - 16;
    dctx.save();
    dctx.strokeStyle = 'rgba(174,183,198,0.9)'; dctx.fillStyle = 'rgba(174,183,198,0.95)'; dctx.lineWidth = 2;
    dctx.beginPath(); dctx.moveTo(x0, y); dctx.lineTo(x1, y); dctx.stroke();
    dctx.lineWidth = 1; dctx.beginPath(); dctx.moveTo(x0, y - 5); dctx.lineTo(x0, y + 5); dctx.moveTo(x1, y - 5); dctx.lineTo(x1, y + 5); dctx.stroke();
    dctx.font = '11px system-ui'; dctx.textAlign = 'center'; dctx.textBaseline = 'bottom';
    dctx.fillText(curUnit() === 'in' ? `${+nice.toFixed(3)} in` : `${nice} mm`, (x0 + x1) / 2, y - 7);
    dctx.restore();
  }

  // Measure overlay: two clicked points (mm) → line + distance in the current unit.
  function drawMeasure(ox, oy, s, cabH) {
    if (!measurePts.length) return;
    const P = (p) => [ox + p.x * s, oy + (cabH - p.y) * s];
    dctx.save(); dctx.strokeStyle = '#e0a93a'; dctx.fillStyle = '#e0a93a'; dctx.lineWidth = 1.5;
    for (const p of measurePts) { const [X, Y] = P(p); dctx.beginPath(); dctx.arc(X, Y, 3, 0, Math.PI * 2); dctx.fill(); }
    if (measurePts.length === 2) {
      const [ax, ay] = P(measurePts[0]), [bx, by] = P(measurePts[1]);
      dctx.beginPath(); dctx.moveTo(ax, ay); dctx.lineTo(bx, by); dctx.stroke();
      const dmm = Math.hypot(measurePts[1].x - measurePts[0].x, measurePts[1].y - measurePts[0].y);
      const mx = (ax + bx) / 2, my = (ay + by) / 2, txt = `${fmtU(dmm)} ${curUnit()}`;
      dctx.font = '600 12px system-ui'; dctx.textAlign = 'center'; dctx.textBaseline = 'middle';
      const w = dctx.measureText(txt).width + 10;
      dctx.fillStyle = 'rgba(20,24,30,0.9)'; dctx.fillRect(mx - w / 2, my - 10, w, 20);
      dctx.fillStyle = '#ffe9b8'; dctx.fillText(txt, mx, my);
    }
    dctx.restore();
  }

  // ── Shared 3D painter (faithful port of renderDesign3D) ──
  // Orthographic orbit over a box list, explode offset, normal-based Lambert
  // shading. base is an [r,g,b] array. Used by design 3D AND the room 3D scene.
  function paint3D(ctx, W, H, boxes, cen, cam, opts) {
    opts = opts || {}; const ex = opts.explode || 0, selId = opts.selId;
    const cY = Math.cos(cam.yaw), sY = Math.sin(cam.yaw), cX = Math.cos(cam.pitch), sX = Math.sin(cam.pitch);
    const rot = (x, y, z) => { x -= cen[0]; y -= cen[1]; z -= cen[2]; const x1 = x * cY + z * sY, z1 = -x * sY + z * cY, y1 = y; return [x1, y1 * cX - z1 * sX, y1 * sX + z1 * cX]; };
    const FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const rboxes = boxes.map((b) => {
      const bc = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
      const off = [(bc[0] - cen[0]) * ex, (bc[1] - cen[1]) * ex, (bc[2] - cen[2]) * ex];
      const rc = [
        [b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0],
        [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1],
      ].map((c) => rot(c[0] + off[0], c[1] + off[1], c[2] + off[2]));
      rc.forEach((p) => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });
      return { b, rc };
    });
    const pad = 48;
    if (cam.fit) { cam.scale = Math.min((W - 2 * pad) / Math.max(1, maxX - minX), (H - 2 * pad) / Math.max(1, maxY - minY)); cam.ox = 0; cam.oy = 0; cam.fit = false; }
    const scale = cam.scale, offX = (W - (maxX + minX) * scale) / 2 + cam.ox, offY = (H + (maxY + minY) * scale) / 2 + cam.oy;
    const proj = (p) => [offX + p[0] * scale, offY - p[1] * scale];
    const L = (() => { const v = [-0.3, 0.65, 0.7], m = Math.hypot(v[0], v[1], v[2]); return v.map((k) => k / m); })();
    const faces = [];
    for (const { b, rc } of rboxes) {
      const base = b.id === selId ? [255, 180, 84] : b.base;
      for (const f of FACES) {
        const p0 = rc[f[0]], p1 = rc[f[1]], p2 = rc[f[2]];
        const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
        let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const nm = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map((k) => k / nm);
        const sh = 0.42 + 0.58 * Math.abs(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        const depth = (rc[f[0]][2] + rc[f[1]][2] + rc[f[2]][2] + rc[f[3]][2]) / 4;
        const rgbc = base.map((k) => Math.round(k * sh));
        faces.push({ pts: f.map((i) => proj(rc[i])), depth, color: b.alpha < 1 ? `rgba(${rgbc.join(',')},${b.alpha})` : `rgb(${rgbc.join(',')})` });
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    for (const fc of faces) { ctx.beginPath(); ctx.moveTo(fc.pts[0][0], fc.pts[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(fc.pts[i][0], fc.pts[i][1]); ctx.closePath(); ctx.fillStyle = fc.color; ctx.fill(); ctx.strokeStyle = 'rgba(18,22,28,0.55)'; ctx.lineWidth = 1; ctx.stroke(); }
    if (opts.dims && showDims) {
      const cor = (x, y, z) => proj(rot(x, y, z)), w = opts.dims.w, h = opts.dims.h, d = opts.dims.d;
      const dimLine = (a, b, txt) => {
        ctx.strokeStyle = '#8a97a8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(txt).width + 8; ctx.fillStyle = 'rgba(20,24,30,0.85)'; ctx.fillRect(mx - tw / 2, my - 8, tw, 16); ctx.fillStyle = '#e9edf3'; ctx.fillText(txt, mx, my);
      };
      dimLine(cor(0, 0, d), cor(w, 0, d), fmtU(w)); dimLine(cor(0, 0, d), cor(0, h, d), fmtU(h)); dimLine(cor(w, 0, 0), cor(w, 0, d), fmtU(d));
    }
  }
  function draw3D() {
    const box = fit(dcv, dctx); dctx.clearRect(0, 0, box.w, box.h);
    if (!model || !model.module3d || !model.module3d.boxes.length) return;
    const cab = (model.module2d && model.module2d.cab) || { w: 600, h: 720, d: 560 };
    paint3D(dctx, box.w, box.h, model.module3d.boxes, [cab.w / 2, cab.h / 2, (cab.d || 560) / 2], cam3, { explode, selId: selectedId, dims: { w: cab.w, h: cab.h, d: cab.d || 560 } });
    drawScaleBar(box.w, box.h, cam3.scale);
  }

  // ── Sheet ──
  function drawSheet() {
    const box = fit(scv, sctx); sctx.clearRect(0, 0, box.w, box.h);
    if (!model || !model.sheets || !model.sheets.sheets.length) { $('#sheet-stats').classList.add('hidden'); return; }
    const sh = model.sheets, SW = sh.SW, SH = sh.SH, n = sh.sheets.length;
    const cols = Math.min(n, Math.max(1, Math.floor(box.w / 240)));
    const rows = Math.ceil(n / cols);
    const cellW = box.w / cols, cellH = box.h / rows, pad = 12;
    const s = Math.min((cellW - pad * 2) / SW, (cellH - pad * 2) / SH);
    sheetRects = [];
    sh.sheets.forEach((sheet, i) => {
      const cxi = i % cols, cyi = Math.floor(i / cols);
      const ox = cxi * cellW + (cellW - SW * s) / 2, oy = cyi * cellH + (cellH - SH * s) / 2;
      sctx.strokeStyle = '#39424f'; sctx.lineWidth = 1; sctx.strokeRect(ox + 0.5, oy + 0.5, SW * s - 1, SH * s - 1);
      for (const p of sheet.placements) {
        const hi = p.srcId != null && String(p.srcId) === String(selectedId);
        drawPlacement(sctx, p, ox, oy, s, true, { sheetNo: i + 1, highlight: hi });
        sheetRects.push({ x: ox + p.x * s, y: oy + p.y * s, w: p.w * s, h: p.h * s, srcId: p.srcId });
      }
    });
    const st = $('#sheet-stats'); st.classList.remove('hidden');
    st.innerHTML = `Sheets: <b>${n}</b> · Utilisation: <b>${((Math.min(1, sh.utilisation || 0)) * 100).toFixed(1)}%</b> <span style="color:var(--muted)">(${scope === 'job' ? 'whole job' : 'this module'})</span> · Sheet ${fmtU(SW)}×${fmtU(SH)} ${curUnit()}`;
  }
  // Faithful port of the prototype's drawPlacement (presentation only).
  function drawPlacement(ctx, p, ox, oy, scale, showText, opts) {
    opts = opts || {}; const sheetNo = opts.sheetNo, hi = !!opts.highlight;
    const px = ox + p.x * scale, py = oy + p.y * scale, pw = p.w * scale, ph = p.h * scale;
    ctx.fillStyle = hi ? '#e8873a' : '#3a78d6'; ctx.fillRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    ctx.strokeStyle = hi ? '#ffd9a0' : '#f1e4ba'; ctx.lineWidth = hi ? 2 : 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    if (!showText) return;
    const lenW = p.rot ? p.h : p.w, widW = p.rot ? p.w : p.h, dim = `${fmtU(lenW)}×${fmtU(widW)}`;
    ctx.fillStyle = '#fbf3da'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (pw > 56 && ph > 30) { ctx.font = '10px system-ui'; ctx.fillText(p.name, px + pw / 2, py + ph / 2 - 7); ctx.font = '9px system-ui'; ctx.fillText(`S${sheetNo} · ${dim}`, px + pw / 2, py + ph / 2 + 7); }
    else if (pw > 40 && ph > 18) { ctx.font = '10px system-ui'; ctx.fillText(`${p.name} ${fmtU(lenW)}`, px + pw / 2, py + ph / 2); }
    else if (pw > 14 && ph > 12) { ctx.font = '10px system-ui'; ctx.fillText(p.name[0], px + pw / 2, py + ph / 2); }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  // ── Room / wall elevation (job scope) ──
  async function loadRoom() {
    if (!design) { roomModel = null; drawRoom(); return; }
    try { const r = await api('POST', `/${T()}/engine/compute`, { design: Object.assign({}, design, { active }), room: true }); roomModel = r.room; }
    catch (e) { return toast(e.message, true); }
    renderRoomModuleList(); drawRoom();
  }
  function drawRoom() { if (roomMode === '3d') drawRoom3D(); else drawRoomElevation(); }
  function drawRoom3D() {
    const box = fit(rcv, rctx); rctx.clearRect(0, 0, box.w, box.h);
    if (!roomModel || !roomModel.boxes || !roomModel.boxes.length) return;
    const boxes = roomModel.boxes.filter((b) => !roomHidden.has(parseInt(b.id, 10)));   // drop hidden modules
    if (!boxes.length) return;
    const R = roomModel.room;
    paint3D(rctx, box.w, box.h, boxes, [R.w / 2, R.h / 2, (R.d || 560) / 2], roomCam, { explode: 0, selId: null, dims: null });
  }
  // Floating "modules on wall" list — tick to show/hide each on the wall.
  function renderRoomModuleList() {
    const list = $('#rm-list'); if (!list || !roomModel) return;
    list.innerHTML = roomModel.modules.map((m, i) => `<label class="rm-item"><input type="checkbox" data-mi="${i}"${roomHidden.has(i) ? '' : ' checked'}> ${esc(m.name)}</label>`).join('');
    list.querySelectorAll('input[data-mi]').forEach((cb) => cb.onchange = () => { const i = +cb.dataset.mi; if (cb.checked) roomHidden.delete(i); else roomHidden.add(i); drawRoom(); });
  }
  let roomView = null, roomDrag = null;   // roomView = live elevation transform; roomDrag = module being dragged
  function drawRoomElevation() {
    const box = fit(rcv, rctx); rctx.clearRect(0, 0, box.w, box.h);
    if (!roomModel || !roomModel.modules.length) { roomView = null; return; }
    // Bounding box from visible modules only.
    let rw = 1, rh = 1, anyVis = false;
    roomModel.modules.forEach((m, i) => { if (roomHidden.has(i)) return; anyVis = true; rw = Math.max(rw, m.offsetX + m.cab.w); rh = Math.max(rh, m.baseHeight + m.cab.h); });
    if (!anyVis) { roomView = null; return; }
    const s = Math.min((box.w - 60) / (rw || 1), (box.h - 80) / (rh || 1)) * 0.98;
    const ox = (box.w - rw * s) / 2, floorY = box.h - (box.h - rh * s) / 2;   // floor at bottom, modules stand up
    roomView = { ox, s, floorY };
    rctx.strokeStyle = 'rgba(174,183,198,0.35)'; rctx.lineWidth = 1;
    rctx.beginPath(); rctx.moveTo(ox - 20, floorY + 0.5); rctx.lineTo(ox + rw * s + 20, floorY + 0.5); rctx.stroke();
    roomModel.modules.forEach((m, i) => {
      if (roomHidden.has(i)) return;
      const dx = (roomDrag && roomDrag.index === i) ? roomDrag.dxMM : 0, dy = (roomDrag && roomDrag.index === i) ? roomDrag.dyMM : 0;
      const bx = m.offsetX + dx, by = m.baseHeight + dy;
      for (const rc of m.rects) {
        const X = ox + (bx + rc.x0) * s, Y = floorY - (by + rc.y1) * s, w = (rc.x1 - rc.x0) * s, h = (rc.y1 - rc.y0) * s;
        if (rc.fill) { rctx.fillStyle = rc.fill; rctx.fillRect(X, Y, w, h); }
        if (rc.stroke) { rctx.strokeStyle = rc.stroke; rctx.lineWidth = 1; rctx.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1); }
      }
      rctx.fillStyle = '#aeb7c6'; rctx.font = '600 11px system-ui'; rctx.textAlign = 'center'; rctx.textBaseline = 'top';
      rctx.fillText(`${m.name} · ${fmtU(m.cab.w)}`, ox + (bx + m.cab.w / 2) * s, floorY + 6);
    });
    rctx.textBaseline = 'alphabetic';
  }
  function roomHitModule(clientX, clientY) {
    if (!roomView || !roomModel) return -1;
    const r = rcv.getBoundingClientRect(), { ox, s, floorY } = roomView;
    const xm = (clientX - r.left - ox) / s, ym = (floorY - (clientY - r.top)) / s;
    for (let i = roomModel.modules.length - 1; i >= 0; i--) {
      if (roomHidden.has(i)) continue;
      const m = roomModel.modules[i];
      if (xm >= m.offsetX && xm <= m.offsetX + m.cab.w && ym >= m.baseHeight && ym <= m.baseHeight + m.cab.h) return i;
    }
    return -1;
  }

  // ── Cut list + summary (right panel) ──
  function renderCutList() {
    const tb = $('#cutlist tbody');
    tb.innerHTML = (model.cutList || []).map((p) => {
      const src = p.srcId != null ? String(p.srcId) : '';
      const selCls = src !== '' && src === String(selectedId) ? ' class="cl-selected"' : '';
      return `<tr data-src="${esc(src)}"${selCls}><td>${p.partNo != null ? p.partNo : ''}</td><td>${esc(p.name)}</td><td>${esc(p.module || '')}</td><td>${p.qty}</td><td>${fmtU(p.w)}</td><td>${fmtU(p.h)}</td><td>${fmtU(p.d)}</td><td>${fmtU(p.thick)}</td><td>${esc(p.band)}</td></tr>`;
    }).join('');
    const t = model.totals || {}, sh = model.sheets || {};
    $('#cutlist-summary').innerHTML =
      `Parts: <b>${t.parts || 0}</b><br>Board area: <b>${fmt(t.areaM2 || 0)} m²</b><br>` +
      `Edge tape: <b>${fmt(t.tapeM || 0)} m</b><br>` +
      `Sheets: <b>${(sh.sheets || []).length}</b> · Utilisation: <b>${((Math.min(1, sh.utilisation || 0)) * 100).toFixed(1)}%</b> <span style="color:var(--muted)">(${scope === 'job' ? 'whole job' : 'this module'})</span>` +
      (model.bom ? `<br>BOM: <b>${esc(model.bom.currency)} ${fmt(model.bom.total)}</b>` : '');
  }

  // ── Extra pieces (manual cut-list rows not in the box geometry: dummy panels, exposed fillers…) ──
  // Stored on the active module as `extras: [{id,name,w,h,thick,qty}]` (mm) and pushed to the engine via a
  // config patch; the engine emits them as cut-list rows, so they flow through the module column, nesting,
  // totals and exports automatically. This modal just adds/lists/removes them.
  const currentExtras = () => { const m = design && design.modules && design.modules[active]; return (m && Array.isArray(m.extras)) ? m.extras : []; };
  function extrasModal() {
    if (!(design && design.modules && design.modules[active])) return toast('Add a module first', true);
    const m = $('#wv-modal'), u = curUnit();
    const render = () => {
      const list = currentExtras();
      const rows = list.length
        ? list.map((x) => `<div class="row" style="cursor:default"><span class="n">${esc(x.name || 'Extra piece')}</span><span class="d">${fmtU(x.w)} × ${fmtU(x.h)} × ${fmtU(x.thick)} · ×${x.qty | 0}</span><button class="ex-del" data-id="${esc(x.id)}" title="Remove">✕</button></div>`).join('')
        : '<p class="hint">No extra pieces yet. Add dummy panels, exposed fillers, etc. below.</p>';
      m.innerHTML = `<div class="ov"><div class="box"><h3>Extra pieces <small style="color:var(--muted);font-weight:400">(${u})</small></h3>
        <style>#ex-form label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}#ex-form input{width:100%;box-sizing:border-box}.ex-del{background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:0 4px}.ex-del:hover{color:var(--danger,#e5484d)}</style>
        ${rows}
        <div id="ex-form" style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px">
          <label style="margin-bottom:8px">Name<input id="ex-name" type="text" placeholder="Dummy panel, exposed filler…"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
            <label>Width<input id="ex-w" type="number" step="any" min="1"></label>
            <label>Height<input id="ex-h" type="number" step="any" min="1"></label>
            <label>Thick<input id="ex-t" type="number" step="any" min="1" value="18"></label>
            <label>Qty<input id="ex-q" type="number" step="1" min="1" value="1"></label>
          </div>
          <button id="ex-add" style="margin-top:10px">+ Add piece</button>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button id="ex-close">Close</button></div>
      </div></div>`;
      const close = () => { m.innerHTML = ''; };
      m.querySelector('.ov').addEventListener('click', (e) => { if (e.target.classList.contains('ov')) close(); });
      $('#ex-close', m).onclick = close;
      $('#ex-add', m).onclick = async () => {
        const w = toMM(+$('#ex-w', m).value), h = toMM(+$('#ex-h', m).value), th = toMM(+$('#ex-t', m).value), q = Math.max(1, parseInt($('#ex-q', m).value, 10) || 1);
        if (!(w > 0 && h > 0 && th > 0)) return toast('Enter Width, Height and Thickness', true);
        const ex = { id: Date.now(), name: ($('#ex-name', m).value || '').trim(), w: Math.round(w), h: Math.round(h), thick: Math.round(th), qty: q };
        await patch({ extras: [...currentExtras(), ex] });
        render();
      };
      m.querySelectorAll('.ex-del').forEach((b) => b.onclick = async () => { await patch({ extras: currentExtras().filter((x) => String(x.id) !== String(b.dataset.id)) }); render(); });
    };
    render();
  }

  // ── Labels (print) — part stickers + box-content stickers, each with a QR code ──
  // Pure client-side: built from model.cutList (the fields the engine already returns). No engine call.
  function qrDataUrl(text) {
    if (typeof qrcode !== 'function') return '';
    try { const q = qrcode(0, 'M'); q.addData(String(text)); q.make(); return q.createDataURL(4, 0); }
    catch (e) { try { const q = qrcode(0, 'L'); q.addData(String(text).slice(0, 200)); q.make(); return q.createDataURL(4, 0); } catch (_) { return ''; } }
  }
  function openPrint(title, css, bodyHTML) {
    const win = window.open('', '_blank');
    if (!win) return toast('Allow pop-ups to print', true);
    win.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + css + '</style></head><body>' + bodyHTML +
      '<div class="noprint" style="text-align:center;margin:9mm 0"><button onclick="window.print()" style="font:14px system-ui;padding:8px 16px;cursor:pointer">Print / Save as PDF</button></div></body></html>');
    win.document.close();
    setTimeout(function () { try { win.focus(); win.print(); } catch (e) {} }, 500);
  }
  const LABEL_CSS = `@page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;font:11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111}
    .sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
    .lbl{border:1px solid #222;border-radius:5px;padding:2.5mm 3mm;height:34mm;display:flex;align-items:center;gap:2mm;overflow:hidden;page-break-inside:avoid;break-inside:avoid}
    .lbl .info{flex:1;min-width:0}.lbl .nm{font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lbl .nm .no{color:#666;font-weight:600;font-size:10px}.lbl .mod{color:#333;font-size:10px;margin:1px 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lbl .dim{font-size:10.5px;line-height:1.5}.lbl .qty{font-size:11px;font-weight:700;margin-top:1px}
    .lbl .qr img{width:20mm;height:20mm;image-rendering:pixelated;display:block}`;
  const BOX_CSS = `@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font:13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111}
    .box-lbl{border:2px solid #111;border-radius:8px;padding:9mm;page-break-after:always}
    .bhead{display:flex;justify-content:space-between;align-items:flex-start;gap:8mm;border-bottom:1.5px solid #111;padding-bottom:5mm;margin-bottom:5mm}
    .btitle{font-size:22px;font-weight:800}.bmod{font-size:14px;color:#333;margin-top:2px}.bqr{width:28mm;height:28mm;image-rendering:pixelated}
    table.btbl{width:100%;border-collapse:collapse;font-size:13px}.btbl th,.btbl td{border:1px solid #999;padding:4px 8px;text-align:right}
    .btbl th:first-child,.btbl td:first-child{text-align:left}.btot{margin-top:5mm;font-size:15px}`;
  const dimStr = (p) => `W ${fmtU(p.w)} · H ${fmtU(p.h)} · D ${fmtU(p.d)}`;
  function partLabelCell(p, piece) {
    const qr = qrDataUrl(`WV|${p.module || ''}|${p.name}|#${p.partNo}|${Math.round(p.w)}x${Math.round(p.h)}x${Math.round(p.d)}x${Math.round(p.thick)}`);
    const qtyLine = piece ? `Piece ${piece.i} / ${piece.n}` : `Qty ${p.qty}`;
    return `<div class="lbl"><div class="info">
      <div class="nm">${esc(p.name)} <span class="no">#${p.partNo}</span></div>
      <div class="mod">${esc(p.module || '')}</div>
      <div class="dim">${dimStr(p)}<br>Thick ${fmtU(p.thick)}</div>
      <div class="qty">${qtyLine}</div>
    </div>${qr ? `<div class="qr"><img src="${qr}"></div>` : ''}</div>`;
  }
  function printPartLabels(perPiece) {
    const list = (model && model.cutList) || [];
    if (!list.length) return toast('Nothing to label', true);
    const cells = [];
    for (const p of list) {
      const n = Math.max(1, p.qty | 0);
      if (perPiece) for (let i = 1; i <= n; i++) cells.push(partLabelCell(p, { i, n }));
      else cells.push(partLabelCell(p, null));
    }
    openPrint('Part labels', LABEL_CSS, `<div class="sheet">${cells.join('')}</div>`);
  }
  function printBoxLabel(title, items) {
    if (!items.length) return toast('Select at least one panel for the box', true);
    const u = curUnit();
    const total = items.reduce((a, x) => a + (x.qty | 0), 0);
    const mods = [...new Set(items.map((x) => x.module).filter(Boolean))].join(', ');
    const rows = items.map((x) => `<tr><td>${esc(x.name)}</td><td>${fmtU(x.w)} × ${fmtU(x.h)} × ${fmtU(x.d)}</td><td>${fmtU(x.thick)}</td><td>${x.qty}</td></tr>`).join('');
    const qr = qrDataUrl(`WV-BOX|${title}|${mods}|panels:${total}`);
    const body = `<div class="box-lbl">
      <div class="bhead"><div><div class="btitle">${esc(title)}</div><div class="bmod">${esc(mods)}</div></div>${qr ? `<img class="bqr" src="${qr}">` : ''}</div>
      <table class="btbl"><thead><tr><th>Part</th><th>Size (${u})</th><th>Thick (${u})</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="btot">Total panels in this box: <b>${total}</b></div>
    </div>`;
    openPrint('Box label — ' + title, BOX_CSS, body);
  }
  function labelsModal() {
    const list = (model && model.cutList) || [];
    if (!list.length) return toast('Nothing to label yet', true);
    const m = $('#wv-modal');
    let mode = 'part';
    const partView = () => `<p class="hint">One sticker per part with a QR code, printed 3-across on A4.</p>
      <label class="lb-opt"><input type="radio" name="lblmode" value="piece" checked> One label per <b>piece</b> (expand quantities)</label>
      <label class="lb-opt"><input type="radio" name="lblmode" value="type"> One label per <b>part type</b> (quantity shown on the label)</label>
      <button id="lbl-print-part" class="lb-print">🖨 Print part labels</button>`;
    const boxView = () => `<p class="hint">Tick the panels going into this box (lower a Qty to split a part across boxes), then print the box-content sticker. Repeat per box.</p>
      <label class="lb-title">Box label<input id="box-title" type="text" value="Box 1"></label>
      <div class="lb-actions"><button id="box-all" type="button">Select all</button><button id="box-none" type="button">Clear</button></div>
      <div id="box-list">${list.map((p, i) => `<label class="box-row"><input type="checkbox" class="box-chk" data-i="${i}"><span class="bnm">${esc(p.name)} <span class="bmuted">· ${esc(p.module || '')} · ${dimStr(p)} · T ${fmtU(p.thick)}</span></span><input type="number" class="box-qty" data-i="${i}" min="0" max="${p.qty}" value="${p.qty}"></label>`).join('')}</div>
      <div id="box-count" class="bmuted"></div>
      <button id="lbl-print-box" class="lb-print">🖨 Print box sticker</button>`;
    const render = () => {
      m.innerHTML = `<div class="ov"><div class="box" style="width:min(620px,94vw)">
        <style>
          .seg{display:flex;gap:6px;margin-bottom:12px}.seg button{flex:1}.seg button.on{background:var(--accent);color:#2a1d02;border-color:var(--accent);font-weight:600}
          .lb-opt{display:flex;align-items:center;justify-content:flex-start;gap:8px;color:var(--ink);margin:6px 0}.lb-opt input{width:auto}
          .lb-print{margin-top:12px}.lb-title{display:flex;flex-direction:column;align-items:stretch;gap:3px;color:var(--muted);font-size:12px}.lb-title input{width:100%}
          .lb-actions{display:flex;gap:8px;margin:8px 0}
          #box-list{max-height:40vh;overflow:auto;border:1px solid var(--line);border-radius:6px;padding:4px 8px;margin-top:6px}
          .box-row{display:grid;grid-template-columns:auto 1fr 60px;gap:8px;align-items:center;justify-content:stretch;color:var(--ink);margin:0;padding:5px 0;border-bottom:1px solid var(--line)}
          .box-row:last-child{border-bottom:0}.box-row input[type=checkbox]{width:auto}.box-row .box-qty{width:100%}.bnm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bmuted{color:var(--muted);font-size:12px}
        </style>
        <h3>Labels</h3>
        <div class="seg"><button id="seg-part" type="button" class="${mode === 'part' ? 'on' : ''}">Part labels</button><button id="seg-box" type="button" class="${mode === 'box' ? 'on' : ''}">Box label</button></div>
        <div id="lbl-body">${mode === 'part' ? partView() : boxView()}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:14px"><button id="lbl-close" type="button">Close</button></div>
      </div></div>`;
      const close = () => { m.innerHTML = ''; };
      m.querySelector('.ov').addEventListener('click', (e) => { if (e.target.classList.contains('ov')) close(); });
      $('#lbl-close', m).onclick = close;
      $('#seg-part', m).onclick = () => { mode = 'part'; render(); };
      $('#seg-box', m).onclick = () => { mode = 'box'; render(); };
      if (mode === 'part') {
        $('#lbl-print-part', m).onclick = () => { const per = (m.querySelector('input[name=lblmode]:checked') || {}).value !== 'type'; close(); printPartLabels(per); };
      } else {
        const upd = () => { let n = 0; m.querySelectorAll('.box-chk').forEach((c) => { if (c.checked) n += Math.max(0, parseInt(m.querySelector(`.box-qty[data-i="${c.dataset.i}"]`).value, 10) || 0); }); $('#box-count', m).textContent = `${n} panel(s) selected for this box`; };
        $('#box-all', m).onclick = () => { m.querySelectorAll('.box-chk').forEach((c) => c.checked = true); upd(); };
        $('#box-none', m).onclick = () => { m.querySelectorAll('.box-chk').forEach((c) => c.checked = false); upd(); };
        m.querySelectorAll('.box-chk, .box-qty').forEach((el) => el.addEventListener('input', upd));
        upd();
        $('#lbl-print-box', m).onclick = () => {
          const title = ($('#box-title', m).value || 'Box').trim();
          const items = [];
          m.querySelectorAll('.box-chk').forEach((c) => {
            if (!c.checked) return; const i = +c.dataset.i, p = list[i];
            const q = Math.min(p.qty | 0, Math.max(0, parseInt(m.querySelector(`.box-qty[data-i="${i}"]`).value, 10) || 0));
            if (q > 0) items.push({ name: p.name, module: p.module, w: p.w, h: p.h, d: p.d, thick: p.thick, qty: q });
          });
          if (!items.length) return toast('Select at least one panel (qty > 0)', true);
          printBoxLabel(title, items);
        };
      }
    };
    render();
  }

  // ── Exports (client presentation from the render model — no engine) ──
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

  function exportCSV() {
    if (!model) return; const u = curUnit();
    const rows = [['Part #', 'Part', 'Module', 'Qty', `Width (${u})`, `Height (${u})`, `Depth (${u})`, `Thick (${u})`, 'Banded edges']];
    for (const p of model.cutList || []) rows.push([p.partNo != null ? p.partNo : '', p.name, `"${p.module || ''}"`, p.qty, fmtU(p.w), fmtU(p.h), fmtU(p.d), fmtU(p.thick), `"${p.band}"`]);
    download('cutlist.csv', new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
  }

  // Render one nesting sheet to a PNG data URL (reuses the on-screen drawPlacement).
  function sheetImage(sheet, i, SW, SH) {
    const scale = 680 / Math.max(SW, SH);
    const c = document.createElement('canvas'); c.width = Math.round(SW * scale); c.height = Math.round(SH * scale);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = '#333'; x.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
    for (const p of sheet.placements) drawPlacement(x, p, 0, 0, scale, true, { sheetNo: i + 1 });
    return c.toDataURL('image/png');
  }
  // Render the current 2D elevation to a PNG (white paper).
  function capture2D(m2, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); if (!m2) return c;
    const w = m2.cab.w, h = m2.cab.h, pad = 70, s = Math.min((W - 2 * pad) / (w || 1), (H - 2 * pad) / (h || 1)), ox = (W - w * s) / 2, oy = (H - h * s) / 2, cabH = h;
    for (const rc of m2.rects) { const X = ox + rc.x0 * s, Y = oy + (cabH - rc.y1) * s, ww = (rc.x1 - rc.x0) * s, hh = (rc.y1 - rc.y0) * s; if (rc.fill) { x.fillStyle = rc.fill; x.fillRect(X, Y, ww, hh); } if (rc.stroke) { x.strokeStyle = rc.stroke; x.lineWidth = 1; x.strokeRect(X + 0.5, Y + 0.5, ww - 1, hh - 1); } }
    for (const H2 of (m2.handles || [])) { const hx = ox + H2.x * s, hy = oy + (cabH - H2.y) * s; if (H2.kind === 'door') { x.fillStyle = '#5b3a1a'; x.fillRect(hx - 1.5, hy - 13, 3, 26); } else { x.strokeStyle = '#2a1d02'; x.lineWidth = 2; x.beginPath(); x.moveTo(hx - 18, hy + 14); x.lineTo(hx + 18, hy + 14); x.stroke(); } }
    // Arrowed dimensions, dark text on white paper.
    const sx = (xmm) => ox + xmm * s, sy = (ymm) => oy + (cabH - ymm) * s;
    for (const cell of (m2.openings || [])) cellDim(x, cell, sx, sy, '#ffffff', '#222');
    drawOverallDims(x, w, h, m2.sides, sx, sy, '#ffffff', '#222');
    return c;
  }
  // Render the current 3D isometric to a PNG (white paper), neutral camera.
  function capture3D(m3, m2, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); if (!m3 || !m2) return c;
    const cab = m2.cab, cen = [cab.w / 2, cab.h / 2, (cab.d || 560) / 2];
    const yaw = -0.6, pitch = 0.5, cY = Math.cos(yaw), sY = Math.sin(yaw), cX = Math.cos(pitch), sX = Math.sin(pitch);
    const rot = (X, Y, Z) => { X -= cen[0]; Y -= cen[1]; Z -= cen[2]; const x1 = X * cY + Z * sY, z1 = -X * sY + Z * cY, y1 = Y; return [x1, y1 * cX - z1 * sX, y1 * sX + z1 * cX]; };
    const FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    const rb = m3.boxes.map((b) => { const rc = [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0], [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]].map((p) => rot(p[0], p[1], p[2])); rc.forEach((p) => { if (p[0] < mnX) mnX = p[0]; if (p[0] > mxX) mxX = p[0]; if (p[1] < mnY) mnY = p[1]; if (p[1] > mxY) mxY = p[1]; }); return { b, rc }; });
    const pad = 50, s = Math.min((W - 2 * pad) / Math.max(1, mxX - mnX), (H - 2 * pad) / Math.max(1, mxY - mnY));
    const oX = (W - (mxX + mnX) * s) / 2, oY = (H + (mxY + mnY) * s) / 2, proj = (p) => [oX + p[0] * s, oY - p[1] * s];
    const L = (() => { const v = [-0.3, 0.65, 0.7], m = Math.hypot(v[0], v[1], v[2]); return v.map((k) => k / m); })();
    const faces = [];
    for (const { b, rc } of rb) for (const f of FACES) {
      const p0 = rc[f[0]], p1 = rc[f[1]], p2 = rc[f[2]], u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const nm = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map((k) => k / nm);
      const sh = 0.42 + 0.58 * Math.abs(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]), depth = (rc[f[0]][2] + rc[f[1]][2] + rc[f[2]][2] + rc[f[3]][2]) / 4, rgbc = b.base.map((k) => Math.round(k * sh));
      faces.push({ pts: f.map((i) => proj(rc[i])), depth, color: b.alpha < 1 ? `rgba(${rgbc.join(',')},${b.alpha})` : `rgb(${rgbc.join(',')})` });
    }
    faces.sort((a, b) => a.depth - b.depth);
    for (const fc of faces) { x.beginPath(); x.moveTo(fc.pts[0][0], fc.pts[0][1]); for (let i = 1; i < 4; i++) x.lineTo(fc.pts[i][0], fc.pts[i][1]); x.closePath(); x.fillStyle = fc.color; x.fill(); x.strokeStyle = 'rgba(40,40,40,0.5)'; x.lineWidth = 1; x.stroke(); }
    return c;
  }

  function cutTableHTML() {
    const u = curUnit();
    const rows = (model.cutList || []).map((p) => `<tr><td>${p.partNo != null ? p.partNo : ''}</td><td>${esc(p.name)}</td><td>${esc(p.module || '')}</td><td>${p.qty}</td><td>${fmtU(p.w)}</td><td>${fmtU(p.h)}</td><td>${fmtU(p.d)}</td><td>${fmtU(p.thick)}</td><td>${esc(p.band)}</td></tr>`).join('');
    return `<table><thead><tr><th>#</th><th>Part</th><th>Module</th><th>Qty</th><th>W (${u})</th><th>H (${u})</th><th>D (${u})</th><th>Thick (${u})</th><th>Edges</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function printDoc(title, bodyHTML) {
    const win = window.open('', '_blank'); if (!win) { toast('Allow pop-ups to export', true); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><style>
      body{font:13px system-ui,sans-serif;color:#111;margin:24px}h1{font-size:18px}h2{font-size:14px;margin-top:22px}
      table{border-collapse:collapse;width:100%;max-width:620px}th,td{border:1px solid #999;padding:4px 8px;text-align:right}th:first-child,td:first-child{text-align:left}
      figure{margin:0 0 16px;page-break-inside:avoid}img{max-width:100%;border:1px solid #ccc}figcaption{color:#555;font-size:12px;margin-top:4px}
      .imgs{display:flex;gap:16px;flex-wrap:wrap}@media print{button{display:none}}</style></head><body>${bodyHTML}
      <button onclick="window.print()">Print / Save as PDF</button></body></html>`);
    win.document.close(); setTimeout(() => win.print(), 400);
  }
  function exportPDF() {
    if (!model) return; const sh = model.sheets || { sheets: [] }, SW = sh.SW, SH = sh.SH, u = curUnit();
    const imgs = (sh.sheets || []).map((s, i) => `<figure><img src="${sheetImage(s, i, SW, SH)}"><figcaption>Sheet ${i + 1} — ${fmtU(SW)}×${fmtU(SH)} ${u}</figcaption></figure>`).join('');
    const t = model.totals || {};
    printDoc('Cut list', `<h1>WallView — Cut List</h1>
      <p>Parts: <b>${t.parts || 0}</b> · Board: <b>${fmt(t.areaM2 || 0)} m²</b> · Tape: <b>${fmt(t.tapeM || 0)} m</b> · Sheets: <b>${(sh.sheets || []).length}</b> @ <b>${((Math.min(1, sh.utilisation || 0)) * 100).toFixed(1)}%</b> (${scope === 'job' ? 'whole job' : 'this module'})</p>
      ${cutTableHTML()}<h2>Sheet layout</h2><div class="imgs">${imgs}</div>`);
  }
  // One module's drawing block (elevation + 3D) for the production pack.
  function modBlock(name, m2, m3) {
    return `<h2>${esc(name)}</h2><div class="imgs">
      <figure><img src="${capture2D(m2, 520, 600).toDataURL('image/png')}"><figcaption>Elevation</figcaption></figure>
      <figure><img src="${capture3D(m3, m2, 520, 520).toDataURL('image/png')}"><figcaption>3D</figcaption></figure></div>`;
  }
  async function exportProdPack() {
    if (!model) return; const sh = model.sheets || { sheets: [] }, SW = sh.SW, SH = sh.SH, u = curUnit();
    const sheets = (sh.sheets || []).map((s, i) => `<figure><img src="${sheetImage(s, i, SW, SH)}"><figcaption>Sheet ${i + 1}</figcaption></figure>`).join('');
    let blocks;
    if (scope === 'job' && design && design.modules && design.modules.length > 1) {
      // Per-module drawings across the whole job.
      const parts = [];
      for (let i = 0; i < design.modules.length; i++) {
        let mm; try { mm = await api('POST', `/${T()}/engine/compute`, { design: Object.assign({}, design, { active: i }), scope: 'module', render: true }); } catch (e) { continue; }
        parts.push(modBlock(design.modules[i].name || ('Module ' + (i + 1)), mm.module2d, mm.module3d));
      }
      blocks = parts.join('');
    } else {
      const cab = (model.module2d || {}).cab || {};
      blocks = `<p>Cabinet ${fmtU(cab.w)}×${fmtU(cab.h)}×${fmtU(cab.d)} ${u}</p>` + modBlock(projName || 'Module', model.module2d, model.module3d);
    }
    printDoc('Production pack', `<h1>WallView — Production Pack</h1>${blocks}
      <h2>Cut list${scope === 'job' ? ' (whole job)' : ''}</h2>${cutTableHTML()}
      <h2>Sheet layout</h2><div class="imgs">${sheets}</div>`);
  }

  // ── Setup form (mirrors the design; every control patches the design) ──
  function populateSetup() {
    const m = design && design.modules && design.modules[active]; if (!m) return;
    const cab = m.cab || {}, bp = m.backPanel || {}, sheet = m.sheet || {}, top = cab.top || {}, bot = cab.bottom || {};
    const set = (id, v) => {
      const el = $('#' + id); if (!el || el.type === 'checkbox') return;
      el.value = (v == null) ? '' : (el.type === 'number' ? (curUnit() === 'in' ? +(v / MM_PER_IN).toFixed(3) : Math.round(v)) : v);
    };
    const chk = (id, v) => { const el = $('#' + id); if (el) el.checked = !!v; };
    set('in-h', cab.h); set('in-w', cab.w); set('in-d', cab.d); set('in-t', cab.t);
    chk('in-back', cab.back !== false); chk('in-side-l', cab.sideL !== false); chk('in-side-r', cab.sideR !== false);
    set('in-preset', m.preset || 'custom'); set('in-wood-theme', m.woodTheme || 'birch');
    set('in-back-type', bp.type || 'groove'); set('in-back-thk', bp.thickness); set('in-back-groove', bp.groove); set('in-back-setback', bp.setback);
    chk('in-top-on', top.on !== false); set('in-top-mount', top.mount || 'inset'); set('in-top-depth', top.depth); set('in-top-anchor', top.anchor || 'back');
    chk('in-bot-on', bot.on !== false); set('in-bot-mount', bot.mount || 'inset'); set('in-bot-depth', bot.depth); set('in-bot-anchor', bot.anchor || 'back');
    set('in-sw', sheet.w); set('in-sh', sheet.h); set('in-kerf', sheet.kerf); chk('in-grain', !!m.grainLock);
    set('in-reveal', (m.doors || {}).reveal);
    if ($('#unit-mm')) $('#unit-mm').classList.toggle('active', (m.unit || 'mm') === 'mm');
    if ($('#unit-in')) $('#unit-in').classList.toggle('active', m.unit === 'in');
  }

  // ── Module bar (switch / add / rename / delete) ──
  let modEditIndex = null;
  function renderModuleBar() {
    const bar = $('#module-bar'); const mods = (design && design.modules) || [];
    const chips = mods.map((m, i) => {
      const act = i === active;
      const x = act ? ` <span class="mod-edit" data-edit="${i}" title="Rename">✎</span> <span class="mod-x" data-del="${i}" title="Delete">✕</span>` : '';
      return `<button class="mod-chip${act ? ' active' : ''}" data-mi="${i}" type="button">${esc(m.name || ('Module ' + (i + 1)))}${x}</button>`;
    }).join('');
    bar.innerHTML = `<span class="mod-label">${mods.length ? 'Modules' : 'No modules'}</span>${chips}<button id="mod-add" class="mod-add" type="button"><span class="mod-add-ico">+</span>New</button>`;
    bar.querySelectorAll('.mod-chip').forEach((b) => b.onclick = (e) => {
      const del = e.target.closest('.mod-x'); if (del) {
        e.stopPropagation(); const i = +del.dataset.del;
        if (confirm(`Delete "${(mods[i] && mods[i].name) || ('Module ' + (i + 1))}"? This cannot be undone.`)) editIntent('delete_module', { index: i });
        return;
      }
      const ed = e.target.closest('.mod-edit'); if (ed) { e.stopPropagation(); openModPanel(+ed.dataset.edit); return; }
      active = +b.dataset.mi; clearSelection(); renderModuleBar(); populateSetup(); recompute();
    });
    if ($('#mod-add')) $('#mod-add').onclick = () => openModPanel(null);
    document.body.classList.toggle('no-modules', mods.length === 0);
  }
  function openModPanel(editIndex) {
    const panel = $('#module-add-panel'); if (!panel) return;
    modEditIndex = editIndex; const editing = editIndex != null; const m = editing ? design.modules[editIndex] : null;
    $('#map-title').textContent = editing ? 'Rename module' : 'New module';
    $('#mod-add-confirm').textContent = editing ? 'Save' : 'Add';
    $('#mod-code').value = editing ? (m.code || '') : '';
    $('#mod-name').value = editing ? (m.name || ('Module ' + (editIndex + 1))) : ('Module ' + ((design.modules ? design.modules.length : 0) + 1));
    panel.classList.remove('hidden'); $('#mod-name').focus();
  }
  function confirmModPanel() {
    const name = $('#mod-name').value.trim() || ('Module ' + ((design.modules ? design.modules.length : 0) + 1));
    $('#module-add-panel').classList.add('hidden');
    if (modEditIndex != null) editIntent('rename_module', { index: modEditIndex, name });
    else editIntent('add_module', { name });
    modEditIndex = null;
  }

  // ── Redraw current tab ──
  function redraw() {
    if (tab === 'design') { mode === '3d' ? draw3D() : draw2D(); }
    else if (tab === 'sheet') drawSheet();
    else if (tab === 'room') drawRoom();
  }

  async function recompute() {
    if (!design) return;
    // Point the design at the active module (server computes that one for module scope).
    const d = Object.assign({}, design, { active });
    try { model = await api('POST', `/${T()}/engine/compute`, { design: d, scope, render: true }); }
    catch (e) { return toast(e.message, true); }
    cam2.fit = true; cam3.fit = true;
    renderCutList(); redraw();
  }

  // Set the cut-list / sheet scope (module = this cabinet, job = whole job) and
  // reflect it in the toggle. Recomputes only when the scope actually changes.
  function setScope(s) {
    const bm = $('#scope-module'), bj = $('#scope-job');
    if (bm) bm.classList.toggle('active', s === 'module');
    if (bj) bj.classList.toggle('active', s === 'job');
    if (scope === s) return;
    scope = s; recompute();
  }

  // Edit intent: the server applies the op (real engine) and returns the updated
  // design + render model. The client keeps only the design document (data) and
  // redraws — it never computes geometry. Camera is preserved (no refit).
  let editing = false;
  async function editIntent(op, args) {
    if (!design || editing) return;
    editing = true;
    const d = Object.assign({}, design, { active });
    const prevActive = active;
    try {
      const r = await api('POST', `/${T()}/engine/edit`, { design: d, op, args: args || {}, scope });
      design = r.design; model = r.model;
      if (design && design.active != null) active = design.active;   // module ops can change the active index
      renderModuleBar(); populateSetup(); renderCutList();
      if (active !== prevActive) {
        cam2.fit = true; cam3.fit = true; selectedId = null; const p = $('#card-selected'); if (p) p.classList.add('hidden'); redraw();
      } else {
        redraw();
        // Refresh the open selection panel with server-canonical values + derived calcs.
        if (selectedId != null && (typeof selectedId === 'string' || compById(selectedId))) showSelection(selectedId);
      }
    } catch (e) { toast(e.message, true); }
    finally { editing = false; }
  }
  // Config edit: patch design-doc fields (data) and let the server recompute.
  const patch = (obj) => editIntent('patch', { patch: obj });

  async function openDesign(id, name) {
    try { const p = await api('GET', `/${T()}/projects/${id}`); design = p.design || {}; projId = id; projName = name || p.name; active = design.active != null ? design.active : 0; }
    catch (e) { return toast(e.message, true); }
    $('#wv-proj').textContent = projName;
    renderModuleBar(); populateSetup(); await recompute();
  }
  // Start a fresh empty design (e.g. a tenant with no saved projects yet).
  function startEmptyDesign() {
    design = { name: 'Untitled', modules: [], active: -1 };
    projId = null; projName = 'Untitled'; active = -1; model = null;
    $('#wv-proj').textContent = projName;
    renderModuleBar();   // renders "+ New" + toggles the no-modules empty states on
    redraw();            // draw2D returns early (no model) — blank canvas
  }

  // ── Save (cloud projects) ──
  async function saveDesign() {
    if (!design) return;
    if (projId == null) return saveAsDesign();
    try { await api('PUT', `/${T()}/projects/${projId}`, { name: projName, design: foldDesign() }); toast('Saved “' + projName + '”'); }
    catch (e) { toast(e.message, true); }
  }
  async function saveAsDesign() {
    if (!design) return;
    const name = prompt('Save design as:', projName && projName !== 'Untitled' ? projName : (design.name || 'Job 1'));
    if (!name) return;
    try { const r = await api('POST', `/${T()}/projects`, { name: name.trim(), design: foldDesign() }); projId = r.id; projName = r.name; $('#wv-proj').textContent = projName; toast('Saved “' + projName + '”'); }
    catch (e) { toast(e.message, true); }
  }
  const foldDesign = () => Object.assign({}, design, { active });

  function projectsModal() {
    api('GET', `/${T()}/projects`).then((r) => {
      const list = r.projects || []; const m = $('#wv-modal');
      m.innerHTML = `<div class="ov"><div class="box"><h3>Projects</h3>${list.length
        ? list.map((p) => `<div class="row" data-id="${esc(p.id)}" data-name="${esc(p.name)}"><span class="n">${esc(p.name)}</span><span class="d">${esc(p.updatedAt)}</span></div>`).join('')
        : '<p class="hint">No saved designs yet.</p>'}
        <div style="display:flex;gap:8px;margin-top:10px">
          <button id="wv-mnew">New design</button><button id="wv-msaveas">Save current as…</button><button id="wv-mclose">Close</button>
        </div></div></div>`;
      const close = () => { m.innerHTML = ''; };
      m.querySelector('.ov').addEventListener('click', (e) => { if (e.target.classList.contains('ov')) close(); });
      $('#wv-mclose', m).onclick = close;
      $('#wv-mnew', m).onclick = () => { close(); startEmptyDesign(); toast('New design — click “+ New” to add a module.'); };
      $('#wv-msaveas', m).onclick = () => { close(); saveAsDesign(); };
      m.querySelectorAll('.row').forEach((row) => row.onclick = () => { close(); openDesign(row.dataset.id, row.dataset.name); });
    }).catch((e) => toast(e.message, true));
  }

  // ── Tabs / view toggles / camera input ──
  function showTab(name) {
    if (cellMode && name !== 'design') setCellMode(false);
    tab = name;
    $$('.tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    const views = { design: '#design-canvas', room: '#room-canvas', sheet: '#sheet-canvas', setup: '#setup-view', 'drawer-setup': '#drawer-setup-view' };
    $$('.canvas-wrap > .view').forEach((v) => v.classList.remove('active'));
    const sel = views[name]; if (sel && $(sel)) $(sel).classList.add('active');
    const inDesign = name === 'design';
    $('#view-toggle').style.visibility = inDesign ? 'visible' : 'hidden';
    $('#zoom-ctl').classList.toggle('hidden', !inDesign);
    if ($('#btn-measure')) $('#btn-measure').classList.toggle('hidden', !inDesign);
    if ($('#dims-wrap')) $('#dims-wrap').classList.toggle('hidden', !inDesign);
    if ($('#room-view-toggle')) $('#room-view-toggle').classList.toggle('hidden', name !== 'room');
    if ($('#room-modules')) $('#room-modules').classList.toggle('hidden', name !== 'room');
    syncViewTools();
    // Scope follows context: Design works on one cabinet (module), Room spans every
    // module (whole job). Sheet/Setup are neutral — they KEEP the current scope, so
    // Sheet inherits it: Design→Sheet shows this module's sheets, Room→Sheet shows the
    // whole-job sheets. setScope recomputes only if the scope actually changes.
    if (name === 'design') setScope('module');
    else if (name === 'room') setScope('job');
    redraw();
    if (name === 'room') loadRoom();
  }
  function syncViewTools() {
    const ew = $('#explode-wrap'); if (ew) ew.classList.toggle('hidden', !(tab === 'design' && mode === '3d'));
    setCanvasCursor();
  }
  // Precise crosshair while designing in 2D (like the prototype); grab/orbit in 3D.
  function setCanvasCursor() {
    dcv.style.cursor = (tab === 'design' && mode === '2d') ? 'crosshair' : 'grab';
  }
  // Snap a measure click to the nearest rect corner (within ~12px), else free.
  function snapMeasurePoint(clientX, clientY) {
    const r = dcv.getBoundingClientRect(), s = cam2.scale, cabH = model.module2d.cab.h;
    const px = clientX - r.left, py = clientY - r.top;
    let best = { x: (px - cam2.ox) / s, y: cabH - (py - cam2.oy) / s }, bd = 12 * 12;
    const consider = (xm, ym) => { const sx = cam2.ox + xm * s, sy = cam2.oy + (cabH - ym) * s; const d = (sx - px) * (sx - px) + (sy - py) * (sy - py); if (d < bd) { bd = d; best = { x: xm, y: ym }; } };
    for (const rc of model.module2d.rects) { consider(rc.x0, rc.y0); consider(rc.x1, rc.y0); consider(rc.x0, rc.y1); consider(rc.x1, rc.y1); }
    return best;
  }
  // Hit-test a screen point against the tagged part rects → topmost part id.
  function hitTestMM(clientX, clientY) {
    if (!model || !model.module2d) return null;
    const r = dcv.getBoundingClientRect(), S = cam2.scale, cabH = model.module2d.cab.h;
    const xm = (clientX - r.left - cam2.ox) / S, ym = cabH - (clientY - r.top - cam2.oy) / S;
    const tol = 6 / S;   // small grab tolerance for thin panels (matches the prototype)
    // Rank the rects under the cursor: real components (numeric srcId — shelves,
    // verticals, doors, drawers) beat carcass edges (L/R/T/B); within a rank the
    // SMALLEST rect wins, so a shelf inside a bay is picked, never the big panel
    // behind it. The back panel (BK) is intentionally not click-selectable here —
    // it spans the whole cabinet and would swallow every click; select it from
    // the cut list instead, exactly like the prototype.
    let best = null, bestRank = -1, bestArea = Infinity;
    for (const rc of model.module2d.rects) {
      if (rc.srcId == null || String(rc.srcId) === 'BK') continue;
      if (xm < rc.x0 - tol || xm > rc.x1 + tol || ym < rc.y0 - tol || ym > rc.y1 + tol) continue;
      const rank = /^\d+$/.test(String(rc.srcId)) ? 1 : 0;   // 1 = component, 0 = carcass edge
      const area = Math.max(0, rc.x1 - rc.x0) * Math.max(0, rc.y1 - rc.y0);
      if (rank > bestRank || (rank === bestRank && area < bestArea)) { best = rc.srcId; bestRank = rank; bestArea = area; }
    }
    return best;
  }

  // Live position readout while dragging a shelf/vertical (call with null to hide).
  function dragChip(e, mm) {
    let n = document.getElementById('wv-drag-chip');
    if (!e) { if (n) n.style.display = 'none'; return; }
    if (!n) {
      n = document.createElement('div'); n.id = 'wv-drag-chip';
      n.style.cssText = 'position:fixed;z-index:600;pointer-events:none;background:#101418;color:#fff;border:1px solid rgba(255,255,255,.22);border-radius:6px;padding:3px 8px;font:600 12px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.45)';
      document.body.appendChild(n);
    }
    n.textContent = (dragPart && dragPart.type === 'shelf' ? 'Height ' : 'Position ') + fmtU(mm) + ' ' + curUnit() + (dragPart && dragPart.aligned ? '  ·  aligned ✓' : '');
    n.style.left = (e.clientX + 14) + 'px'; n.style.top = (e.clientY + 16) + 'px'; n.style.display = 'block';
  }

  // Selection editor rows (data-path drives a targeted patch_comp on change).
  const selRow = (path, label, val, nounit) => {
    const disp = val == null ? '' : (nounit ? val : (curUnit() === 'in' ? +(val / MM_PER_IN).toFixed(3) : Math.round(val)));
    return `<label class="sel-row"><span>${label}</span><input type="number" step="any" data-path="${path}"${nounit ? ' data-nounit' : ''} value="${disp}" placeholder="${val == null ? 'auto' : ''}"></label>`;
  };
  const optRow = (path, label, opts, cur) => `<label class="sel-row"><span>${label}</span><select data-path="${path}">${opts.map(([v, l]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const chkRow = (path, label, on) => `<label class="sel-row"><span>${label}</span><input type="checkbox" data-path="${path}"${on ? ' checked' : ''}></label>`;
  const subHead = (t) => `<div class="sel-sub">${t}</div>`;
  const pathToObj = (path, val) => { const p = path.split('.'); const root = {}; let o = root; for (let i = 0; i < p.length - 1; i++) { o[p[i]] = {}; o = o[p[i]]; } o[p[p.length - 1]] = val; return root; };
  // Module-level (config) rows — data-mpath patches the active module, not a component.
  const mNumRow = (path, label, val) => { const disp = val == null ? '' : (curUnit() === 'in' ? +(val / MM_PER_IN).toFixed(3) : Math.round(val)); return `<label class="sel-row"><span>${label}</span><input type="number" step="any" data-mpath="${path}" value="${disp}" placeholder="${val == null ? 'full' : ''}"></label>`; };
  const mOptRow = (path, label, opts, cur) => `<label class="sel-row"><span>${label}</span><select data-mpath="${path}">${opts.map(([v, l]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  // "Part name": custom cut-list label. Components store it on themselves (data-path=customName → patch_comp);
  // carcass faces store it in the module (data-mpath=partNames.<id> → patch). Empty ⇒ the engine's default name.
  const nameRowComp = (val) => `<label class="sel-row"><span>Part name</span><input type="text" data-path="customName" value="${esc(val || '')}" placeholder="Custom name"></label>`;
  const nameRowCarcass = (id, val) => `<label class="sel-row"><span>Part name</span><input type="text" data-mpath="partNames.${id}" value="${esc(val || '')}" placeholder="Custom name"></label>`;

  function showSelection(id) {
    const panel = $('#card-selected');
    // Carcass panels — caps (top/bottom) are editable (mount/depth/anchor);
    // sides + back are read-only. All are deletable. Sizes come from the
    // engine-computed cut list, so the calculations shown are exact.
    if (typeof id === 'string') {
      selectedId = id;
      const m = (design && design.modules && design.modules[active]) || { cab: {} }, cab = m.cab || {};
      const names = { L: 'Left side', R: 'Right side', T: 'Top panel', B: 'Bottom panel', BK: 'Back panel' };
      const row = (model.cutList || []).find((r) => String(r.srcId) === String(id)) || {};
      $('#sel-title').innerHTML = `${names[id] || 'Panel'} <small>(${curUnit()})</small>`;
      const pn = (m.partNames || {})[id];
      if (id === 'T' || id === 'B') {
        const which = id === 'T' ? 'top' : 'bottom', cap = cab[which] || {};
        $('#sel-fields').innerHTML =
          nameRowCarcass(id, pn)
          + mOptRow(`cab.${which}.mount`, 'Mount', [['inset', 'Inset (between sides)'], ['outset', 'Outset (over sides)']], cap.mount || 'inset')
          + mNumRow(`cab.${which}.depth`, 'Depth', cap.depth)
          + mOptRow(`cab.${which}.anchor`, 'Anchor', [['back', 'Back'], ['center', 'Center'], ['front', 'Front']], cap.anchor || 'back');
        const sh = (model.module2d.sides || {}).height;
        $('#sel-derived').textContent = `Panel ${fmtU(row.w || 0)} × ${fmtU(row.d || 0)} ${curUnit()} · ${cap.mount || 'inset'}. Sides now ${fmtU(sh || cab.h || 0)}. Depth = full ⇒ aligned to sides. Delete removes it (restore in Setup).`;
      } else {
        $('#sel-fields').innerHTML =
          nameRowCarcass(id, pn)
          + `<div class="sel-ro">Width <b>${fmtU(row.w || 0)}</b></div><div class="sel-ro">Height <b>${fmtU(row.h || 0)}</b></div><div class="sel-ro">Depth <b>${fmtU(row.d || 0)}</b></div><div class="sel-ro">Thickness <b>${fmtU(row.thick || 0)}</b></div>`;
        $('#sel-derived').textContent = 'Read-only size (set via the Setup Sizes). Delete removes this panel — restore it in Setup.';
      }
      const sd0 = $('#sel-delete'); if (sd0) sd0.style.display = '';     // carcass panels are deletable
      const su0 = $('#sel-update'); if (su0) su0.style.display = 'none'; // edits apply live
      panel.classList.remove('hidden'); markCutRows(); redraw(); return;
    }
    selectedId = id; const c = compById(id);
    if (!c) { clearSelection(); return; }
    const sd = $('#sel-delete'); if (sd) sd.style.display = '';   // components are deletable
    const label = { shelf: 'Shelf', vertical: 'Vertical', door: 'Door', drawer: 'Drawer' }[c.type] || 'Part';
    $('#sel-title').textContent = label;
    let html = '';
    if (c.type === 'shelf' || c.type === 'vertical') {
      const isShelf = c.type === 'shelf';
      html = nameRowComp(c.customName)
        + selRow('pos', isShelf ? 'Height (mm)' : 'Position (mm)', Math.round(c.pos || 0))
        + selRow('thick', 'Thickness (mm)', c.thick)
        + selRow('depth', 'Depth (mm)', c.depth)
        + selRow('setback', 'Setback from back (mm)', c.setback || 0);
    } else if (c.type === 'door') {
      html = nameRowComp(c.customName)
        + optRow('count', 'Leaves', [[1, '1 door'], [2, '2 doors']], c.count || 1)
        + optRow('mount', 'Front', [['outset', 'Outset (overlay)'], ['inset', 'Inset']], c.mount || 'outset')
        + optRow('valign', 'Anchor', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], c.valign || 'bottom')
        + optRow('covers', 'Covers', [['cell', 'This cell'], ['column', 'Full column'], ['row', 'Full row'], ['all', 'Whole interior']], c.covers || 'cell');
    } else if (c.type === 'drawer') {
      const ds = c.drawerSetup || {}, sz = ds.size || {}, bp = ds.backPanel || {}, cap = (ds.caps && ds.caps.bottom) || {};
      html = selRow('count', 'Drawers', c.count || 1, true)
        + optRow('mount', 'Front', [['outset', 'Outset'], ['inset', 'Inset']], c.mount || 'outset')
        + optRow('valign', 'Anchor', [['top', 'Top'], ['bottom', 'Bottom']], c.valign || 'bottom')
        + chkRow('boxFront', 'Front side', c.boxFront !== false)
        + subHead('Drawer setup')
        + selRow('drawerSetup.size.height', 'Height', sz.height)
        + selRow('drawerSetup.size.width', 'Width', sz.width)
        + selRow('drawerSetup.size.depth', 'Depth', sz.depth)
        + selRow('drawerSetup.size.thickness', 'Material thickness', sz.thickness)
        + subHead('Bottom panel')
        + optRow('drawerSetup.backPanel.type', 'Fixing', [['groove', 'Groove / dado'], ['rabbet', 'Rabbet'], ['overlay', 'Overlay']], bp.type || 'groove')
        + selRow('drawerSetup.backPanel.thickness', 'Bottom thickness', bp.thickness)
        + selRow('drawerSetup.backPanel.setback', 'Setback from bottom', bp.setback)
        + subHead('Back panel')
        + chkRow('drawerSetup.caps.bottom.on', 'Include back panel', cap.on !== false)
        + optRow('drawerSetup.caps.bottom.mount', 'Back mount', [['inset', 'Inset'], ['outset', 'Outset']], cap.mount || 'outset')
        + selRow('drawerSetup.caps.bottom.setback', 'Setback from rear', cap.setback);
    }
    $('#sel-fields').innerHTML = html;
    $('#sel-derived').textContent = `${label} · id ${id}` + ((c.type === 'shelf' || c.type === 'vertical') ? ' · drag to move' : '');
    const su = $('#sel-update'); if (su) su.style.display = 'none';   // live edits apply on change
    panel.classList.remove('hidden');
    markCutRows(); redraw();
  }
  function clearSelection() { selectedId = null; const p = $('#card-selected'); if (p) p.classList.add('hidden'); markCutRows(); redraw(); }
  // Cross-highlight: mark the cut-list rows whose part is the selected component.
  function markCutRows() {
    document.querySelectorAll('#cutlist tbody tr[data-src]').forEach((tr) => {
      tr.classList.toggle('cl-selected', tr.dataset.src !== '' && tr.dataset.src === String(selectedId));
    });
  }

  // ── Multi-bay door: pick cells, then place one door spanning them ──
  function setCellMode(on) {
    cellMode = on; if (!on) cellSel = [];
    if ($('#door-cells-bar')) $('#door-cells-bar').classList.toggle('hidden', !on);
    if ($('#btn-door-cells')) $('#btn-door-cells').classList.toggle('hidden', on);
    updatePlaceBtn(); redraw();
  }
  function updatePlaceBtn() { const b = $('#btn-door-place'); if (b) { b.textContent = `Place door (${cellSel.length})`; b.disabled = !cellSel.length; } }
  function toggleCell(cell) {
    const sig = cellSig(cell), i = cellSel.findIndex((c) => cellSig(c) === sig);
    if (i >= 0) cellSel.splice(i, 1); else cellSel.push(cell);
    updatePlaceBtn(); draw2D();
  }
  function hitTestOpening(clientX, clientY) {
    const m2 = model && model.module2d; if (!m2 || !m2.openings) return null;
    const r = dcv.getBoundingClientRect(), s = cam2.scale;
    const xm = (clientX - r.left - cam2.ox) / s, ym = m2.cab.h - (clientY - r.top - cam2.oy) / s;
    for (const o of m2.openings) if (xm >= o.left && xm <= o.right && ym >= o.bottom && ym <= o.top) return o;
    return null;
  }

  function wireCamera() {
    let drag = null;
    dcv.addEventListener('mousedown', (e) => {
      // In 2D, clicking a part selects it (and shelves/verticals can be dragged);
      // clicking empty space pans. 3D always orbits/pans.
      if (tab === 'design' && mode === '2d') {
        if (cellMode) { const o = hitTestOpening(e.clientX, e.clientY); if (o) toggleCell(o); return; }
        if (measureOn && model && model.module2d) {
          if (measurePts.length >= 2) measurePts = [];
          measurePts.push(snapMeasurePoint(e.clientX, e.clientY)); draw2D(); return;
        }
        const id = hitTestMM(e.clientX, e.clientY);
        if (id != null) {
          showSelection(id);
          const c = compById(id);
          if (c && (c.type === 'shelf' || c.type === 'vertical')) { dragPart = { id, type: c.type, startPos: c.pos || 0, x: e.clientX, y: e.clientY, moved: false }; dcv.style.cursor = 'grabbing'; }
          return;
        }
        clearSelection();
        // Remember the clicked cell so the next "+ Shelf/Drawer/Door" inserts here.
        const rr = dcv.getBoundingClientRect();
        lastClickMM = { x: (e.clientX - rr.left - cam2.ox) / cam2.scale, y: model.module2d.cab.h - (e.clientY - rr.top - cam2.oy) / cam2.scale };
      }
      drag = { x: e.clientX, y: e.clientY, o2: { ...cam2 }, o3: { ...cam3 }, btn: e.button };
      dcv.style.cursor = 'grabbing';   // panning / orbiting
    });
    // Hover feedback: pointer over a selectable part, crosshair over empty design space.
    dcv.addEventListener('mousemove', (e) => {
      if (drag || dragPart) return;
      if (tab === 'design' && mode === '2d') {
        dcv.style.cursor = (cellMode || measureOn) ? 'crosshair'
          : (hitTestMM(e.clientX, e.clientY) != null ? 'pointer' : 'crosshair');
      } else { dcv.style.cursor = 'grab'; }
    });
    window.addEventListener('mousemove', (e) => {
      if (dragPart) {
        const dxpx = e.clientX - dragPart.x, dypx = e.clientY - dragPart.y;
        if (Math.abs(dxpx) + Math.abs(dypx) > 2) dragPart.moved = true;
        // Snapping: prefer ALIGNMENT with sibling parts of the same kind (so shelves
        // line up in a row across verticals, and verticals line up in a column), then
        // fall back to a 5 mm grid. Hold Shift for free 1 mm placement (no align).
        const rawMM = dragPart.startPos + (dragPart.type === 'shelf' ? (-dypx / cam2.scale) : (dxpx / cam2.scale));
        let snapped, aligned = false;
        if (e.shiftKey) {
          snapped = Math.round(rawMM);
        } else {
          const tolMM = 12 / cam2.scale; let bestD = tolMM, alignAt = null;
          for (const c of comps()) { if (c.id === dragPart.id || c.type !== dragPart.type) continue; const d = Math.abs((c.pos || 0) - rawMM); if (d < bestD) { bestD = d; alignAt = c.pos; } }
          if (alignAt != null) { snapped = Math.round(alignAt); aligned = true; }   // align to a sibling
          else snapped = Math.round(rawMM / 5) * 5;                                   // else 5 mm grid
        }
        dragPart.livePos = snapped; dragPart.aligned = aligned;
        const delta = snapped - dragPart.startPos;
        dragPreview = dragPart.type === 'shelf'
          ? { id: dragPart.id, dx: 0, dy: delta }   // shelf moves in y (screen-down => lower)
          : { id: dragPart.id, dx: delta, dy: 0 };    // vertical moves in x
        draw2D(); dragChip(e, snapped); return;
      }
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (tab === 'design' && mode === '3d' && drag.btn === 0) { cam3.yaw = drag.o3.yaw + dx * 0.01; cam3.pitch = Math.max(-1.4, Math.min(1.4, drag.o3.pitch + dy * 0.01)); draw3D(); }
      else { const c = mode === '3d' ? cam3 : cam2; const o = mode === '3d' ? drag.o3 : drag.o2; c.ox = o.ox + dx; c.oy = o.oy + dy; redraw(); }
    });
    window.addEventListener('mouseup', () => {
      if (dragPart) {
        if (dragPart.moved && dragPreview) {
          const newPos = dragPart.livePos != null ? dragPart.livePos
            : dragPart.startPos + (dragPart.type === 'shelf' ? dragPreview.dy : dragPreview.dx);
          dragPreview = null; editIntent('move', { id: dragPart.id, pos: Math.round(newPos) });
        }
        dragPart = null; dragPreview = null; dragChip(null);
      }
      drag = null;
      setCanvasCursor();   // restore crosshair/grab after a pan or part-drag
    });
    dcv.addEventListener('wheel', (e) => {
      e.preventDefault(); const c = mode === '3d' ? cam3 : cam2; const k = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      if (mode === '3d') { c.scale *= k; }
      else { const r = dcv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; const wx = (mx - c.ox) / c.scale, wy = (my - c.oy) / c.scale; c.scale *= k; c.ox = mx - wx * c.scale; c.oy = my - wy * c.scale; }
      redraw();
    }, { passive: false });
  }

  function wire() {
    $('#wv-projects').onclick = projectsModal;
    if ($('#wv-save')) $('#wv-save').onclick = saveDesign;
    $('#wv-out').onclick = async () => { try { await http('POST', '/logout', { refreshToken: session.refreshToken }); } catch {} localStorage.removeItem('wv_session'); location.href = LOGIN; };
    $$('.tabs .tab').forEach((t) => t.onclick = () => showTab(t.dataset.tab));
    $('#v2d').onclick = () => { mode = '2d'; $('#v2d').classList.add('active'); $('#v3d').classList.remove('active'); syncViewTools(); redraw(); };
    $('#v3d').onclick = () => { mode = '3d'; $('#v3d').classList.add('active'); $('#v2d').classList.remove('active'); syncViewTools(); redraw(); };
    $('#zoom-in') && ($('#zoom-in').onclick = () => { (mode === '3d' ? cam3 : cam2).scale *= 1.15; redraw(); });
    $('#zoom-out') && ($('#zoom-out').onclick = () => { (mode === '3d' ? cam3 : cam2).scale /= 1.15; redraw(); });
    $('#zoom-fit') && ($('#zoom-fit').onclick = () => { cam2.fit = cam3.fit = true; redraw(); });
    $('#scope-module') && ($('#scope-module').onclick = () => setScope('module'));
    $('#scope-job') && ($('#scope-job').onclick = () => setScope('job'));
    // Sheet piece → select its part (cross-highlight); empty space clears.
    scv.addEventListener('click', (e) => {
      const r = scv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (let i = sheetRects.length - 1; i >= 0; i--) {
        const p = sheetRects[i];
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
          if (p.srcId == null) return;
          const s = String(p.srcId); selectedId = /^-?\d+$/.test(s) ? +s : s;
          markCutRows(); drawSheet();   // highlight the piece + its cut-list row (stay on Sheet)
          return;
        }
      }
      clearSelection(); drawSheet();
    });

    // Cut-list → design cross-select: click a row to select its component.
    const clb = $('#cutlist tbody');
    if (clb) clb.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-src]'); if (!tr || !tr.dataset.src) return;
      const s = tr.dataset.src; if (tab !== 'design') showTab('design');
      showSelection(/^-?\d+$/.test(s) ? +s : s);   // number → component, string → carcass panel
    });
    window.addEventListener('resize', redraw);
    wireCamera();
    wireRoom();
    wireEditing();
    wirePanelDrag();
  }
  // Make the floating selection panel draggable by its header (dbl-click header = snap to corner).
  function wirePanelDrag() {
    const card = $('#card-selected'), head = card && card.querySelector('.sel-head');
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
      const r = card.getBoundingClientRect();
      pan = { dx: e.clientX - r.left, dy: e.clientY - r.top, pr: card.parentElement.getBoundingClientRect() };
      card.classList.add('dragging'); e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => { if (!pan) return; place(e.clientX - pan.pr.left - pan.dx, e.clientY - pan.pr.top - pan.dy); });
    window.addEventListener('mouseup', () => { if (pan) { pan = null; card.classList.remove('dragging'); } });
    head.addEventListener('dblclick', (e) => { if (e.target.closest('.sel-close')) return; card.style.left = 'auto'; card.style.bottom = 'auto'; card.style.top = '12px'; card.style.right = '12px'; });
    window.addEventListener('resize', () => { if (card.style.left && card.style.left !== 'auto') place(parseFloat(card.style.left), parseFloat(card.style.top)); });
  }
  function wireRoom() {
    const on2 = $('#rv-2d'), on3 = $('#rv-3d');
    if (on2) on2.onclick = () => { roomMode = '2d'; on2.classList.add('active'); if (on3) on3.classList.remove('active'); drawRoom(); };
    if (on3) on3.onclick = () => { roomMode = '3d'; roomCam.fit = true; on3.classList.add('active'); if (on2) on2.classList.remove('active'); drawRoom(); };
    if ($('#rm-all')) $('#rm-all').onclick = () => { roomHidden.clear(); renderRoomModuleList(); drawRoom(); };
    if ($('#rm-none')) $('#rm-none').onclick = () => { if (roomModel) roomModel.modules.forEach((m, i) => roomHidden.add(i)); renderRoomModuleList(); drawRoom(); };
    if ($('#rm-toggle')) $('#rm-toggle').onclick = () => { const rm = $('#room-modules'); if (rm) rm.classList.toggle('collapsed'); };
    let rdrag = null;
    rcv.addEventListener('mousedown', (e) => {
      if (roomMode === '3d') { rdrag = { x: e.clientX, y: e.clientY, o: { ...roomCam }, btn: e.button }; return; }
      // Elevation: drag a module to arrange it on the wall.
      const i = roomHitModule(e.clientX, e.clientY);
      if (i >= 0) { const m = roomModel.modules[i]; roomDrag = { index: i, x: e.clientX, y: e.clientY, dxMM: 0, dyMM: 0, start: { offsetX: m.offsetX, baseHeight: m.baseHeight } }; }
    });
    window.addEventListener('mousemove', (e) => {
      if (roomDrag && roomView) {
        roomDrag.dxMM = (e.clientX - roomDrag.x) / roomView.s;
        roomDrag.dyMM = -(e.clientY - roomDrag.y) / roomView.s;   // screen-down => lower on the wall
        drawRoomElevation(); return;
      }
      if (!rdrag) return; const dx = e.clientX - rdrag.x, dy = e.clientY - rdrag.y;
      if (rdrag.btn === 0) { roomCam.yaw = rdrag.o.yaw + dx * 0.01; roomCam.pitch = Math.max(-1.4, Math.min(1.4, rdrag.o.pitch + dy * 0.01)); }
      else { roomCam.ox = rdrag.o.ox + dx; roomCam.oy = rdrag.o.oy + dy; }
      drawRoom3D();
    });
    window.addEventListener('mouseup', () => {
      if (roomDrag) {
        let offsetX = Math.max(0, Math.round(roomDrag.start.offsetX + roomDrag.dxMM));
        let baseHeight = Math.max(0, Math.round(roomDrag.start.baseHeight + roomDrag.dyMM));
        if (baseHeight < 30) baseHeight = 0;   // snap to the floor
        if (design && design.modules && design.modules[roomDrag.index]) design.modules[roomDrag.index].placement = { offsetX, baseHeight };
        roomDrag = null; loadRoom();   // persist (data) + re-render the wall
        return;
      }
      rdrag = null;
    });
    rcv.addEventListener('wheel', (e) => { if (roomMode !== '3d') return; e.preventDefault(); roomCam.scale *= (e.deltaY < 0 ? 1.1 : 1 / 1.1); drawRoom3D(); }, { passive: false });
  }

  // ── Editing (stage 2): controls post intents to the server ──
  function wireEditing() {
    const num = (id) => { const el = $('#' + id); return el && el.value !== '' ? toMM(+el.value) : null; };   // length inputs: display unit -> mm
    const onChange = (id, fn) => { const el = $('#' + id); if (el) el.addEventListener('change', fn); };
    const onClick = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };

    const chkv = (id) => { const el = $('#' + id); return el ? !!el.checked : false; };
    const selv = (id) => { const el = $('#' + id); return el ? el.value : null; };

    // Sizes + sides + back-include (patch the design; server re-normalizes)
    onChange('in-h', () => patch({ cab: { h: num('in-h') } }));
    onChange('in-w', () => patch({ cab: { w: num('in-w') } }));
    onChange('in-d', () => patch({ cab: { d: num('in-d') } }));
    onChange('in-t', () => patch({ cab: { t: num('in-t') } }));
    onChange('in-back', () => patch({ cab: { back: chkv('in-back') } }));
    onChange('in-side-l', () => patch({ cab: { sideL: chkv('in-side-l') } }));
    onChange('in-side-r', () => patch({ cab: { sideR: chkv('in-side-r') } }));
    onChange('in-preset', () => { const v = selv('in-preset'); if (v && v !== 'custom') editIntent('apply_preset', { name: v }); });
    onChange('in-wood-theme', () => patch({ woodTheme: selv('in-wood-theme') }));
    onClick('unit-mm', () => patch({ unit: 'mm' }));
    onClick('unit-in', () => patch({ unit: 'in' }));

    // Back panel
    onChange('in-back-type', () => patch({ backPanel: { type: selv('in-back-type') } }));
    onChange('in-back-thk', () => patch({ backPanel: { thickness: num('in-back-thk') } }));
    onChange('in-back-groove', () => patch({ backPanel: { groove: num('in-back-groove') } }));
    onChange('in-back-setback', () => patch({ backPanel: { setback: num('in-back-setback') } }));

    // Top / bottom caps
    onChange('in-top-on', () => patch({ cab: { top: { on: chkv('in-top-on') } } }));
    onChange('in-top-mount', () => patch({ cab: { top: { mount: selv('in-top-mount') } } }));
    onChange('in-top-depth', () => patch({ cab: { top: { depth: num('in-top-depth') } } }));
    onChange('in-top-anchor', () => patch({ cab: { top: { anchor: selv('in-top-anchor') } } }));
    onChange('in-bot-on', () => patch({ cab: { bottom: { on: chkv('in-bot-on') } } }));
    onChange('in-bot-mount', () => patch({ cab: { bottom: { mount: selv('in-bot-mount') } } }));
    onChange('in-bot-depth', () => patch({ cab: { bottom: { depth: num('in-bot-depth') } } }));
    onChange('in-bot-anchor', () => patch({ cab: { bottom: { anchor: selv('in-bot-anchor') } } }));

    // Sheet stock + grain
    onChange('in-sw', () => patch({ sheet: { w: num('in-sw') } }));
    onChange('in-sh', () => patch({ sheet: { h: num('in-sh') } }));
    onChange('in-kerf', () => patch({ sheet: { kerf: num('in-kerf') } }));
    onChange('in-grain', () => patch({ grainLock: chkv('in-grain') }));

    // Module add / rename panel
    onClick('mod-add-confirm', confirmModPanel);
    onClick('mod-add-cancel', () => $('#module-add-panel').classList.add('hidden'));

    // Selected-part editing: any field with data-path patches that component.
    const selFields = $('#sel-fields');
    if (selFields) selFields.addEventListener('change', (e) => {
      const el = e.target.closest('[data-path],[data-mpath]'); if (!el || selectedId == null) return;
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') val = el.value === '' ? null : (el.hasAttribute('data-nounit') ? +el.value : toMM(+el.value));
      else val = el.value;
      if (el.dataset.mpath) editIntent('patch', { patch: pathToObj(el.dataset.mpath, val) });        // carcass = module config patch
      else editIntent('patch_comp', { id: selectedId, patch: pathToObj(el.dataset.path, val) });      // component patch
    });

    // Components — inserted into the last-clicked cell (add_comp = real addComp).
    // With "× N" > 1, add N parts spaced EVENLY across the interior (equal, symmetric
    // divisions) via add_shelves/add_verticals; N = 1 inserts a single part into the
    // clicked cell. Even distribution is what produces clean modular splits.
    const pt = () => lastClickMM;
    const divN = () => Math.max(1, Math.min(20, +(($('#in-div-count') || {}).value || 1)));
    onClick('btn-add-shelf', () => { const n = divN(); n > 1 ? editIntent('add_shelves', { count: n }) : editIntent('add_comp', { type: 'shelf', point: pt() }); });
    onClick('btn-add-vertical', () => { const n = divN(); n > 1 ? editIntent('add_verticals', { count: n }) : editIntent('add_comp', { type: 'vertical', point: pt() }); });
    onClick('btn-add-drawer', () => editIntent('add_comp', {
      type: 'drawer', point: pt(),
      count: +(($('#in-drawer-count') || {}).value || 1), sides: chkv('in-drawer-sides'), front: chkv('in-drawer-front'),
    }));
    onClick('btn-add-door', () => editIntent('add_comp', { type: 'door', point: pt(), count: +(($('#in-door-leaves') || {}).value || 1) }));
    onChange('in-reveal', () => editIntent('set_doors', { reveal: num('in-reveal') }));

    // Delete (via the left button or the selection panel).
    const del = () => {
      if (selectedId == null) return; const id = selectedId; clearSelection();
      if (typeof id === 'string') {   // carcass panel — remove via a config patch (restore in Setup)
        const map = { L: { cab: { sideL: false } }, R: { cab: { sideR: false } }, T: { cab: { top: { on: false } } }, B: { cab: { bottom: { on: false } } }, BK: { cab: { back: false } } };
        if (map[id]) editIntent('patch', { patch: map[id] });
        return;
      }
      editIntent('delete', { id });
    };
    if ($('#btn-delete')) $('#btn-delete').disabled = false;   // enabled; del() no-ops without a selection
    onClick('btn-delete', del);
    onClick('sel-delete', del);
    onClick('sel-close', clearSelection);

    // Delete key: delete the currently selected component (or carcass panel) with a
    // simple confirm. Does nothing if no part is selected, and never fires while
    // typing in a field.
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Delete' || selectedId == null) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      const c = typeof selectedId === 'number' ? compById(selectedId) : null;
      const label = c ? (c.type || 'part') : 'panel';
      if (confirm(`Delete the selected ${label}?`)) del();
    });
    onClick('sel-update', () => { const el = $('#sel-pos'); if (selectedId != null && el) editIntent('move', { id: selectedId, pos: +el.value }); });

    // 2D tools: dimensions toggle + measure (client presentation).
    onChange('in-dims', () => { showDims = $('#in-dims').checked; redraw(); });
    onClick('btn-measure', () => { measureOn = !measureOn; if (!measureOn) measurePts = []; $('#btn-measure').classList.toggle('active', measureOn); redraw(); });
    // 3D explode slider (client presentation).
    const inExp = $('#in-explode');
    if (inExp) inExp.addEventListener('input', () => { explode = parseFloat(inExp.value) || 0; if (mode === '3d') draw3D(); });

    // Exports (client-side from the render model).
    onClick('btn-add-extra', extrasModal);
    onClick('btn-labels', labelsModal);
    onClick('btn-export', exportCSV);
    onClick('btn-pdf', exportPDF);
    onClick('btn-prod', exportProdPack);

    // Multi-bay door: pick cells → place one spanning door.
    onClick('btn-door-cells', () => setCellMode(true));
    onClick('btn-door-cancel', () => setCellMode(false));
    onClick('btn-door-place', () => {
      // A picked-cells door is ONE door covering the whole selection. Force count:1 — the "Leaves" dropdown is
      // for a single-cell door and would otherwise split this into two panels (the "extra door" bug). To make
      // it a double door afterwards, select the placed door and change its Leaves in the properties panel.
      const cells = cellSel.slice();
      setCellMode(false); editIntent('add_span_door', { cells, count: 1 });
    });
  }

  (async function boot() {
    try { await refresh(); } catch { localStorage.removeItem('wv_session'); location.href = LOGIN; return; }
    // Brand from tenant config.
    try { const cfg = await api('GET', `/${T()}/config`); if (cfg.brand) { if (cfg.brand.accent) document.documentElement.style.setProperty('--accent', cfg.brand.accent); if (cfg.brand.name) { $('#brand-title').textContent = cfg.brand.name; document.title = cfg.brand.name + ' — Designer'; } } } catch {}
    $('#wv-ws').textContent = session.tenant;
    wire(); showTab('design');
    let list = [];
    try { list = (await api('GET', `/${T()}/projects`)).projects || []; } catch (e) { return toast(e.message, true); }
    if (list.length) openDesign(list[0].id, list[0].name);
    else { startEmptyDesign(); toast('New design — click “+ New” to add a module.'); }
  })();
})();
