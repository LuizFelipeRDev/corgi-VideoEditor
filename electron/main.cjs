const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
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

function getFfmpegPath() {
  if (!isDev) {
    return path.join(process.resourcesPath, 'bin', 'ffmpeg.exe');
  }
  return path.join(__dirname, '..', 'bin', 'ffmpeg.exe');
}

function readConfig() {
  const defaults = {
    threshold: '-30',
    margin: '0.5',
    output_folder: '',
    output_format: 'mp3',
    subtitles: 'false',
    subtitle_model: 'tiny',
    subtitle_position: 'bottom',
    subtitle_style: 'hormozi',
    green_screen: 'false',
    burn_subtitles: 'true',
  };
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
    `[settings]\nthreshold = ${config.threshold}\nmargin = ${config.margin}\noutput_folder = ${config.output_folder}\noutput_format = ${config.output_format}\nsubtitles = ${config.subtitles}\nsubtitle_model = ${config.subtitle_model}\nsubtitle_position = ${config.subtitle_position}\nsubtitle_style = ${config.subtitle_style}\ngreen_screen = ${config.green_screen}\nburn_subtitles = ${config.burn_subtitles}\n`, 'utf-8');
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

ipcMain.handle('resize-window', (e, width, height) => {
  if (mainWindow) {
    mainWindow.setSize(width, height)
  }
});

ipcMain.handle('read-file', async (e, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (err) {
    return null
  }
});

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

  console.log('[auto-editor] bin:', binPath);
  console.log('[auto-editor] args:', JSON.stringify(args));

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
      console.log('[auto-editor] exit code:', code);
      console.log('[auto-editor] stderr:', stderrData.trim().slice(0, 500));
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

ipcMain.handle('run-whisper', async (event, args) => {
  const binPath = getBinPath();
  const binDir = path.dirname(binPath);
  if (!fs.existsSync(binPath)) return { success: false, error: 'Não encontrado' };

  const resolvedArgs = args.map((arg, i) => {
    if (i === 2) {
      const modelPath = path.join(binDir, arg)
      if (fs.existsSync(modelPath)) return modelPath
      const modelPathBin = path.join(binDir, arg + '.bin')
      if (fs.existsSync(modelPathBin)) return modelPathBin
    }
    return arg
  });

  return new Promise((resolve) => {
    let stderrData = '';
    const proc = spawn(binPath, resolvedArgs, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      cwd: binDir,
    });

    proc.stdout.on('data', (d) => {
      mainWindow?.webContents.send('whisper-output', d.toString('utf-8'));
    });

    proc.stderr.on('data', (d) => {
      const text = d.toString('utf-8');
      stderrData += text;
      mainWindow?.webContents.send('whisper-output', text);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        mainWindow?.webContents.send('whisper-done', true);
        resolve({ success: true, code });
      } else {
        const errorMsg = stderrData.trim() || `Processo finalizou com código ${code}`;
        mainWindow?.webContents.send('whisper-error', errorMsg);
        mainWindow?.webContents.send('whisper-done', false);
        resolve({ success: false, code, error: errorMsg });
      }
    });

    proc.on('error', (err) => {
      const errorMsg = `Falha ao executar: ${err.message}`;
      mainWindow?.webContents.send('whisper-error', errorMsg);
      mainWindow?.webContents.send('whisper-done', false);
      resolve({ success: false, error: errorMsg });
    });
  });
});

ipcMain.handle('run-ffmpeg', async (event, args, cwd) => {
  const ffmpegPath = getFfmpegPath();
  if (!fs.existsSync(ffmpegPath)) return { success: false, error: 'FFmpeg não encontrado' };

  // Build a shell-safe command string for exec (handles Windows path escaping in filter expressions)
  const shellArgs = args.map(a => {
    // Wrap args that contain special chars in double quotes
    if (/[\s'";&|<>]/.test(a) || a.includes('\\:')) {
      // Escape existing double quotes inside the arg
      return `"${a.replace(/"/g, '\\"')}"`;
    }
    return a;
  });
  const cmd = `"${ffmpegPath}" ${shellArgs.join(' ')}`;
  console.log('[ffmpeg] exec cmd:', cmd);

  return new Promise((resolve) => {
    const execOpts = { env: { ...process.env }, maxBuffer: 10 * 1024 * 1024 };
    if (cwd) {
      execOpts.cwd = cwd;
      console.log('[ffmpeg] cwd:', cwd);
    }

    const proc = exec(cmd, execOpts);

    proc.stdout?.on('data', (d) => {
      mainWindow?.webContents.send('ffmpeg-output', d.toString('utf-8'));
    });

    proc.stderr?.on('data', (d) => {
      const text = d.toString('utf-8');
      mainWindow?.webContents.send('ffmpeg-output', text);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        mainWindow?.webContents.send('ffmpeg-done', true);
        resolve({ success: true, code });
      } else {
        const errorMsg = `FFmpeg finalizou com código ${code}`;
        mainWindow?.webContents.send('ffmpeg-error', errorMsg);
        mainWindow?.webContents.send('ffmpeg-done', false);
        resolve({ success: false, code, error: errorMsg });
      }
    });

    proc.on('error', (err) => {
      const errorMsg = `Falha ao executar FFmpeg: ${err.message}`;
      mainWindow?.webContents.send('ffmpeg-error', errorMsg);
      mainWindow?.webContents.send('ffmpeg-done', false);
      resolve({ success: false, error: errorMsg });
    });
  });
});

ipcMain.handle('write-file', async (e, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
});

ipcMain.handle('delete-file', async (e, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
});

ipcMain.handle('rename-file', async (e, oldPath, newPath) => {
  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
});

ipcMain.handle('get-temp-dir', async () => {
  return app.getPath('temp');
});
