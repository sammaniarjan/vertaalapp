const { contextBridge } = require('electron');

// Expose minimal API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
