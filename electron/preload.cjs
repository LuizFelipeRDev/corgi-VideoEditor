const { contextBridge, ipcRenderer } = require('electron');

let _outputCb = null;
let _doneCb = null;
let _errorCb = null;

let _whisperOutputCb = null;
let _whisperDoneCb = null;
let _whisperErrorCb = null;

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
  onOutput: (cb) => { _outputCb = cb; },
  onDone: (cb) => { _doneCb = cb; },
  onError: (cb) => { _errorCb = cb; },
  runWhisper: (args) => ipcRenderer.invoke('run-whisper', args),
  onWhisperOutput: (cb) => { _whisperOutputCb = cb; },
  onWhisperDone: (cb) => { _whisperDoneCb = cb; },
  onWhisperError: (cb) => { _whisperErrorCb = cb; },
  runFfmpeg: (args, cwd) => ipcRenderer.invoke('run-ffmpeg', args, cwd),
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
  resizeWindow: (width, height) => ipcRenderer.invoke('resize-window', width, height),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
});
