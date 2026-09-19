'use strict';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';
const SYSTEM_PROMPT =
  '你是翻译助手。把用户输入翻译成简体中文，只输出译文，不要任何解释、注释或额外内容。';

/**
 * 调用 DeepSeek chat/completions 接口翻译文本。
 * @param {string} text 待翻译文本
 * @param {string} apiKey
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 * @param {string} [options.model]
 * @param {Function} [options.fetchImpl] 注入 fetch 实现（测试用）
 * @param {number} [options.timeoutMs] 超时毫秒
 * @returns {Promise<string>} 译文
 */
async function translateText(text, apiKey, options = {}) {
  const {
    baseUrl = DEEPSEEK_BASE_URL,
    model = MODEL,
    fetchImpl = fetch,
    timeoutMs = 30000,
  } = options;

  if (!apiKey) {
    throw new Error('缺少 API Key');
  }

  const trimmed = String(text).trim();
  if (!trimmed) {
    return '';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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

module.exports = { translateText, DEEPSEEK_BASE_URL, MODEL, SYSTEM_PROMPT };
