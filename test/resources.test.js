'use strict';

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { RESOURCES, list, totalSize, remove, removeAll, formatSize, isCached } = require('../src/resources');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiaobai-res-'));
}

test('资源清单包含 5 项', () => {
  assert.strictEqual(RESOURCES.length, 5);
  assert.ok(RESOURCES.every((r) => r.id && r.name && r.description));
});

test('空目录时所有资源未缓存、大小为 0', () => {
  const dir = tmpDir();
  const items = list(dir);
  assert.strictEqual(items.length, 5);
  assert.ok(items.every((i) => i.cached === false && i.size === 0));
  assert.strictEqual(totalSize(dir), 0);
});

test('创建文件后能正确判断 cached 与大小', () => {
  const dir = tmpDir();
  const eng = path.join(dir, 'tessdata', 'eng.traineddata');
  fs.mkdirSync(path.dirname(eng), { recursive: true });
  fs.writeFileSync(eng, Buffer.alloc(100));

  const modelDir = path.join(dir, 'models', 'Xenova', 'opus-mt-en-zh');
  fs.mkdirSync(modelDir, { recursive: true });
  fs.writeFileSync(path.join(modelDir, 'model.onnx'), Buffer.alloc(500));

  const items = list(dir);
  const engItem = items.find((i) => i.id === 'ocr-eng');
  const modelItem = items.find((i) => i.id === 'model-en-zh');
  assert.strictEqual(engItem.cached, true);
  assert.strictEqual(engItem.size, 100);
  assert.strictEqual(modelItem.cached, true);
  assert.strictEqual(modelItem.size, 500);
  assert.strictEqual(totalSize(dir), 600);
});

test('remove 删除单个资源', () => {
  const dir = tmpDir();
  const eng = path.join(dir, 'tessdata', 'eng.traineddata');
  fs.mkdirSync(path.dirname(eng), { recursive: true });
  fs.writeFileSync(eng, Buffer.alloc(10));
  assert.strictEqual(isCached(dir, { relPath: path.join('tessdata', 'eng.traineddata'), kind: 'ocr' }), true);

  remove(dir, 'ocr-eng');
  assert.strictEqual(isCached(dir, { relPath: path.join('tessdata', 'eng.traineddata'), kind: 'ocr' }), false);
});

test('removeAll 删除全部', () => {
  const dir = tmpDir();
  const eng = path.join(dir, 'tessdata', 'eng.traineddata');
  fs.mkdirSync(path.dirname(eng), { recursive: true });
  fs.writeFileSync(eng, Buffer.alloc(10));
  removeAll(dir);
  assert.strictEqual(totalSize(dir), 0);
});

test('formatSize 格式化', () => {
  assert.strictEqual(formatSize(0), '0 B');
  assert.strictEqual(formatSize(500), '500 B');
  assert.strictEqual(formatSize(1024), '1.0 KB');
  assert.strictEqual(formatSize(5 * 1024 * 1024), '5.0 MB');
});
