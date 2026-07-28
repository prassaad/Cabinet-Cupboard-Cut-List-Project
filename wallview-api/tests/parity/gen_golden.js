/* JS-vs-PHP nesting parity: generate golden fixtures from the REAL JS engine.
 *
 * Extracts nest() + groupKey from prototype/app.js verbatim (brace-matched, not
 * rewritten), runs a set of seeded cases through it, and writes
 * tests/parity/nest_golden.json = [{ case, expected }]. PHP's NesterParityTest
 * then asserts its output equals `expected` for every case. Re-run this whenever
 * the JS engine changes: `node tests/parity/gen_golden.js <path-to-app.js>`.
 *
 * Zero dependencies (Node built-ins only).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] ||
  path.resolve(__dirname, '../../../../../Ideas/Cabinet-Cupboard-Cut-List-Project/prototype/app.js');
const OUT = path.join(__dirname, 'nest_golden.json');

// ── Extract the real functions from app.js ──
const src = fs.readFileSync(APP, 'utf8');

function sliceBalanced(text, startIdx) {
  const open = text.indexOf('{', startIdx);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(startIdx, i + 1); }
  }
  throw new Error('unbalanced braces');
}

const gkMatch = src.match(/const groupKey = \(it\) =>[^\n]*;/);
if (!gkMatch) throw new Error('groupKey not found in app.js');
const groupKeySrc = gkMatch[0];

const nestStart = src.indexOf('function nest(items)');
if (nestStart < 0) throw new Error('nest() not found in app.js');
const nestSrc = sliceBalanced(src, nestStart);

// Build a factory that binds nest to a per-case S (nest reads S.sheet/S.grainLock).
const factory = new Function('S', `${groupKeySrc}\n${nestSrc}\nreturn nest;`);

// ── Seeded RNG (mulberry32) for reproducible cases ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x5EED1234);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const rint = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const rflt = (lo, hi) => lo + rnd() * (hi - lo);

const SHEETS = [
  { w: 2440, h: 1220, kerf: 3 },
  { w: 1830, h: 915, kerf: 4 },
  { w: 3050, h: 1220, kerf: 3.2 },
  { w: 2440, h: 1220, kerf: 0 },
];
const NAMES = ['Side', 'Shelf', 'Door', 'Back', 'Top / Bottom', 'Vertical', 'Drawer Bottom'];
const KEYS = ['Side', 'Shelf', 'Door', 'Back', 'TopBottom', 'Vertical', 'DrawerBottom'];
const THICK = [16, 18, 12, 0.8, 25];

function makeItems(n, maxDim) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const ni = rint(0, NAMES.length - 1);
    items.push({
      name: NAMES[ni],
      key: KEYS[ni],
      length: +rflt(60, maxDim * 1.05).toFixed(2), // *1.05 => some pieces overflow, forcing rotation/new sheets
      width: +rflt(40, maxDim * 0.9).toFixed(2),
      thick: pick(THICK),
      srcId: 'p' + i,
    });
  }
  return items;
}

const cases = [];
// Edge cases first.
cases.push({ sheet: SHEETS[0], grainLock: false, items: [] });
cases.push({ sheet: SHEETS[0], grainLock: false, items: [{ name: 'Huge', key: 'X', length: 9999, width: 9999, thick: 18, srcId: 'h' }] });
cases.push({ sheet: SHEETS[1], grainLock: true, items: makeItems(1, 900) });
// Randomised bulk.
for (let i = 0; i < 90; i++) {
  const sheet = pick(SHEETS);
  const maxDim = Math.max(sheet.w, sheet.h);
  cases.push({ sheet, grainLock: rnd() < 0.35, items: makeItems(rint(2, 45), maxDim) });
}

const golden = cases.map((c) => {
  const nest = factory({ sheet: c.sheet, grainLock: c.grainLock });
  return { case: c, expected: nest(c.items) };
});

fs.writeFileSync(OUT, JSON.stringify(golden, null, 0));
console.log(`Wrote ${golden.length} golden cases -> ${path.relative(process.cwd(), OUT)}`);
