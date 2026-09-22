'use strict';

const OCR_LANGS = {
  auto: 'eng+chi_sim+jpn',
  en: 'eng',
  ja: 'jpn',
  zh: 'chi_sim',
};

/**
 * 把界面语言标识映射为 tesseract 语言代码。
 * @param {string} lang 'auto' | 'en' | 'ja' | 'zh'
 */
function mapOcrLang(lang) {
  return OCR_LANGS[lang] || OCR_LANGS.auto;
}

let _workerPromise = null;
let _workerLangs = null;

async function getWorker(langs, options) {
  if (_workerPromise && _workerLangs === langs) {
    return _workerPromise;
  }
  if (_workerPromise) {
    try {
      const old = await _workerPromise;
      if (old && typeof old.terminate === 'function') {
        await old.terminate();
      }
    } catch {
      // 忽略旧 worker 销毁错误
    }
  }
  _workerLangs = langs;
  const { createWorker } = require('tesseract.js');
  _workerPromise = createWorker(langs, 1, {
    cachePath: options.cacheDir || undefined,
  }).catch((err) => {
    _workerPromise = null;
    _workerLangs = null;
    throw err;
  });
  return _workerPromise;
}

/**
 * 对图片 Buffer 执行 OCR。
 * @param {Buffer} imageBuffer PNG/JPEG 图片
 * @param {string} lang 'auto' | 'en' | 'ja' | 'zh'
 * @param {object} [options] { cacheDir }
 * @returns {Promise<string>} 识别文本（去首尾空白）
 */
async function recognize(imageBuffer, lang, options = {}) {
  const langs = mapOcrLang(lang);
  const worker = await getWorker(langs, options);
  const { data } = await worker.recognize(imageBuffer);
  return (data && data.text ? data.text : '').trim();
}

module.exports = { recognize, mapOcrLang, OCR_LANGS };
