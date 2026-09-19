'use strict';

const originalEl = document.getElementById('original');
const translationEl = document.getElementById('translation');
const copyBtn = document.getElementById('copy');
const closeBtn = document.getElementById('close');

let currentTranslation = '';

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
});

copyBtn.addEventListener('click', () => {
  if (currentTranslation) {
    window.api.copyTranslation(currentTranslation);
  }
});

closeBtn.addEventListener('click', () => {
  window.api.hideWindow();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    window.api.hideWindow();
  }
});
