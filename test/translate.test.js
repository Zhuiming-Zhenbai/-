'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { translate, translateViaOpenAI } = require('../src/translate');

function makeProvider(overrides = {}) {
  return {
    id: 'p1',
    name: 'P1',
    baseUrl: 'https://api.deepseek.com',
    apiKey: 'test-key',
    model: 'deepseek-chat',
    systemPrompt: 'SYSPROMPT',
    enabled: true,
    ...overrides,
  };
}

function okFetch(content) {
  return async (_url, init) => {
    assert.strictEqual(init.method, 'POST');
    assert.strictEqual(init.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(init.body);
    assert.strictEqual(body.model, 'deepseek-chat');
    assert.strictEqual(body.messages[0].role, 'system');
    assert.strictEqual(body.messages[0].content, 'SYSPROMPT');
    assert.strictEqual(body.messages[1].content, 'hello');
    return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
  };
}

test('translateViaOpenAI 成功返回译文', async () => {
  const r = await translateViaOpenAI(' hello ', makeProvider(), { fetchImpl: okFetch('你好') });
  assert.strictEqual(r, '你好');
});

test('translateViaOpenAI 空文本直接返回空串', async () => {
  let called = false;
  const r = await translateViaOpenAI('   ', makeProvider(), {
    fetchImpl: async () => {
      called = true;
      throw new Error('不应调用');
    },
  });
  assert.strictEqual(r, '');
  assert.strictEqual(called, false);
});

test('translateViaOpenAI 缺少 API Key 抛错', async () => {
  await assert.rejects(() => translateViaOpenAI('hello', makeProvider({ apiKey: '' }), {}), /缺少 API Key/);
});

test('translateViaOpenAI 非 2xx 抛错', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => 'bad',
  });
  await assert.rejects(() => translateViaOpenAI('hello', makeProvider(), { fetchImpl }), /翻译接口返回错误：401/);
});

test('translateViaOpenAI 响应格式异常抛错', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [] }) });
  await assert.rejects(() => translateViaOpenAI('hello', makeProvider(), { fetchImpl }), /响应格式异常/);
});

test('translateViaOpenAI 超时抛错', async () => {
  const fetchImpl = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  await assert.rejects(
    () => translateViaOpenAI('hello', makeProvider(), { fetchImpl, timeoutMs: 10 }),
    /翻译请求超时/,
  );
});

test('translateViaOpenAI 处理 baseUrl 尾部斜杠', async () => {
  let capturedUrl = '';
  const fetchImpl = async (url) => {
    capturedUrl = url;
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) };
  };
  await translateViaOpenAI('hi', makeProvider({ baseUrl: 'https://api.example.com/' }), { fetchImpl });
  assert.strictEqual(capturedUrl, 'https://api.example.com/chat/completions');
});

test('translate 在线模式调用 active provider', async () => {
  const config = {
    engineMode: 'online',
    providers: [makeProvider()],
    activeProviderId: 'p1',
  };
  const r = await translate('hello', config, { fetchImpl: okFetch('你好') });
  assert.strictEqual(r, '你好');
});

test('translate 在线模式无可用 provider 抛错', async () => {
  await assert.rejects(
    () => translate('hello', { engineMode: 'online', providers: [], activeProviderId: '' }, {}),
    /没有可用的翻译配置/,
  );
});

test('translate 离线模式分发到离线引擎', async () => {
  let called = false;
  const offlineImpl = async (text, cfg) => {
    called = true;
    return '离线结果';
  };
  const r = await translate(
    'hello',
    { engineMode: 'offline', offline: { sourceLang: 'auto' } },
    { offlineImpl },
  );
  assert.strictEqual(r, '离线结果');
  assert.strictEqual(called, true);
});
