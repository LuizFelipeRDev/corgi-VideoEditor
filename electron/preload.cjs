const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Initial theme read from --corgi-theme (added in electron/main.cjs).
// Exposed synchronously so the renderer applies data-theme before the first paint.
const _themeArg = process.argv.find((a) => a.startsWith('--corgi-theme='));
const _initialTheme = _themeArg ? _themeArg.slice('--corgi-theme='.length) : 'modern';

let _outputCb = null;
let _doneCb = null;
let _errorCb = null;

let _whisperOutputCb = null;
let _whisperDoneCb = null;
let _whisperErrorCb = null;

let _whisperCliOutputCb = null;
let _whisperCliDoneCb = null;
let _whisperCliErrorCb = null;

let _modelDownloadProgressCb = null;
let _cudaDownloadProgressCb = null;
let _rnnoiseProgressCb = null;

let _ffmpegOutputCb = null;
let _ffmpegDoneCb = null;
let _ffmpegErrorCb = null;

let _fullscreenCb = null;

ipcRenderer.on('fullscreen-changed', (event, isFullScreen) => {
  if (_fullscreenCb) _fullscreenCb(isFullScreen);
});

ipcRenderer.on('auto-editor-output', (event, data) => {
  if (_outputCb) _outputCb(data);
});

ipcRenderer.on('auto-editor-done', (event, ok) => {
  if (_doneCb) _doneCb(ok);
});

ipcRenderer.on('auto-editor-error', (event, msg) => {
  if (_errorCb) _errorCb(msg);
});

ipcRenderer.on('whisper-output', (event, data) => {
  if (_whisperOutputCb) _whisperOutputCb(data);
});

ipcRenderer.on('whisper-done', (event, ok) => {
  if (_whisperDoneCb) _whisperDoneCb(ok);
});

ipcRenderer.on('whisper-error', (event, msg) => {
  if (_whisperErrorCb) _whisperErrorCb(msg);
});

ipcRenderer.on('whisper-cli-output', (event, data) => {
  if (_whisperCliOutputCb) _whisperCliOutputCb(data);
});

ipcRenderer.on('whisper-cli-done', (event, ok) => {
  if (_whisperCliDoneCb) _whisperCliDoneCb(ok);
});

ipcRenderer.on('whisper-cli-error', (event, msg) => {
  if (_whisperCliErrorCb) _whisperCliErrorCb(msg);
});

ipcRenderer.on('model-download-progress', (event, data) => {
  if (_modelDownloadProgressCb) _modelDownloadProgressCb(data);
});

ipcRenderer.on('cuda-download-progress', (event, data) => {
  if (_cudaDownloadProgressCb) _cudaDownloadProgressCb(data);
});

ipcRenderer.on('rnnoise-download-progress', (event, data) => {
  if (_rnnoiseProgressCb) _rnnoiseProgressCb(data);
});

ipcRenderer.on('ffmpeg-output', (event, data) => {
  if (_ffmpegOutputCb) _ffmpegOutputCb(data);
});

ipcRenderer.on('ffmpeg-done', (event, ok) => {
  if (_ffmpegDoneCb) _ffmpegDoneCb(ok);
});

ipcRenderer.on('ffmpeg-error', (event, msg) => {
  if (_ffmpegErrorCb) _ffmpegErrorCb(msg);
});

contextBridge.exposeInMainWorld('api', {
  runAutoEditor: (args) => ipcRenderer.invoke('run-auto-editor', args),
  runAutoEditorExport: (args) => ipcRenderer.invoke('run-auto-editor-export', args),
  onOutput: (cb) => { _outputCb = cb; },
  onDone: (cb) => { _doneCb = cb; },
  onError: (cb) => { _errorCb = cb; },
  runWhisper: (args) => ipcRenderer.invoke('run-whisper', args),
  onWhisperOutput: (cb) => { _whisperOutputCb = cb; },
  onWhisperDone: (cb) => { _whisperDoneCb = cb; },
  onWhisperError: (cb) => { _whisperErrorCb = cb; },
  runWhisperCli: (args) => ipcRenderer.invoke('run-whisper-cli', args),
  stopWhisperCli: () => ipcRenderer.invoke('stop-whisper-cli'),
  onWhisperCliOutput: (cb) => { _whisperCliOutputCb = cb; },
  onWhisperCliDone: (cb) => { _whisperCliDoneCb = cb; },
  onWhisperCliError: (cb) => { _whisperCliErrorCb = cb; },
  runFfmpeg: (args, cwd) => ipcRenderer.invoke('run-ffmpeg', args, cwd),
  runFfmpegAnalysis: (args) => ipcRenderer.invoke('run-ffmpeg-analysis', args),
  onFfmpegOutput: (cb) => { _ffmpegOutputCb = cb; },
  onFfmpegDone: (cb) => { _ffmpegDoneCb = cb; },
  onFfmpegError: (cb) => { _ffmpegErrorCb = cb; },
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  minimize: () => ipcRenderer.invoke('minimize'),
  close: () => ipcRenderer.invoke('close'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  onFullscreenChange: (cb) => { _fullscreenCb = cb; },
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  joinPath: (dir, filename) => ipcRenderer.invoke('join-path', dir, filename),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  initialTheme: _initialTheme,
  getFontsPath: () => ipcRenderer.invoke('get-fonts-path'),
  pathExists: (targetPath) => ipcRenderer.invoke('path-exists', targetPath),
  getFileSize: (targetPath) => ipcRenderer.invoke('get-file-size', targetPath),
  getMediaDuration: (filePath) => ipcRenderer.invoke('get-media-duration', filePath),
  selectProjectSavePath: (opts) => ipcRenderer.invoke('select-project-save-path', opts),
  openProject: () => ipcRenderer.invoke('open-project'),
  getWhisperDir: () => ipcRenderer.invoke('get-whisper-dir'),
  resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', width, height),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  checkModel: (modelName) => ipcRenderer.invoke('check-model', modelName),
  downloadModel: (modelName) => ipcRenderer.invoke('download-model', modelName),
  onModelDownloadProgress: (cb) => { _modelDownloadProgressCb = cb; },
  checkCudaInstalled: () => ipcRenderer.invoke('check-cuda-installed'),
  downloadCuda: () => ipcRenderer.invoke('download-cuda'),
  onCudaDownloadProgress: (cb) => { _cudaDownloadProgressCb = cb; },
  rnnoiseStatus: () => ipcRenderer.invoke('get-rnnoise-status'),
  downloadRnnoise: () => ipcRenderer.invoke('download-rnnoise-model'),
  onRnnoiseDownloadProgress: (cb) => { _rnnoiseProgressCb = cb; },
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
