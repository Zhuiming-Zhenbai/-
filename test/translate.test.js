'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { translateText, MODEL, SYSTEM_PROMPT } = require('../src/translate');

function okFetch(content) {
  return async (_url, init) => {
    assert.strictEqual(init.method, 'POST');
    assert.strictEqual(init.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(init.body);
    assert.strictEqual(body.model, MODEL);
    assert.ok(body.messages.some((m) => m.role === 'system' && m.content === SYSTEM_PROMPT));
    assert.strictEqual(body.messages[body.messages.length - 1].content, 'hello');
    return {
      ok: true,
      async json() {
        return { choices: [{ message: { content } }] };
      },
    };
  };
}

test('翻译成功返回译文', async () => {
  const result = await translateText('  hello  ', 'test-key', { fetchImpl: okFetch('你好') });
  assert.strictEqual(result, '你好');
});

test('空文本直接返回空串，不发起请求', async () => {
  let called = false;
  const result = await translateText('   ', 'test-key', {
    fetchImpl: async () => {
      called = true;
      throw new Error('不应调用 fetch');
    },
  });
  assert.strictEqual(result, '');
  assert.strictEqual(called, false);
});

test('缺少 API Key 抛错', async () => {
  await assert.rejects(() => translateText('hello', '', {}), /缺少 API Key/);
});

test('非 2xx 响应抛错', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => 'bad key',
  });
  await assert.rejects(() => translateText('hello', 'k', { fetchImpl }), /翻译接口返回错误：401/);
});

test('响应格式异常抛错', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [] }) });
  await assert.rejects(() => translateText('hello', 'k', { fetchImpl }), /响应格式异常/);
});

test('超时抛错', async () => {
  const fetchImpl = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  await assert.rejects(
    () => translateText('hello', 'k', { fetchImpl, timeoutMs: 10 }),
    /翻译请求超时/,
  );
});
