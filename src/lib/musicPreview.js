// Background music preview — ducking phase 2 (preview).
//
// Plays the music bed under the voice while previewing and ducks it while
// someone speaks, mirroring what the export does with sidechaincompress
// (level-triggered duck). The VOICE level is read through an AnalyserNode
// tapped on the realtime chain's trim (pre A/B — speech is tracked even
// with the mic bypassed, and the export's no-mic sidechain sees the same
// signal), and a hysteresis envelope (fast attack / slow release) lowers
// the music's gain. The music element runs through Web Audio
// (MediaElementSource — file:// access is fine, webSecurity is off) with
// base gain (gutter dB) x duck gain, looping so shorter beds cover the
// whole timeline — same idea as -stream_loop on export. The seam itself dips
// to silence (LOOP_SEAM_MS envelope, seamTick) instead of splicing mid-level.

// Loop seam window (phase A): the bed's gain falls to silence across the last
// LOOP_SEAM_MS before the native wrap and rises back over the head. The export
// joins the looped copies with acrossfade over this SAME window (a real
// crossfade there; a dip is the closest one element can approximate).
export const LOOP_SEAM_MS = 700
const TAU_SEAM = 0.02 // seconds of smoothing on the per-frame seam servo

// Final fade (ducking checkbox): the BED alone falls to silence across the last
// MUSIC_FADE_SEC of the timeline — the voice keeps its own level. The export
// fades the same window with afade on the bed branch, so preview and file
// match.
export const MUSIC_FADE_SEC = 1.5
const TAU_FADE = 0.05 // seconds of smoothing on the per-frame fade servo

const DUCK_DB = -15 // drop while the voice speaks (dB, relative to the bed)
const RMS_ON = 0.03 // voice RMS (0..1) that starts the duck
const RMS_OFF = 0.018 // hysteresis: back to full level below this
const TAU_ATTACK = 0.03 // seconds to fall into the duck
const TAU_RELEASE = 0.25 // seconds to come back (podcast-smooth)
const DRIFT = 0.35 // seconds of drift tolerated before resyncing

const dbToLin = (db) => Math.pow(10, db / 20)
const toUrl = (p) => `file:///${p.replace(/\\/g, '/')}`
// A marked range collapses the EXPORT timeline (the work file starts at 0
// and the bed starts at its own 0) while the preview plays on the FILE's
// timeline — subtracting the range start from the voice time makes preview
// and export hear the same music position.
// With a bed SHORTER than the timeline the target position wraps modulo the
// bed's duration (the export restarts it at every copy the same way) —
// without the mod the sync seeks to a time past the end, the element clamps
// and the loop never advances.
const posOf = (time) => {
  const raw = Math.max(0, (time || 0) - S.offset)
  const d = S.dur || (el && Number.isFinite(el.duration) ? el.duration : 0)
  return d > 0 && raw >= d ? raw % d : raw
}

const S = {
  enabled: false,
  file: null,
  db: 0,
  playing: false,
  applied: '',
  offset: 0,
  dur: 0,
  fade: false, // final fade on (ducking checkbox)
  total: 0, // timeline length (the preview plays on the FILE's timeline)
  time: 0, // last voice position reported by play/seek/sync
  fadeNow: 1, // last factor written to outGain (skips redundant automation)
}

let ctx = null
let el = null
let baseGain = null
let duckGain = null
let analyser = null // lives in the VOICE context (fed by realtimeChain's trim)
let level = null // Float32Array for the analyser readings
let raf = 0
let ducked = false
let elSrc = '' // path currently on the element (avoids reloading every play)
let loopGain = null // seam envelope node (bed's own position), before baseGain
let outGain = null // final fade (bed only), after the duck envelope
let seamArmed = false // saw the tail: the head must rise back after the wrap
let seamPrev = 0 // last position read (jumps backward at the native loop)

// Lazily built on the first play (keeps AudioContext out of app boot).
function ensure() {
  if (ctx) return
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  el = new Audio()
  el.loop = true
  el.preload = 'auto'
  baseGain = ctx.createGain()
  duckGain = ctx.createGain()
  loopGain = ctx.createGain()
  outGain = ctx.createGain()
  baseGain.gain.value = dbToLin(S.db)
  duckGain.gain.value = 1
  loopGain.gain.value = 1
  outGain.gain.value = 1
  // Bed duration for the wrapped position (refreshed on every src swap)
  el.addEventListener('loadedmetadata', () => {
    S.dur = Number.isFinite(el.duration) ? el.duration : 0
  })
  const src = ctx.createMediaElementSource(el)
  src.connect(loopGain)
  loopGain.connect(baseGain)
  baseGain.connect(duckGain)
  duckGain.connect(outGain)
  outGain.connect(ctx.destination)
  if (S.applied) {
    el.src = toUrl(S.applied)
    elSrc = S.applied
  }
}

// Points the element at the current file ONLY when it changed (a new src
// reloads the media and drops the position).
function applyFile() {
  if (!el) return
  if (S.applied && elSrc !== S.applied) {
    el.src = toUrl(S.applied)
    elSrc = S.applied
    S.dur = 0 // stale until the new loadedmetadata lands
  } else if (!S.applied && elSrc) {
    el.removeAttribute('src')
    elSrc = ''
    S.dur = 0
  }
}

function resetEnvelope() {
  ducked = false
  seamArmed = false
  seamPrev = 0
  if (duckGain && ctx) {
    duckGain.gain.cancelScheduledValues(ctx.currentTime)
    duckGain.gain.value = 1
  }
  if (loopGain && ctx) {
    loopGain.gain.cancelScheduledValues(ctx.currentTime)
    loopGain.gain.value = 1
  }
  if (outGain && ctx) {
    outGain.gain.cancelScheduledValues(ctx.currentTime)
    outGain.gain.value = 1
  }
  S.fadeNow = 1
}

// Loop seam servo: the gain tracks the bed's OWN position every frame, so the
// native loop never splices mid-level. The tail region falls to silence and
// arms the head, which rises back over it — also armed by the wrap's backward
// jump (position jumping back more than half a cycle). The export joins the
// copies with a real acrossfade over the same LOOP_SEAM_MS window; a dip is
// the closest a single element can get.
function seamTick() {
  if (!loopGain || !el || !Number.isFinite(el.duration) || el.duration <= 0) return
  const d = el.duration
  const x = Math.min(LOOP_SEAM_MS / 1000, d / 4)
  const p = el.currentTime
  if (seamPrev - p > d / 2) seamArmed = true
  seamPrev = p
  let g = 1
  if (p > d - x) {
    g = Math.sin(Math.PI / 2 * ((d - p) / x))
    seamArmed = true
  } else if (seamArmed) {
    if (p < x) g = Math.sin(Math.PI / 2 * (p / x))
    else seamArmed = false // head already past: full level again
  }
  loopGain.gain.setTargetAtTime(g, ctx.currentTime, TAU_SEAM)
}

// Final fade servo: the BED ramps to silence across the last MUSIC_FADE_SEC of
// the timeline (the voice is untouched — outGain sits after the duck envelope).
// Driven by the voice position the App reports on every timeupdate (S.time),
// so a seek or a pause just re-reads the factor on the next frame.
function fadeTick() {
  if (!outGain || !ctx) return
  let f = 1
  if (S.fade && S.total > 0) {
    const left = S.total - (S.time || 0)
    f = left <= 0 ? 0 : left >= MUSIC_FADE_SEC ? 1 : left / MUSIC_FADE_SEC
  }
  if (Math.abs(f - S.fadeNow) < 0.005) return
  S.fadeNow = f
  outGain.gain.setTargetAtTime(f, ctx.currentTime, TAU_FADE)
}

function tick() {
  raf = requestAnimationFrame(tick)
  if (!S.playing || !ctx) return
  seamTick()
  fadeTick()
  if (!analyser || !level || !duckGain) return
  analyser.getFloatTimeDomainData(level)
  let sum = 0
  for (let i = 0; i < level.length; i++) sum += level[i] * level[i]
  const rms = Math.sqrt(sum / level.length)
  // Hysteresis: duck on speech, release only below the lower bar (no flapping)
  const want = ducked ? rms > RMS_OFF : rms >= RMS_ON
  if (want !== ducked) {
    ducked = want
    duckGain.gain.setTargetAtTime(
      want ? dbToLin(DUCK_DB) : 1,
      ctx.currentTime,
      want ? TAU_ATTACK : TAU_RELEASE
    )
  }
}

const startLoop = () => {
  if (!raf) raf = requestAnimationFrame(tick)
}
const stopLoop = () => {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

const musicPreview = {
  // Mirrors the ducking settings (called from App): music file, bed level
  // (live dB), timeline offset, on/off, the final fade switch and the timeline
  // length the fade measures against. Swapping the file mid-play pauses
  // the bed — the next timeupdate (sync) resumes it at the voice's position.
  configure({ enabled, file, db, offset, fade, total }) {
    S.enabled = !!enabled
    S.file = file || null
    S.db = Number(db) || 0
    S.offset = Number(offset) || 0
    S.fade = !!fade
    S.total = Number(total) || 0
    if (baseGain) baseGain.gain.value = dbToLin(S.db)
    const next = S.enabled && S.file ? S.file.path : ''
    if (next !== S.applied) {
      S.applied = next
      if (el) {
        el.pause()
        applyFile()
      }
      if (!next) {
        S.playing = false
        stopLoop()
        resetEnvelope()
      }
    }
  },

  // Called by realtimeChain.attach with the voice's trim node: leaf tap, no
  // destination feed needed for the analyser to receive data.
  tapVoice(node) {
    if (!node) return
    try {
      const a = node.context.createAnalyser()
      a.fftSize = 1024
      node.connect(a)
      analyser = a
      level = new Float32Array(a.fftSize)
    } catch {
      // no voice ctx — preview keeps the music at full level
      analyser = null
      level = null
    }
  },

  play(atTime) {
    if (!S.enabled || !S.applied) return
    if (typeof atTime === 'number') S.time = atTime
    ensure()
    applyFile()
    if (ctx.state === 'suspended') ctx.resume()
    const align = () => {
      const want = posOf(atTime)
      if (typeof atTime === 'number' && Math.abs(el.currentTime - want) > DRIFT) {
        el.currentTime = want
      }
    }
    align()
    const p = el.play()
    if (p && p.catch) {
      p.catch(() => {}) // autoplay retry on the next gesture
      p.then(align) // again after the load settles (a fresh src can clamp the first seek)
    }
    S.playing = true
    startLoop()
  },

  pause() {
    S.playing = false
    if (el) el.pause()
    stopLoop()
    resetEnvelope()
  },

  seek(time) {
    if (!S.enabled || !S.applied || !el) return
    S.time = time || 0
    const want = posOf(time)
    if (Math.abs(el.currentTime - want) > 0.01) el.currentTime = want
  },

  // Drift correction on every voice timeupdate (and resume after a mid-play
  // file swap: the new source starts paused at 0 until this lines it up).
  sync(time) {
    if (!S.playing || !S.enabled || !S.applied || !el) return
    S.time = time || 0
    if (el.paused) {
      const p = el.play()
      if (p && p.catch) p.catch(() => {})
    }
    const want = posOf(time)
    if (Math.abs(el.currentTime - want) > DRIFT) el.currentTime = want
  },
}

export default musicPreview
