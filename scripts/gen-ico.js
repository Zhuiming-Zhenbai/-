'use strict';

// 把多尺寸 PNG 打包成多尺寸 ICO（用于桌面快捷方式与后续打包）。
const fs = require('node:fs');
const path = require('node:path');
const { SIZES, renderPng } = require('./gen-icon');

async function main() {
  const images = [];
  for (const s of SIZES) {
    images.push({ size: s, png: await renderPng(s) });
  }

  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  for (const img of images) {
    const e = Buffer.alloc(16);
    e[0] = img.size >= 256 ? 0 : img.size; // width（256 记作 0）
    e[1] = img.size >= 256 ? 0 : img.size; // height
    e[2] = 0; // palette
    e[3] = 0; // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bit count
    e.writeUInt32LE(img.png.length, 8); // size
    e.writeUInt32LE(offset, 12); // offset
    entries.push(e);
    offset += img.png.length;
  }

  const out = path.join(__dirname, '..', 'assets', 'icon.ico');
  fs.writeFileSync(out, Buffer.concat([header, ...entries, ...images.map((i) => i.png)]));
  console.log(`written icon.ico (${count} sizes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
