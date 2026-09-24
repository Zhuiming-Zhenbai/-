'use strict';

const $ = (id) => document.getElementById(id);

const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
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
const ocrHotkeyEl = $('ocr-hotkey');
const changeOcrBtn = $('change-ocr');
const resetOcrBtn = $('reset-ocr');
const ocrBorderColorEl = $('ocr-border-color');
const resTotal = $('res-total');
const resList = $('res-list');
const resStatus = $('res-status');
const downloadAllBtn = $('download-all');
const deleteAllBtn = $('delete-all');
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
  defaultOcrHotkey: 'Alt+W',
  ocrHotkey: 'Alt+W',
  ocrBorderColor: '#1f6feb',
};

let recording = null; // { inputEl, changeBtn, prevValue, target }

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

function startRecording(inputEl, changeBtn, target) {
  cancelRecording();
  recording = { inputEl, changeBtn, prevValue: inputEl.value, target };
  changeBtn.classList.add('recording');
  changeBtn.textContent = '请按下快捷键…';
  inputEl.value = '';
  setStatus('', true);
}

function cancelRecording() {
  if (!recording) return;
  recording.inputEl.value = recording.prevValue;
  recording.changeBtn.classList.remove('recording');
  recording.changeBtn.textContent = '更改';
  recording = null;
}

async function doSave(successMsg = '已保存') {
  collectSelected();
  const res = await window.api.saveSettings({
    hotkey: hotkeyEl.value,
    ocrHotkey: ocrHotkeyEl.value,
    ocrBorderColor: ocrBorderColorEl.value,
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

function switchTab(tab) {
  navItems.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  tabPanes.forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
  if (tab === 'resources') {
    refreshResources();
  }
}

navItems.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function formatSize(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function renderResources(data) {
  const list = (data && data.resources) || [];
  resTotal.textContent = formatSize((data && data.totalSize) || 0);
  resList.innerHTML = '';
  for (const r of list) {
    const li = document.createElement('li');
    li.className = 'res-item';
    const statusText = r.cached ? `已下载 · ${formatSize(r.size)}` : '未下载';

    const row = document.createElement('div');
    row.className = 'row';

    const info = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = r.name;
    const descEl = document.createElement('div');
    descEl.className = 'desc';
    descEl.textContent = r.description;
    info.appendChild(nameEl);
    info.appendChild(descEl);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = statusText;

    const actions = document.createElement('div');
    actions.className = 'actions';
    const btn = document.createElement('button');
    btn.className = 'ghost';
    if (r.cached) {
      btn.classList.add('danger');
      btn.textContent = '删除';
      btn.addEventListener('click', () => deleteResource(r.id));
    } else {
      btn.textContent = '下载';
      btn.addEventListener('click', () => downloadResource(r.id));
    }
    actions.appendChild(btn);

    row.appendChild(info);
    row.appendChild(meta);
    row.appendChild(actions);

    const progressRow = document.createElement('div');
    progressRow.className = 'progress-row';
    progressRow.dataset.progress = r.id;
    progressRow.hidden = true;
    const barWrap = document.createElement('div');
    barWrap.className = 'progress';
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    barWrap.appendChild(bar);
    const pct = document.createElement('span');
    pct.className = 'pct';
    progressRow.appendChild(barWrap);
    progressRow.appendChild(pct);

    li.appendChild(row);
    li.appendChild(progressRow);
    resList.appendChild(li);
  }
}

function setProgress(id, progress, status) {
  const row = resList.querySelector(`.progress-row[data-progress="${id}"]`);
  if (!row) return;
  if (status === 'done' || progress >= 1) {
    row.hidden = true;
    return;
  }
  row.hidden = false;
  const bar = row.querySelector('.progress-bar');
  const pct = row.querySelector('.pct');
  if (progress == null) {
    bar.style.width = '20%';
    pct.textContent = '…';
  } else {
    const p = Math.round(progress * 100);
    bar.style.width = p + '%';
    pct.textContent = p + '%';
  }
}

async function refreshResources() {
  try {
    const res = await window.api.getResources();
    renderResources(res);
  } catch (err) {
    resStatus.textContent = '读取资源失败：' + err.message;
    resStatus.style.color = '#dc2626';
  }
}

async function downloadResource(id) {
  resStatus.textContent = '正在下载…';
  resStatus.style.color = '#6b7280';
  setProgress(id, 0, 'downloading');
  try {
    const res = await window.api.downloadResource(id);
    if (res && res.ok) {
      renderResources(res);
      resStatus.textContent = '下载完成';
      resStatus.style.color = '#16a34a';
    } else {
      resStatus.textContent = (res && res.error) || '下载失败';
      resStatus.style.color = '#dc2626';
      setProgress(id, 1, 'done');
    }
  } catch (err) {
    resStatus.textContent = '下载失败：' + err.message;
    resStatus.style.color = '#dc2626';
    setProgress(id, 1, 'done');
  }
}

async function deleteResource(id) {
  const res = await window.api.deleteResource(id);
  if (res && res.ok) {
    renderResources(res);
    resStatus.textContent = '已删除';
    resStatus.style.color = '#16a34a';
  } else if (res && res.cancelled) {
    // 用户取消
  } else {
    resStatus.textContent = (res && res.error) || '删除失败';
    resStatus.style.color = '#dc2626';
  }
}

downloadAllBtn.addEventListener('click', async () => {
  resStatus.textContent = '正在全部下载，请稍等…';
  resStatus.style.color = '#6b7280';
  try {
    const res = await window.api.downloadAllResources();
    if (res && res.ok) {
      renderResources(res);
      resStatus.textContent = '全部下载完成';
      resStatus.style.color = '#16a34a';
    } else {
      resStatus.textContent = (res && res.error) || '下载失败';
      resStatus.style.color = '#dc2626';
    }
  } catch (err) {
    resStatus.textContent = '下载失败：' + err.message;
    resStatus.style.color = '#dc2626';
  }
});

deleteAllBtn.addEventListener('click', async () => {
  const res = await window.api.deleteAllResources();
  if (res && res.ok) {
    renderResources(res);
    resStatus.textContent = '已全部删除';
    resStatus.style.color = '#16a34a';
  } else if (res && res.cancelled) {
    // 用户取消
  } else {
    resStatus.textContent = (res && res.error) || '删除失败';
    resStatus.style.color = '#dc2626';
  }
});

window.api.onResourceProgress((d) => {
  if (!d) return;
  setProgress(d.id, d.progress, d.status);
});

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
    state.defaultOcrHotkey = s.defaultOcrHotkey || 'Alt+W';
    state.defaultSystemPrompt = s.defaultSystemPrompt || '';

    state.currentHotkey = s.hotkey || state.defaultHotkey;
    hotkeyEl.value = state.currentHotkey;
    state.ocrHotkey = s.ocrHotkey || state.defaultOcrHotkey;
    ocrHotkeyEl.value = state.ocrHotkey;
    state.ocrBorderColor = s.ocrBorderColor || '#1f6feb';
    ocrBorderColorEl.value = state.ocrBorderColor;
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
    refreshResources();
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

changeBtn.addEventListener('click', () => startRecording(hotkeyEl, changeBtn, 'translate'));
changeOcrBtn.addEventListener('click', () => startRecording(ocrHotkeyEl, changeOcrBtn, 'ocr'));

document.addEventListener('keydown', async (event) => {
  if (!recording) return;
  event.preventDefault();
  event.stopPropagation();

  if (event.key === 'Escape') {
    cancelRecording();
    setStatus('已取消', true);
    return;
  }

  const accel = keyEventToAccelerator(event);
  if (!accel) {
    setStatus('无效按键，请使用 Ctrl/Alt/Shift 等修饰键 + 字母/数字，或功能键', false);
    return;
  }

  const rec = recording;
  cancelRecording();
  try {
    const ok = await window.api.confirmHotkey(accel);
    if (!ok) {
      rec.inputEl.value = rec.prevValue;
      return;
    }
    rec.inputEl.value = accel;
    if (rec.target === 'translate') {
      state.currentHotkey = accel;
    } else {
      state.ocrHotkey = accel;
    }
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

resetOcrBtn.addEventListener('click', async () => {
  try {
    const ok = await window.api.confirmReset(state.defaultOcrHotkey);
    if (!ok) return;
    state.ocrHotkey = state.defaultOcrHotkey;
    ocrHotkeyEl.value = state.ocrHotkey;
    await doSave('已重置为默认快捷键');
  } catch (err) {
    setStatus(`操作失败：${err.message}`, false);
  }
});

cancelBtn.addEventListener('click', () => {
  window.api.closeSettings();
});
