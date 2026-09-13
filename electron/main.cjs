const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const isDev = !app.isPackaged;
const resourcesPath = isDev ? path.join(__dirname, '..') : process.resourcesPath;
const configPath = path.join(resourcesPath, 'config.ini');

function getBinPath() {
  if (!isDev) {
    return path.join(process.resourcesPath, 'bin', 'auto-editor.exe');
  }
  return path.join(__dirname, '..', 'bin', 'auto-editor.exe');
}

function readConfig() {
  const defaults = { threshold: '-30', margin: '0.5', output_folder: '', output_format: 'mp3' };
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
    `[settings]\nthreshold = ${config.threshold}\nmargin = ${config.margin}\noutput_folder = ${config.output_folder}\noutput_format = ${config.output_format}\n`, 'utf-8');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 640, height: 420, resizable: false, frame: false, transparent: false,
    icon: path.join(__dirname, '..', 'assets', 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
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

ipcMain.handle('open-folder', async (e, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) {
    await shell.openPath(folderPath);
  }
});

ipcMain.handle('run-auto-editor', async (event, args) => {
  const binPath = getBinPath();
  if (!fs.existsSync(binPath)) return { success: false, error: 'Não encontrado' };

  return new Promise((resolve) => {
    let stderrData = '';
    const proc = spawn(binPath, args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      cwd: path.dirname(binPath),
    });

    proc.stdout.on('data', (d) => {
      mainWindow?.webContents.send('auto-editor-output', d.toString('utf-8'));
    });

    proc.stderr.on('data', (d) => {
      const text = d.toString('utf-8');
      stderrData += text;
      mainWindow?.webContents.send('auto-editor-output', text);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        mainWindow?.webContents.send('auto-editor-done', true);
        resolve({ success: true, code });
      } else {
        const errorMsg = stderrData.trim() || `Processo finalizou com código ${code}`;
        mainWindow?.webContents.send('auto-editor-error', errorMsg);
        mainWindow?.webContents.send('auto-editor-done', false);
        resolve({ success: false, code, error: errorMsg });
      }
    });

    proc.on('error', (err) => {
      const errorMsg = `Falha ao executar: ${err.message}`;
      mainWindow?.webContents.send('auto-editor-error', errorMsg);
      mainWindow?.webContents.send('auto-editor-done', false);
      resolve({ success: false, error: errorMsg });
    });
  });
});
