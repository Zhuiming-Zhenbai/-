'use strict';

const fs = require('node:fs');
const path = require('node:path');

// 资源清单：kind 'model' | 'ocr'
const RESOURCES = [
  {
    id: 'model-en-zh',
    name: '离线翻译模型（英→中）',
    description: '离线翻译英文时使用。',
    kind: 'model',
    relPath: path.join('models', 'Xenova', 'opus-mt-en-zh'),
    modelId: 'Xenova/opus-mt-en-zh',
  },
  {
    id: 'model-ja-en',
    name: '离线翻译模型（日→英）',
    description: '离线翻译日文时作为中间步骤使用（日→英→中）。',
    kind: 'model',
    relPath: path.join('models', 'Xenova', 'opus-mt-ja-en'),
    modelId: 'Xenova/opus-mt-ja-en',
  },
  {
    id: 'ocr-eng',
    name: '识别语言数据（英文）',
    description: '屏幕识别英文文字时使用。',
    kind: 'ocr',
    relPath: path.join('tessdata', 'eng.traineddata'),
    lang: 'eng',
  },
  {
    id: 'ocr-jpn',
    name: '识别语言数据（日文）',
    description: '屏幕识别日文文字时使用。',
    kind: 'ocr',
    relPath: path.join('tessdata', 'jpn.traineddata'),
    lang: 'jpn',
  },
  {
    id: 'ocr-chi_sim',
    name: '识别语言数据（中文）',
    description: '屏幕识别中文文字时使用。',
    kind: 'ocr',
    relPath: path.join('tessdata', 'chi_sim.traineddata'),
    lang: 'chi_sim',
  },
];

function absPath(userDataDir, res) {
  return path.join(userDataDir, res.relPath);
}

function dirSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const p = stack.pop();
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      let entries = [];
      try {
        entries = fs.readdirSync(p);
      } catch {
        continue;
      }
      for (const e of entries) {
        stack.push(path.join(p, e));
      }
    } else {
      total += st.size;
    }
  }
  return total;
}

function isCached(userDataDir, res) {
  const p = absPath(userDataDir, res);
  try {
    const st = fs.statSync(p);
    return res.kind === 'model' ? st.isDirectory() : st.isFile();
  } catch {
    return false;
  }
}

function sizeOf(userDataDir, res) {
  const p = absPath(userDataDir, res);
  try {
    const st = fs.statSync(p);
    return st.isDirectory() ? dirSize(p) : st.size;
  } catch {
    return 0;
  }
}

function list(userDataDir) {
  return RESOURCES.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    kind: r.kind,
    cached: isCached(userDataDir, r),
    size: sizeOf(userDataDir, r),
  }));
}

function totalSize(userDataDir) {
  return RESOURCES.reduce((sum, r) => sum + sizeOf(userDataDir, r), 0);
}

function getById(id) {
  return RESOURCES.find((r) => r.id === id) || null;
}

function remove(userDataDir, id) {
  const r = getById(id);
  if (!r) throw new Error('未知资源');
  const p = absPath(userDataDir, r);
  fs.rmSync(p, { recursive: true, force: true });
}

function removeAll(userDataDir) {
  for (const r of RESOURCES) {
    const p = absPath(userDataDir, r);
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function formatSize(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

module.exports = { RESOURCES, list, totalSize, remove, removeAll, getById, formatSize, isCached, sizeOf };
