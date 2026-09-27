'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { checkUpdate, compareVersions } = require('../src/updater');

test('compareVersions 比较正确', () => {
  assert.strictEqual(compareVersions('0.2.0', '0.1.0'), 1);
  assert.strictEqual(compareVersions('0.1.0', '0.2.0'), -1);
  assert.strictEqual(compareVersions('1.0.0', '1.0.0'), 0);
  assert.strictEqual(compareVersions('1.10.0', '1.9.0'), 1);
  assert.strictEqual(compareVersions('2.0', '1.9.9'), 1);
});

test('checkUpdate：未配置地址返回 hasUpdate=false', async () => {
  const r = await checkUpdate('', '0.1.0');
  assert.strictEqual(r.hasUpdate, false);
  assert.strictEqual(r.reason, '未配置更新地址');
});

test('checkUpdate：发现新版本', async () => {
  const fetchImpl = async (url) => {
    assert.ok(url.endsWith('/latest.json'));
    return {
      ok: true,
      json: async () => ({ version: '0.2.0', url: 'https://x/setup.exe', notes: '新功能' }),
    };
  };
  const r = await checkUpdate('https://example.com/updates/', '0.1.0', { fetchImpl });
  assert.strictEqual(r.hasUpdate, true);
  assert.strictEqual(r.version, '0.2.0');
  assert.strictEqual(r.url, 'https://x/setup.exe');
});

test('checkUpdate：版本不新', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ version: '0.1.0', url: 'https://x/setup.exe' }),
  });
  const r = await checkUpdate('https://example.com/updates', '0.1.0', { fetchImpl });
  assert.strictEqual(r.hasUpdate, false);
});

test('checkUpdate：清单格式错误抛错', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
  await assert.rejects(() => checkUpdate('https://x', '0.1.0', { fetchImpl }), /格式错误/);
});
