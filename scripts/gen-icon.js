'use strict';

// 生成「小白翻译」应用图标：蓝色渐变圆角方形 + 白色对话气泡 + 蓝色双向箭头（翻译符号）。
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const SIZES = [16, 32, 48, 64, 128, 256];

const svg = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4f8cff"/>
      <stop offset="1" stop-color="#1f6feb"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="56" fill="url(#bg)"/>
  <path d="M76 158 L52 190 L118 162 Z" fill="#ffffff"/>
  <rect x="44" y="48" width="168" height="120" rx="36" fill="#ffffff"/>
  <line x1="90" y1="108" x2="166" y2="108" stroke="#1f6feb" stroke-width="14" stroke-linecap="round"/>
  <path d="M106 90 L82 108 L106 126 Z" fill="#1f6feb"/>
  <path d="M150 90 L174 108 L150 126 Z" fill="#1f6feb"/>
</svg>`;

async function renderPng(size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function main() {
  const outDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(outDir, { recursive: true });
  for (const s of SIZES) {
    const buf = await renderPng(s);
    const file = s === 256 ? 'icon.png' : `icon-${s}.png`;
    fs.writeFileSync(path.join(outDir, file), buf);
    console.log(`written ${file} (${buf.length} bytes)`);
  }
}

module.exports = { svg, SIZES, renderPng };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
