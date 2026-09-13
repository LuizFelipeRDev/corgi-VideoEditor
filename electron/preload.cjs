const { contextBridge, ipcRenderer } = require('electron');

let _outputCb = null;
let _doneCb = null;
let _errorCb = null;

ipcRenderer.on('auto-editor-output', (event, data) => {
  if (_outputCb) _outputCb(data);
});

ipcRenderer.on('auto-editor-done', (event, ok) => {
  if (_doneCb) _doneCb(ok);
});

ipcRenderer.on('auto-editor-error', (event, msg) => {
  if (_errorCb) _errorCb(msg);
});

contextBridge.exposeInMainWorld('api', {
  runAutoEditor: (args) => ipcRenderer.invoke('run-auto-editor', args),
  onOutput: (cb) => { _outputCb = cb; },
  onDone: (cb) => { _doneCb = cb; },
  onError: (cb) => { _errorCb = cb; },
  minimize: () => ipcRenderer.invoke('minimize'),
  close: () => ipcRenderer.invoke('close'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  joinPath: (dir, filename) => ipcRenderer.invoke('join-path', dir, filename),
  openFolder: (p) => ipcRenderer.invoke('open-folder', p),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
});
