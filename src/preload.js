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
});
