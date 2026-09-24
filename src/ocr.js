'use strict';

const fs = require('node:fs');
const path = require('node:path');

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

/**
 * 某语言需要下载的 traineddata 文件（不含扩展名）列表。
 */
function requiredLangs(lang) {
  return mapOcrLang(lang).split('+');
}

/**
 * 判断某语言的语言数据是否已缓存。
 */
function traineddataCached(lang, cacheDir) {
  if (!cacheDir) return false;
  return requiredLangs(lang).every((l) => fs.existsSync(path.join(cacheDir, `${l}.traineddata`)));
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

/**
 * 触发某语言数据下载（创建 worker 后立即销毁）。
 * @param {string} rawLang tesseract 语言代码（eng / chi_sim / jpn）
 * @param {object} [options] { cacheDir, onProgress }
 */
async function downloadTraineddata(rawLang, options = {}) {
  const { createWorker } = require('tesseract.js');
  const worker = await createWorker(rawLang, 1, {
    cachePath: options.cacheDir || undefined,
    logger: (m) => {
      if (options.onProgress) {
        options.onProgress({
          progress: typeof m.progress === 'number' ? m.progress : null,
          status: m.status,
        });
      }
    },
  });
  await worker.terminate();
  return true;
}

module.exports = {
  recognize,
  mapOcrLang,
  requiredLangs,
  traineddataCached,
  downloadTraineddata,
  OCR_LANGS,
};
