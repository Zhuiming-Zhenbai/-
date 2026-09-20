'use strict';

const $ = (id) => document.getElementById(id);

const engineRadios = document.querySelectorAll('input[name="engineMode"]');
const onlineSection = $('online-section');
const offlineSection = $('offline-section');
const providerSelect = $('provider-select');
const setActiveBtn = $('set-active');
const addProviderBtn = $('add-provider');
const delProviderBtn = $('del-provider');
const pName = $('p-name');
const pBaseurl = $('p-baseurl');
const pApikey = $('p-apikey');
const pModel = $('p-model');
const pPrompt = $('p-prompt');
const pEnabled = $('p-enabled');
const activeName = $('active-name');
const offSource = $('off-source');
const offHost = $('off-host');
const hotkeyEl = $('hotkey');
const changeBtn = $('change-hotkey');
const resetBtn = $('reset-hotkey');
const saveBtn = $('save');
const cancelBtn = $('cancel');
const statusEl = $('status');
const closeToTrayRadios = document.querySelectorAll('input[name="closeToTray"]');

const state = {
  engineMode: 'online',
  providers: [],
  activeProviderId: '',
  selectedProviderId: '',
  offline: { sourceLang: 'auto', remoteHost: '' },
  defaultHotkey: 'Alt+Q',
  defaultSystemPrompt: '',
  currentHotkey: 'Alt+Q',
};

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

function newId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getSelectedProvider() {
  return state.providers.find((p) => p.id === state.selectedProviderId) || null;
}

function updateActiveLabel() {
  const active = state.providers.find((p) => p.id === state.activeProviderId);
  activeName.textContent = active ? active.name : '（无）';
}

function renderProviders() {
  providerSelect.innerHTML = '';
  for (const p of state.providers) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + (p.id === state.activeProviderId ? '（当前）' : '');
    providerSelect.appendChild(opt);
  }
  if (!state.providers.some((p) => p.id === state.selectedProviderId)) {
    state.selectedProviderId = state.providers[0] ? state.providers[0].id : '';
  }
  if (state.selectedProviderId) {
    providerSelect.value = state.selectedProviderId;
  }
  updateActiveLabel();
}

function loadSelected() {
  const p = getSelectedProvider();
  if (!p) {
    pName.value = '';
    pBaseurl.value = '';
    pApikey.value = '';
    pModel.value = '';
    pPrompt.value = '';
    pEnabled.checked = true;
    return;
  }
  pName.value = p.name || '';
  pBaseurl.value = p.baseUrl || '';
  pApikey.value = p.apiKey || '';
  pModel.value = p.model || '';
  pPrompt.value = p.systemPrompt || '';
  pEnabled.checked = p.enabled !== false;
}

function collectSelected() {
  const p = getSelectedProvider();
  if (!p) return;
  p.name = pName.value.trim() || '未命名';
  p.baseUrl = pBaseurl.value.trim();
  p.apiKey = pApikey.value.trim();
  p.model = pModel.value.trim();
  p.systemPrompt = pPrompt.value;
  p.enabled = pEnabled.checked;
}

function toggleSections() {
  const offline = state.engineMode === 'offline';
  onlineSection.classList.toggle('disabled', offline);
  offlineSection.classList.toggle('disabled', !offline);
}

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
  if (parts.length === 0 && /^[A-Z0-9]$/.test(mainKey)) {
    return null;
  }
  return parts.length === 0 ? mainKey : `${parts.join('+')}+${mainKey}`;
}

async function doSave(successMsg = '已保存') {
  collectSelected();
  const res = await window.api.saveSettings({
    hotkey: hotkeyEl.value,
    closeToTray: selectedCloseToTray(),
    engineMode: state.engineMode,
    providers: state.providers,
    activeProviderId: state.activeProviderId,
    offline: {
      sourceLang: offSource.value,
      remoteHost: offHost.value.trim() || 'https://hf-mirror.com/',
    },
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
    const s = await window.api.getSettings();
    state.engineMode = s.engineMode || 'online';
    state.providers = Array.isArray(s.providers) ? s.providers : [];
    state.activeProviderId = s.activeProviderId || '';
    state.offline = {
      sourceLang: (s.offline && s.offline.sourceLang) || 'auto',
      remoteHost: (s.offline && s.offline.remoteHost) || '',
    };
    state.defaultHotkey = s.defaultHotkey || 'Alt+Q';
    state.defaultSystemPrompt = s.defaultSystemPrompt || '';

    hotkeyEl.value = s.hotkey || state.defaultHotkey;
    state.currentHotkey = hotkeyEl.value;
    setCloseToTray(s.closeToTray !== false);

    engineRadios.forEach((r) => {
      r.checked = r.value === state.engineMode;
    });
    toggleSections();

    if (!state.providers.length) {
      state.providers.push({
        id: newId(),
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: s.apiKey || '',
        model: 'deepseek-chat',
        systemPrompt: state.defaultSystemPrompt,
        enabled: true,
      });
      state.activeProviderId = state.providers[0].id;
    }
    if (!state.providers.some((p) => p.id === state.activeProviderId)) {
      const fallback = state.providers.find((p) => p.enabled !== false) || state.providers[0];
      state.activeProviderId = fallback.id;
    }
    state.selectedProviderId = state.activeProviderId;
    renderProviders();
    loadSelected();

    offSource.value = state.offline.sourceLang;
    offHost.value = state.offline.remoteHost || '';
  } catch (err) {
    setStatus(`读取设置失败：${err.message}`, false);
  }
})();

engineRadios.forEach((r) => {
  r.addEventListener('change', () => {
    if (!r.checked) return;
    state.engineMode = r.value;
    toggleSections();
  });
});

providerSelect.addEventListener('change', () => {
  collectSelected();
  state.selectedProviderId = providerSelect.value;
  loadSelected();
});

setActiveBtn.addEventListener('click', () => {
  collectSelected();
  state.activeProviderId = state.selectedProviderId;
  renderProviders();
  setStatus('已设为当前（点「保存」生效）', true);
});

addProviderBtn.addEventListener('click', () => {
  collectSelected();
  const p = {
    id: newId(),
    name: '新配置',
    baseUrl: '',
    apiKey: '',
    model: '',
    systemPrompt: state.defaultSystemPrompt,
    enabled: true,
  };
  state.providers.push(p);
  state.selectedProviderId = p.id;
  renderProviders();
  loadSelected();
});

delProviderBtn.addEventListener('click', () => {
  if (state.providers.length <= 1) {
    setStatus('至少保留一个配置', false);
    return;
  }
  collectSelected();
  const idx = state.providers.findIndex((p) => p.id === state.selectedProviderId);
  if (idx === -1) return;
  const removed = state.providers[idx];
  state.providers.splice(idx, 1);
  if (state.activeProviderId === removed.id) {
    state.activeProviderId = state.providers[0] ? state.providers[0].id : '';
  }
  state.selectedProviderId = state.providers[0] ? state.providers[0].id : '';
  renderProviders();
  loadSelected();
});

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
    hotkeyEl.value = state.currentHotkey;
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
      hotkeyEl.value = state.currentHotkey;
      return;
    }
    state.currentHotkey = accel;
    hotkeyEl.value = accel;
    await doSave('快捷键已更新');
  } catch (err) {
    setStatus(`操作失败：${err.message}`, false);
  }
});

resetBtn.addEventListener('click', async () => {
  try {
    const ok = await window.api.confirmReset(state.defaultHotkey);
    if (!ok) return;
    state.currentHotkey = state.defaultHotkey;
    hotkeyEl.value = state.currentHotkey;
    await doSave('已重置为默认快捷键');
  } catch (err) {
    setStatus(`操作失败：${err.message}`, false);
  }
});

cancelBtn.addEventListener('click', () => {
  window.api.closeSettings();
});
