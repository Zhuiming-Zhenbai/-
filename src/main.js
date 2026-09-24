'use strict';

const path = require('node:path');
const fs = require('node:fs');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  dialog,
  ipcMain,
  globalShortcut,
  clipboard,
  screen,
  nativeImage,
  desktopCapturer,
} = require('electron');

const { loadConfig, saveConfig, resolveApiKey, getActiveProvider, DEFAULTS, DEFAULT_SYSTEM_PROMPT } = require('./config');
const { translate } = require('./translate');
const { captureSelection } = require('./selection');
const { recognize: ocrRecognize, traineddataCached, downloadTraineddata } = require('./ocr');
const { downloadModel } = require('./providers/offline');
const {
  RESOURCES,
  list: listResources,
  totalSize: resourcesTotalSize,
  remove: removeResource,
  removeAll: removeAllResources,
  getById: getResourceById,
  isCached: resourceCached,
} = require('./resources');

const POPUP_MIN_W = 320;
const POPUP_MIN_H = 160;
const POPUP_MAX_W = 560;
const POPUP_MAX_H = 600;

let config = null;
let tray = null;
let popupWindow = null;
let settingsWindow = null;
let ocrWindow = null;
let popupReady = false;
let pendingPopupData = null;
let translating = false;
const activeDownloads = new Map();
let cancelAllDownloads = false;

function getConfigDir() {
  return app.getPath('userData');
}

function iconPath() {
  return path.join(__dirname, '..', 'assets', 'icon.png');
}

function createTray() {
  const icon = nativeImage.createFromPath(iconPath());
  tray = new Tray(icon);
  tray.setToolTip('小白翻译');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '屏幕识别', click: () => createOcrWindow() },
      { label: '设置', click: () => createSettingsWindow() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]),
  );
  tray.on('click', () => createSettingsWindow());
}

function createPopupWindow() {
  popupWindow = new BrowserWindow({
    width: 360,
    height: 240,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  popupWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  popupWindow.webContents.once('did-finish-load', () => {
    popupReady = true;
    if (pendingPopupData) {
      popupWindow.webContents.send('show-translation', pendingPopupData);
      pendingPopupData = null;
    }
  });
  popupWindow.on('closed', () => {
    popupWindow = null;
    popupReady = false;
  });
}

function positionPopupNearCursor() {
  if (!popupWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const [w, h] = popupWindow.getSize();
  const area = display.workArea;
  let x = cursor.x + 12;
  let y = cursor.y + 12;
  if (x + w > area.x + area.width) x = area.x + area.width - w - 8;
  if (y + h > area.y + area.height) y = area.y + area.height - h - 8;
  if (x < area.x) x = area.x + 8;
  if (y < area.y) y = area.y + 8;
  popupWindow.setPosition(Math.round(x), Math.round(y));
}

function sendPopupData(data) {
  if (popupReady && popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('show-translation', data);
  } else {
    pendingPopupData = data;
  }
}

function showPopup(data) {
  if (!popupWindow) createPopupWindow();
  positionPopupNearCursor();
  sendPopupData(data);
  popupWindow.show();
  popupWindow.focus();
}

function clampPopupSize(w, h) {
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const maxH = Math.min(POPUP_MAX_H, area.height - 40);
  const cw = Math.round(Math.min(Math.max(w, POPUP_MIN_W), POPUP_MAX_W));
  const ch = Math.round(Math.min(Math.max(h, POPUP_MIN_H), maxH));
  return [cw, ch];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function modelsCached() {
  const dir = path.join(getConfigDir(), 'models');
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function sendResourceProgress(id, progress, status) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('resource-progress', { id, progress, status });
  }
}

async function downloadOneResource(id) {
  const res = getResourceById(id);
  if (!res) throw new Error('未知资源');
  const control = { cancelled: false, clear: false, abort: null };
  activeDownloads.set(id, control);
  sendResourceProgress(id, 0, 'downloading');
  try {
    if (res.kind === 'model') {
      await downloadModel(res.modelId, {
        cacheDir: path.join(getConfigDir(), 'models'),
        remoteHost: config.offline && config.offline.remoteHost,
        progress_callback: (d) => {
          if (control.cancelled) throw new Error('__CANCELLED__');
          sendResourceProgress(id, typeof d.progress === 'number' ? d.progress : null, 'downloading');
        },
      });
    } else {
      const ac = new AbortController();
      control.abort = () => ac.abort();
      await downloadTraineddata(res.lang, {
        cacheDir: path.join(getConfigDir(), 'tessdata'),
        signal: ac.signal,
        onProgress: (m) => {
          if (control.cancelled) {
            ac.abort();
            return;
          }
          sendResourceProgress(id, typeof m.progress === 'number' ? m.progress : null, m.status || 'downloading');
        },
      });
    }
    if (control.cancelled) throw new Error('__CANCELLED__');
    sendResourceProgress(id, 1, 'done');
    return true;
  } catch (err) {
    if (control.cancelled && control.clear) {
      fs.rmSync(path.join(getConfigDir(), res.relPath), { recursive: true, force: true });
    }
    if (err && err.name === 'AbortError') {
      throw new Error('__CANCELLED__');
    }
    throw err;
  } finally {
    activeDownloads.delete(id);
  }
}

/**
 * 截取某个窗口当前覆盖的屏幕区域（先把窗口隐藏，避免截到自身）。
 * @param {BrowserWindow} win
 * @returns {Promise<Buffer>} PNG 数据
 */
async function captureWindowRegion(win) {
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const scale = display.scaleFactor || 1;

  win.hide();
  try {
    await sleep(150);
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.size.width * scale),
        height: Math.round(display.size.height * scale),
      },
    });
    const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
    if (!source || !source.thumbnail || source.thumbnail.isEmpty()) {
      throw new Error('无法截取屏幕');
    }
    const cropRect = {
      x: Math.round((bounds.x - display.bounds.x) * scale),
      y: Math.round((bounds.y - display.bounds.y) * scale),
      width: Math.round(bounds.width * scale),
      height: Math.round(bounds.height * scale),
    };
    const cropped = source.thumbnail.crop(cropRect);
    return cropped.toPNG();
  } finally {
    win.show();
    win.focus();
  }
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 680,
    minWidth: 440,
    minHeight: 500,
    title: '小白翻译 - 设置',
    resizable: true,
    minimizable: true,
    maximizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('close', () => {
    if (config && config.closeToTray === false) {
      app.quit();
    }
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createOcrWindow() {
  if (ocrWindow && !ocrWindow.isDestroyed()) {
    ocrWindow.show();
    ocrWindow.focus();
    return;
  }
  ocrWindow = new BrowserWindow({
    width: 420,
    height: 300,
    minWidth: 200,
    minHeight: 120,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  ocrWindow.loadFile(path.join(__dirname, 'renderer', 'ocr', 'index.html'));
  ocrWindow.on('focus', () => {
    if (ocrWindow && !ocrWindow.isDestroyed()) {
      ocrWindow.webContents.send('ocr-focused', true);
    }
  });
  ocrWindow.on('blur', () => {
    if (ocrWindow && !ocrWindow.isDestroyed()) {
      ocrWindow.webContents.send('ocr-focused', false);
    }
  });
  ocrWindow.on('closed', () => {
    ocrWindow = null;
  });
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  let ok = true;
  const hk = config.hotkey;
  if (hk) {
    try {
      if (!globalShortcut.register(hk, onHotkey)) ok = false;
    } catch {
      ok = false;
    }
  }
  const ocr = config.ocrHotkey;
  if (ocr) {
    try {
      if (!globalShortcut.register(ocr, onOcrHotkey)) ok = false;
    } catch {
      ok = false;
    }
  }
  return ok;
}

function onOcrHotkey() {
  createOcrWindow();
}

async function onHotkey() {
  if (translating) return;
  translating = true;
  try {
    // 若弹窗当前持有焦点，先隐藏，确保 Ctrl+C 作用于目标应用
    if (popupWindow && popupWindow.isVisible()) {
      popupWindow.hide();
    }

    if (config.engineMode !== 'offline') {
      const provider = getActiveProvider(config);
      if (!resolveApiKey(provider)) {
        createSettingsWindow();
        return;
      }
    }

    const text = await captureSelection();
    if (!text.trim()) {
      showPopup({ original: '', translation: '未检测到选中的文本' });
      return;
    }

    showPopup({ original: text, translation: '翻译中…' });
    const translation = await translate(text, config, {
      cacheDir: path.join(getConfigDir(), 'models'),
      remoteHost: config.offline && config.offline.remoteHost,
    });
    showPopup({ original: text, translation });
  } catch (err) {
    showPopup({ original: '', translation: `翻译失败：${err.message}` });
  } finally {
    translating = false;
  }
}

function registerIpcHandlers() {
  ipcMain.on('hide-window', () => {
    if (popupWindow) popupWindow.hide();
  });

  ipcMain.on('copy-translation', async (_event, text) => {
    try {
      await clipboard.writeText(String(text ?? ''));
    } catch {
      // 忽略复制失败
    }
  });

  ipcMain.on('resize-to-content', (_event, size) => {
    if (!popupWindow || popupWindow.isDestroyed()) return;
    const [w, h] = clampPopupSize(
      Number(size && size.width) || POPUP_MIN_W,
      Number(size && size.height) || POPUP_MIN_H,
    );
    popupWindow.setSize(w, h);
    positionPopupNearCursor();
  });

  ipcMain.on('resize-window', (_event, size) => {
    if (!popupWindow || popupWindow.isDestroyed()) return;
    const [w, h] = clampPopupSize(
      Number(size && size.width) || POPUP_MIN_W,
      Number(size && size.height) || POPUP_MIN_H,
    );
    popupWindow.setSize(w, h);
  });

  ipcMain.handle('get-settings', () => ({
    apiKey: config.apiKey || '',
    hotkey: config.hotkey || '',
    closeToTray: config.closeToTray !== false,
    defaultHotkey: DEFAULTS.hotkey,
    ocrHotkey: config.ocrHotkey || '',
    defaultOcrHotkey: DEFAULTS.ocrHotkey,
    ocrBorderColor: config.ocrBorderColor || '#1f6feb',
    engineMode: config.engineMode || 'online',
    providers: Array.isArray(config.providers) ? config.providers : [],
    activeProviderId: config.activeProviderId || '',
    offline: { ...(config.offline || {}) },
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
  }));

  ipcMain.handle('save-settings', (_event, cfg) => {
    const next = {
      ...config,
      hotkey: typeof cfg.hotkey === 'string' ? cfg.hotkey.trim() : config.hotkey,
      ocrHotkey: typeof cfg.ocrHotkey === 'string' ? cfg.ocrHotkey.trim() : config.ocrHotkey,
      ocrBorderColor: typeof cfg.ocrBorderColor === 'string' ? cfg.ocrBorderColor : config.ocrBorderColor,
      closeToTray: typeof cfg.closeToTray === 'boolean' ? cfg.closeToTray : config.closeToTray,
      engineMode: cfg.engineMode === 'offline' ? 'offline' : 'online',
      providers: Array.isArray(cfg.providers) ? cfg.providers : config.providers,
      activeProviderId: typeof cfg.activeProviderId === 'string' ? cfg.activeProviderId : config.activeProviderId,
      offline: {
        sourceLang: 'auto',
        remoteHost: 'https://hf-mirror.com/',
        ...(config.offline || {}),
        ...(cfg.offline || {}),
      },
    };
    if (!next.hotkey) {
      return { ok: false, error: '翻译快捷键不能为空' };
    }
    if (!next.ocrHotkey) {
      return { ok: false, error: '屏幕识别快捷键不能为空' };
    }
    const prev = config;
    config = next;
    if (!registerShortcuts()) {
      config = prev;
      registerShortcuts(); // 回退到旧快捷键
      return { ok: false, error: '快捷键注册失败，可能已被占用或两个快捷键冲突，请更换' };
    }
    saveConfig(getConfigDir(), config);
    return { ok: true };
  });

  ipcMain.on('close-settings', () => {
    if (settingsWindow) settingsWindow.close();
  });

  ipcMain.handle('confirm-hotkey', async (_event, accelerator) => {
    const { response } = await dialog.showMessageBox(settingsWindow, {
      type: 'question',
      buttons: ['确认更改', '取消'],
      defaultId: 0,
      cancelId: 1,
      title: '确认快捷键',
      message: `确认将快捷键设置为 ${accelerator} 吗？`,
    });
    return response === 0;
  });

  ipcMain.handle('confirm-reset', async (_event, defaultHotkey) => {
    const { response } = await dialog.showMessageBox(settingsWindow, {
      type: 'question',
      buttons: ['重置', '取消'],
      defaultId: 0,
      cancelId: 1,
      title: '重置快捷键',
      message: `确认将快捷键重置为默认值 ${defaultHotkey} 吗？`,
    });
    return response === 0;
  });

  ipcMain.on('set-ocr-bounds', (_event, b) => {
    if (!ocrWindow || ocrWindow.isDestroyed()) return;
    const MIN_W = 200;
    const MIN_H = 120;
    const x = Math.round(Number(b && b.x) || 0);
    const y = Math.round(Number(b && b.y) || 0);
    const w = Math.max(MIN_W, Math.round(Number(b && b.width) || MIN_W));
    const h = Math.max(MIN_H, Math.round(Number(b && b.height) || MIN_H));
    ocrWindow.setBounds({ x, y, width: w, height: h });
  });

  ipcMain.on('close-ocr-window', () => {
    if (ocrWindow) ocrWindow.close();
  });

  ipcMain.handle('get-ocr-lang', () => config.ocrLang || 'auto');

  ipcMain.handle('set-ocr-lang', (_event, lang) => {
    const v = ['auto', 'en', 'ja', 'zh'].includes(lang) ? lang : 'auto';
    config.ocrLang = v;
    saveConfig(getConfigDir(), config);
    return v;
  });

  ipcMain.handle('ocr-translate', async (_event, lang) => {
    if (!ocrWindow || ocrWindow.isDestroyed()) {
      throw new Error('识别窗口未打开');
    }
    const sendStatus = (msg) => {
      if (ocrWindow && !ocrWindow.isDestroyed()) {
        ocrWindow.webContents.send('ocr-status', msg);
      }
    };
    const tessCache = path.join(getConfigDir(), 'tessdata');
    const needTess = !traineddataCached(lang, tessCache);
    const needModels = config.engineMode === 'offline' && !modelsCached();

    if (needTess) {
      sendStatus('首次识别该语言需下载语言数据，请稍作等待…');
    }
    const png = await captureWindowRegion(ocrWindow);
    const original = await ocrRecognize(png, lang, { cacheDir: tessCache });
    if (needTess) {
      sendStatus('语言数据下载完成');
    }
    if (!original.trim()) {
      return { original: '', translation: '未识别到文字' };
    }
    if (needModels) {
      sendStatus('首次离线翻译需下载模型，请稍作等待…');
    }
    const translation = await translate(original, config, {
      cacheDir: path.join(getConfigDir(), 'models'),
      remoteHost: config.offline && config.offline.remoteHost,
    });
    return { original, translation };
  });

  ipcMain.handle('get-ocr-config', () => ({
    lang: config.ocrLang || 'auto',
    borderColor: config.ocrBorderColor || '#1f6feb',
  }));

  ipcMain.handle('save-ocr-border-color', (_event, color) => {
    const v = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : config.ocrBorderColor;
    config.ocrBorderColor = v;
    saveConfig(getConfigDir(), config);
    if (ocrWindow && !ocrWindow.isDestroyed()) {
      ocrWindow.webContents.send('ocr-border-color', v);
    }
    return { ok: true, borderColor: v };
  });

  ipcMain.handle('get-resources', () => ({
    resources: listResources(getConfigDir()),
    totalSize: resourcesTotalSize(getConfigDir()),
  }));

  ipcMain.handle('download-resource', async (_event, id) => {
    try {
      await downloadOneResource(id);
      return {
        ok: true,
        resources: listResources(getConfigDir()),
        totalSize: resourcesTotalSize(getConfigDir()),
      };
    } catch (err) {
      if (err && err.message === '__CANCELLED__') {
        return {
          ok: false,
          cancelled: true,
          resources: listResources(getConfigDir()),
          totalSize: resourcesTotalSize(getConfigDir()),
        };
      }
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('download-all-resources', async () => {
    cancelAllDownloads = false;
    try {
      for (const r of RESOURCES) {
        if (cancelAllDownloads) break;
        if (!resourceCached(getConfigDir(), r)) {
          await downloadOneResource(r.id);
        }
      }
      return {
        ok: true,
        resources: listResources(getConfigDir()),
        totalSize: resourcesTotalSize(getConfigDir()),
      };
    } catch (err) {
      if (err && err.message === '__CANCELLED__') {
        return {
          ok: false,
          cancelled: true,
          resources: listResources(getConfigDir()),
          totalSize: resourcesTotalSize(getConfigDir()),
        };
      }
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('cancel-resource', async (_event, payload) => {
    const id = payload && payload.id;
    const clear = !!(payload && payload.clear);
    const control = activeDownloads.get(id);
    if (!control) return { ok: false, error: '没有进行中的下载' };
    control.cancelled = true;
    control.clear = clear;
    if (control.abort) control.abort();
    return {
      ok: true,
      resources: listResources(getConfigDir()),
      totalSize: resourcesTotalSize(getConfigDir()),
    };
  });

  ipcMain.handle('cancel-all-resources', async () => {
    cancelAllDownloads = true;
    for (const control of activeDownloads.values()) {
      control.cancelled = true;
      control.clear = true;
      if (control.abort) control.abort();
    }
    return {
      ok: true,
      resources: listResources(getConfigDir()),
      totalSize: resourcesTotalSize(getConfigDir()),
    };
  });

  ipcMain.handle('delete-resource', async (_event, id) => {
    const res = getResourceById(id);
    if (!res) return { ok: false, error: '未知资源' };
    const { response } = await dialog.showMessageBox(settingsWindow, {
      type: 'question',
      buttons: ['删除', '取消'],
      defaultId: 1,
      cancelId: 1,
      title: '删除资源',
      message: `确认删除「${res.name}」吗？删除后下次使用会重新下载。`,
    });
    if (response !== 0) return { ok: false, cancelled: true };
    removeResource(getConfigDir(), id);
    return {
      ok: true,
      resources: listResources(getConfigDir()),
      totalSize: resourcesTotalSize(getConfigDir()),
    };
  });

  ipcMain.handle('delete-all-resources', async () => {
    const { response } = await dialog.showMessageBox(settingsWindow, {
      type: 'question',
      buttons: ['全部删除', '取消'],
      defaultId: 1,
      cancelId: 1,
      title: '删除全部资源',
      message: '确认删除全部已下载资源吗？删除后下次使用会重新下载。',
    });
    if (response !== 0) return { ok: false, cancelled: true };
    removeAllResources(getConfigDir());
    return {
      ok: true,
      resources: listResources(getConfigDir()),
      totalSize: resourcesTotalSize(getConfigDir()),
    };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    createSettingsWindow();
  });

  app.setAppUserModelId('com.xiaobai.translator');

  app.whenReady().then(() => {
    config = loadConfig(getConfigDir());
    registerIpcHandlers();
    createTray();
    createPopupWindow();
    if (!registerShortcuts()) {
      console.warn('快捷键注册失败');
    }
  });

  // 常驻托盘：仅在关闭行为配置为「退出程序」时，窗口全部关闭后退出
  app.on('window-all-closed', () => {
    if (config && config.closeToTray === false) {
      app.quit();
    }
  });
}
