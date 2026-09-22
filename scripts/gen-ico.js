'use strict';

// 把 assets/icon.png 包成 icon.ico（ICO 内嵌 PNG，用于桌面快捷方式图标）。
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'assets', 'icon.png');
const out = path.join(__dirname, '..', 'assets', 'icon.ico');

const png = fs.readFileSync(src);

// ICONDIR (6 bytes)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count

// ICONDIRENTRY (16 bytes)
const entry = Buffer.alloc(16);
entry[0] = 32; // width (32)
entry[1] = 32; // height (32)
entry[2] = 0; // palette
entry[3] = 0; // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bit count
entry.writeUInt32LE(png.length, 8); // size
entry.writeUInt32LE(6 + 16, 12); // offset

const ico = Buffer.concat([header, entry, png]);
fs.writeFileSync(out, ico);
console.log(`written ${out} (${ico.length} bytes)`);
