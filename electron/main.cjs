const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Garante aceleração de hardware e WebGL no Windows
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#121212',
    title: 'Lote360 Studio — Mapeamento Interativo de Loteamentos em 360°',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abre links externos no navegador padrão do Windows (em vez de dentro do app)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// IPC Handlers para recursos nativos do Windows
ipcMain.handle('save-file', async (event, { defaultName, filters, content }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'projeto.mozari.json',
    filters: filters || [{ name: 'Todos os arquivos', extensions: ['*'] }],
  });

  if (canceled || !filePath) return { canceled: true };

  try {
    const buffer = Buffer.isBuffer(content)
      ? content
      : typeof content === 'string'
      ? Buffer.from(content, 'utf-8')
      : Buffer.from(new Uint8Array(content));
    await fs.promises.writeFile(filePath, buffer);
    return { canceled: false, filePath };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});

ipcMain.handle('open-file', async (event, { filters } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: filters || [{ name: 'Todos os arquivos', extensions: ['*'] }],
  });

  if (canceled || !filePaths || filePaths.length === 0) return { canceled: true };

  try {
    const filePath = filePaths[0];
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { canceled: false, filePath, content, name: path.basename(filePath) };
  } catch (err) {
    return { canceled: true, error: err.message };
  }
});

ipcMain.handle('toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  const isFull = !win.isFullScreen();
  win.setFullScreen(isFull);
  return isFull;
});

ipcMain.handle('is-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isFullScreen() : false;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
