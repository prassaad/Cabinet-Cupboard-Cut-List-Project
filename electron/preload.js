'use strict';
// Minimal, safe bridge for the BYOK settings window only. The main app window uses no preload.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('settingsAPI', {
  getKeyStatus: () => ipcRenderer.invoke('get-key-status'),
  saveKey: (key) => ipcRenderer.invoke('save-key', key),
});
