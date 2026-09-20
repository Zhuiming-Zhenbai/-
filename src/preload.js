'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // —— 翻译结果弹窗 ——
  onShowTranslation(cb) {
    ipcRenderer.on('show-translation', (_event, data) => cb(data));
  },
  hideWindow() {
    ipcRenderer.send('hide-window');
  },
  copyTranslation(text) {
    ipcRenderer.send('copy-translation', text);
  },
  resizeToContent(size) {
    ipcRenderer.send('resize-to-content', size);
  },
  resizeWindow(size) {
    ipcRenderer.send('resize-window', size);
  },

  // —— 设置窗口 ——
  getSettings() {
    return ipcRenderer.invoke('get-settings');
  },
  saveSettings(cfg) {
    return ipcRenderer.invoke('save-settings', cfg);
  },
  closeSettings() {
    ipcRenderer.send('close-settings');
  },
  confirmHotkey(accelerator) {
    return ipcRenderer.invoke('confirm-hotkey', accelerator);
  },
  confirmReset(defaultHotkey) {
    return ipcRenderer.invoke('confirm-reset', defaultHotkey);
  },
});
