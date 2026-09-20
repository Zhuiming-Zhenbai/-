'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { translateViaOffline, detectSourceLang } = require('../src/providers/offline');

test('detectSourceLang：含假名判为 ja', () => {
  assert.strictEqual(detectSourceLang('こんにちは世界', 'auto'), 'ja');
  assert.strictEqual(detectSourceLang('これは日本語です', 'auto'), 'ja');
  assert.strictEqual(detectSourceLang('カタカナ', 'auto'), 'ja');
});

test('detectSourceLang：无假名判为 en', () => {
  assert.strictEqual(detectSourceLang('Hello world', 'auto'), 'en');
  assert.strictEqual(detectSourceLang('This is English.', 'auto'), 'en');
});

test('detectSourceLang：手动指定优先', () => {
  assert.strictEqual(detectSourceLang('こんにちは', 'en'), 'en');
  assert.strictEqual(detectSourceLang('Hello', 'ja'), 'ja');
});

test('translateViaOffline 空文本直接返回空串（不加载模型）', async () => {
  const r = await translateViaOffline('   ', { sourceLang: 'auto' }, {});
  assert.strictEqual(r, '');
});
