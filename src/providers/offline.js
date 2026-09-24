'use strict';

const EN_ZH_MODEL = 'Xenova/opus-mt-en-zh';
const JA_EN_MODEL = 'Xenova/opus-mt-ja-en';
const DEFAULT_REMOTE_HOST = 'https://hf-mirror.com/';

// 惰性加载，避免启动时加载 onnxruntime 原生模块
let _transformers = null;
let _enZh = null;
let _jaEn = null;

function getTransformers() {
  if (!_transformers) {
    _transformers = require('@huggingface/transformers');
  }
  return _transformers;
}

/**
 * 源语言检测（启发式）：含日文假名 → ja，否则 en。
 * @param {string} text
 * @param {string} configured 'auto' | 'en' | 'ja'
 */
function detectSourceLang(text, configured) {
  if (configured === 'en' || configured === 'ja') {
    return configured;
  }
  return /[\u3040-\u30ff]/.test(String(text)) ? 'ja' : 'en';
}

async function buildPipeline(model, options) {
  const t = getTransformers();
  t.env.allowRemoteModels = true;
  if (options.remoteHost) {
    t.env.remoteHost = options.remoteHost;
  }
  if (options.cacheDir) {
    t.env.cacheDir = options.cacheDir;
  }
  return t.pipeline('translation', model, {
    progress_callback: options.progress_callback || undefined,
  });
}

/**
 * 触发模型下载（加载 pipeline），并把结果缓存供翻译复用。
 * @param {string} modelId
 * @param {object} [options] { remoteHost, cacheDir, progress_callback }
 */
async function downloadModel(modelId, options = {}) {
  const p = await buildPipeline(modelId, options);
  if (modelId === EN_ZH_MODEL) _enZh = p;
  if (modelId === JA_EN_MODEL) _jaEn = p;
  return p;
}

/**
 * 离线翻译：en→zh 直接；ja→zh 走 ja→en→zh 两跳。
 * @param {string} text
 * @param {object} offlineConfig { sourceLang, remoteHost }
 * @param {object} [options] { remoteHost, cacheDir }
 * @returns {Promise<string>}
 */
async function translateViaOffline(text, offlineConfig = {}, options = {}) {
  const trimmed = String(text).trim();
  if (!trimmed) {
    return '';
  }

  const sourceLang = offlineConfig.sourceLang || 'auto';
  const remoteHost = options.remoteHost || offlineConfig.remoteHost || DEFAULT_REMOTE_HOST;
  const src = detectSourceLang(trimmed, sourceLang);

  if (src === 'ja') {
    if (!_jaEn) {
      _jaEn = await buildPipeline(JA_EN_MODEL, { ...options, remoteHost });
    }
    if (!_enZh) {
      _enZh = await buildPipeline(EN_ZH_MODEL, { ...options, remoteHost });
    }
    const en = (await _jaEn(trimmed))[0].translation_text;
    const zh = (await _enZh(en))[0].translation_text;
    return String(zh).trim();
  }

  if (!_enZh) {
    _enZh = await buildPipeline(EN_ZH_MODEL, { ...options, remoteHost });
  }
  const zh = (await _enZh(trimmed))[0].translation_text;
  return String(zh).trim();
}

module.exports = { translateViaOffline, detectSourceLang, downloadModel, EN_ZH_MODEL, JA_EN_MODEL };
