const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const isDev = !app.isPackaged;
const ROOT = isDev ? __dirname : path.dirname(app.getPath('exe'));
const resourcesPath = isDev ? __dirname : process.resourcesPath;
const configPath = path.join(resourcesPath, 'config.ini');

function getBinPath() {
  const devPath = path.join(__dirname, '..', 'bin', 'auto-editor.exe');
  if (fs.existsSync(devPath)) return devPath;
  return path.join(resourcesPath, 'bin', 'auto-editor.exe');
}

function readConfig() {
  const defaults = { threshold: '-35', margin: '0.1', output_folder: '' };
  if (!fs.existsSync(configPath)) return defaults;
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = { ...defaults };
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('[')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key) config[key.trim()] = rest.join('=').trim();
    }
    return config;
  } catch { return defaults; }
}

function writeConfig(config) {
  fs.writeFileSync(configPath,
    `[settings]\nthreshold = ${config.threshold}\nmargin = ${config.margin}\noutput_folder = ${config.output_folder}\n`, 'utf-8');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 640, height: 420, resizable: false, frame: false, transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'public', 'index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.handle('minimize', () => mainWindow?.minimize());
ipcMain.handle('close', () => mainWindow?.close());
ipcMain.handle('get-config', () => readConfig());
ipcMain.handle('save-config', (e, config) => writeConfig(config));

ipcMain.handle('select-file', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar arquivo',
    filters: [{ name: 'Mídia', extensions: ['mp4','mp3','wav','mkv','avi','mov','webm','flac','ogg'] }],
    properties: ['openFile'],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('select-output-dir', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Pasta', properties: ['openDirectory'],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('join-path', (e, dir, filename) => {
  return path.join(dir, filename);
});

ipcMain.handle('run-auto-editor', async (event, args) => {
  const binPath = getBinPath();
  if (!fs.existsSync(binPath)) return { success: false, error: 'Não encontrado' };

  return new Promise((resolve) => {
    const proc = spawn(binPath, args);

    proc.stdout.on('data', (d) => {
      mainWindow?.webContents.send('auto-editor-output', d.toString());
    });

    proc.stderr.on('data', (d) => {
      mainWindow?.webContents.send('auto-editor-output', d.toString());
    });

    proc.on('close', (code) => {
      mainWindow?.webContents.send('auto-editor-done', code === 0);
      resolve({ success: code === 0, code });
    });

    proc.on('error', () => {
      mainWindow?.webContents.send('auto-editor-done', false);
      resolve({ success: false });
    });
  });
});
