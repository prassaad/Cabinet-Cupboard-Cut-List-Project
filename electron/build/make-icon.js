'use strict';
/* Generates build/icon.png and build/icon.ico (256×256) — a gold rounded square with a dark cabinet+shelf glyph.
   Pure Node (zlib only). Run:  node build/make-icon.js  */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 256, H = 256;
const buf = Buffer.alloc(W * H * 4); // RGBA, transparent

const setPx = (x, y, r, g, b, a) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
};
const rect = (x0, y0, x1, y1, r, g, b, a = 255) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPx(x, y, r, g, b, a);
};
// rounded-square background
const roundedBg = (rad, r, g, b) => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cx = Math.min(x, W - 1 - x), cy = Math.min(y, H - 1 - y);
    if (cx < rad && cy < rad) { const dx = rad - cx, dy = rad - cy; if (dx * dx + dy * dy > rad * rad) continue; }
    setPx(x, y, r, g, b, 255);
  }
};

const GOLD = [217, 169, 59], DARK = [42, 29, 2];
roundedBg(46, ...GOLD);
// cabinet carcass: dark frame with gold interior + two shelves
rect(62, 52, 194, 206, ...DARK);          // outer dark box
rect(76, 66, 180, 192, ...GOLD);          // gold interior (leaves a frame)
rect(76, 110, 180, 120, ...DARK);         // shelf 1
rect(76, 150, 180, 160, ...DARK);         // shelf 2

// ---- PNG encode ----
const crcTable = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = ~0; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};
function encodePNG() {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = W * 4, raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) buf.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- ICO wrap (single 256 PNG entry) ----
function buildICO(png) {
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 0; entry[1] = 0; // 0 ⇒ 256
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

const png = encodePNG();
fs.writeFileSync(path.join(__dirname, 'icon.png'), png);
fs.writeFileSync(path.join(__dirname, 'icon.ico'), buildICO(png));
console.log(`icon.png ${png.length} bytes, icon.ico ${png.length + 22} bytes written to build/`);
