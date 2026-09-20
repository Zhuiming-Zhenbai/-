'use strict';

const { getActiveProvider } = require('./config');
const { translateViaOpenAI } = require('./providers/openai');
const { translateViaOffline } = require('./providers/offline');

/**
 * 按配置分发到在线（OpenAI 兼容）或离线引擎。
 * @param {string} text 待翻译文本
 * @param {object} config 配置对象
 * @param {object} [options] 透传给具体 provider
 * @returns {Promise<string>} 译文
 */
async function translate(text, config, options = {}) {
  if (config.engineMode === 'offline') {
    const impl = options.offlineImpl || translateViaOffline;
    return impl(text, config.offline || {}, options);
  }
  const provider = getActiveProvider(config);
  if (!provider) {
    throw new Error('没有可用的翻译配置');
  }
  const impl = options.openaiImpl || translateViaOpenAI;
  return impl(text, provider, options);
}

module.exports = { translate, translateViaOpenAI, translateViaOffline };
