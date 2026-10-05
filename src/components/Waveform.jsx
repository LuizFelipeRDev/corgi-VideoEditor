import { useRef, useEffect, useState, useMemo } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { useTheme } from '../lib/theme'
import { useLang } from '../lib/i18n'
import realtimeChain from '../lib/realtimeChain'
import musicPreview from '../lib/musicPreview'
import DbGutter from './DbGutter'
import MusicTrack from './MusicTrack'

// Rendered audio pixels per second. Keeps the MINIMUM density of
// ~0.5s per bar (barWidth 2 + barGap 1 = 3px; 3px / 6px-s = 0.5s): files
// longer than ~3min become a strip with horizontal scroll instead of being
// squeezed. Short ones (<= ~3min) keep filling the container as before.
const MIN_PX_PER_SEC = 6

// Upper bound for the waveform canvases' device pixel ratio. wavesurfer uses
// max(1, window.devicePixelRatio) with no cap, so a 2x/3x screen costs 4-9x the
// fill rate on every redraw; for a bar graph 1.5x is indistinguishable.
const MAX_WAVE_PIXEL_RATIO = 1.5
const capPixelRatio = (ws) => {
  const renderer = ws && ws.renderer
  if (!renderer || typeof renderer.getPixelRatio !== 'function') return
  renderer.getPixelRatio = () => Math.min(
    Math.max(1, window.devicePixelRatio || 1),
    MAX_WAVE_PIXEL_RATIO,
  )
}

// normalize:true without maxPeak makes wavesurfer rescan the slice looking for
// the maximum on EVERY redraw (calculateVerticalScale in renderer-utils.js) —
// and redraws happen on every scroll boundary and every lazy canvas. The decoded
// buffer is available once, at 'ready': measure it there and hand the peak over,
// which turns the scale into O(1) per redraw.
//
// Two details, both measured in the browser against wavesurfer 7.12.12:
//   - the render buffer is 8 kHz (AudioContext at that rate), so a 1h file is
//     ~28.8M samples per channel;
//   - calculateVerticalScale only looks at channelData[0], so scanning that
//     channel alone reproduces exactly what wavesurfer would compute.
// The scan runs in slices through setTimeout: a synchronous pass froze the UI
// for ~1.7s on a 1h file, and the load itself is async (the UI stays alive).
const MAXPEAK_SLICE = 2000000
const maxPeakTokenRef = { current: 0 }

const applyMaxPeak = (ws) => {
  const token = ++maxPeakTokenRef.current
  let decoded
  try {
    decoded = ws.getDecodedData && ws.getDecodedData()
  } catch (e) {
    return
  }
  if (!decoded || !decoded.length || !decoded.numberOfChannels) return
  let data
  try {
    data = decoded.getChannelData(0)
  } catch (e) {
    return
  }
  let max = 0
  let i = 0
  const step = () => {
    if (token !== maxPeakTokenRef.current) return // a newer scan (or a dead instance) won
    const end = Math.min(data.length, i + MAXPEAK_SLICE)
    for (; i < end; i++) {
      const v = data[i] < 0 ? -data[i] : data[i]
      if (v > max) max = v
    }
    if (i < data.length) {
      setTimeout(step, 0)
      return
    }
    if (max > 0) {
      try {
        ws.setOptions({ maxPeak: max })
      } catch (e) {
        console.warn('[wave] maxPeak nao aplicado:', e)
      }
    }
  }
  step()
}

// Thin scrollbar INSIDE the wavesurfer Shadow DOM — the document's
// ::-webkit-scrollbar does not reach the shadow root. It only appears when the
// audio is long enough to generate scroll (the inner .scroll only gets
// overflow-x: auto in that case).
const WS_SCROLLBAR_CSS = `
  .scroll::-webkit-scrollbar { height: 8px; }
  .scroll::-webkit-scrollbar-track { background: transparent; }
  .scroll::-webkit-scrollbar-thumb {
    background: rgba(148, 148, 148, 0.55);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  .scroll::-webkit-scrollbar-thumb:hover {
    background-color: rgba(170, 170, 170, 0.85);
    background-clip: content-box;
  }
  .scroll::-webkit-scrollbar-corner { background: transparent; }
`

// Single style for the transport buttons (40x40 — wireframe v1.5.0)
const TRANSPORT_BTN_CLASS =
  'w-10 h-10 flex items-center justify-center bg-retro-box border border-retro-black rounded hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed'

// Width (in px) of the export start/end marks on the waveform — converted
// to seconds on every redraw according to the current scale (px/s).
const EXPORT_MARK_PX = 6

// Time ruler (Premiere style — wireframe v1.6.0): label + big tick every
// 10s, small tick every 5s. The positions are % of the duration, so they don't
// depend on the px/s scale (which changes with the strip's fill/scroll).
const fmtTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Transport clock (hh:mm:ss): current position / total duration
const fmtHMS = (s) => {
  const total = Math.max(0, Math.floor(s))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Audio panel (wireframe 1.11.0): MAIN box with the SHARED ruler at the top
// of the voice column + brother box for the music (ducking) right below — both
// with a dB gutter, same px/s scale, locked scroll and a playhead crossing
// the tracks (NLE style: Premiere/Vegas/CapCut). The music is only VISUAL at
// this stage (scale + scroll + chip); the mix (preview duck, export sidechain)
// arrives in phases 2/3.
function Waveform({
  selectedFile,
  onTimeUpdate,
  seekTo,
  videoRef,
  waveSurferRef,
  processing,
  generatingSubtitles,
  playRequest,
  onPlayer,
  shapeCfg,
  exportRange,
  selectedMarker,
  onSelectMarker,
  onDurationChange,
  // --- 1.11.0: music track + dB gutters ---
  duckingEnabled,
  musicFile,
  musicDb,
  onMusicDbChange,
  onPickMusic,
  onRemoveMusic,
  fadeOut,
  onFadeOutChange,
  voiceDb,
  onVoiceDbChange,
  trackDisabled,
}) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  // Regions plugin (export I/O marks) — created together with the wavesurfer
  const regionsRef = useRef(null)
  // Marks callback always "fresh" in the handler (the wavesurfer effect
  // only runs on file/theme change)
  const onSelectMarkerRef = useRef(onSelectMarker)
  onSelectMarkerRef.current = onSelectMarker
  const { theme } = useTheme()
  const { t } = useLang()
  const [ready, setReady] = useState(false)
  const [showReady, setShowReady] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  // Timeline length up to the App (the music bed's final fade measures against
  // it). Through refs: the parent setState must not re-fire on every render.
  const onDurationChangeRef = useRef(onDurationChange)
  onDurationChangeRef.current = onDurationChange
  const sentDurRef = useRef(0)
  const [rulerW, setRulerW] = useState(0)
  const [curTime, setCurTime] = useState(0)
  const rulerInnerRef = useRef(null)
  const playheadRef = useRef(null)
  const durationRef = useRef(0)
  // v1.8.0: the A/B preview is done in REAL TIME (Web Audio inside the player) —
  // the audio source never switches anymore; the position only needs to survive
  // wavesurfer recreation (theme/file change).
  const lastTimeRef = useRef(0) // last known transport position
  const lastFileRef = useRef(null) // file that "holds" the current position
  const restoreTimeRef = useRef(0) // position to restore on the next 'ready'
  const pendingPlayRef = useRef(false) // play requested before wavesurfer becomes ready
  const appliedSeekRef = useRef(null) // last seekTo already applied (avoids reapplying on 'ready')
  const followAfterRef = useRef(0) // earliest moment a follow may run (throttle + suspension)
  const lastClockPushRef = useRef(0) // last time currentTime was pushed to the App (20 Hz)
  const followSelfUntilRef = useRef(0) // window in which a scroll is the follow's own
  const FOLLOW_INTERVAL_MS = 250 // the follow runs at most 4x/s while playing
  const FOLLOW_SUSPEND_MS = 3000 // after the user scrolls by hand, the follow stays quiet
  // v1.8.0: SHAPE of the waveform following the treatment (offline render → envelope)
  const shapeTokenRef = useRef(0) // discards renders of old cfgs
  const shapeTimerRef = useRef(null) // debounce of the offline render
  const shapeDrawnRef = useRef(null) // { ws, key } already drawn (avoids redoing)
  // --- 1.11.0: audio panel (main box + brother box for the music) ---
  const panelRef = useRef(null) // panel root (the mouse wheel scrolls the waves)
  const musicContainerRef = useRef(null) // music waveform area (WaveSurfer #2)
  const musicWsRef = useRef(null)
  const voicePlayheadRef = useRef(null) // vertical playhead line on the voice track
  const musicPlayheadRef = useRef(null) // same on the music track (passed to MusicTrack)
  const scrollLeftRef = useRef(0) // current horizontal scroll (updates the track playheads)
  const rulerWRef = useRef(0) // ruler width in px (the state setter also feeds the ref)

  // applyRulerW: single entry point for the ruler width — keeps the ref in
  // sync so the track playheads can compute without waiting for a re-render.
  const applyRulerW = (w) => {
    rulerWRef.current = w
    setRulerW(w)
  }

  // Element with overflow-x that actually scrolls (inside the wavesurfer
  // Shadow DOM) — the ruler follows the scroll through it.
  const getScroller = () => {
    const host = containerRef.current && containerRef.current.firstElementChild
    const shadow = host && host.shadowRoot
    return (shadow && shadow.querySelector('.scroll')) || null
  }

  // Same .scroll as the music track (2nd wavesurfer's shadow) — its scroll is
  // a MIRROR of the voice's (shared ruler: both move together).
  const getMusicScroller = () => {
    const host = musicContainerRef.current && musicContainerRef.current.firstElementChild
    const shadow = host && host.shadowRoot
    return (shadow && shadow.querySelector('.scroll')) || null
  }

  // Position of the playhead line on the ruler (% of duration — no re-render)
  const updatePlayhead = (time) => {
    const d = durationRef.current
    if (playheadRef.current && d > 0) {
      playheadRef.current.style.left = `${Math.min(100, (time / d) * 100)}%`
    }
    updateRowsPlayhead(time)
  }

  // Playhead CONTINUOUS crossing the tracks (voice and music): the line lives
  // inside each waveform area (time origin = waveform origin) and moves at
  // px = time/duration × ruler width − scrollLeft (same math as the ruler,
  // translated by the same scrollLeft). Hides when out of the area.
  const updateRowsPlayhead = (time) => {
    const d = durationRef.current
    const w = rulerWRef.current
    const x = d > 0 && w > 0 ? (time / d) * w - scrollLeftRef.current : null
    for (const el of [voicePlayheadRef.current, musicPlayheadRef.current]) {
      if (!el) continue
      if (x === null) {
        el.style.opacity = '0'
        continue
      }
      const vw = el.parentElement ? el.parentElement.clientWidth : w
      el.style.opacity = x >= 0 && x <= vw ? '1' : '0'
      el.style.transform = `translateX(${x}px)`
    }
  }

  // Transport hh:mm:ss clock: only re-renders when the second changes
  const syncClock = (time) => {
    const sec = Math.floor(time)
    setCurTime((prev) => (prev === sec ? prev : sec))
  }

  useEffect(() => {
    if (!selectedFile || !containerRef.current) {
      if (wsRef.current) {
        wsRef.current.pause()
        wsRef.current.destroy()
        wsRef.current = null
      }
      durationRef.current = 0
      setDuration(0)
      applyRulerW(0)
      setCurTime(0)
      lastFileRef.current = null
      lastTimeRef.current = 0
      scrollLeftRef.current = 0
      return
    }

    setReady(false)
    setShowReady(false)
    setFadingOut(false)
    setPlaying(false)
    durationRef.current = 0
    setDuration(0)
    setCurTime(0)
    // Ruler measurement resets too: the music track (shared scale) only
    // recreates once the new width is measured on 'ready'.
    applyRulerW(0)
    // Same file (e.g., theme change): the transport position survives
    // wavesurfer recreation; a new file starts at 0.
    const sameFile = lastFileRef.current === selectedFile.path
    restoreTimeRef.current = sameFile ? lastTimeRef.current : 0
    lastFileRef.current = selectedFile.path
    if (!sameFile) appliedSeekRef.current = null
    let detachScroll = () => {}

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: theme === 'modern' ? '#3f3f46' : '#4a5568',
      progressColor: theme === 'modern' ? '#9B30FF' : '#22c55e',
      cursorColor: theme === 'modern' ? '#e8e8ea' : '#1a1a1a',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      // Fixed at the container's 80px floor — NOT 'auto': that mode reads
      // parent.clientHeight back on every resize redraw, and on a long file
      // the horizontal scrollbar (+8px inside .scroll) makes the container
      // grow again on each cycle — an unbounded loop that crushes the boxes
      // above (small files never scroll, hence they never grow).
      // Width changes (window resize) still trigger the redraw as before.
      height: 80,
      minPxPerSec: MIN_PX_PER_SEC,
      normalize: true,
      backend: 'WebAudio',
      // The app draws its own playhead lines (updateRowsPlayhead), so wavesurfer
      // chasing the view on every frame was pure cost: autoScroll/autoCenter
      // rewrite the canvas layer's clipPath AND scroll the strip every
      // animation frame, which makes the renderer draw up to 3 new canvases at
      // each canvas boundary (and wipe the cache after 10). The view now stays
      // where the user left it; scrolling is manual, like the editor panels.
      autoScroll: false,
      autoCenter: false,
    })
    // wavesurfer sizes EVERY canvas at window.devicePixelRatio with no ceiling
    // (utils.getPixelRatio = max(1, dpr)), so a 2x/3x screen pays 4-9x the fill
    // rate per redraw — and redraws happen on every scroll boundary. The wave is
    // a bar graph, where 1.5x is visually indistinguishable, so cap it. Private
    // method (TS-private, present at runtime); re-check on a wavesurfer upgrade.
    capPixelRatio(ws)

    // Styles the native scrollbar of .scroll (wavesurfer's shadow root)
    const host = containerRef.current && containerRef.current.firstElementChild
    const shadow = host && host.shadowRoot
    if (shadow && !shadow.querySelector('style[data-ws-scrollbar]')) {
      const styleEl = document.createElement('style')
      styleEl.setAttribute('data-ws-scrollbar', '')
      styleEl.textContent = WS_SCROLLBAR_CSS
      shadow.appendChild(styleEl)
    }

    // The video is silent — wavesurfer is the audio output of the whole app. The
    // 🎤 treatment happens ON THIS side (real-time Web Audio), so the
    // source is always the original file.
    ws.load(`file:///${selectedFile.path.replace(/\\/g, '/')}`)

    // --- Export I/O marks (Regions) ---------------------------------
    // Thin marker at each end + shaded band between the two (when
    // start AND end exist). The band only PAINTS — clicking it still
    // performs a seek; the mark is what selects (Delete removes the selected one).
    const regions = ws.registerPlugin(RegionsPlugin.create())
    regionsRef.current = regions
    regions.on('region-clicked', (region, e) => {
      if (region.id === 'expIn' || region.id === 'expOut') {
        e.stopPropagation()
        onSelectMarkerRef.current?.(region.id === 'expIn' ? 'start' : 'end')
      }
    })
    // The band is purely visual: without pointer-events a click on it falls on the
    // waveform and performs a seek (its marker stays on top, selectable).
    regions.on('region-created', (region) => {
      if (region.id === 'expBand' && region.element) {
        region.element.style.pointerEvents = 'none'
      }
    })

    ws.on('ready', () => {
      setReady(true)
      setShowReady(true)
      applyMaxPeak(ws)
      const d = ws.getDuration() || 0
      durationRef.current = d
      setDuration(d)
      // Restores the position when wavesurfer is recreated (doesn't touch a new file)
      const restore = restoreTimeRef.current
      if (restore > 0 && (!d || restore < d)) {
        ws.setTime(restore)
        lastTimeRef.current = restore
        updatePlayhead(restore)
        syncClock(restore)
      }
      // Play requested before wavesurfer becomes ready (modal A/B preview)
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false
        ws.play()
        if (videoRef?.current) videoRef.current.play()
      }
      // Ruler: follows the horizontal scroll of the strip (.scroll of the shadow DOM)
      const scroller = getScroller()
      if (scroller) {
        const onScroll = () => {
          scrollLeftRef.current = scroller.scrollLeft
          if (rulerInnerRef.current) {
            rulerInnerRef.current.style.transform = `translateX(${-scroller.scrollLeft}px)`
          }
          // Music track mirrors the SAME scroll (shared ruler)
          const ms = getMusicScroller()
          if (ms && ms.scrollLeft !== scroller.scrollLeft) ms.scrollLeft = scroller.scrollLeft
          updateRowsPlayhead(lastTimeRef.current)
          // A scroll the USER made (wheel, scrollbar) suspends the playhead
          // follow, so it never fights them. The follow's own jump is excluded
          // by its own short window.
          if (performance.now() >= followSelfUntilRef.current) {
            followAfterRef.current = performance.now() + FOLLOW_SUSPEND_MS
          }
        }
        scroller.addEventListener('scroll', onScroll)
        onScroll()
        detachScroll = () => scroller.removeEventListener('scroll', onScroll)
      }
      // Ruler width = actual width of the wavesurfer wrapper (measured on the
      // next frame, after wavesurfer itself finishes the layout)
      requestAnimationFrame(() => {
        if (wsRef.current !== ws) return
        const wrapper = ws.getWrapper()
        if (wrapper) applyRulerW(wrapper.offsetWidth)
      })
    })

    ws.on('play', () => {
      setPlaying(true)
      musicPreview.play(ws.getCurrentTime())
    })
    ws.on('pause', () => {
      setPlaying(false)
      musicPreview.pause()
    })
    ws.on('finish', () => {
      setPlaying(false)
      musicPreview.pause()
      if (videoRef?.current) videoRef.current.pause()
    })

      // Follows the playhead while playing, at 4 Hz and ONLY when it approaches the
  // edge of the view. wavesurfer's own autoCenter scrolled on every animation
  // frame, which made the renderer draw new canvases at every boundary (and wipe
  // its cache after 10); doing it here cuts that cost by ~15x and still keeps the
  // playhead visible. Scrolling by hand is never fought: inside the view nothing
  // moves, and one jump only happens when the playhead would leave the screen.
  const followPlayhead = (time, ws) => {
    const d = durationRef.current
    const scroller = getScroller()
    if (!ws || !scroller || !(d > 0) || !ws.isPlaying()) return
    const now = performance.now()
    // Throttle (4 Hz) and the suspension after a manual scroll share this gate.
    if (now < followAfterRef.current) return
    const totalW = ws.getWrapper() ? ws.getWrapper().offsetWidth : 0
    const viewW = scroller.clientWidth
    if (!(totalW > viewW)) return // fits entirely: nothing to follow
    const x = (time / d) * totalW
    const left = scroller.scrollLeft
    const margin = viewW * 0.15
    if (x > left + margin && x < left + viewW - margin) return // still comfortably visible
    followAfterRef.current = now + FOLLOW_INTERVAL_MS
    const target = Math.min(
      Math.max(0, x - viewW / 2),
      Math.max(0, totalW - viewW),
    )
    if (Math.abs(target - left) > 2) {
      followSelfUntilRef.current = now + 200
      ws.setScroll(target)
    }
  }

  ws.on('timeupdate', (time) => {
      lastTimeRef.current = time
      // The App re-renders its WHOLE tree on currentTime, and timeupdate fires
      // every animation frame: 60 full reconciliations per second while media
      // plays. The subtitle overlay keeps a frame-accurate clock of its own
      // (DropZone listens to this same instance), so the panels can live with
      // 20 Hz — the word switch still lands within 50ms, imperceptible, and the
      // panels/controls do a third of the work.
      const nowMs = performance.now()
      if (nowMs - lastClockPushRef.current >= 50) {
        lastClockPushRef.current = nowMs
        if (onTimeUpdate) onTimeUpdate(time)
      }
      updatePlayhead(time)
      followPlayhead(time, ws)
      syncClock(time)
      musicPreview.sync(time)
    })

    ws.on('seeking', (time) => {
      lastTimeRef.current = time
      if (videoRef?.current) videoRef.current.currentTime = time
      updatePlayhead(time)
      syncClock(time)
      musicPreview.seek(time)
    })

    wsRef.current = ws
    if (waveSurferRef) waveSurferRef.current = ws
    // v1.8.0: hands the player (WebAudioPlayer) over so the realtime preview
    // chain can connect to its AudioContext.
    if (onPlayer) onPlayer(ws.getMediaElement())

    return () => {
      detachScroll()
      ws.pause()
      musicPreview.pause()
      ws.destroy()
      wsRef.current = null
      regionsRef.current = null
      if (waveSurferRef) waveSurferRef.current = null
      if (onPlayer) onPlayer(null)
    }
  }, [selectedFile, theme])

  // --- Export regions: rebuilds the marks on every change -------------------
  // Redraws from scratch: thin start/end marks + shaded band when
  // BOTH exist. Deps: marks/selection (state), ready (waveform decoded)
  // and rulerW (wrapper width changed → the mark's width in SECONDS changes).
  useEffect(() => {
    const regions = regionsRef.current
    const ws = wsRef.current
    if (!regions || !ws || !ready || !exportRange) return
    const d = durationRef.current
    if (!d) return

    for (const r of [...regions.getRegions()]) {
      if (r.id === 'expIn' || r.id === 'expOut' || r.id === 'expBand') r.remove()
    }

    const wrapper = ws.getWrapper()
    const wrapperW = wrapper ? wrapper.offsetWidth : 0
    // px → seconds using the current scale (6px mark on the waveform)
    const lineSec = wrapperW > 0 ? (EXPORT_MARK_PX * d) / wrapperW : d * 0.01
    const { start, end } = exportRange

    if (start != null && end != null && end > start) {
      const band = regions.addRegion({
        id: 'expBand',
        start,
        end,
        drag: false,
        resize: false,
        color: 'rgba(250, 204, 21, 0.22)',
      })
      if (band.element) band.element.style.pointerEvents = 'none'
    }
    if (start != null) {
      regions.addRegion({
        id: 'expIn',
        start,
        end: Math.min(d, start + lineSec),
        drag: false,
        resize: false,
        color: selectedMarker === 'start' ? '#166534' : 'rgba(22, 163, 74, 0.9)',
      })
    }
    if (end != null) {
      regions.addRegion({
        id: 'expOut',
        start: Math.max(0, end - lineSec),
        end,
        drag: false,
        resize: false,
        color: selectedMarker === 'end' ? '#991b1b' : 'rgba(220, 38, 38, 0.9)',
      })
    }
  }, [exportRange, selectedMarker, ready, rulerW])

  // v1.8.0: the SHAPE of the waveform follows what is being HEARD — when the
  // preview is treated, the SAME chain runs offline (realtimeChain.
  // renderEnvelope) and the peaks are redrawn. Nothing touches the player or
  // playback; the original side (or 🎤 off) goes back to the original file's shape.
  // Debounce: only redoes when the cfg stops changing (preset/settings/A-B).
  useEffect(() => {
    const ws = wsRef.current
    const token = ++shapeTokenRef.current
    clearTimeout(shapeTimerRef.current)
    if (!ready || !ws) return
    const decoded = ws.getDecodedData()
    if (!decoded) return
    const key = shapeCfg ? JSON.stringify(shapeCfg) : 'original'
    if (shapeDrawnRef.current && shapeDrawnRef.current.ws === ws && shapeDrawnRef.current.key === key) return

    const draw = (env) => {
      const renderer = ws.renderer
      if (!renderer || typeof renderer.render !== 'function') return
      try {
        if (env) {
          // "Fake" buffer: the renderer maps array↔width by duration —
          // the envelope stretched to the real duration becomes the shape.
          const dur = decoded.duration || 0
          renderer.render({
            duration: dur,
            length: env[0].length,
            sampleRate: dur > 0 ? env[0].length / dur : 48000,
            numberOfChannels: env.length,
            getChannelData: (i) => env[i] || env[0],
          })
        } else if (renderer.audioData !== decoded) {
          renderer.render(decoded)
        }
        // repaints cursor/fill at the current position (without playing)
        try {
          ws.updateProgress()
        } catch {
          // no progress yet — ok
        }
        shapeDrawnRef.current = { ws, key }
      } catch (e) {
        console.warn('[forma] falha ao redesenhar a onda:', e)
      }
    }

    if (!shapeCfg) {
      draw(null)
      return
    }
    shapeTimerRef.current = setTimeout(() => {
      realtimeChain
        .renderEnvelope(decoded, shapeCfg, () => shapeTokenRef.current !== token)
        .then((env) => {
          if (shapeTokenRef.current !== token || wsRef.current !== ws) return
          if (env) draw(env)
        })
    }, 350)
    return () => clearTimeout(shapeTimerRef.current)
  }, [shapeCfg, ready])

  // --- 1.11.0: music waveform (2nd track of ducking) ------------------------
  // SHARED SCALE: the music is drawn on the VIDEO's timeline (ruler px/s),
  // not on its own width — fillParent:false + minPxPerSec = the real scale.
  // Music longer than the video cuts at the edge; shorter leaves empty space
  // on the right (the export's -stream_loop fills that). Default backend
  // (MediaElement): only decodes via fetch to draw, no extra AudioContext —
  // playback + ducking live in musicPreview (phase 2).
  const scaleReady = rulerW > 0 && duration > 0
  const pxPerSec = scaleReady ? rulerW / duration : 0

  // Extended bed strip (phase A): the audio loops for the WHOLE timeline, so
  // the music row paints the bed REPEATED up to the end instead of stopping at
  // the file's own length — which also left the row narrower than the voice
  // strip, so the shared scroll clamped and the two tracks drifted apart.
  // DISPLAY ONLY: the rendered wave is snapshotted into one bitmap and repeated
  // with a CSS background (any number of copies, cheap), plus a thin tick at
  // every loop seam — the wrap point the export joins with acrossfade. The
  // nodes live inside wavesurfer's wrapper (shadow root), so they scroll with
  // the strip for free.
  const musicOverlayRef = useRef([])
  const musicPaintTimerRef = useRef(0)
  const musicBlobUrlRef = useRef('')
  const musicPaintGenRef = useRef(0)
  const clearMusicOverlay = () => {
    // Bumps the generation: a toBlob still in flight must not append its node.
    musicPaintGenRef.current++
    musicOverlayRef.current.forEach((n) => n.remove())
    musicOverlayRef.current = []
    if (musicBlobUrlRef.current) {
      URL.revokeObjectURL(musicBlobUrlRef.current)
      musicBlobUrlRef.current = ''
    }
  }
  const paintMusicOverlay = () => {
    clearMusicOverlay()
    const mws = musicWsRef.current
    if (!mws || !(duration > 0) || !(rulerW > 0)) return
    const mdur = mws.getDuration()
    if (!Number.isFinite(mdur) || mdur <= 0) return
    const pxPerSec = rulerW / duration
    const stripW = mdur * pxPerSec
    if (!(stripW > 0)) return
    const wrapper = mws.getWrapper()
    if (!wrapper) return
    // The row spans the voice strip's own width: same px/s, same scroll range
    wrapper.style.width = `${duration * pxPerSec}px`
    const root = wrapper.getRootNode ? wrapper.getRootNode() : null
    const canvasesWrap = root && root.querySelector ? root.querySelector('.canvases') : null
    if (!canvasesWrap) return
    const sources = canvasesWrap.querySelectorAll('canvas')
    if (!sources.length) return
    const dpr = window.devicePixelRatio || 1
    const base = canvasesWrap.getBoundingClientRect()
    // Absolute boxes DON'T stretch: width/height must be explicit (an abs child
    // with left:0 and no right/width is 0px wide, and height:100% against an
    // auto-height parent collapses to 0 — the repeat would paint nothing).
    const rowW = Math.max(1, Math.round(duration * pxPerSec))
    const rowH = Math.max(1, Math.round(base.height))
    const snap = document.createElement('canvas')
    snap.width = Math.max(1, Math.round(stripW * dpr))
    snap.height = Math.max(1, Math.round(rowH * dpr))
    const sctx = snap.getContext('2d')
    if (!sctx) return
    sources.forEach((c) => {
      const holder = c.parentElement || c
      const r = holder.getBoundingClientRect()
      sctx.drawImage(c, Math.round((r.left - base.left) * dpr), Math.round((r.top - base.top) * dpr))
    })
    const repeat = document.createElement('div')
    repeat.style.cssText =
      `position:absolute;top:0;left:0;width:${rowW}px;height:${rowH}px;pointer-events:none;` +
      `background-repeat:repeat-x;background-size:${stripW.toFixed(2)}px ${rowH}px;`
    const gen = ++musicPaintGenRef.current
    // toDataURL encodes the PNG synchronously on the main thread and then stores
    // a base64 string in the style attribute; toBlob encodes off the render path
    // and the object URL keeps that giant string out of the DOM. The generation
    // guard drops the result when the overlay was cleared meanwhile (fast resize).
    snap.toBlob((blob) => {
      if (!blob || gen !== musicPaintGenRef.current) return
      const url = URL.createObjectURL(blob)
      if (gen !== musicPaintGenRef.current) { URL.revokeObjectURL(url); return }
      repeat.style.backgroundImage = `url(${url})`
      if (musicBlobUrlRef.current) URL.revokeObjectURL(musicBlobUrlRef.current)
      musicBlobUrlRef.current = url
      wrapper.appendChild(repeat)
      musicOverlayRef.current.push(repeat)
    }, 'image/png')
    const seams = Math.floor(duration / mdur)
    for (let k = 1; k <= seams; k++) {
      const seam = document.createElement('div')
      seam.style.cssText = `position:absolute;top:0;left:${(k * stripW).toFixed(2)}px;width:1px;height:${rowH}px;background:rgba(0,0,0,0.4);pointer-events:none;`
      wrapper.appendChild(seam)
      musicOverlayRef.current.push(seam)
    }
  }

  useEffect(() => {
    const container = musicContainerRef.current
    if (!duckingEnabled || !musicFile || !container || !scaleReady) {
      if (musicWsRef.current) {
        musicWsRef.current.destroy()
        musicWsRef.current = null
      }
      return
    }
    const scale = rulerW / duration
    const mws = WaveSurfer.create({
      container,
      waveColor: theme === 'modern' ? '#3f3f46' : '#4a5568',
      progressColor: theme === 'modern' ? '#9B30FF' : '#22c55e',
      cursorWidth: 0,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      // 'auto' = the row height (min-h 96px floor): the container is
      // absolutely positioned (inset-0), so its content can never feed back
      // into the parent's height — no scrollbar growth loop here, unlike the
      // in-flow voice container above.
      height: 'auto',
      minPxPerSec: scale,
      fillParent: false,
      hideScrollbar: true,
      interact: false,
      normalize: true,
    })
    capPixelRatio(mws)
    musicWsRef.current = mws
    // The renderer rebuilds the canvases and the wrapper width on every render
    // (zoom on window resize included) — repaint the repeated strip after each.
    mws.on('render', () => {
      clearTimeout(musicPaintTimerRef.current)
      musicPaintTimerRef.current = setTimeout(paintMusicOverlay, 0)
    })
    mws.load(`file:///${musicFile.path.replace(/\\/g, '/')}`).catch((e) =>
      console.warn('[music] failed to load:', e)
    )
    mws.on('ready', () => {
      if (musicWsRef.current !== mws) return
      applyMaxPeak(mws)
      // born already at the voice track's current scroll
      const vs = getScroller()
      const ms = getMusicScroller()
      if (vs && ms) ms.scrollLeft = vs.scrollLeft
      updateRowsPlayhead(lastTimeRef.current)
      paintMusicOverlay()
    })
    return () => {
      clearTimeout(musicPaintTimerRef.current)
      clearMusicOverlay()
      mws.destroy()
      if (musicWsRef.current === mws) musicWsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicFile, theme, duckingEnabled, scaleReady])

  // Window resize: the music re-renders on the SAME new voice scale
  // (zoom swaps minPxPerSec without recreating the instance).
  useEffect(() => {
    const mws = musicWsRef.current
    if (!mws || pxPerSec <= 0 || mws.options?.minPxPerSec === pxPerSec) return
    mws.zoom(pxPerSec)
    // the reRender touches the internal scroll — reconnect to the voice scroll
    requestAnimationFrame(() => {
      const vs = getScroller()
      const ms = getMusicScroller()
      if (vs && ms) ms.scrollLeft = vs.scrollLeft
      updateRowsPlayhead(lastTimeRef.current)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerSec])

  // Positions the track lines when the ruler/scale (or the music track)
  // show up — without waiting for the next timeupdate/scroll.
  useEffect(() => {
    updateRowsPlayhead(lastTimeRef.current)
    paintMusicOverlay() // the repeated strip follows the new px/s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rulerW, duration, musicFile, duckingEnabled])

  // Timeline length up to the App (music bed's final fade reference)
  useEffect(() => {
    if (duration === sentDurRef.current) return
    sentDurRef.current = duration
    if (onDurationChangeRef.current) onDurationChangeRef.current(duration)
  }, [duration])

  // Horizontal scroll with the mouse wheel: wavesurfer's inner strip only
  // scrolls horizontally via Shift+wheel or the scrollbar; here the normal
  // vertical wheel also moves the strip. Attached to the PANEL ROOT (main box
  // + brother music box) so it also responds over the ruler, the gutters and
  // BOTH tracks.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onWheel = (e) => {
      const ws = wsRef.current
      if (!ws) return
      // Already a horizontal event (trackpad): let the browser handle it
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const wrapper = ws.getWrapper()
      // No scroll when the strip fits in the container (short audio)
      if (!wrapper || wrapper.offsetWidth <= containerRef.current.clientWidth) return
      e.preventDefault()
      ws.setScroll(ws.getScroll() + e.deltaY)
    }
    panel.addEventListener('wheel', onWheel, { passive: false })
    return () => panel.removeEventListener('wheel', onWheel)
  }, [])

  // The ruler width follows the strip's width: when the window changes
  // (700 <-> 960 with subtitles) wavesurfer re-lays-out and the wrapper changes.
  // The rAF guarantees the measurement AFTER wavesurfer itself processes the resize.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // Debounced: a window drag fires the observer on every frame, and each tick
    // cascaded into setRulerW -> music zoom -> strip repaint (a PNG encode
    // before). wavesurfer re-lays-out on its own schedule, so the ruler only has
    // to catch up once the size settles.
    let timer = 0
    let raf = 0
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => {
          const ws = wsRef.current
          const wrapper = ws && ws.getWrapper()
          if (wrapper) applyRulerW(wrapper.offsetWidth)
        })
      }, 120)
    })
    ro.observe(container)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!showReady || fadingOut) return
    const timer = setTimeout(() => setFadingOut(true), 2000)
    return () => clearTimeout(timer)
  }, [showReady, fadingOut])

  useEffect(() => {
    if (!fadingOut) return
    const timer = setTimeout(() => setShowReady(false), 1000)
    return () => clearTimeout(timer)
  }, [fadingOut])

  useEffect(() => {
    if (seekTo === null) {
      appliedSeekRef.current = null
      return
    }
    // Applies each seekTo ONCE: on the 'ready' of a source reload (🎤/A-B) the
    // position goes back to the transport's, not the panel's last click.
    if (appliedSeekRef.current === seekTo) return
    if (wsRef.current && ready) {
      appliedSeekRef.current = seekTo
      lastTimeRef.current = seekTo
      wsRef.current.setTime(seekTo)
    }
  }, [seekTo, ready])

  // v1.7.0: play requested by SoundConfigModal (A/B preview). If wavesurfer
  // is reloading the audio source, 'ready' consumes the intent; if it's
  // already ready, it plays right away.
  useEffect(() => {
    if (!playRequest) return
    if (wsRef.current && ready) {
      wsRef.current.play()
      if (videoRef?.current) videoRef.current.play()
    } else {
      pendingPlayRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playRequest])

  // DEDICATED buttons: [▶] only plays, [⏸] only pauses (the current state
  // is disabled, becoming an immediate visual read — wireframe v1.5.0).
  const handlePlay = (e) => {
    e.stopPropagation()
    if (wsRef.current) {
      wsRef.current.play()
    }
    if (videoRef?.current) {
      videoRef.current.play()
    }
  }

  const handlePause = (e) => {
    e.stopPropagation()
    if (wsRef.current) {
      wsRef.current.pause()
    }
    if (videoRef?.current) {
      videoRef.current.pause()
    }
  }

  const handleRestart = (e) => {
    e.stopPropagation()
    if (wsRef.current) {
      wsRef.current.setTime(0)
      wsRef.current.play()
    }
    if (videoRef?.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play()
    }
  }

  // Ruler positions: label/big tick every 10s, smaller tick every 5s. Memoized on
  // the duration: they were rebuilt inside the render body, and with a 1h file
  // that is ~1,000 tick nodes rebuilt on EVERY render (the App re-renders at
  // frame rate while media plays).
  const { rulerMajors, rulerMinors } = useMemo(() => {
    const majors = []
    const minors = []
    if (duration > 0) {
      for (let s = 0; s <= duration + 1e-6; s += 10) majors.push(s)
      for (let s = 5; s <= duration + 1e-6; s += 10) minors.push(s)
    }
    return { rulerMajors: majors, rulerMinors: minors }
  }, [duration])

  return (
    <div ref={panelRef} className="space-y-1">
      {/* MAIN box (brother of the music box below): the SHARED ruler is born
          inside the waveform column — the dB gutter takes the full height, no
          empty cell in the corner. Both tracks use the SAME px/s scale and
          the SAME scroll. Block layout with natural height (original v1.10.x
          spacings): the window itself grows for the music row (see
          WINDOW_DUCKING_EXTRA_HEIGHT), so nothing here ever compresses. */}
      <div className="w-full border-2 border-retro-black rounded bg-retro-bg shadow-retro p-2">
        {/* Track 1 — VOICE: dB gutter + waveform column with the ruler on top.
            The playhead is a SIBLING of the container — the container must stay
            free of React children, because wavesurfer is the firstElementChild
            of the Shadow DOM queries; the line's x origin is the waveform's */}
        <div className="flex">
          <DbGutter
            db={voiceDb}
            onChange={onVoiceDbChange}
            label={t('ducking.voiceDb')}
            disabled={trackDisabled}
          />
          <div className="relative flex-1 min-w-0 flex flex-col">
            {/* SHARED ruler (the brother music track uses the same scale and
                the same scroll — the time origin is this column's left edge,
                same on the music's dB column) */}
            <div className="relative w-full h-[16px] shrink-0 overflow-hidden select-none pointer-events-none">
              {duration > 0 && rulerW > 0 && (
                <div
                  ref={rulerInnerRef}
                  className="absolute top-0 left-0 h-full"
                  style={{ width: `${rulerW}px` }}
                >
                  {rulerMinors.map((s) => (
                    <div
                      key={`m${s}`}
                      className="absolute bottom-0 w-[1px] h-[3px] bg-retro-black/30"
                      style={{ left: `${(s / duration) * 100}%` }}
                    />
                  ))}
                  {rulerMajors.map((s) => (
                    <div
                      key={`M${s}`}
                      className="absolute top-0 bottom-0"
                      style={{ left: `${(s / duration) * 100}%` }}
                    >
                      <span className="absolute top-0 left-[2px] font-pixel text-[6px] leading-none text-retro-black/70 whitespace-nowrap">
                        {fmtTime(s)}
                      </span>
                      <span className="absolute bottom-0 left-0 w-[1px] h-[5px] bg-retro-black/50" />
                    </div>
                  ))}
                  {/* Export I/O marks: chip I = start, O = end (the dark
                      background marks which one is selected for Delete) */}
                  {exportRange?.start != null && (
                    <div
                      className="absolute top-0"
                      style={{ left: `${(exportRange.start / duration) * 100}%` }}
                    >
                      <span className={`font-pixel text-[6px] leading-none px-[2px] rounded-[2px] ${selectedMarker === 'start' ? 'bg-retro-black text-white' : 'bg-green-600 text-white'}`}>
                        I
                      </span>
                    </div>
                  )}
                  {exportRange?.end != null && (
                    <div
                      className="absolute top-0"
                      style={{ left: `${(exportRange.end / duration) * 100}%`, transform: 'translateX(-100%)' }}
                    >
                      <span className={`font-pixel text-[6px] leading-none px-[2px] rounded-[2px] ${selectedMarker === 'end' ? 'bg-retro-black text-white' : 'bg-red-600 text-white'}`}>
                        O
                      </span>
                    </div>
                  )}
                  <div
                    ref={playheadRef}
                    className="absolute top-0 bottom-0 w-[2px] bg-retro-black/80"
                    style={{ left: '0%' }}
                  />
                </div>
              )}
            </div>
            <div ref={containerRef} className="w-full min-h-[80px] rounded overflow-hidden" />
            {/* Playhead line: starts BELOW the ruler (which has its own) */}
            <div
              ref={voicePlayheadRef}
              className="absolute top-[16px] bottom-0 left-0 w-[2px] bg-retro-black/80 pointer-events-none z-20"
              style={{ opacity: 0 }}
            />
          </div>
        </div>
      </div>

      {/* Box 2 — MUSIC (ducking): BROTHER box of the main one (not its child)
          — shows only with ducking on */}
      {duckingEnabled && (
        <MusicTrack
          musicFile={musicFile}
          musicDb={musicDb}
          onMusicDbChange={onMusicDbChange}
          onPick={onPickMusic}
          onRemove={onRemoveMusic}
          waveContainerRef={musicContainerRef}
          playheadRef={musicPlayheadRef}
          disabled={trackDisabled}
          gutterLabel={t('ducking.musicDb')}
          fadeOut={fadeOut}
          onFadeOutChange={onFadeOutChange}
        />
      )}

      {/* Dedicated transport container (wireframe v1.5.0): clock
          hh:mm:ss on the left, centered buttons + Loading/Ready status
          aligned to the right */}
      <div className="relative w-full shrink-0 border-2 border-retro-black rounded bg-retro-bg shadow-retro p-2 flex items-center justify-center">
        <span className="absolute left-2 font-pixel text-[6px] text-retro-black/70 tabular-nums">
          {fmtHMS(curTime)}/{fmtHMS(duration)}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRestart}
            disabled={!ready || processing || generatingSubtitles}
            className={TRANSPORT_BTN_CLASS}
          >
            <svg className="w-5 h-5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6a4 4 0 1 1 1 2.5" />
              <polyline points="2,3 2,6 5,6" />
            </svg>
          </button>
          <button
            onClick={handlePlay}
            disabled={!ready || processing || generatingSubtitles || playing}
            className={TRANSPORT_BTN_CLASS}
          >
            <svg className="w-5 h-5 ml-0.5" viewBox="0 0 12 12" fill="currentColor">
              <polygon points="2,1 10,6 2,11" />
            </svg>
          </button>
          <button
            onClick={handlePause}
            disabled={!ready || processing || generatingSubtitles || !playing}
            className={TRANSPORT_BTN_CLASS}
          >
            <svg className="w-5 h-5" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1" width="3" height="10" />
              <rect x="7" y="1" width="3" height="10" />
            </svg>
          </button>
        </div>
        {selectedFile && !ready && (
          <span className="absolute right-2 font-pixel text-[6px] text-retro-black/40">{t('waveform.loading')}</span>
        )}
        {selectedFile && showReady && (
          <span className={`absolute right-2 font-pixel text-[6px] text-green-600 transition-opacity duration-1000 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}>{t('waveform.ready')}</span>
        )}
      </div>
    </div>
  )
}

export default Waveform
