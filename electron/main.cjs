const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const windowConfig = require('../src/global_config/window.js');
// First-install defaults centralized (see src/global_config/configDefaults.js)
const { CONFIG_DEFAULTS } = require('../src/global_config/configDefaults.js');
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
    // Copia apenas o que FALTA (nunca sobrescreve): instalacoes antigas
    // ganham os arquivos novos (whisper CPU embutido) e o set CUDA/modelos
    // baixados pelo usuario em %APPDATA% permanecem intactos.
    const copyMissing = (src, dst) => {
      let added = 0;
      fs.mkdirSync(dst, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dst, entry.name);
        if (entry.isDirectory()) added += copyMissing(s, d);
        else if (!fs.existsSync(d)) {
          fs.copyFileSync(s, d);
          added++;
        }
      }
      return added;
    };
    const added = copyMissing(srcBin, dstBin);
    if (added) console.log(`[setup] bundled bin: ${added} arquivo(s) ausente(s) copiado(s) para userData`);
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

// Modelo neural do arnndn (RNNoise) — baixado sob demanda pelo app, NUNCA
// empacotado (AGENTS.md: só o ggml-tiny vem no build). ~300 KB de texto.
// somnolent-hogwash = treino Speech x Recording (ruído de gravação) do
// repositório GregorR/rnnoise-models — declarado "sem copyright" pelo autor.
// Primário = raw.githubusercontent; espelho = jsDelivr (mesmo arquivo de outro
// CDN) — cobre falha de DNS pontual do GitHub (ENOTFOUND já observado na rede).
const RNNOISE_MODEL_URLS = [
  'https://raw.githubusercontent.com/GregorR/rnnoise-models/master/somnolent-hogwash-2018-09-01/sh.rnnn',
  'https://cdn.jsdelivr.net/gh/GregorR/rnnoise-models@master/somnolent-hogwash-2018-09-01/sh.rnnn',
];
const RNNOISE_MODEL_URL = RNNOISE_MODEL_URLS[0];
const RNNOISE_MODEL_FILE = 'sh.rnnn';

// Falha de rede → código curto que o renderer traduz via i18n.
function rnnoiseNetCode(err) {
  const code = (err && (err.code || (err.cause && err.cause.code))) || '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns';
  if (String(code).includes('TIMEOUT') || code === 'ETIMEDOUT') return 'timeout';
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) return 'conn';
  if (code === 'http') return 'http';
  return 'unknown';
}

// 2 tentativas por URL com pausa (DNS/conexão costuma falhar de forma
// passageira), depois tenta o espelho. HTTP 4xx não repete na mesma URL.
async function fetchRnnoiseModel() {
  let lastErr = null;
  for (const url of RNNOISE_MODEL_URLS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (res.ok) return res;
        const e = new Error(`HTTP ${res.status}`);
        e.code = 'http';
        throw e;
      } catch (e) {
        lastErr = e;
        if (e && e.code === 'http') break;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastErr;
}

function getRnnoiseDir() {
  if (!isDev) {
    return path.join(userDataPath, 'bin', 'rnnoise');
  }
  return path.join(devRoot, 'bin', 'rnnoise');
}

function getFontsDir() {
  if (!isDev) {
    return path.join(userDataPath, 'fonts');
  }
  return path.join(devRoot, 'src', 'global_config', 'fonts');
}

function readConfig() {
  // First-install defaults: single source in src/global_config/configDefaults.js
  // (this object used to live inline here). The file, when present,
  // overrides these values key by key.
  const defaults = { ...CONFIG_DEFAULTS };
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

// Grava o config de forma GENÉRICA: o leitor (readConfig) aceita qualquer
// chave `key = value`, então o escritor também precisa. O template fixo antigo
// ENGOLIA tudo que não estava na lista — sound_config, sound_presets,
// advanced_tools e recent_projects nunca chegavam ao disco. O merge do
// save-config ({...readConfig(), ...novo}) já preserva o que está no arquivo;
// só falta serializar. Header [settings] mantido (readConfig pula linhas '[').
function writeConfig(config) {
  const lines = Object.entries(config)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k} = ${typeof v === 'object' ? JSON.stringify(v) : String(v).replace(/\r?\n/g, ' ')}`);
  fs.writeFileSync(configPath, `[settings]\n${lines.join('\n')}\n`, 'utf-8');
}

let mainWindow;
let whisperCliProc = null;
let whisperCliStopped = false;
let whisperCliHandled = false;

// Tamanho do estado atual (painel de legendas ligado/desligado). É o
// TAMANHO MINIMO da janela: ela pode crescer (arrastar a borda / tela
// cheia), mas nunca encolher abaixo do tamanho de hoje.
let windowStateSize = { width: 0, height: 0 };

function toggleFullScreen() {
  if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
}

function createWindow() {
  const config = readConfig();
  const initialWidth = config.subtitles === 'true'
    ? windowConfig.WINDOW_SUBTITLES_WIDTH
    : windowConfig.WINDOW_NO_SUBTITLES_WIDTH;
  windowStateSize = { width: initialWidth, height: windowConfig.WINDOW_DEFAULT_HEIGHT };

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: windowConfig.WINDOW_DEFAULT_HEIGHT,
    // Mínimo = tamanho atual do estado (não pode ficar menor do que é hoje).
    minWidth: initialWidth,
    minHeight: windowConfig.WINDOW_DEFAULT_HEIGHT,
    resizable: windowConfig.WINDOW_OPTIONS.resizable,
    frame: windowConfig.WINDOW_OPTIONS.frame,
    transparent: windowConfig.WINDOW_OPTIONS.transparent,
    // Cor de pre-paint do tema + tema inicial sincrono no renderer
    // (aplicado antes do primeiro paint, sem flash).
    backgroundColor: config.theme === 'modern' ? '#17171c' : '#f5f0d0',
    ...(isDev ? { icon: path.join(devRoot, 'assets', 'novaLogo.ico') } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      additionalArguments: [`--corgi-theme=${config.theme === 'modern' ? 'modern' : 'retro'}`],
    },
  });

  // Sincroniza o estado do fullscreen com o renderer (botao da TitleBar).
  const sendFullScreenState = () => {
    if (mainWindow) mainWindow.webContents.send('fullscreen-changed', mainWindow.isFullScreen());
  };
  mainWindow.on('enter-full-screen', sendFullScreenState);
  mainWindow.on('leave-full-screen', () => {
    sendFullScreenState();
    // Ao sair da tela cheia o Electron restaura o tamanho de antes; se por
    // alguma motivo ficou ABAIXO do minimo do estado (troca de painel feita
    // dentro do fullscreen), garante o minimo de volta.
    if (mainWindow) {
      const [w, h] = mainWindow.getSize();
      if (w < windowStateSize.width || h < windowStateSize.height) {
        mainWindow.setSize(
          Math.max(w, windowStateSize.width),
          Math.max(h, windowStateSize.height)
        );
      }
    }
  });

  // F11 entra/sai da tela cheia — mesmo caminho do botao da TitleBar.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault();
      toggleFullScreen();
    }
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
// Merge com o config do disco antes de gravar: chaves ausentes no payload
// (ex.: theme, language) nao sao apagadas.
ipcMain.handle('save-config', (e, config) => writeConfig({ ...readConfig(), ...config }));
ipcMain.handle('get-fonts-path', () => getFontsDir());
ipcMain.handle('path-exists', (e, targetPath) => {
  try { return fs.existsSync(targetPath); } catch { return false; }
});
ipcMain.handle('get-file-size', (e, targetPath) => {
  try { return fs.statSync(targetPath).size; } catch { return null; }
});
ipcMain.handle('get-whisper-dir', () => getWhisperDir());

// Entra/sai da tela cheia (botao da TitleBar + atalho F11).
ipcMain.handle('toggle-fullscreen', () => {
  toggleFullScreen();
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle('resize-window', (e, width, height) => {
  if (mainWindow) {
    // O minimo SEMPRE acompanha o estado (640/900 x 566) — a janela não
    // pode ficar menor do que é hoje, mesmo que o usuário estique.
    windowStateSize = { width, height };
    mainWindow.setMinimumSize(width, height)
    // Dentro do fullscreen não mexe no tamanho; o minimo vale e o tamanho
    // do estado é resolvido ao sair (listener de leave-full-screen).
    if (!mainWindow.isFullScreen()) mainWindow.setSize(width, height)
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

// v1.8.0 — projeto: diálogo "Salvar como" (padrão: pasta da mídia +
// nome do arquivo de mídia como nome do projeto).
ipcMain.handle('select-project-save-path', async (e, opts) => {
  const defaultDir = opts?.defaultDir && fs.existsSync(opts.defaultDir) ? opts.defaultDir : undefined;
  const defaultName = String(opts?.defaultName || 'projeto').replace(/[\\/:*?"<>|]/g, '_');
  const r = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar projeto',
    defaultPath: defaultDir ? path.join(defaultDir, `${defaultName}.corgi.json`) : `${defaultName}.corgi.json`,
    filters: [{ name: 'Projeto CORGI', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return null;
  let filePath = r.filePath;
  if (!filePath.toLowerCase().endsWith('.json')) filePath += '.json';
  return filePath;
});

// v1.8.0 — projeto: diálogo "Abrir" + leitura/parse do JSON e checagem da mídia
// (se o arquivo foi movido/renomeado, o renderer avisa e reabre sem a mídia).
ipcMain.handle('open-project', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir projeto',
    filters: [{ name: 'Projeto CORGI (*.corgi.json)', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return { canceled: true };
  const filePath = r.filePaths[0];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!data || typeof data !== 'object') throw new Error('invalid project file');
    const mediaPath = typeof data.mediaPath === 'string' ? data.mediaPath : '';
    return { ok: true, path: filePath, data, mediaExists: mediaPath ? fs.existsSync(mediaPath) : false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
    // Idioma detectado pelo whisper (result.language do JSON -ojf)
    const detectedLanguage = jsonData.result?.language || null;
    resolve({ success: true, cuda: cudaDetected, code, detectedLanguage });
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

  // Idioma de saida da legenda (Settings > Saida): 'auto' (padrao) detecta o
  // idioma falado; 'en' traduz qualquer audio para ingles (-tr so traduz PARA
  // ingles); demais codigos forcam o idioma falado.
  const whisperLang = language || readConfig().subtitle_language || 'auto';
  const langArgs = whisperLang === 'en' ? ['-l', 'auto', '-tr'] : ['-l', whisperLang];

  const args = [
    '-m', modelFile,
    '-f', wavFile,
    '-ojf',
    '-of', output,
    ...langArgs,
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
    const proc = exec(cmd, { env: { ...process.env }, maxBuffer: 64 * 1024 * 1024 });
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

    // Guarda o rabo do stderr: sem ele o usuário só via "código X" e o
    // console não mostrava POR QUE o ffmpeg morreu (era o famoso caso do
    // afftdn nf fora de faixa, invisível aqui).
    let stderrTail = '';

    proc.stdout?.on('data', (d) => {
      mainWindow?.webContents.send('ffmpeg-output', d.toString('utf-8'));
    });

    proc.stderr?.on('data', (d) => {
      const text = d.toString('utf-8');
      stderrTail = (stderrTail + text).slice(-1500);
      mainWindow?.webContents.send('ffmpeg-output', text);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        mainWindow?.webContents.send('ffmpeg-done', true);
        resolve({ success: true, code });
      } else {
        const tail = stderrTail.trim();
        const errorMsg = `FFmpeg finalizou com código ${code}` +
          (tail ? ` — ${tail.split('\n').slice(-4).join(' | ')}` : '');
        console.error('[ffmpeg] exit', code, '\n' + tail);
        mainWindow?.webContents.send('ffmpeg-error', errorMsg);
        mainWindow?.webContents.send('ffmpeg-done', false);
        resolve({ success: false, code, error: errorMsg });
      }
    });

    proc.on('error', (err) => {
      const errorMsg = `Falha ao executar FFmpeg: ${err.message}`;
      console.error('[ffmpeg] spawn error:', err.message);
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

// "GPU installed" requires EVERY CUDA dll to be present. whisper-cli.exe alone does
// not count: the bundled CPU build already ships it, so the old check reported
// "GPU installed" even with none of the GPU dlls downloaded.
const CUDA_REQUIRED_DLLS = ['ggml-cuda.dll', 'cublas64_12.dll', 'cublasLt64_12.dll', 'cudart64_12.dll'];

ipcMain.handle('check-cuda-installed', () => {
  const dir = getWhisperDir();
  return CUDA_REQUIRED_DLLS.every((dll) => fs.existsSync(path.join(dir, dll)));
});

ipcMain.handle('download-cuda', async () => {
  const whisperDir = getWhisperDir();
  const AdmZip = require('adm-zip');
  const os = require('os');
  const zipPath = path.join(os.tmpdir(), 'whisper-cuda.zip');
  // Fixed URL from AGENTS.md (the old "corgi-editor" repo name 301-redirects to
  // "corgi-VideoEditor" and GitHub then 302-redirects to the asset host).
  // fetch follows the whole chain; the old https.get code followed ONE redirect
  // and piped the second (empty) redirect body, so extraction always failed.
  // Dev and prod share this URL: the old http://localhost:18923 dev branch pointed
  // to a server that does not exist anywhere in the app (always ECONNREFUSED).
  const url = 'https://github.com/LuizFelipeRDev/corgi-editor/releases/download/v1.0.0/whisper-cuda.zip';

  console.log('[CUDA] download-cuda handler called, url:', url);
  console.log('[CUDA] whisperDir:', whisperDir);

  if (!fs.existsSync(whisperDir)) {
    fs.mkdirSync(whisperDir, { recursive: true });
  }

  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`);
    }
    const totalBytes = parseInt(response.headers.get('content-length') || '', 10) || 0;
    console.log('[CUDA] response status:', response.status, '| totalBytes:', totalBytes);

    const nodeStream = require('stream').Readable.fromWeb(response.body);
    let downloadedBytes = 0;
    let lastProgress = -1;
    nodeStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
      if (progress !== lastProgress) {
        lastProgress = progress;
        if (progress % 10 === 0 || progress === 100) console.log('[CUDA] progress:', progress);
        mainWindow?.webContents.send('cuda-download-progress', { progress });
      }
    });

    await require('stream/promises').pipeline(nodeStream, fs.createWriteStream(zipPath));
    console.log('[CUDA] download finished, extracting...');

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(whisperDir, true);
    fs.unlinkSync(zipPath);
    console.log('[CUDA] resolve success');
    return { success: true };
  } catch (err) {
    console.error('[CUDA] download error:', err);
    if (fs.existsSync(zipPath)) {
      try { fs.unlinkSync(zipPath); } catch { /* ignore cleanup error */ }
    }
    return { success: false, error: (err && err.message) || String(err) };
  }
});

// Status do modelo neural: instalado + path absoluto pro -af (o escaping do
// path acontece no renderer, em escFilterPath, antes de montar a cadeia).
ipcMain.handle('get-rnnoise-status', () => {
  const modelPath = path.join(getRnnoiseDir(), RNNOISE_MODEL_FILE);
  return { installed: fs.existsSync(modelPath), path: modelPath, url: RNNOISE_MODEL_URL };
});

// Download do modelo (.rnnn, ~300 KB) — mesmo fluxo do download-cuda: fetch
// segue os redirects sozinho, progresso por evento, arquivo .downloading
// renomeado só no fim (nunca deixa modelo pela metade no lugar).
ipcMain.handle('download-rnnoise-model', async () => {
  const dir = getRnnoiseDir();
  const modelPath = path.join(dir, RNNOISE_MODEL_FILE);
  const tempPath = modelPath + '.downloading';
  if (fs.existsSync(modelPath)) return { success: true };
  try {
    fs.mkdirSync(dir, { recursive: true });
    const response = await fetchRnnoiseModel();
    if (!response.body) throw new Error('sem corpo na resposta');
    const totalBytes = parseInt(response.headers.get('content-length') || '', 10) || 0;
    const nodeStream = require('stream').Readable.fromWeb(response.body);
    let downloadedBytes = 0;
    let lastProgress = -1;
    nodeStream.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
      if (progress !== lastProgress) {
        lastProgress = progress;
        mainWindow?.webContents.send('rnnoise-download-progress', { progress });
      }
    });
    await require('stream/promises').pipeline(nodeStream, fs.createWriteStream(tempPath));
    fs.renameSync(tempPath, modelPath);
    mainWindow?.webContents.send('rnnoise-download-progress', { progress: 100 });
    console.log('[rnnoise] model downloaded:', modelPath);
    return { success: true };
  } catch (err) {
    console.error('[rnnoise] download error:', err);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* limpeza */ }
    return {
      success: false,
      code: rnnoiseNetCode(err),
      error: (err && err.message) || String(err),
    };
  }
});
