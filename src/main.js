'use strict';

const path = require('node:path');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
  clipboard,
  screen,
  nativeImage,
} = require('electron');

const { loadConfig, saveConfig, resolveApiKey } = require('./config');
const { translateText } = require('./translate');
const { captureSelection } = require('./selection');

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
  popupWindow.on('blur', () => {
    if (popupWindow && popupWindow.isVisible()) {
      popupWindow.hide();
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

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 440,
    height: 400,
    title: '小白翻译 - 设置',
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
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

    const apiKey = resolveApiKey(config);
    if (!apiKey) {
      createSettingsWindow();
      return;
    }

    const text = await captureSelection();
    if (!text.trim()) {
      showPopup({ original: '', translation: '未检测到选中的文本' });
      return;
    }

    showPopup({ original: text, translation: '翻译中…' });
    const translation = await translateText(text, apiKey);
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

  ipcMain.on('copy-translation', (_event, text) => {
    clipboard.writeText(String(text ?? ''));
  });

  ipcMain.handle('get-settings', () => ({
    apiKey: config.apiKey || '',
    hotkey: config.hotkey || '',
  }));

  ipcMain.handle('save-settings', (_event, cfg) => {
    const next = {
      apiKey: typeof cfg.apiKey === 'string' ? cfg.apiKey.trim() : config.apiKey,
      hotkey: typeof cfg.hotkey === 'string' ? cfg.hotkey.trim() : config.hotkey,
    };
    if (!next.hotkey) {
      return { ok: false, error: '快捷键不能为空' };
    }
    const registered = registerShortcut(next.hotkey);
    if (!registered) {
      registerShortcut(config.hotkey); // 回退到旧快捷键
      return { ok: false, error: '快捷键注册失败，可能已被占用，请换一个' };
    }
    config = { ...config, ...next };
    saveConfig(getConfigDir(), config);
    return { ok: true };
  });

  ipcMain.on('close-settings', () => {
    if (settingsWindow) settingsWindow.close();
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

  // 常驻托盘：窗口全部关闭时不退出
  app.on('window-all-closed', () => {
    /* no-op */
  });
}
