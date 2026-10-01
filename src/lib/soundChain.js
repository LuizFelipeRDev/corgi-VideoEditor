// Sound processing chain (v1.7.0) — pure functions.
// Used by the export (-af), by the rendered preview and by SoundConfigModal.
// Testable outside Electron: import directly (node --experimental or a test page).

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const clone = (o) => JSON.parse(JSON.stringify(o))

// ---------------------------------------------------------------------------
// System presets — can NEVER be deleted by the user (immutable).
// Each params uses the same format as soundConfig: { noise, dynamics, eq, fx }.
// ---------------------------------------------------------------------------
export const SYSTEM_PRESETS = [
  {
    id: 'podcast',
    nameKey: 'sound.preset.podcast',
    params: {
      noise: { denoiseOn: true, denoiseDb: -25, highpassOn: true, highpassHz: 80, lowpassOn: false, lowpassHz: 8000, deEssOn: false },
      dynamics: { normalizeOn: true, lufs: -16, lra: 11, compOn: true, threshold: -18, ratio: 3, attack: 5, limiterOn: false, ceiling: -1 },
      eq: { on: false, tone: 'flat', low: 0, mid: 0, high: 0 },
      fx: { speedOn: false, speed: 1, echoOn: false, echoDelay: 300, echoDecay: 0.4 },
    },
  },
  {
    id: 'broadcast',
    nameKey: 'sound.preset.broadcast',
    params: {
      noise: { denoiseOn: true, denoiseDb: -30, highpassOn: true, highpassHz: 75, lowpassOn: false, lowpassHz: 9000, deEssOn: true },
      dynamics: { normalizeOn: true, lufs: -23, lra: 7, compOn: false, threshold: -18, ratio: 3, attack: 5, limiterOn: true, ceiling: -1 },
      eq: { on: false, tone: 'flat', low: 0, mid: 0, high: 0 },
      fx: { speedOn: false, speed: 1, echoOn: false, echoDelay: 300, echoDecay: 0.4 },
    },
  },
  {
    id: 'cleanup',
    nameKey: 'sound.preset.cleanup',
    params: {
      noise: { denoiseOn: true, denoiseDb: -20, highpassOn: true, highpassHz: 100, lowpassOn: false, lowpassHz: 8000, deEssOn: false },
      dynamics: { normalizeOn: true, lufs: -16, lra: 11, compOn: true, threshold: -18, ratio: 3, attack: 5, limiterOn: false, ceiling: -1 },
      eq: { on: false, tone: 'flat', low: 0, mid: 0, high: 0 },
      fx: { speedOn: false, speed: 1, echoOn: false, echoDelay: 300, echoDecay: 0.4 },
    },
  },
  {
    id: 'uniform',
    nameKey: 'sound.preset.uniform',
    params: {
      noise: { denoiseOn: true, denoiseDb: -25, highpassOn: true, highpassHz: 80, lowpassOn: false, lowpassHz: 8000, deEssOn: false },
      dynamics: { normalizeOn: true, lufs: -16, lra: 11, compOn: true, threshold: -24, ratio: 6, attack: 3, limiterOn: false, ceiling: -1 },
      eq: { on: false, tone: 'flat', low: 0, mid: 0, high: 0 },
      fx: { speedOn: false, speed: 1, echoOn: false, echoDelay: 300, echoDecay: 0.4 },
    },
  },
  {
    id: 'hiss',
    nameKey: 'sound.preset.hiss',
    params: {
      noise: { denoiseOn: false, denoiseDb: -25, highpassOn: true, highpassHz: 120, lowpassOn: true, lowpassHz: 8000, deEssOn: false },
      dynamics: { normalizeOn: false, lufs: -16, lra: 11, compOn: false, threshold: -18, ratio: 3, attack: 5, limiterOn: false, ceiling: -1 },
      eq: { on: false, tone: 'flat', low: 0, mid: 0, high: 0 },
      fx: { speedOn: false, speed: 1, echoOn: false, echoDelay: 300, echoDecay: 0.4 },
    },
  },
]

// Default config: Podcast preset + 🎤 OFF (nothing goes to the export).
export const DEFAULT_SOUND_CONFIG = {
  enabled: false,
  presetId: 'podcast',
  ...clone(SYSTEM_PRESETS[0].params),
  // Noise engine: 'classic' (afftdn) or 'rnnoise' (arnndn, requires model)
  noise: { denoiseMode: 'classic', ...clone(SYSTEM_PRESETS[0].params).noise },
}

// Defensive merge of the JSON saved in config.ini over the default.
export function mergeSoundConfig(saved) {
  const base = clone(DEFAULT_SOUND_CONFIG)
  if (!saved || typeof saved !== 'object') return base
  const out = { ...base }
  if (typeof saved.enabled === 'boolean') out.enabled = saved.enabled
  if (typeof saved.presetId === 'string') out.presetId = saved.presetId
  for (const group of ['noise', 'dynamics', 'eq', 'fx']) {
    const g = saved[group]
    out[group] = { ...base[group], ...(g && typeof g === 'object' ? g : {}) }
  }
  // Sanitizes denoiseDb saved by old versions (the clamp -50..-10 let
  // -19..-10 pass, which afftdn rejects and broke the export).
  out.noise.denoiseDb = clamp(Math.round(Number(out.noise.denoiseDb) || -25), -80, -20)
  return out
}

// Finds a preset by id (system first, then the user's).
export function findPreset(id, customPresets = []) {
  const sys = SYSTEM_PRESETS.find((p) => p.id === id)
  if (sys) return { id: sys.id, nameKey: sys.nameKey, system: true, params: sys.params }
  const cus = customPresets.find((p) => p.id === id)
  if (cus) return { id: cus.id, name: cus.name, system: false, params: cus.params }
  return null
}

// ---------------------------------------------------------------------------
// Escapes a file path for inside a filter option (-af).
// The ffmpeg parser has levels: level 1 (graphs) consumes a single
// backslash, so the Windows drive ':' needs a DOUBLE BACKSLASH (\\:) to
// arrive whole at level 2 (options). Single quotes do NOT work (they vanish at
// level 1) — validated against the project's real ffmpeg in both directions
// (plain path and path with space/parentheses, via exec just like run-ffmpeg).
// Apostrophe in the path is removed (rare window: the export fails loudly, not muted).
// ---------------------------------------------------------------------------
export function escFilterPath(p) {
  return String(p)
    .replace(/\\/g, '/')
    .replace(/'/g, '')
    .replace(/:/g, '\\\\:')
}

// ---------------------------------------------------------------------------
// Building the -af chain (order: noise gating → EQ → dynamics → FX).
// Returns '' when nothing is on — the export then proceeds without -af.
// opts.rnnoiseModel = path of the neural model when the engine is in
// 'rnnoise' mode; without the path the neural branch falls back to classic afftdn (truthiness
// callers — waveform, A/B listening — only need a chain).
// ---------------------------------------------------------------------------
export function buildSoundChain(cfg, opts = {}) {
  if (!cfg || typeof cfg !== 'object') return ''
  const n = cfg.noise || {}
  const d = cfg.dynamics || {}
  const e = cfg.eq || {}
  const f = cfg.fx || {}
  const parts = []

  if (n.highpassOn) parts.push(`highpass=f=${clamp(Math.round(Number(n.highpassHz) || 80), 20, 500)}`)
  if (n.denoiseOn) {
    if (n.denoiseMode === 'rnnoise' && opts.rnnoiseModel) {
      // arnndn (RNNoise): neural model trained for voice. The ffmpeg graph
      // auto-resamples (44.1k/48k) — no explicit aresample needed.
      parts.push(`arnndn=m=${escFilterPath(opts.rnnoiseModel)}`)
    } else {
      // afftdn's nf accepts only [-80, -20] IN this ffmpeg — an out-of-range value takes down the
      // whole export ("Error applying option 'nf'"), so the clamp is the
      // last line of defense (sliders and merge already deliver in range).
      parts.push(`afftdn=nf=${clamp(Math.round(Number(n.denoiseDb) || -25), -80, -20)}`)
    }
  }
  if (n.lowpassOn) parts.push(`lowpass=f=${clamp(Math.round(Number(n.lowpassHz) || 8000), 1000, 20000)}`)
  if (n.deEssOn) parts.push('deesser')

  if (eqActive(e)) {
    if (e.tone === 'radio') {
      // Radio voice: narrow band (low cut + high cut)
      parts.push('highpass=f=300', 'lowpass=f=3400')
    }
    const bands = [['110', e.low], ['1000', e.mid], ['8000', e.high]]
    for (const [freq, raw] of bands) {
      const g = clamp(Math.round(Number(raw) || 0), -12, 12)
      if (g !== 0) parts.push(`equalizer=f=${freq}:t=q:w=1:g=${g}`)
    }
  }

  if (d.compOn) {
    const th = clamp(Number(d.threshold ?? -18), -50, 0)
    const ratio = clamp(Number(d.ratio ?? 3), 1, 20)
    const attack = clamp(Number(d.attack ?? 5), 1, 200)
    parts.push(`acompressor=threshold=${th}dB:ratio=${ratio}:attack=${attack}:release=250`)
  }

  if (d.normalizeOn) {
    const lufs = clamp(Number(d.lufs ?? -16), -30, -5)
    const lra = clamp(Number(d.lra ?? 11), 1, 50)
    // With the limiter on, the maximum peak becomes the loudnorm TP (single source)
    const tp = d.limiterOn ? clamp(Number(d.ceiling ?? -1), -6, -0.1) : -1.5
    parts.push(`loudnorm=I=${lufs}:TP=${tp}:LRA=${lra}`)
  } else if (d.limiterOn) {
    const ceiling = clamp(Number(d.ceiling ?? -1), -6, -0.1)
    parts.push(`alimiter=limit=${Math.pow(10, ceiling / 20).toFixed(4)}`)
  }

  if (f.echoOn) {
    const delay = clamp(Math.round(Number(f.echoDelay ?? 300)), 10, 1000)
    const decay = clamp(Number(f.echoDecay ?? 0.4), 0.05, 0.9)
    parts.push(`aecho=0.7:0.9:${delay}:${decay}`)
  }

  if (f.speedOn) {
    const speed = clamp(Number(f.speed ?? 1), 0.5, 2)
    // atempo last: shortens/lengthens the entire timeline (warns in the UI)
    if (Math.abs(speed - 1) > 0.001) parts.push(`atempo=${speed}`)
  }

  return parts.join(',')
}

function eqActive(e) {
  if (!e.on) return false
  return e.tone === 'radio' || [e.low, e.mid, e.high].some((g) => (Number(g) || 0) !== 0)
}

// Readable names of the chain (preview at the top of the modal): ['highpass', 'afftdn', ...]
export function describeSoundChain(cfg) {
  if (!cfg || typeof cfg !== 'object') return []
  const n = cfg.noise || {}
  const d = cfg.dynamics || {}
  const e = cfg.eq || {}
  const f = cfg.fx || {}
  const names = []
  if (n.highpassOn) names.push('highpass')
  if (n.denoiseOn) names.push(n.denoiseMode === 'rnnoise' ? 'arnndn' : 'afftdn')
  if (n.lowpassOn) names.push('lowpass')
  if (n.deEssOn) names.push('deesser')
  if (eqActive(e)) names.push(e.tone === 'radio' ? 'bandpass+eq' : 'eq')
  if (d.compOn) names.push('compressor')
  if (d.normalizeOn) names.push('loudnorm')
  else if (d.limiterOn) names.push('limiter')
  if (f.echoOn) names.push('aecho')
  if (f.speedOn && Math.abs(clamp(Number(f.speed ?? 1), 0.5, 2) - 1) > 0.001) names.push('atempo')
  return names
}

// Short hash for the preview file name in temp (breaks cache between chains).
export function shortHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return (h >>> 0).toString(16)
}
