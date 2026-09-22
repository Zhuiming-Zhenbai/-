'use strict';

const $ = (id) => document.getElementById(id);

const langEl = $('lang');
const translateBtn = $('translate-btn');
const toggleBtn = $('toggle-btn');
const copyBtn = $('copy-btn');
const closeBtn = $('close-btn');
const contentEl = $('content');

let result = null; // { original, translation }
let showing = 'translation'; // 'translation' | 'original'

function render() {
  if (!result) {
    contentEl.hidden = true;
    contentEl.textContent = '';
    return;
  }
  contentEl.hidden = false;
  contentEl.textContent = showing === 'translation' ? result.translation : result.original;
  toggleBtn.textContent = showing === 'translation' ? '显示原文' : '显示译文';
}

function currentText() {
  if (!result) return '';
  return showing === 'translation' ? result.translation : result.original;
}

window.api.onOcrStatus((msg) => {
  contentEl.hidden = false;
  contentEl.textContent = msg;
});

(async () => {
  try {
    langEl.value = await window.api.getOcrLang();
  } catch {
    langEl.value = 'auto';
  }
})();

langEl.addEventListener('change', async () => {
  try {
    await window.api.setOcrLang(langEl.value);
  } catch {
    // 忽略
  }
});

translateBtn.addEventListener('click', async () => {
  translateBtn.disabled = true;
  contentEl.hidden = false;
  contentEl.textContent = '识别中…';
  try {
    const res = await window.api.ocrTranslate(langEl.value);
    result = res && res.original !== undefined ? res : { original: '', translation: '识别/翻译失败' };
    showing = 'translation';
    render();
  } catch (err) {
    result = { original: '', translation: `出错：${err.message}` };
    showing = 'translation';
    render();
  } finally {
    translateBtn.disabled = false;
  }
});

toggleBtn.addEventListener('click', () => {
  if (!result) return;
  showing = showing === 'translation' ? 'original' : 'translation';
  render();
});

copyBtn.addEventListener('click', () => {
  const text = currentText();
  if (text) {
    window.api.copyTranslation(text);
  }
});

closeBtn.addEventListener('click', () => {
  window.api.closeOcrWindow();
});

// 四角拖拽缩放
function setupGrip(el, corner) {
  el.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    el.setPointerCapture(event.pointerId);
    const start = {
      sx: event.screenX,
      sy: event.screenY,
      x: window.screenX,
      y: window.screenY,
      w: window.innerWidth,
      h: window.innerHeight,
    };
    const MIN_W = 200;
    const MIN_H = 120;
    const onMove = (ev) => {
      const dx = ev.screenX - start.sx;
      const dy = ev.screenY - start.sy;
      let { x, y, w, h } = start;
      if (corner.includes('e')) w = start.w + dx;
      if (corner.includes('s')) h = start.h + dy;
      if (corner.includes('w')) {
        x = start.x + dx;
        w = start.w - dx;
      }
      if (corner.includes('n')) {
        y = start.y + dy;
        h = start.h - dy;
      }
      if (w < MIN_W) {
        if (corner.includes('w')) x -= MIN_W - w;
        w = MIN_W;
      }
      if (h < MIN_H) {
        if (corner.includes('n')) y -= MIN_H - h;
        h = MIN_H;
      }
      window.api.setOcrBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) });
    };
    const onUp = () => {
      el.releasePointerCapture(event.pointerId);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  });
}

['nw', 'ne', 'sw', 'se'].forEach((c) => setupGrip(document.querySelector(`.grip.${c}`), c));
