/**
 * Preload Script (Electron): expõe `window.desktopAPI` com segurança via contextBridge
 * para o React usar diálogos nativos do Windows ao salvar/abrir arquivos.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,
  saveFile: (options) => ipcRenderer.invoke('desktop:save-file', options),
  openFile: (options) => ipcRenderer.invoke('desktop:open-file', options),
});
