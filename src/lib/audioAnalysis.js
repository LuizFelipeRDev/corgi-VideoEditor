// ---------------------------------------------------------------------------
// ANALYZE AND SUGGEST - parsing of ffmpeg's raw output and suggestion rules.
//
// Chain (assembled in AnalyzeModal, via the run-ffmpeg-analysis IPC):
//   silencedetect=noise=-45dB:d=0.25,aresample=44100,
//   asetnsamples=n=4410:p=0,astats=metadata=1:reset=1,
//   ametadata=mode=print:key=lavfi.astats.Overall.RMS_level
//
// asetnsamples forces EXACT frames of 4410 samples (100 ms @44.1k) and
// reset=1 zeroes the stats at every frame => each window = 100 ms of pure audio
// (without it astats keeps accumulating from the start and the levels flatten -
// ffmpeg's "length" has no effect and "reset" is counted in FRAMES, not
// samples). ffmpeg prints one block per window, with the prefix
// [Parsed_ametadata...] on stderr: line "frame:N pts:... pts_time:<t>"
// followed by "...Overall.RMS_level=<dB>". silencedetect emits
// "silence_start:" and "silence_end: <end> | silence_duration: <dur>"
// (it also injects lavfi.silence_*=... metadata with "=" - the parser only
// accepts the log ones, with ":").
// ---------------------------------------------------------------------------

// astats' -inf/nan (digital silence, empty window) becomes -100 dB.
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

  // Silence that starts and never ends (end of file with no silence_end)
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

// Rules (explained in the backlog):
//  - noise floor    = 10th percentile of the per-frame levels
//  - voice          = 90th percentile
//  - threshold      = floor + half the distance to the voice (midpoint of the SNR)
//  - margin         = half the median of the pauses (0.2 .. 1.0 s)
//  - denoiseDb      = by SNR: >=20 light (-20, the afftdn maximum), 10-20 -25, 5-10 -30, <5 -35
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

  // afftdn nf only accepts [-80, -20] in this ffmpeg — -10 broke the export.
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
