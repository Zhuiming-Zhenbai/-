'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { PRESETS, getPresetById } = require('../src/presets');

test('预设包含 7 家服务商，结构完整', () => {
  assert.strictEqual(PRESETS.length, 7);
  for (const p of PRESETS) {
    assert.ok(p.id && p.name && p.baseUrl && p.website && p.model);
    assert.ok(p.baseUrl.startsWith('https://'));
    assert.ok(p.website.startsWith('https://'));
  }
});

test('getPresetById 返回对应项或 null', () => {
  assert.strictEqual(getPresetById('deepseek').name, 'DeepSeek');
  assert.strictEqual(getPresetById('not-exist'), null);
});
