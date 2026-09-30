// ---------------------------------------------------------------------------
// ANALISAR E SUGERIR - parsing do output bruto do ffmpeg e regras de sugestao.
//
// Cadeia (montada no AnalyzeModal, via IPC run-ffmpeg-analysis):
//   silencedetect=noise=-45dB:d=0.25,aresample=44100,
//   asetnsamples=n=4410:p=0,astats=metadata=1:reset=1,
//   ametadata=mode=print:key=lavfi.astats.Overall.RMS_level
//
// asetnsamples força frames EXATOS de 4410 samples (100 ms @44,1k) e o
// reset=1 zera os stats a cada frame => cada janela = 100 ms de audio puro
// (sem isso o astats fica acumulando desde o inicio e os niveis achatam -
// o "length" do ffmpeg nao faz efeito e "reset" e contado em FRAMES, nao
// samples). O ffmpeg imprime um bloco por janela, com prefixo
// [Parsed_ametadata...] no stderr: linha "frame:N pts:... pts_time:<t>"
// seguida de "...Overall.RMS_level=<dB>". O silencedetect emite
// "silence_start:" e "silence_end: <fim> | silence_duration: <dur>"
// (tambem injeta metadados lavfi.silence_*=... com "=" - o parser so aceita
// os de log, com ":").
// ---------------------------------------------------------------------------

// -inf/nan do astats (silencio digital, janela vazia) vira -100 dB.
function toDb(raw) {
  if (raw === 'nan') return null
  if (raw === '-inf') return -100
  if (raw === 'inf' || raw === '+inf') return 0
  const v = parseFloat(raw)
  return Number.isFinite(v) ? Math.max(-100, Math.min(0, v)) : null
}

export function parseAnalysisOutput(output) {
  const windows = []
  const silences = []
  let current = null
  let silenceStart = null
  let duration = null

  for (const line of String(output || '').split('\n')) {
    let m = line.match(/frame:\d+\s+pts:\d+\s+pts_time:([\d.]+)/)
    if (m) {
      current = { t: parseFloat(m[1]), rms: null }
      windows.push(current)
      continue
    }
    m = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+|-inf|inf|nan)/)
    if (m && current) {
      const db = toDb(m[1])
      if (db !== null) current.rms = db
      continue
    }
    m = line.match(/silence_start:\s*(-?[\d.]+)/)
    if (m) {
      silenceStart = parseFloat(m[1])
      continue
    }
    m = line.match(/silence_end:\s*(-?[\d.]+)(?:\s*\|\s*silence_duration:\s*([\d.]+))?/)
    if (m) {
      const end = parseFloat(m[1])
      const dur = m[2] ? parseFloat(m[2]) : silenceStart !== null ? end - silenceStart : 0
      if (silenceStart !== null && dur > 0) silences.push({ start: silenceStart, end, dur })
      silenceStart = null
      continue
    }
    m = line.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
    if (m && duration === null) duration = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])
  }

  // Silencio que comeca e nunca termina (fim do arquivo sem silence_end)
  if (silenceStart !== null) {
    if (duration === null && windows.length) duration = windows[windows.length - 1].t
    if (duration !== null && duration - silenceStart > 0.05) {
      silences.push({ start: silenceStart, end: duration, dur: duration - silenceStart })
    }
  }

  return { duration, windows, silences }
}

function quantile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx]
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const round1 = (v) => Math.round(v * 10) / 10

// Regras (explicadas no backlog):
//  - piso de ruedo  = percentil 10 dos niveis por frame
//  - voz            = percentil 90
//  - threshold      = pino + metade da distancia ate a voz (meio do SNR)
//  - margin         = metade da mediana das pausas (0.2 .. 1.0 s)
//  - denoiseDb      = pelo SNR: >=20 leve (-20, o máximo do afftdn), 10-20 -25, 5-10 -30, <5 -35
export function suggestSettings({ windows, silences }) {
  const values = (windows || []).map((w) => w.rms).filter((v) => v !== null && Number.isFinite(v))
  if (values.length < 4) return { error: 'tooShort' }

  const sorted = [...values].sort((a, b) => a - b)
  const noiseFloor = quantile(sorted, 0.1)
  const voice = quantile(sorted, 0.9)
  const snr = voice - noiseFloor
  if (snr < 6) return { error: 'noSpeech' }

  const threshold = clamp(Math.round(noiseFloor + snr / 2), -70, -15)

  const pauses = (silences || []).map((s) => s.dur).filter((d) => d > 0).sort((a, b) => a - b)
  const medianPause = pauses.length ? pauses[Math.floor(pauses.length / 2)] : null
  const margin = medianPause === null ? 0.5 : round1(clamp(medianPause / 2, 0.2, 1.0))

  // afftdn nf só aceita [-80, -20] neste ffmpeg — -10 derrubava o export.
  const denoiseDb = snr >= 20 ? -20 : snr >= 10 ? -25 : snr >= 5 ? -30 : -35

  return {
    measurements: {
      noiseFloor: round1(noiseFloor),
      voice: round1(voice),
      snr: round1(snr),
      pauses: pauses.length,
      medianPause: medianPause === null ? null : round1(medianPause),
    },
    suggestions: { threshold, margin, denoiseDb },
  }
}
