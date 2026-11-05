/**
 * Processo Principal do Electron (Windows Desktop App — Lote360 Studio).
 * - Janela nativa escura (#121212) com controles nativos e WebGL acelerado por GPU
 * - IPC handlers para diálogos nativos do Windows (`dialog.showSaveDialog` e `dialog.showOpenDialog`)
 *   permitindo salvar `tour-offline.html` e `.mozari.json` diretamente no disco sem limites do navegador
 */
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged && process.env.ELECTRON_DEV === '1';

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#121212',
    title: 'Lote360 Studio — Mapeamento 360° de Loteamentos',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Abre links externos (ex: WhatsApp) no navegador padrão do Windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

/* ------------------------------------------- IPC: Salvar Arquivo Nativo no Windows */
ipcMain.handle('desktop:save-file', async (_event, { defaultName, filters, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Arquivo — Lote360 Studio',
    defaultPath: defaultName,
    filters: filters || [{ name: 'Todos os arquivos', extensions: ['*'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  await fs.writeFile(filePath, content, 'utf-8');
  return { canceled: false, filePath };
});

/* ------------------------------------------- IPC: Abrir Projeto (.mozari.json) */
ipcMain.handle('desktop:open-file', async (_event, { filters }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir Projeto — Lote360 Studio',
    properties: ['openFile'],
    filters: filters || [{ name: 'Projeto Lote360 (.mozari.json)', extensions: ['json'] }],
  });
  if (canceled || !filePaths?.[0]) return { canceled: true };
  const text = await fs.readFile(filePaths[0], 'utf-8');
  return { canceled: false, filePath: filePaths[0], name: path.basename(filePaths[0]), text };
});

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
