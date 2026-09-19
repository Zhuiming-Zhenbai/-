'use strict';

const apiKeyEl = document.getElementById('apiKey');
const hotkeyEl = document.getElementById('hotkey');
const hintEl = document.getElementById('hint');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('save');
const cancelBtn = document.getElementById('cancel');

function setStatus(text, ok) {
  statusEl.textContent = text || '';
  statusEl.style.color = ok ? '#16a34a' : '#dc2626';
}

(async () => {
  try {
    const settings = await window.api.getSettings();
    apiKeyEl.value = settings.apiKey || '';
    hotkeyEl.value = settings.hotkey || '';
    if (!settings.apiKey) {
      hintEl.hidden = false;
    }
  } catch (err) {
    setStatus(`读取设置失败：${err.message}`, false);
  }
})();

saveBtn.addEventListener('click', async () => {
  try {
    const res = await window.api.saveSettings({
      apiKey: apiKeyEl.value,
      hotkey: hotkeyEl.value,
    });
    if (res && res.ok) {
      setStatus('已保存', true);
      setTimeout(() => window.api.closeSettings(), 400);
    } else {
      setStatus((res && res.error) || '保存失败', false);
    }
  } catch (err) {
    setStatus(`保存失败：${err.message}`, false);
  }
});

cancelBtn.addEventListener('click', () => {
  window.api.closeSettings();
});
