'use strict';

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const {
  DEFAULTS,
  loadConfig,
  saveConfig,
  resolveApiKey,
  getActiveProvider,
  makeDefaultProvider,
} = require('../src/config');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiaobai-config-'));
}

test('无配置文件时创建默认 DeepSeek provider', () => {
  const cfg = loadConfig(tmpDir());
  assert.strictEqual(cfg.engineMode, 'online');
  assert.strictEqual(cfg.providers.length, 1);
  assert.strictEqual(cfg.providers[0].id, 'deepseek');
  assert.strictEqual(cfg.providers[0].apiKey, '');
  assert.strictEqual(cfg.activeProviderId, 'deepseek');
  assert.strictEqual(cfg.offline.sourceLang, 'auto');
});

test('旧配置迁移：apiKey 继承到默认 provider', () => {
  const dir = tmpDir();
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify({ apiKey: 'sk-legacy', hotkey: 'Alt+Q' }),
    'utf8',
  );
  const cfg = loadConfig(dir);
  assert.strictEqual(cfg.providers.length, 1);
  assert.strictEqual(cfg.providers[0].apiKey, 'sk-legacy');
  assert.strictEqual(cfg.activeProviderId, 'deepseek');
});

test('保存并读取 providers / activeProviderId / offline', () => {
  const dir = tmpDir();
  const cfg = {
    engineMode: 'offline',
    providers: [
      { id: 'a', name: 'A', baseUrl: 'https://a', apiKey: 'ka', model: 'm', systemPrompt: 's', enabled: true },
      { id: 'b', name: 'B', baseUrl: 'https://b', apiKey: 'kb', model: 'm', systemPrompt: 's', enabled: false },
    ],
    activeProviderId: 'b',
    offline: { sourceLang: 'ja' },
  };
  saveConfig(dir, cfg);
  const loaded = loadConfig(dir);
  assert.strictEqual(loaded.engineMode, 'offline');
  assert.strictEqual(loaded.providers.length, 2);
  assert.strictEqual(loaded.activeProviderId, 'b');
  assert.strictEqual(loaded.offline.sourceLang, 'ja');
});

test('closeToTray 默认值为 true', () => {
  const dir = tmpDir();
  saveConfig(dir, { apiKey: 'sk' });
  const cfg = loadConfig(dir);
  assert.strictEqual(cfg.closeToTray, true);
});

test('配置文件损坏时回退默认（含默认 provider）', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'config.json'), '{not json', 'utf8');
  const cfg = loadConfig(dir);
  assert.strictEqual(cfg.engineMode, 'online');
  assert.strictEqual(cfg.providers.length, 1);
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

test('getActiveProvider 优先 active，跳过禁用，回退第一个', () => {
  const p1 = { ...makeDefaultProvider('k1'), id: 'p1', name: 'P1' };
  const p2 = { ...makeDefaultProvider('k2'), id: 'p2', name: 'P2', enabled: false };
  const p3 = { ...makeDefaultProvider('k3'), id: 'p3', name: 'P3' };

  const cfg = { providers: [p1, p2, p3], activeProviderId: 'p3' };
  assert.strictEqual(getActiveProvider(cfg).id, 'p3');

  // active 被禁用 → 回退第一个启用
  const cfg2 = { providers: [p1, p2, p3], activeProviderId: 'p2' };
  assert.strictEqual(getActiveProvider(cfg2).id, 'p1');

  // 无 active → 第一个启用
  const cfg3 = { providers: [p1, p2, p3], activeProviderId: '' };
  assert.strictEqual(getActiveProvider(cfg3).id, 'p1');

  assert.strictEqual(getActiveProvider({ providers: [] }), null);
});

test('DEFAULTS 保持兼容字段', () => {
  assert.strictEqual(DEFAULTS.hotkey, 'Alt+Q');
  assert.strictEqual(DEFAULTS.closeToTray, true);
  assert.strictEqual(DEFAULTS.ocrHotkey, 'Alt+W');
  assert.strictEqual(DEFAULTS.ocrLang, 'auto');
});

test('保存并读取 ocrHotkey / ocrLang', () => {
  const dir = tmpDir();
  saveConfig(dir, { ocrHotkey: 'Ctrl+Shift+O', ocrLang: 'ja' });
  const cfg = loadConfig(dir);
  assert.strictEqual(cfg.ocrHotkey, 'Ctrl+Shift+O');
  assert.strictEqual(cfg.ocrLang, 'ja');
});
