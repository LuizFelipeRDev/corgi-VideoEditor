const $ = (id) => document.getElementById(id);

const dropZone = $('dropZone');
const dropContent = $('dropContent');
const dropLoaded = $('dropLoaded');
const loadedFileName = $('loadedFileName');
const fileName = $('fileName');
const fileDuration = $('fileDuration');
const threshold = $('threshold');
const margin = $('margin');
const btnExport = $('btnExport');
const btnClearFile = $('btnClearFile');
const progressFill = $('progressFill');
const progressText = $('progressText');
const modalOverlay = $('modalOverlay');

let selectedFilePath = null;
let outputFolder = '';
let lastPct = 0;
let processing = false;

function setProgress(pct, text) {
  progressFill.style.width = `${pct}%`;
  if (text) progressText.textContent = text;
}

function resetProgress() {
  lastPct = 0;
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
}

function clearFile() {
  selectedFilePath = null;
  dropContent.classList.remove('hidden');
  dropLoaded.classList.add('hidden');
  dropZone.style.borderColor = '';
  dropZone.style.backgroundColor = '';
  fileName.textContent = '—';
  fileDuration.textContent = '—';
  btnExport.disabled = true;
  btnClearFile.classList.add('hidden');
  resetProgress();
}

function showFile(name) {
  loadedFileName.textContent = name;
  fileName.textContent = name;
  dropContent.classList.add('hidden');
  dropLoaded.classList.remove('hidden');
  btnExport.disabled = false;
  btnClearFile.classList.remove('hidden');
  dropZone.style.borderColor = '#28a745';
  dropZone.style.backgroundColor = '#f0fff4';
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[\?[0-9]*[a-zA-Z]/g, '');
}

function parseOutput(raw) {
  const clean = stripAnsi(raw);
  for (const line of clean.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const tildeIdx = t.lastIndexOf('~');
    if (tildeIdx === -1) continue;
    const remaining = parseFloat(t.substring(tildeIdx + 1));
    if (isNaN(remaining)) continue;
    const pct = Math.max(0, Math.min(100, Math.round((1 - remaining) * 100)));
    if (pct >= lastPct) {
      lastPct = pct;
      setProgress(pct, `${pct}%`);
    }
    return;
  }
  if (clean.includes('Finished')) setProgress(100, 'PRONTO');
}

window.api.onOutput((raw) => parseOutput(raw));
window.api.onDone((ok) => {
  processing = false;
  setProgress(ok ? 100 : 0, ok ? 'PRONTO' : 'ERRO');
  btnExport.textContent = 'EXPORTAR';
  btnExport.disabled = false;
});

btnClearFile.addEventListener('click', (e) => { e.stopPropagation(); clearFile(); });

dropZone.addEventListener('click', async () => {
  if (selectedFilePath || processing) return;
  const p = await window.api.selectFile();
  if (p) { selectedFilePath = p; showFile(p.split(/[/\\]/).pop()); fileDuration.textContent = '—'; }
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', async (e) => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  if (processing) return;
  const f = e.dataTransfer.files;
  if (f.length > 0 && f[0].path) {
    selectedFilePath = f[0].path;
    showFile(f[0].name);
    fileDuration.textContent = `~${(f[0].size / 1048576).toFixed(1)} MB`;
  } else {
    const p = await window.api.selectFile();
    if (p) { selectedFilePath = p; showFile(p.split(/[/\\]/).pop()); }
  }
});

btnExport.addEventListener('click', async () => {
  if (!selectedFilePath || processing) return;
  processing = true;
  btnExport.textContent = 'PROCESSANDO...';
  lastPct = 0;
  setProgress(0, '0%');

  const args = [selectedFilePath, '--progress', 'machine',
    '--edit', `audio:threshold=${Math.pow(10, parseFloat(threshold.value) / 20)}`,
    '--margin', `${margin.value}s`];
  if (outputFolder) {
    const n = selectedFilePath.split(/[/\\]/).pop();
    const base = n.replace(/\.[^.]+$/, '');
    const ext = n.match(/\.[^.]+$/)?.[0] || '';
    const outPath = await window.api.joinPath(outputFolder, base + '_ALTERED' + ext);
    args.push('--output', outPath);
  }
  await window.api.runAutoEditor(args);
});

$('btnSettings').addEventListener('click', () => modalOverlay.classList.remove('hidden'));
$('btnCloseModal').addEventListener('click', () => modalOverlay.classList.add('hidden'));
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.add('hidden'); });

$('btnSelectFolder').addEventListener('click', async () => {
  const d = await window.api.selectOutputDir();
  if (d) { outputFolder = d; $('outputPathInput').value = d; }
});

$('btnSaveSettings').addEventListener('click', async () => {
  await window.api.saveConfig({ threshold: threshold.value, margin: margin.value, output_folder: outputFolder });
  $('outputPath').textContent = outputFolder ? `PASTA: ${outputFolder}` : 'PASTA: MESMA DO ARQUIVO';
  modalOverlay.classList.add('hidden');
});

threshold.addEventListener('change', () => window.api.saveConfig({ threshold: threshold.value, margin: margin.value, output_folder: outputFolder }));
margin.addEventListener('change', () => window.api.saveConfig({ threshold: threshold.value, margin: margin.value, output_folder: outputFolder }));

$('btnMinimize')?.addEventListener('click', () => window.api.minimize?.());
$('btnClose')?.addEventListener('click', () => window.api.close?.());

(async () => {
  const c = await window.api.getConfig();
  threshold.value = c.threshold;
  margin.value = c.margin;
  if (c.output_folder) { outputFolder = c.output_folder; $('outputPathInput').value = c.output_folder; $('outputPath').textContent = `PASTA: ${c.output_folder}`; }
})();
