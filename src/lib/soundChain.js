// Cadeia de tratamento de som (v1.7.0) — funções puras.
// Usado pelo export (-af), pela prévia renderizada e pelo SoundConfigModal.
// Testável fora do Electron: importar direto (node --experimental ou página de teste).

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const clone = (o) => JSON.parse(JSON.stringify(o))

// ---------------------------------------------------------------------------
// Presets do sistema — NUNCA podem ser apagados pelo usuário (imutáveis).
// Cada params usa o mesmo formato de soundConfig: { noise, dynamics, eq, fx }.
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

// Configuração padrão: preset Podcast + 🎤 DESLIGADO (nada vai ao export).
export const DEFAULT_SOUND_CONFIG = {
  enabled: false,
  presetId: 'podcast',
  ...clone(SYSTEM_PRESETS[0].params),
  // Motor de ruído: 'classic' (afftdn) ou 'rnnoise' (arnndn, exige modelo)
  noise: { denoiseMode: 'classic', ...clone(SYSTEM_PRESETS[0].params).noise },
}

// Merge defensivo do JSON salvo no config.ini sobre o padrão.
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
  // Sanitiza denoiseDb salvo por versões antigas (clamp -50..-10 deixava
  // passar -19..-10, que o afftdn rejeita e quebrava o export).
  out.noise.denoiseDb = clamp(Math.round(Number(out.noise.denoiseDb) || -25), -80, -20)
  return out
}

// Busca preset por id (sistema primeiro, depois os do usuário).
export function findPreset(id, customPresets = []) {
  const sys = SYSTEM_PRESETS.find((p) => p.id === id)
  if (sys) return { id: sys.id, nameKey: sys.nameKey, system: true, params: sys.params }
  const cus = customPresets.find((p) => p.id === id)
  if (cus) return { id: cus.id, name: cus.name, system: false, params: cus.params }
  return null
}

// ---------------------------------------------------------------------------
// Escapa um path de arquivo pra dentro de uma opção de filtro (-af).
// O parser do ffmpeg tem níveis: o nível 1 (grafos) consome o backslash
// simples, então o ':' do drive Windows precisa de BACKSLASH DUPLO (\\:) pra
// chegar inteiro no nível 2 (opções). Aspas simples NÃO funcionam (somem no
// nível 1) — validado contra o ffmpeg real do projeto nos dois sentidos
// (path simples e path com espaço/parênteses, via exec igual ao run-ffmpeg).
// Apóstrofo no path é removido (janela rara: o export falha alto, não mudo).
// ---------------------------------------------------------------------------
export function escFilterPath(p) {
  return String(p)
    .replace(/\\/g, '/')
    .replace(/'/g, '')
    .replace(/:/g, '\\\\:')
}

// ---------------------------------------------------------------------------
// Montagem da cadeia -af (ordem: gating de ruído → EQ → dinâmica → FX).
// Retorna '' quando não há nada ligado — o export aí segue sem -af.
// opts.rnnoiseModel = path do modelo neural quando o motor está em modo
// 'rnnoise'; sem o path o ramo neural cai no afftdn clássico (as chamadas
// de truthiness — forma d'onda, escuta A/B — só precisam de uma cadeia).
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
      // arnndn (RNNoise): modelo neural treinado pra voz. O graph do ffmpeg
      // auto-ressampla (44.1k/48k) — não precisa de aresample explícito.
      parts.push(`arnndn=m=${escFilterPath(opts.rnnoiseModel)}`)
    } else {
      // nf do afftdn aceita só [-80, -20] NESTE ffmpeg — valor fora derruba o
      // export inteiro ("Error applying option 'nf'"), então o clamp é a
      // última linha de defesa (sliders e merge já entregam na faixa).
      parts.push(`afftdn=nf=${clamp(Math.round(Number(n.denoiseDb) || -25), -80, -20)}`)
    }
  }
  if (n.lowpassOn) parts.push(`lowpass=f=${clamp(Math.round(Number(n.lowpassHz) || 8000), 1000, 20000)}`)
  if (n.deEssOn) parts.push('deesser')

  if (eqActive(e)) {
    if (e.tone === 'radio') {
      // Voz de rádio: banda estreita (corte grave + corte agudo)
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
    // Com limitador ligado, o pico máximo vira o TP do loudnorm (fonte única)
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
    // atempo por último: encurta/aumenta a timeline inteira (avisa na UI)
    if (Math.abs(speed - 1) > 0.001) parts.push(`atempo=${speed}`)
  }

  return parts.join(',')
}

function eqActive(e) {
  if (!e.on) return false
  return e.tone === 'radio' || [e.low, e.mid, e.high].some((g) => (Number(g) || 0) !== 0)
}

// Nomes legíveis da cadeia (prévia no topo do modal): ['highpass', 'afftdn', ...]
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

// Hash curto para o nome do arquivo de prévia no temp (quebra cache entre cadeias).
export function shortHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return (h >>> 0).toString(16)
}
