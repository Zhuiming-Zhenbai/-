'use strict';

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { DEFAULTS, loadConfig, saveConfig, resolveApiKey } = require('../src/config');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiaobai-config-'));
}

test('无配置文件时返回默认值', () => {
  const cfg = loadConfig(tmpDir());
  assert.deepStrictEqual(cfg, DEFAULTS);
});

test('保存后能读取配置', () => {
  const dir = tmpDir();
  saveConfig(dir, { apiKey: 'sk-abc', hotkey: 'Alt+T' });
  const cfg = loadConfig(dir);
  assert.strictEqual(cfg.apiKey, 'sk-abc');
  assert.strictEqual(cfg.hotkey, 'Alt+T');
});

test('配置文件损坏时回退默认值', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'config.json'), '{not json', 'utf8');
  const cfg = loadConfig(dir);
  assert.deepStrictEqual(cfg, DEFAULTS);
});

test('API Key 优先使用环境变量', () => {
  const prev = process.env.DEEPSEEK_API_KEY;
  try {
    process.env.DEEPSEEK_API_KEY = 'sk-env';
    assert.strictEqual(resolveApiKey({ apiKey: 'sk-file' }), 'sk-env');

    delete process.env.DEEPSEEK_API_KEY;
    assert.strictEqual(resolveApiKey({ apiKey: 'sk-file' }), 'sk-file');
    assert.strictEqual(resolveApiKey({}), '');
  } finally {
    if (prev === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = prev;
    }
  }
});
