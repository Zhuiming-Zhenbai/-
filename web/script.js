'use strict';

// 复制百度网盘提取码
const copyBtn = document.getElementById('copy-pwd');

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // 兜底：非 https 环境（如本地直接打开）
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    try {
      await copyText('kbwq');
      copyBtn.textContent = '已复制';
      setTimeout(() => {
        copyBtn.textContent = '复制';
      }, 1500);
    } catch {
      copyBtn.textContent = '复制失败';
    }
  });
}
