'use strict';

const originalEl = document.getElementById('original');
const translationEl = document.getElementById('translation');
const copyBtn = document.getElementById('copy');
const closeBtn = document.getElementById('close');

let currentTranslation = '';

const FONT_FAMILY = '"Segoe UI", "Microsoft YaHei", sans-serif';

// 测量文本（按行、不换行）的最大宽度
function measureTextWidth(text, fontSizePx) {
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${fontSizePx}px ${FONT_FAMILY};left:-9999px;top:-9999px;`;
  document.body.appendChild(probe);
  let max = 0;
  for (const line of String(text).split('\n')) {
    probe.textContent = line;
    if (probe.offsetWidth > max) max = probe.offsetWidth;
  }
  document.body.removeChild(probe);
  return max;
}

// 测量元素自然高度（临时去掉 overflow/height 限制）
function measureNaturalHeight(el) {
  const prevOverflow = el.style.overflowY;
  const prevHeight = el.style.height;
  el.style.overflowY = 'visible';
  el.style.height = 'auto';
  const h = el.scrollHeight;
  el.style.overflowY = prevOverflow;
  el.style.height = prevHeight;
  return h;
}

// 计算并请求主进程调整窗口大小以适配内容
function requestFitSize() {
  const headerEl = document.querySelector('.header');
  const footerEl = document.querySelector('.footer');

  const transW = measureTextWidth(translationEl.textContent, 15);
  const origW = originalEl.hidden ? 0 : measureTextWidth(originalEl.textContent, 13);
  const desiredW = Math.max(transW, origW) + 26; // 左右 padding + 边框

  const headerH = headerEl.offsetHeight;
  const footerH = footerEl.offsetHeight;
  const originalH = originalEl.hidden ? 0 : Math.min(originalEl.scrollHeight, 120) + 14;
  const transH = measureNaturalHeight(translationEl);
  const desiredH = headerH + originalH + transH + footerH + 20; // card 上下 margin

  window.api.resizeToContent({ width: Math.ceil(desiredW), height: Math.ceil(desiredH) });
}

window.api.onShowTranslation((data) => {
  const original = data && data.original ? data.original : '';
  currentTranslation = (data && data.translation) || '';

  if (original.trim()) {
    originalEl.textContent = original;
    originalEl.hidden = false;
  } else {
    originalEl.textContent = '';
    originalEl.hidden = true;
  }

  translationEl.textContent = currentTranslation || '(空)';
  requestFitSize();
});

copyBtn.addEventListener('click', () => {
  if (currentTranslation) {
    window.api.copyTranslation(currentTranslation);
  }
});

closeBtn.addEventListener('click', () => {
  window.api.hideWindow();
});

// 右下角拖拽手柄：手动调整窗口大小
const resizeHandle = document.getElementById('resize-handle');
let resizing = false;
let startX = 0;
let startY = 0;
let startW = 0;
let startH = 0;

resizeHandle.addEventListener('pointerdown', (event) => {
  resizing = true;
  resizeHandle.setPointerCapture(event.pointerId);
  startX = event.screenX;
  startY = event.screenY;
  startW = window.innerWidth;
  startH = window.innerHeight;
  event.preventDefault();
});

resizeHandle.addEventListener('pointermove', (event) => {
  if (!resizing) return;
  window.api.resizeWindow({
    width: startW + (event.screenX - startX),
    height: startH + (event.screenY - startY),
  });
});

function endResize(event) {
  if (!resizing) return;
  resizing = false;
  if (resizeHandle.hasPointerCapture(event.pointerId)) {
    resizeHandle.releasePointerCapture(event.pointerId);
  }
}

resizeHandle.addEventListener('pointerup', endResize);
resizeHandle.addEventListener('pointercancel', endResize);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    window.api.hideWindow();
  }
});
