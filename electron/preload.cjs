const { contextBridge, ipcRenderer, webUtils } = require('electron');

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

let _ffmpegOutputCb = null;
let _ffmpegDoneCb = null;
let _ffmpegErrorCb = null;

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
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  joinPath: (dir, filename) => ipcRenderer.invoke('join-path', dir, filename),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  getFontsPath: () => ipcRenderer.invoke('get-fonts-path'),
  pathExists: (targetPath) => ipcRenderer.invoke('path-exists', targetPath),
  getWhisperDir: () => ipcRenderer.invoke('get-whisper-dir'),
  resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', width, height),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  checkModel: (modelName) => ipcRenderer.invoke('check-model', modelName),
  downloadModel: (modelName) => ipcRenderer.invoke('download-model', modelName),
  onModelDownloadProgress: (cb) => { _modelDownloadProgressCb = cb; },
  checkWhisperCli: () => ipcRenderer.invoke('check-whisper-cli'),
  downloadCuda: () => ipcRenderer.invoke('download-cuda'),
  onCudaDownloadProgress: (cb) => { _cudaDownloadProgressCb = cb; },
  getPathForFile: (file) => webUtils.getPathForFile(file),
});
