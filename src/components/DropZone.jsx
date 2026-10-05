import { useState, useEffect, useRef } from 'react'
import { IconPlayerPlayFilled, IconPlayerPauseFilled, IconPlayerStopFilled } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'
import SubtitleOverlay from './SubtitleOverlay'

// Fullscreen transport: idle time before the play/stop buttons fade out.
const FS_CONTROLS_HIDE_MS = 2000

// Glass button of the fullscreen control stack (same family as the close X, one
// step more transparent so the stack reads as a group).
const FS_BTN_CLASS = 'w-7 h-7 bg-white/10 hover:bg-white/30 backdrop-blur-md border border-white/30 rounded flex items-center justify-center text-white transition-colors'

// Bytes -> "20 MB" / "1.5 GB" (one decimal place only when it adds info)
const formatFileSize = (bytes) => {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = -1
  do {
    value /= 1024
    unit++
  } while (value >= 1024 && unit < units.length - 1)
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

// The stage is the area the frame must fit into; `container-type: size` turns
// it into a query container so the frame can be sized in CSS against BOTH axes.
const STAGE_STYLE = { containerType: 'size' }

// Frame of a FIXED ratio inside the stage, sized in pure CSS: `min()` picks the
// width that fits both axes and `aspect-ratio` derives the height, so the ratio
// is invariant at any window size (fullscreen included) and the frame is always
// exactly the video/canvas rect -> the overlay lands where the export puts it.
// A plain `aspect-ratio` + `max-height` does NOT work: Chromium clamps the
// height and the box silently loses the ratio (video letterboxed, overlay off).
const frameStyle = (ratioW, ratioH) => ({
  aspectRatio: `${ratioW} / ${ratioH}`,
  width: `min(100cqw, calc(100cqh * ${(ratioW / ratioH).toFixed(4)}))`,
  // The frame is the OUTPUT rect: black, like the export's pad=...:color=black.
  // object-contain leaves the video's leftover area transparent, so without
  // this the "phone" bars of a portrait 9:16 frame showed whatever the stage
  // was painted with (and with a dark stage they vanished completely).
  backgroundColor: '#000',
})

function DropZone({ selectedFile, setSelectedFile, processing, onTimeUpdate, seekTo, onClear, videoRef, waveSurferRef, subtitles, subtitleStyle, subtitlePosition, subtitleConfigs, positionMode, positionPercent, outputResolution, greenScreen, subtitlesEnabled, currentTime: currentTimeProp, wordsPerLine, linesCount, hMarginPct = 0 }) {
  const { t } = useLang()
  const [isDragOver, setIsDragOver] = useState(false)
  const [videoFullscreen, setVideoFullscreen] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const savedTimeRef = useRef(0)

  // Fullscreen transport (play/pause + stop). The state lives here because the
  // fullscreen player is mounted in this component, outside the Waveform.
  const [fsPlaying, setFsPlaying] = useState(false)
  const [fsControlsVisible, setFsControlsVisible] = useState(true)
  const fsHideTimerRef = useRef(null)

  const isVideo = selectedFile && /\.(mp4|mkv|mov|webm|avi)$/i.test(selectedFile.name)
  const isAudio = selectedFile && /\.(mp3|wav|flac|ogg|aac|m4a)$/i.test(selectedFile.name)

  // Frame-accurate clock for the subtitle overlay. The App pushes currentTime at
  // 20 Hz (that state re-renders its whole tree), which would step the word pops;
  // here the preview listens to the PLAYER directly, so the overlay animates at
  // frame rate while only this component re-renders — never the whole app. Falls
  // back to the video element's own timeupdate and, without a player, to the
  // App's value.
  const [playerTime, setPlayerTime] = useState(null)
  const playerWsRef = useRef(null)
  useEffect(() => {
    const ws = waveSurferRef?.current
    if (!ws || ws === playerWsRef.current) return undefined
    playerWsRef.current = ws
    const onTick = (t) => setPlayerTime(t)
    // wavesurfer's on() RETURNS its own unsubscribe (the API has no off(): the
    // EventEmitter exposes on/un/once), so the cleanup uses that instead of guessing
    // a method name.
    const unsubscribe = ws.on('timeupdate', onTick)
    return () => {
      unsubscribe()
      playerWsRef.current = null
    }
  })
  // New file → the old player's time is meaningless.
  useEffect(() => { setPlayerTime(null) }, [selectedFile?.path])

  const effectiveTime = playerTime !== null
    ? playerTime
    : (currentTimeProp !== undefined ? currentTimeProp : videoTime)

  // The SOUND always comes from the WaveSurfer: it decodes the audio of the very
  // same file (Waveform.jsx loads it), while the <video> elements are muted and
  // only draw the picture. So the fullscreen transport drives that same pair —
  // exactly like the Waveform buttons and the space key — and never unmutes the
  // video (that would double the audio).
  const fsIsPlayingNow = () => {
    const ws = waveSurferRef?.current
    if (ws) return ws.isPlaying()
    const v = videoRef?.current
    return !!v && !v.paused && !v.ended
  }

  // Any mouse movement brings the buttons back; they only fade out while the
  // media is playing — paused, they stay put (otherwise there would be no way to
  // press play again without moving the mouse).
  const showFsControls = () => {
    setFsControlsVisible(true)
    if (fsHideTimerRef.current) clearTimeout(fsHideTimerRef.current)
    fsHideTimerRef.current = setTimeout(() => {
      if (fsIsPlayingNow()) setFsControlsVisible(false)
    }, FS_CONTROLS_HIDE_MS)
  }

  const fsPause = () => {
    waveSurferRef?.current?.pause()
    videoRef?.current?.pause()
  }

  const fsTogglePlay = (e) => {
    e.stopPropagation()
    if (fsIsPlayingNow()) {
      fsPause()
    } else {
      waveSurferRef?.current?.play()
      videoRef?.current?.play()
    }
    showFsControls()
  }

  // Stop = pause and rewind to the beginning (the transport's restart button).
  const fsStop = (e) => {
    e.stopPropagation()
    fsPause()
    waveSurferRef?.current?.setTime(0)
    if (videoRef?.current) videoRef.current.currentTime = 0
    setFsPlaying(false)
    showFsControls()
  }

  // On entry the buttons show for FS_CONTROLS_HIDE_MS; while the fullscreen is
  // open the icon follows the real media state (it can change from the keyboard,
  // from the transport panel, or when the media ends on its own).
  useEffect(() => {
    if (!videoFullscreen) return undefined
    setFsPlaying(fsIsPlayingNow())
    showFsControls()
    const id = setInterval(() => setFsPlaying(fsIsPlayingNow()), 200)
    return () => {
      clearInterval(id)
      if (fsHideTimerRef.current) clearTimeout(fsHideTimerRef.current)
    }
  }, [videoFullscreen])

  // Intrinsic size of the loaded video, used as the frame ratio when the output
  // resolution is 'original' (the export then keeps the input resolution).
  const [videoDims, setVideoDims] = useState(null)
  useEffect(() => { setVideoDims(null) }, [selectedFile?.path])
  const handleLoadedMetadata = (e) => {
    const v = e.currentTarget
    if (v && v.videoWidth > 0 && v.videoHeight > 0) setVideoDims({ w: v.videoWidth, h: v.videoHeight })
  }

  // Video frame ratio: the OUTPUT frame when a resolution is picked (the very
  // rect the export burns), otherwise the source's own ratio.
  const videoRatio = outputResolution === 'portrait'
    ? [9, 16]
    : outputResolution === 'original'
      ? (videoDims ? [videoDims.w, videoDims.h] : [16, 9])
      : [16, 9]
  // Audio + subtitles canvas (green screen): always 16:9 / 9:16.
  const canvasRatio = outputResolution === 'portrait' ? [9, 16] : [16, 9]
  const videoFrameStyle = frameStyle(videoRatio[0], videoRatio[1])
  const canvasFrameStyle = { ...frameStyle(canvasRatio[0], canvasRatio[1]), backgroundColor: greenScreen ? '#00a800' : '#000' }

  useEffect(() => {
    if (videoRef.current && seekTo !== null) {
      videoRef.current.currentTime = seekTo
    }
  }, [seekTo])

  const handleClick = async () => {
    if (selectedFile || processing) return
    const p = await window.api.selectFile()
    if (p) {
      const size = await window.api.getFileSize?.(p)
      setSelectedFile({ path: p, name: p.split(/[/\\]/).pop(), folder: p.replace(/[\\/][^\\/]+$/, ''), size: typeof size === 'number' ? size : undefined })
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (processing) return
    const f = e.dataTransfer.files
    if (f.length > 0) {
      const filePath = window.api.getPathForFile(f[0])
      // The drag/drop File already carries the size in bytes — no IPC
      setSelectedFile({ path: filePath, name: f[0].name, folder: filePath.replace(/[\\/][^\\/]+$/, ''), size: f[0].size })
    } else {
      const p = await window.api.selectFile()
      if (p) {
        const size = await window.api.getFileSize?.(p)
        setSelectedFile({ path: p, name: p.split(/[/\\]/).pop(), folder: p.replace(/[\\/][^\\/]+$/, ''), size: typeof size === 'number' ? size : undefined })
      }
    }
  }

  const clearFile = (e) => {
    e.stopPropagation()
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }
    setSelectedFile(null)
    if (onClear) onClear()
  }

  const handleTimeUpdate = (e) => {
    setVideoTime(e.target.currentTime)
    if (onTimeUpdate) {
      onTimeUpdate(e.target.currentTime)
    }
  }

  return (
    <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
      <div
        onClick={!selectedFile ? handleClick : undefined}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg shadow-retro p-4 flex flex-col items-center justify-center cursor-pointer transition-all flex-1 relative overflow-hidden ${
          isDragOver
            ? 'drag-over'
            : selectedFile
              ? `border-green-600 ${isVideo ? 'bg-black' : 'bg-green-50'}`
              : 'border-retro-black bg-retro-bg hover:bg-green-50'
        }`}
      >
        {selectedFile && (
          <button
            onClick={clearFile}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 border border-red-700 rounded flex items-center justify-center text-white text-[10px] font-bold hover:bg-red-600 z-10"
            title={t('dropzone.clear')}
          >
            ✕
          </button>
        )}

        {!selectedFile ? (
          <div id="dropContent">
            <svg className="w-10 h-10 mx-auto mb-2 text-retro-black opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <p className="font-pixel text-[8px] text-retro-black text-center leading-loose">
              DROP AUDIO / VIDEO<br/>
              <span className="text-[7px] opacity-60">{t('dropzone.orClickHere')}</span>
            </p>
          </div>
        ) : isVideo && !videoFullscreen ? (
          <div
            style={STAGE_STYLE}
            className={`min-h-0 w-full h-full flex items-center justify-center overflow-hidden relative ${outputResolution === 'portrait' ? 'dropzone-letterbox' : ''}`}
          >
            {/* The frame IS the video rect (ratio fixed in CSS at every window
                size), so the overlay lands where the export puts it. */}
            <div className="relative" style={videoFrameStyle}>
              <video
                ref={videoRef}
                src={`file:///${selectedFile.path.replace(/\\/g, '/')}`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                muted
                className="w-full h-full object-contain rounded"
              />
              {subtitles && subtitles.length > 0 && (
                <SubtitleOverlay
                  subtitles={subtitles}
                  subtitleStyle={subtitleStyle}
                  subtitlePosition={subtitlePosition}
                  subtitleConfigs={subtitleConfigs}
                  currentTime={effectiveTime}
                  positionMode={positionMode}
                  positionPercent={positionPercent}
                  outputResolution={outputResolution}
                  wordsPerLine={wordsPerLine}
                  linesCount={linesCount}
                  hMarginPct={hMarginPct}
                />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (videoRef.current) {
                    savedTimeRef.current = videoRef.current.currentTime
                    const wasPlaying = !videoRef.current.paused
                    setVideoFullscreen(true)
                    setTimeout(() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = savedTimeRef.current
                        if (wasPlaying) {
                          videoRef.current.play()
                        } else {
                          if (waveSurferRef?.current) waveSurferRef.current.play()
                          videoRef.current.play()
                        }
                      }
                    }, 100)
                  }
                }}
                className="absolute bottom-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 border border-white/20 rounded flex items-center justify-center text-white text-[10px] transition-colors z-10"
                title={t('dropzone.fullscreen')}
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" />
                </svg>
              </button>
            </div>
          </div>
        ) : isAudio && subtitlesEnabled ? (
          <div
            style={STAGE_STYLE}
            className="min-h-0 w-full h-full flex items-center justify-center overflow-hidden relative"
          >
            <div className="relative" style={canvasFrameStyle}>
            {subtitles && subtitles.length > 0 && (
                <SubtitleOverlay
                  subtitles={subtitles}
                  subtitleStyle={subtitleStyle}
                  subtitlePosition={subtitlePosition}
                  subtitleConfigs={subtitleConfigs}
                  currentTime={effectiveTime}
                  positionMode={positionMode}
                  positionPercent={positionPercent}
                  outputResolution={outputResolution}
                  wordsPerLine={wordsPerLine}
                  linesCount={linesCount}
                  hMarginPct={hMarginPct}
                />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setVideoFullscreen(true)
                  setTimeout(() => {
                    if (waveSurferRef?.current) waveSurferRef.current.play()
                  }, 100)
                }}
                className="absolute bottom-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 border border-white/20 rounded flex items-center justify-center text-white text-[10px] transition-colors z-10"
                title={t('dropzone.fullscreen')}
              >
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" />
                </svg>
              </button>
            </div>
          </div>
        ) : isAudio ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <svg className="w-12 h-12 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <p className="font-pixel text-[8px] text-green-700">{selectedFile.name}</p>
            <p className="font-pixel text-[6px] text-retro-black/40">{t('dropzone.usePlayerBelow')}</p>
          </div>
        ) : (
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto mb-1 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
            </svg>
            <p className="font-pixel text-[7px] text-green-700">{selectedFile.name}</p>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1.5 shrink-0">
        <div className="flex justify-between items-center border-b border-retro-black/20 pb-1">
          <span className="font-pixel text-[7px] text-retro-black/60">{t('dropzone.name')}</span>
          <span className="font-pixel text-[7px] text-retro-black">{selectedFile?.name || '—'}</span>
        </div>
        <div className="flex justify-between items-center border-b border-retro-black/20 pb-1">
          <span className="font-pixel text-[7px] text-retro-black/60">{t('dropzone.size')}</span>
          <span className="font-pixel text-[7px] text-retro-black">{formatFileSize(selectedFile?.size)}</span>
        </div>
      </div>

      {videoFullscreen && selectedFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: outputResolution === 'portrait' ? 'rgb(var(--c-box))' : '#000' }}
          onMouseMove={showFsControls}
          onClick={() => {
            if (videoRef.current) {
              savedTimeRef.current = videoRef.current.currentTime
              videoRef.current.pause()
            }
            if (waveSurferRef?.current) waveSurferRef.current.pause()
            setVideoFullscreen(false)
            setTimeout(() => {
              if (videoRef.current) videoRef.current.currentTime = savedTimeRef.current
            }, 100)
          }}
        >
          {isVideo ? (
            <div style={STAGE_STYLE} className="w-full h-full flex items-center justify-center">
              <div className="relative" style={videoFrameStyle}>
                <video
                  ref={videoRef}
                  src={`file:///${selectedFile.path.replace(/\\/g, '/')}`}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  muted
                  autoPlay
                  className="w-full h-full object-contain"
                />
                {subtitles && subtitles.length > 0 && (
                  <SubtitleOverlay
                    subtitles={subtitles}
                    subtitleStyle={subtitleStyle}
                    subtitlePosition={subtitlePosition}
                    subtitleConfigs={subtitleConfigs}
                    currentTime={effectiveTime}
                    fullscreen
                    positionMode={positionMode}
                    positionPercent={positionPercent}
                    outputResolution={outputResolution}
                    wordsPerLine={wordsPerLine}
                    linesCount={linesCount}
                    hMarginPct={hMarginPct}
                  />
                )}
              </div>
            </div>
          ) : (
            <div style={STAGE_STYLE} className="w-full h-full flex items-center justify-center">
              <div className="relative" style={canvasFrameStyle}>
              <div className="relative w-full h-full">
                {subtitles && subtitles.length > 0 && (
                  <SubtitleOverlay
                    subtitles={subtitles}
                    subtitleStyle={subtitleStyle}
                    subtitlePosition={subtitlePosition}
                    subtitleConfigs={subtitleConfigs}
                    currentTime={effectiveTime}
                    fullscreen
                    positionMode={positionMode}
                    positionPercent={positionPercent}
                    outputResolution={outputResolution}
                    wordsPerLine={wordsPerLine}
                    linesCount={linesCount}
                    hMarginPct={hMarginPct}
                  />
                )}
              </div>
              </div>
            </div>
          )}
          {/* Control stack: close X on top (always visible) and, under it, the
              play/pause + stop pair — they appear on any mouse move and fade out
              after FS_CONTROLS_HIDE_MS while the media plays. */}
          <div className="absolute top-2 right-2 flex flex-col items-center gap-1.5 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (videoRef.current) {
                  savedTimeRef.current = videoRef.current.currentTime
                  videoRef.current.pause()
                }
                if (waveSurferRef?.current) waveSurferRef.current.pause()
                setVideoFullscreen(false)
                setTimeout(() => {
                  if (videoRef.current) videoRef.current.currentTime = savedTimeRef.current
                }, 100)
              }}
              className="w-7 h-7 bg-white/20 hover:bg-white/40 border border-white/30 rounded flex items-center justify-center text-white text-[12px] transition-colors"
              title={t('dropzone.exitFullscreen')}
            >
              ✕
            </button>
            {fsControlsVisible && (
              <>
                <button
                  onClick={fsTogglePlay}
                  className={FS_BTN_CLASS}
                  title={t('shortcuts.playPause')}
                >
                  {fsPlaying
                    ? <IconPlayerPauseFilled className="w-4 h-4" />
                    : <IconPlayerPlayFilled className="w-4 h-4" />}
                </button>
                <button
                  onClick={fsStop}
                  className={FS_BTN_CLASS}
                  title={t('panel.stop')}
                >
                  <IconPlayerStopFilled className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DropZone
