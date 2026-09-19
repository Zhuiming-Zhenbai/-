'use strict';

const { spawn } = require('node:child_process');
const { clipboard } = require('electron');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 通过 PowerShell 向当前聚焦窗口发送按键（此处用于 Ctrl+C 复制选中文本）。
 * @param {string} keys SendKeys 语法
 */
function sendKeys(keys) {
  return new Promise((resolve, reject) => {
    const ps = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys('${keys}')`,
      ],
      { windowsHide: true },
    );
    ps.once('error', reject);
    ps.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`SendKeys 失败（退出码 ${code}）`));
    });
  });
}

/**
 * 捕获当前选中的文本：
 * 1. 备份剪贴板（文本或图片）
 * 2. 发送 Ctrl+C 复制选中内容
 * 3. 等待复制生效后读取剪贴板文本
 * 4. 恢复原剪贴板
 * @param {object} [options]
 * @param {number} [options.waitMs] 复制后等待时间
 * @returns {Promise<string>} 选中文本（可能为空字符串）
 */
async function captureSelection(options = {}) {
  const { waitMs = 180 } = options;

  const formats = clipboard.availableFormats();
  const hadText = formats.includes('text/plain');
  const imageFormat = formats.find((f) => f === 'image/png' || f.startsWith('image/'));
  const prevText = hadText ? clipboard.readText() : '';
  const prevImage = imageFormat ? clipboard.readImage() : null;

  await sendKeys('^c');
  await sleep(waitMs);

  const selected = clipboard.readText();

  if (imageFormat && prevImage && !prevImage.isEmpty()) {
    clipboard.writeImage(prevImage);
  } else if (hadText) {
    clipboard.writeText(prevText);
  }

  return selected;
}

module.exports = { captureSelection, sendKeys, sleep };
