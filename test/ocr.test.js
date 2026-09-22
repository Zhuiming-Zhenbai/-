'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { mapOcrLang, OCR_LANGS } = require('../src/ocr');

test('mapOcrLang 映射正确', () => {
  assert.strictEqual(mapOcrLang('en'), 'eng');
  assert.strictEqual(mapOcrLang('ja'), 'jpn');
  assert.strictEqual(mapOcrLang('zh'), 'chi_sim');
  assert.strictEqual(mapOcrLang('auto'), 'eng+chi_sim+jpn');
});

test('mapOcrLang 未知值回退到 auto', () => {
  assert.strictEqual(mapOcrLang('xx'), 'eng+chi_sim+jpn');
  assert.strictEqual(mapOcrLang(undefined), 'eng+chi_sim+jpn');
});

test('OCR_LANGS 常量', () => {
  assert.deepStrictEqual(OCR_LANGS, {
    auto: 'eng+chi_sim+jpn',
    en: 'eng',
    ja: 'jpn',
    zh: 'chi_sim',
  });
});
