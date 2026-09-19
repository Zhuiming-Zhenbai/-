'use strict';

// 生成一个简单的 32x32 圆形图标（蓝色圆点，透明背景），用于托盘与窗口。
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const W = 32;
const H = 32;
const cx = W / 2 - 0.5;
const cy = H / 2 - 0.5;
const r = 13;

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const off = y * (W * 4 + 1) + 1 + x * 4;
    const dx = x - cx;
    const dy = y - cy;
    const inside = dx * dx + dy * dy <= r * r;
    raw[off] = 0x1f; // R
    raw[off + 1] = 0x6f; // G
    raw[off + 2] = 0xeb; // B
    raw[off + 3] = inside ? 0xff : 0x00; // A
  }
}

const idat = zlib.deflateSync(raw);

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'assets', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`icon written: ${out} (${png.length} bytes)`);
