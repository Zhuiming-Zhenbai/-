'use strict';

const path = require('node:path');
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
} = require('electron');

const { loadConfig, saveConfig, resolveApiKey, getActiveProvider, DEFAULTS, DEFAULT_SYSTEM_PROMPT } = require('./config');
const { translate } = require('./translate');
const { captureSelection } = require('./selection');

const POPUP_MIN_W = 320;
const POPUP_MIN_H = 160;
const POPUP_MAX_W = 560;
const POPUP_MAX_H = 600;

let config = null;
let tray = null;
let popupWindow = null;
let settingsWindow = null;
let popupReady = false;
let pendingPopupData = null;
let translating = false;

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

function registerShortcut(hotkey) {
  globalShortcut.unregisterAll();
  if (!hotkey) return false;
  try {
    return globalShortcut.register(hotkey, onHotkey);
  } catch {
    return false;
  }
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
      return { ok: false, error: '快捷键不能为空' };
    }
    const registered = registerShortcut(next.hotkey);
    if (!registered) {
      registerShortcut(config.hotkey); // 回退到旧快捷键
      return { ok: false, error: '快捷键注册失败，可能已被占用，请换一个' };
    }
    config = next;
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
    if (!registerShortcut(config.hotkey)) {
      console.warn(`快捷键注册失败：${config.hotkey}`);
    }
  });

  // 常驻托盘：仅在关闭行为配置为「退出程序」时，窗口全部关闭后退出
  app.on('window-all-closed', () => {
    if (config && config.closeToTray === false) {
      app.quit();
    }
  });
}
