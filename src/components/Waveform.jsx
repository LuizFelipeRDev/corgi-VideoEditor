import { useRef, useEffect, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { useTheme } from '../lib/theme'
import { useLang } from '../lib/i18n'
import realtimeChain from '../lib/realtimeChain'

// Rendered audio pixels per second. Keeps the MINIMUM density of
// ~0.5s per bar (barWidth 2 + barGap 1 = 3px; 3px / 6px-s = 0.5s): files
// longer than ~3min become a strip with horizontal scroll instead of being
// squeezed. Short ones (<= ~3min) keep filling the container as before.
const MIN_PX_PER_SEC = 6

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

function Waveform({ selectedFile, onTimeUpdate, seekTo, videoRef, waveSurferRef, processing, generatingSubtitles, playRequest, onPlayer, shapeCfg, exportRange, selectedMarker, onSelectMarker }) {
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
  // v1.8.0: SHAPE of the waveform following the treatment (offline render → envelope)
  const shapeTokenRef = useRef(0) // discards renders of old cfgs
  const shapeTimerRef = useRef(null) // debounce of the offline render
  const shapeDrawnRef = useRef(null) // { ws, key } already drawn (avoids redoing)

  // Element with overflow-x that actually scrolls (inside the wavesurfer
  // Shadow DOM) — the ruler follows the scroll through it.
  const getScroller = () => {
    const host = containerRef.current && containerRef.current.firstElementChild
    const shadow = host && host.shadowRoot
    return (shadow && shadow.querySelector('.scroll')) || null
  }

  // Position of the playhead line on the ruler (% of duration — no re-render)
  const updatePlayhead = (time) => {
    const d = durationRef.current
    if (playheadRef.current && d > 0) {
      playheadRef.current.style.left = `${Math.min(100, (time / d) * 100)}%`
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
      setRulerW(0)
      setCurTime(0)
      lastFileRef.current = null
      lastTimeRef.current = 0
      return
    }

    setReady(false)
    setShowReady(false)
    setFadingOut(false)
    setPlaying(false)
    durationRef.current = 0
    setDuration(0)
    setCurTime(0)
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
      height: 80,
      minPxPerSec: MIN_PX_PER_SEC,
      normalize: true,
      backend: 'WebAudio',
    })

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
          if (rulerInnerRef.current) {
            rulerInnerRef.current.style.transform = `translateX(${-scroller.scrollLeft}px)`
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
        if (wrapper) setRulerW(wrapper.offsetWidth)
      })
    })

    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => {
      setPlaying(false)
      if (videoRef?.current) videoRef.current.pause()
    })

    ws.on('timeupdate', (time) => {
      lastTimeRef.current = time
      if (onTimeUpdate) onTimeUpdate(time)
      updatePlayhead(time)
      syncClock(time)
    })

    ws.on('seeking', (time) => {
      lastTimeRef.current = time
      if (videoRef?.current) videoRef.current.currentTime = time
      updatePlayhead(time)
      syncClock(time)
    })

    wsRef.current = ws
    if (waveSurferRef) waveSurferRef.current = ws
    // v1.8.0: hands the player (WebAudioPlayer) over so the realtime preview
    // chain can connect to its AudioContext.
    if (onPlayer) onPlayer(ws.getMediaElement())

    return () => {
      detachScroll()
      ws.pause()
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

  // Horizontal scroll with the mouse wheel: wavesurfer's inner strip only
  // scrolls horizontally via Shift+wheel or the scrollbar; here the normal
  // vertical wheel also moves the strip. Attached to the PANEL (not the strip)
  // so it also responds over the time ruler above.
  useEffect(() => {
    const container = containerRef.current
    const panel = container && container.parentElement
    if (!panel) return
    const onWheel = (e) => {
      const ws = wsRef.current
      if (!ws) return
      // Already a horizontal event (trackpad): let the browser handle it
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const wrapper = ws.getWrapper()
      // No scroll when the strip fits in the container (short audio)
      if (!wrapper || wrapper.offsetWidth <= container.clientWidth) return
      e.preventDefault()
      ws.setScroll(ws.getScroll() + e.deltaY)
    }
    panel.addEventListener('wheel', onWheel, { passive: false })
    return () => panel.removeEventListener('wheel', onWheel)
  }, [])

  // The ruler width follows the strip's width: when the window changes
  // (640 <-> 900 with subtitles) wavesurfer re-lays-out and the wrapper changes.
  // The rAF guarantees the measurement AFTER wavesurfer itself processes the resize.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const ws = wsRef.current
        const wrapper = ws && ws.getWrapper()
        if (wrapper) setRulerW(wrapper.offsetWidth)
      })
    })
    ro.observe(container)
    return () => ro.disconnect()
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

  // Ruler positions: label/big tick every 10s, smaller tick every 5s
  const rulerMajors = []
  const rulerMinors = []
  if (duration > 0) {
    for (let s = 0; s <= duration + 1e-6; s += 10) rulerMajors.push(s)
    for (let s = 5; s <= duration + 1e-6; s += 10) rulerMinors.push(s)
  }

  return (
    <div className="space-y-1">
      <div className="w-full border-2 border-retro-black rounded bg-retro-bg shadow-retro p-2">
        {/* Time ruler Premiere style (v1.6.0): labels every 10s,
            10s/5s ticks and the playhead line — follows the strip's scroll */}
        <div className="relative w-full h-[16px] overflow-hidden select-none pointer-events-none">
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
                  <span className="absolute top-1 left-[2px] font-pixel text-[6px] leading-none text-retro-black/70 whitespace-nowrap">
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
      </div>

      {/* Dedicated transport container (wireframe v1.5.0): clock
          hh:mm:ss on the left, centered buttons + Loading/Ready status
          aligned to the right */}
      <div className="relative w-full border-2 border-retro-black rounded bg-retro-bg shadow-retro p-2 flex items-center justify-center">
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
