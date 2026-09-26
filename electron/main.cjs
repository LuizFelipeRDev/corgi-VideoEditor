const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const windowConfig = require('../src/global_config/window.js');
const { syncFontsDir } = require('./fontSync.cjs');

const isDev = !app.isPackaged;
const devRoot = app.getAppPath();
const bundledPath = isDev ? devRoot : process.resourcesPath;
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.ini');

function copyBundledFiles() {
  if (isDev) return;
  // Nunca pode lancar excecao: quem chama e
  // app.whenReady().then(() => { copyBundledFiles(); createWindow(); }),
  // entao um erro aqui fecharia o app sem abrir janela e sem aviso.
  try {
    const srcBin = path.join(process.resourcesPath, 'bin');
    const dstBin = path.join(userDataPath, 'bin');
    if (!fs.existsSync(dstBin)) {
      fs.mkdirSync(dstBin, { recursive: true });
      fs.cpSync(srcBin, dstBin, { recursive: true });
      console.log('[setup] bundled bin copied to userData');
    }
  } catch (err) {
    console.error('[setup] AVISO: falha ao copiar binarios:', err.message);
  }

  // Fontes espelhadas a cada inicializacao (ver fontSync.cjs): instalacoes
  // antigas recebem as fontes que faltavam, senao o export cai na fonte do
  // sistema (Arial) mesmo com o fontsdir no filtro ass.
  try {
    const res = syncFontsDir(path.join(process.resourcesPath, 'fonts'), path.join(userDataPath, 'fonts'));
    if (res.missingSrc) {
      console.warn(`[setup] AVISO: pasta de fontes da build ausente: ${path.join(process.resourcesPath, 'fonts')}`);
    } else if (res.emptySrc) {
      console.warn(`[setup] AVISO: pasta de fontes da build vazia: ${path.join(process.resourcesPath, 'fonts')}`);
    } else if (res.added || res.removed) {
      console.log(`[setup] fontes sincronizadas: ${res.added} adicionada(s), ${res.removed} removida(s) de ${res.total}`);
    }
  } catch (err) {
    console.error('[setup] AVISO: falha ao sincronizar fontes:', err.message);
  }
}

function getBinPath() {
  if (!isDev) {
    return path.join(userDataPath, 'bin', 'auto-editor.exe');
  }
  return path.join(devRoot, 'bin', 'auto-editor.exe');
}

function getFfmpegPath() {
  if (!isDev) {
    return path.join(userDataPath, 'bin', 'ffmpeg.exe');
  }
  return path.join(devRoot, 'bin', 'ffmpeg.exe');
}

function getWhisperCliPath() {
  if (!isDev) {
    return path.join(userDataPath, 'bin', 'whisper', 'whisper-cli.exe');
  }
  return path.join(devRoot, 'bin', 'whisper', 'whisper-cli.exe');
}

function getWhisperDir() {
  if (!isDev) {
    return path.join(userDataPath, 'bin', 'whisper');
  }
  return path.join(devRoot, 'bin', 'whisper');
}

function getFontsDir() {
  if (!isDev) {
    return path.join(userDataPath, 'fonts');
  }
  return path.join(devRoot, 'src', 'global_config', 'fonts');
}

function readConfig() {
  const defaults = {
    threshold: '-30',
    margin: '0.5',
    output_folder: '',
    output_format: 'mp3',
    output_resolution: 'original',
    subtitles: 'false',
    subtitle_model: 'small',
    subtitle_position: 'bottom',
    subtitle_style: 'hormozi',
    green_screen: 'false',
    burn_subtitles: 'true',
    words_per_line: '4',
    lines_count: '2',
    subtitle_configs: '{}',
    subtitle_position_mode: 'fixed',
    subtitle_position_percent: '80',
    subtitle_persistence: '1',
    smart_subtitle: 'false',
    auto_line_wrap: 'false',
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
    `[settings]\nthreshold = ${config.threshold}\nmargin = ${config.margin}\noutput_folder = ${config.output_folder}\noutput_format = ${config.output_format}\noutput_resolution = ${config.output_resolution || 'original'}\nsubtitles = ${config.subtitles}\nsubtitle_model = ${config.subtitle_model}\nsubtitle_position = ${config.subtitle_position}\nsubtitle_style = ${config.subtitle_style}\ngreen_screen = ${config.green_screen}\nburn_subtitles = ${config.burn_subtitles}\nwords_per_line = ${config.words_per_line}\nlines_count = ${config.lines_count}\nsubtitle_configs = ${config.subtitle_configs || '{}'}\nsubtitle_position_mode = ${config.subtitle_position_mode || 'fixed'}\nsubtitle_position_percent = ${config.subtitle_position_percent || '80'}\nsubtitle_persistence = ${config.subtitle_persistence || '1'}\nsmart_subtitle = ${config.smart_subtitle || 'false'}\nauto_line_wrap = ${config.auto_line_wrap || 'false'}\n`, 'utf-8');
}

let mainWindow;
let whisperCliProc = null;
let whisperCliStopped = false;
let whisperCliHandled = false;

function createWindow() {
  const config = readConfig();
  const initialWidth = config.subtitles === 'true'
    ? windowConfig.WINDOW_SUBTITLES_WIDTH
    : windowConfig.WINDOW_NO_SUBTITLES_WIDTH;

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: windowConfig.WINDOW_DEFAULT_HEIGHT,
    resizable: windowConfig.WINDOW_OPTIONS.resizable,
    frame: windowConfig.WINDOW_OPTIONS.frame,
    transparent: windowConfig.WINDOW_OPTIONS.transparent,
    ...(isDev ? { icon: path.join(devRoot, 'assets', 'novaLogo.ico') } : {}),
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
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  }
}

app.whenReady().then(() => { copyBundledFiles(); createWindow(); });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  if (whisperCliProc) {
    whisperCliProc.kill('SIGTERM');
    whisperCliProc = null;
  }
});

ipcMain.handle('minimize', () => mainWindow?.minimize());
ipcMain.handle('close', () => mainWindow?.close());
ipcMain.handle('get-config', () => readConfig());
ipcMain.handle('save-config', (e, config) => writeConfig(config));
ipcMain.handle('get-fonts-path', () => getFontsDir());
ipcMain.handle('path-exists', (e, targetPath) => {
  try { return fs.existsSync(targetPath); } catch { return false; }
});
ipcMain.handle('get-whisper-dir', () => getWhisperDir());

ipcMain.handle('resize-window', (e, width, height) => {
  if (mainWindow) {
    mainWindow.setMinimumSize(width, height)
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

ipcMain.handle('run-auto-editor-export', async (event, args) => {
  const binPath = getBinPath();
  if (!fs.existsSync(binPath)) return { success: false, error: 'Não encontrado' };

  console.log('[auto-editor-export] bin:', binPath);
  console.log('[auto-editor-export] args:', JSON.stringify(args));

  return new Promise((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    const proc = spawn(binPath, args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      cwd: path.dirname(binPath),
    });

    proc.stdout.on('data', (d) => {
      stdoutData += d.toString('utf-8');
    });

    proc.stderr.on('data', (d) => {
      stderrData += d.toString('utf-8');
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdoutData || stderrData });
      } else {
        resolve({ success: false, error: stderrData.trim() || `Exit code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
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
      const direct = path.join(binDir, arg)
      if (fs.existsSync(direct)) return arg
      const withBin = path.join(binDir, arg + '.bin')
      if (fs.existsSync(withBin)) return arg + '.bin'
      const withGgml = path.join(binDir, 'ggml-' + arg + '.bin')
      if (fs.existsSync(withGgml)) return 'ggml-' + arg + '.bin'
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

ipcMain.handle('stop-whisper-cli', () => {
  if (whisperCliProc) {
    whisperCliStopped = true;
    whisperCliProc.kill('SIGTERM');
    whisperCliProc = null;
    return true;
  }
  return false;
});

function parseJsonAndResolve(jsonFile, code, cudaDetected, resolve) {
  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));

    const words = [];
    for (const segment of jsonData.transcription || []) {
      for (const token of segment.tokens || []) {
        const text = token.text;
        if (text === '[_BEG_]' || text.includes('[_TT_')) continue;

        const from = token.timestamps.from;
        const to = token.timestamps.to;

        if (text.startsWith(' ')) {
          words.push({ text: text.trim(), from, to });
        } else if (words.length > 0) {
          words[words.length - 1].text += text;
          words[words.length - 1].to = to;
        }
      }
    }

    const outputBase = jsonFile.replace(/\.json$/, '');
    const srtLines = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      srtLines.push(String(i + 1));
      srtLines.push(`${w.from} --> ${w.to}`);
      srtLines.push(w.text);
      srtLines.push('');
    }

    const srtFile = outputBase + '.srt';
    fs.writeFileSync(srtFile, srtLines.join('\n'), 'utf-8');
    console.log(`[whisper-cli] word-level SRT written: ${words.length} words → ${srtFile}`);

    mainWindow?.webContents.send('whisper-cli-done', true);
    resolve({ success: true, cuda: cudaDetected, code });
  } catch (err) {
    console.error('[whisper-cli] JSON parse error:', err.message);
    mainWindow?.webContents.send('whisper-cli-error', `Erro ao processar JSON: ${err.message}`);
    mainWindow?.webContents.send('whisper-cli-done', false);
    resolve({ success: false, code, error: err.message, cuda: cudaDetected });
  }
}

ipcMain.handle('run-whisper-cli', async (event, { audioFile, model, output, language, splitWords }) => {
  const whisperCliPath = getWhisperCliPath();
  const whisperDir = getWhisperDir();

  if (!fs.existsSync(whisperCliPath)) {
    return { success: false, error: 'whisper-cli.exe não encontrado em: ' + whisperCliPath };
  }

  let modelFile = path.join(whisperDir, `ggml-${model}.bin`);
  if (!fs.existsSync(modelFile)) {
    const fallbackBinDir = path.dirname(getBinPath());
    modelFile = path.join(fallbackBinDir, `ggml-${model}.bin`);
  }
  if (!fs.existsSync(modelFile)) {
    return { success: false, error: `Modelo não encontrado: ggml-${model}.bin` };
  }

  const ext = path.extname(audioFile).toLowerCase();
  let wavFile = audioFile;
  let tempWav = null;

  if (ext !== '.wav') {
    tempWav = audioFile.replace(/\.[^.]+$/, '_temp_whisper.wav');
    const ffmpegPath = getFfmpegPath();
    if (!fs.existsSync(ffmpegPath)) {
      return { success: false, error: 'ffmpeg.exe não encontrado' };
    }
    console.log('[whisper-cli] converting to WAV:', audioFile, '->', tempWav);
    await new Promise((resolve, reject) => {
      exec(`"${ffmpegPath}" -y -i "${audioFile}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempWav}"`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    wavFile = tempWav;
    console.log('[whisper-cli] WAV conversion done');
  }

  const args = [
    '-m', modelFile,
    '-f', wavFile,
    '-ojf',
    '-of', output,
    '-l', language || 'pt',
    '-pp',
  ];

  if (splitWords) {
    args.push('-sow');
  }

  console.log('[whisper-cli] bin:', whisperCliPath);
  console.log('[whisper-cli] args:', JSON.stringify(args));

  whisperCliStopped = false;

  return new Promise((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let cudaDetected = false;

    const proc = spawn(whisperCliPath, args, {
      cwd: whisperDir,
    });
    whisperCliProc = proc;

    proc.stdout.on('data', (d) => {
      const text = d.toString('utf-8');
      stdoutData += text;
      if (text.includes('CUDA: yes') || text.includes('CUDA devices')) {
        cudaDetected = true;
      }
      mainWindow?.webContents.send('whisper-cli-output', text);
    });

    proc.stderr.on('data', (d) => {
      const text = d.toString('utf-8');
      stderrData += text;
      if (text.includes('CUDA: yes') || text.includes('CUDA devices')) {
        cudaDetected = true;
      }
      mainWindow?.webContents.send('whisper-cli-output', text);
    });

    proc.on('close', (code) => {
      const stopped = whisperCliStopped;
      const isCurrentProcess = whisperCliProc === proc;
      whisperCliProc = null;
      console.log('[whisper-cli] close event - code:', code, 'stopped:', stopped, 'isCurrentProcess:', isCurrentProcess, 'procId:', proc.pid);

      if (stopped || !isCurrentProcess) {
        console.log('[whisper-cli] close: suppressed IPC (stopped or not current)');
        if (tempWav && fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
        resolve({ success: false, code, error: 'Cancelado pelo usuario', cuda: cudaDetected, stopped: true });
        return;
      }

      if (code === 0) {
        const jsonFile = output + '.json';
        console.log('[whisper-cli] looking for JSON:', jsonFile);
        console.log('[whisper-cli] output dir exists:', fs.existsSync(path.dirname(jsonFile)));

        const tryParseJson = (attempt) => {
          if (fs.existsSync(jsonFile)) {
            if (tempWav && fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
            parseJsonAndResolve(jsonFile, code, cudaDetected, resolve);
            return;
          }

          const whisperJson = path.join(whisperDir, path.basename(jsonFile));
          if (!attempt && fs.existsSync(whisperJson)) {
            console.log('[whisper-cli] found in whisper dir, copying...');
            fs.copyFileSync(whisperJson, jsonFile);
            if (tempWav && fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
            parseJsonAndResolve(jsonFile, code, cudaDetected, resolve);
            return;
          }

          if (attempt < 10) {
            setTimeout(() => tryParseJson(attempt + 1), 500);
            return;
          }

          if (tempWav && fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
          const dirContents = fs.readdirSync(path.dirname(jsonFile));
          console.log('[whisper-cli] dir contents:', dirContents);
          const errorMsg = `JSON nao encontrado: ${jsonFile}`;
          console.error('[whisper-cli] JSON parse error:', errorMsg);
          mainWindow?.webContents.send('whisper-cli-error', errorMsg);
          mainWindow?.webContents.send('whisper-cli-done', false);
          resolve({ success: false, code, error: errorMsg, cuda: cudaDetected });
        };

        tryParseJson(0);
      } else {
        if (tempWav && fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
        const errorMsg = stderrData.trim() || `Processo finalizou com código ${code}`;
        console.log('[whisper-cli] error:', errorMsg.slice(0, 500));
        mainWindow?.webContents.send('whisper-cli-error', errorMsg);
        mainWindow?.webContents.send('whisper-cli-done', false);
        resolve({ success: false, code, error: errorMsg, cuda: cudaDetected });
      }
    });

    proc.on('error', (err) => {
      const isCurrentProcess = whisperCliProc === proc;
      console.log('[whisper-cli] error event - isCurrentProcess:', isCurrentProcess, 'stopped:', whisperCliStopped, 'procId:', proc.pid);
      whisperCliProc = null;
      if (whisperCliStopped || !isCurrentProcess) {
        console.log('[whisper-cli] error: suppressed IPC');
        resolve({ success: false, error: 'Cancelado pelo usuario', cuda: false, stopped: true });
        return;
      }
      const errorMsg = `Falha ao executar whisper-cli: ${err.message}`;
      console.log('[whisper-cli] spawn error:', errorMsg);
      mainWindow?.webContents.send('whisper-cli-error', errorMsg);
      mainWindow?.webContents.send('whisper-cli-done', false);
      resolve({ success: false, error: errorMsg, cuda: false });
    });
  });
});

ipcMain.handle('run-ffmpeg-analysis', async (event, args) => {
  const ffmpegPath = getFfmpegPath();
  if (!fs.existsSync(ffmpegPath)) return { success: false, error: 'FFmpeg não encontrado' };

  const shellArgs = args.map(a => {
    if (/[\s'";&|<>]/.test(a) || a.includes('\\:')) {
      return `"${a.replace(/"/g, '\\"')}"`;
    }
    return a;
  });
  const cmd = `"${ffmpegPath}" ${shellArgs.join(' ')}`;
  console.log('[ffmpeg-analysis] cmd:', cmd);

  return new Promise((resolve) => {
    const proc = exec(cmd, { env: { ...process.env }, maxBuffer: 10 * 1024 * 1024 });
    let stderrData = '';

    proc.stderr?.on('data', (d) => {
      stderrData += d.toString('utf-8');
    });

    proc.stdout?.on('data', (d) => {
      stderrData += d.toString('utf-8');
    });

    proc.on('close', (code) => {
      if (code === 0 || stderrData.includes('silence_')) {
        resolve({ success: true, output: stderrData });
      } else {
        resolve({ success: false, error: `FFmpeg analysis failed with code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
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

ipcMain.handle('check-model', async (e, modelName) => {
  const whisperDir = getWhisperDir();
  const modelFile = path.join(whisperDir, `ggml-${modelName}.bin`);
  if (fs.existsSync(modelFile)) return true;
  const binPath = getBinPath();
  const binDir = path.dirname(binPath);
  const oldModelFile = path.join(binDir, `ggml-${modelName}.bin`);
  return fs.existsSync(oldModelFile);
});

ipcMain.handle('download-model', async (e, modelName) => {
  const whisperDir = getWhisperDir();
  const modelFile = path.join(whisperDir, `ggml-${modelName}.bin`);
  const tempFile = modelFile + '.downloading';

  if (fs.existsSync(modelFile)) return { success: true };

  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${modelName}.bin`;

  return new Promise((resolve) => {
    const file = fs.createWriteStream(tempFile);
    let downloadedBytes = 0;

    const request = https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (redirectResponse) => {
          const totalBytes = parseInt(redirectResponse.headers['content-length'], 10) || 0;

          redirectResponse.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
            mainWindow?.webContents.send('model-download-progress', {
              model: modelName,
              progress,
              downloadedBytes,
              totalBytes,
            });
          });

          redirectResponse.pipe(file);

          file.on('finish', () => {
            file.close();
            fs.renameSync(tempFile, modelFile);
            resolve({ success: true });
          });
        }).on('error', (err) => {
          fs.unlinkSync(tempFile);
          resolve({ success: false, error: err.message });
        });
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10) || 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        mainWindow?.webContents.send('model-download-progress', {
          model: modelName,
          progress,
          downloadedBytes,
          totalBytes,
        });
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        fs.renameSync(tempFile, modelFile);
        resolve({ success: true });
      });
    });

    request.on('error', (err) => {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      resolve({ success: false, error: err.message });
    });
  });
});

ipcMain.handle('check-whisper-cli', () => {
  const whisperCliPath = getWhisperCliPath();
  return fs.existsSync(whisperCliPath);
});

ipcMain.handle('download-cuda', async () => {
  const whisperDir = getWhisperDir();
  const AdmZip = require('adm-zip');
  const os = require('os');
  const tempDir = os.tmpdir();
  const zipPath = path.join(tempDir, 'whisper-cuda.zip');

  const url = isDev
    ? 'http://localhost:18923/whisper-cuda.zip'
    : 'https://github.com/LuizFelipeRDev/corgi-editor/releases/download/v1.0.0/whisper-cuda.zip';

  console.log('[CUDA] download-cuda handler called, url:', url);
  console.log('[CUDA] whisperDir:', whisperDir);

  if (!fs.existsSync(whisperDir)) {
    fs.mkdirSync(whisperDir, { recursive: true });
  }

  return new Promise((resolve) => {
    const file = fs.createWriteStream(zipPath);
    let downloadedBytes = 0;

    const client = url.startsWith('https') ? https : require('http');
    const request = client.get(url, (response) => {
      console.log('[CUDA] response status:', response.statusCode);
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectClient = response.headers.location.startsWith('https') ? https : require('http');
        redirectClient.get(response.headers.location, (redirectResponse) => {
          const totalBytes = parseInt(redirectResponse.headers['content-length'], 10) || 0;

          redirectResponse.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
            mainWindow?.webContents.send('cuda-download-progress', { progress });
          });

          redirectResponse.pipe(file);

          file.on('finish', () => {
            file.close();
            try {
              const zip = new AdmZip(zipPath);
              zip.extractAllTo(whisperDir, true);
              fs.unlinkSync(zipPath);
              resolve({ success: true });
            } catch (err) {
              resolve({ success: false, error: err.message });
            }
          });
        }).on('error', (err) => {
          if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
          resolve({ success: false, error: err.message });
        });
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
      console.log('[CUDA] totalBytes:', totalBytes);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        if (progress % 10 === 0 || progress === 100) {
          console.log('[CUDA] progress:', progress);
        }
        mainWindow?.webContents.send('cuda-download-progress', { progress });
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('[CUDA] download finished, extracting...');
        try {
          const zip = new AdmZip(zipPath);
          zip.extractAllTo(whisperDir, true);
          console.log('[CUDA] extraction done, cleaning up zip');
          fs.unlinkSync(zipPath);
          console.log('[CUDA] resolve success');
          resolve({ success: true });
        } catch (err) {
          console.error('[CUDA] extraction error:', err.message);
          resolve({ success: false, error: err.message });
        }
      });
    });

    request.on('error', (err) => {
      console.error('[CUDA] request error:', err.message);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      resolve({ success: false, error: err.message });
    });
  });
});
