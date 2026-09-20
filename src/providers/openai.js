'use strict';

const { DEFAULT_SYSTEM_PROMPT } = require('../config');

/**
 * OpenAI 兼容接口翻译。
 * @param {string} text 待翻译文本
 * @param {object} provider { baseUrl, apiKey, model, systemPrompt }
 * @param {object} [options]
 * @param {Function} [options.fetchImpl] 注入 fetch 实现（测试用）
 * @param {number} [options.timeoutMs] 超时毫秒
 * @returns {Promise<string>} 译文
 */
async function translateViaOpenAI(text, provider, options = {}) {
  const { baseUrl, apiKey, model, systemPrompt } = provider || {};
  const { fetchImpl = fetch, timeoutMs = 30000 } = options;

  if (!apiKey) {
    throw new Error('缺少 API Key');
  }

  const trimmed = String(text).trim();
  if (!trimmed) {
    return '';
  }

  const url = `${String(baseUrl || '').replace(/\/+$/, '')}/chat/completions`;
  const prompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: trimmed },
        ],
        stream: false,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`翻译接口返回错误：${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;

    if (typeof content !== 'string') {
      throw new Error('翻译接口响应格式异常');
    }
    return content.trim();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('翻译请求超时');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { translateViaOpenAI };
