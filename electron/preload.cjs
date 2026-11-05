const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  openFile: (options) => ipcRenderer.invoke('open-file', options),
  toggleFullScreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),
});
