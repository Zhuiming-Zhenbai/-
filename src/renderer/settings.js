'use strict';

const apiKeyEl = document.getElementById('apiKey');
const hotkeyEl = document.getElementById('hotkey');
const hintEl = document.getElementById('hint');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('save');
const cancelBtn = document.getElementById('cancel');
const changeBtn = document.getElementById('change-hotkey');
const resetBtn = document.getElementById('reset-hotkey');
const closeToTrayRadios = document.querySelectorAll('input[name="closeToTray"]');

let currentHotkey = 'Alt+Q';
let defaultHotkey = 'Alt+Q';
let recording = false;

function setStatus(text, ok) {
  statusEl.textContent = text || '';
  statusEl.style.color = ok ? '#16a34a' : '#dc2626';
}

function selectedCloseToTray() {
  const checked = document.querySelector('input[name="closeToTray"]:checked');
  return checked ? checked.value === 'tray' : true;
}

function setCloseToTray(value) {
  const target = value === false ? 'quit' : 'tray';
  closeToTrayRadios.forEach((r) => {
    r.checked = r.value === target;
  });
}

// 将 KeyboardEvent 转成 Electron Accelerator 字符串；非法/需修饰键但缺失时返回 null
function keyEventToAccelerator(event) {
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');

  const key = event.key;
  let mainKey = null;

  if (/^[a-zA-Z]$/.test(key)) {
    mainKey = key.toUpperCase();
  } else if (/^[0-9]$/.test(key)) {
    mainKey = key;
  } else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) {
    mainKey = key;
  } else {
    const named = {
      ' ': 'Space',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
      Delete: 'Delete',
      Insert: 'Insert',
      Tab: 'Tab',
      Enter: 'Enter',
      Backspace: 'Backspace',
    };
    mainKey = named[key] || null;
  }

  if (!mainKey) return null;

  // 字母/数字必须带修饰键，避免占用普通输入
  if (parts.length === 0 && /^[A-Z0-9]$/.test(mainKey)) {
    return null;
  }

  return parts.length === 0 ? mainKey : `${parts.join('+')}+${mainKey}`;
}

async function doSave(successMsg = '已保存') {
  const res = await window.api.saveSettings({
    apiKey: apiKeyEl.value,
    hotkey: hotkeyEl.value,
    closeToTray: selectedCloseToTray(),
  });
  if (res && res.ok) {
    setStatus(successMsg, true);
    return true;
  }
  setStatus((res && res.error) || '保存失败', false);
  return false;
}

function stopRecording() {
  recording = false;
  changeBtn.classList.remove('recording');
  changeBtn.textContent = '更改';
}

(async () => {
  try {
    const settings = await window.api.getSettings();
    apiKeyEl.value = settings.apiKey || '';
    defaultHotkey = settings.defaultHotkey || 'Alt+Q';
    currentHotkey = settings.hotkey || defaultHotkey;
    hotkeyEl.value = currentHotkey;
    setCloseToTray(settings.closeToTray !== false);
    if (!settings.apiKey) {
      hintEl.hidden = false;
    }
  } catch (err) {
    setStatus(`读取设置失败：${err.message}`, false);
  }
})();

saveBtn.addEventListener('click', async () => {
  try {
    const ok = await doSave();
    if (ok) {
      setTimeout(() => window.api.closeSettings(), 400);
    }
  } catch (err) {
    setStatus(`保存失败：${err.message}`, false);
  }
});

changeBtn.addEventListener('click', () => {
  recording = true;
  changeBtn.classList.add('recording');
  changeBtn.textContent = '请按下快捷键…';
  hotkeyEl.value = '';
  setStatus('', true);
});

document.addEventListener('keydown', async (event) => {
  if (!recording) return;
  event.preventDefault();
  event.stopPropagation();

  if (event.key === 'Escape') {
    stopRecording();
    hotkeyEl.value = currentHotkey;
    setStatus('已取消', true);
    return;
  }

  const accel = keyEventToAccelerator(event);
  if (!accel) {
    setStatus('无效按键，请使用 Ctrl/Alt/Shift 等修饰键 + 字母/数字，或功能键', false);
    return;
  }

  stopRecording();
  try {
    const ok = await window.api.confirmHotkey(accel);
    if (!ok) {
      hotkeyEl.value = currentHotkey;
      return;
    }
    hotkeyEl.value = accel;
    currentHotkey = accel;
    await doSave('快捷键已更新');
  } catch (err) {
    setStatus(`操作失败：${err.message}`, false);
  }
});

resetBtn.addEventListener('click', async () => {
  try {
    const ok = await window.api.confirmReset(defaultHotkey);
    if (!ok) return;
    hotkeyEl.value = defaultHotkey;
    currentHotkey = defaultHotkey;
    await doSave('已重置为默认快捷键');
  } catch (err) {
    setStatus(`操作失败：${err.message}`, false);
  }
});

cancelBtn.addEventListener('click', () => {
  window.api.closeSettings();
});
