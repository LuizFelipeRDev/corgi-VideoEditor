import { useRef, useEffect, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

function Waveform({ selectedFile, onTimeUpdate, seekTo, videoRef, waveSurferRef, processing, generatingSubtitles }) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [showReady, setShowReady] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!selectedFile || !containerRef.current) {
      if (wsRef.current) {
        wsRef.current.pause()
        wsRef.current.destroy()
        wsRef.current = null
      }
      return
    }

    setReady(false)
    setShowReady(false)
    setFadingOut(false)
    setPlaying(false)

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a5568',
      progressColor: '#22c55e',
      cursorColor: '#1a1a1a',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      normalize: true,
      backend: 'WebAudio',
    })

    ws.load(`file:///${selectedFile.path.replace(/\\/g, '/')}`)

    ws.on('ready', () => {
      setReady(true)
      setShowReady(true)
    })

    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => {
      setPlaying(false)
      if (videoRef?.current) videoRef.current.pause()
    })

    ws.on('timeupdate', (time) => {
      if (onTimeUpdate) onTimeUpdate(time)
    })

    ws.on('seeking', (time) => {
      if (videoRef?.current) videoRef.current.currentTime = time
    })

    wsRef.current = ws
    if (waveSurferRef) waveSurferRef.current = ws

    return () => {
      ws.pause()
      ws.destroy()
      wsRef.current = null
      if (waveSurferRef) waveSurferRef.current = null
    }
  }, [selectedFile])

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
    if (wsRef.current && seekTo !== null && ready) {
      wsRef.current.setTime(seekTo)
    }
  }, [seekTo, ready])

  const handlePlayPause = (e) => {
    e.stopPropagation()
    if (wsRef.current) {
      wsRef.current.playPause()
    }
    if (videoRef?.current) {
      if (videoRef.current.paused) videoRef.current.play()
      else videoRef.current.pause()
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

  return (
    <div className="w-full border-2 border-retro-black rounded bg-retro-bg shadow-retro p-2">
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={handlePlayPause}
          disabled={!ready || processing || generatingSubtitles}
          className="w-5 h-5 flex items-center justify-center bg-retro-box border border-retro-black rounded hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {playing ? (
            <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1" width="3" height="10" />
              <rect x="7" y="1" width="3" height="10" />
            </svg>
          ) : (
            <svg className="w-2.5 h-2.5 ml-0.5" viewBox="0 0 12 12" fill="currentColor">
              <polygon points="2,1 10,6 2,11" />
            </svg>
          )}
        </button>
        <button
          onClick={handleRestart}
          disabled={!ready}
          className="w-5 h-5 flex items-center justify-center bg-retro-box border border-retro-black rounded hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 6a4 4 0 1 1 1 2.5" />
            <polyline points="2,3 2,6 5,6" />
          </svg>
        </button>
        {selectedFile && !ready && (
          <span className="font-pixel text-[6px] text-retro-black/40">Carregando...</span>
        )}
        {selectedFile && showReady && (
          <span className={`font-pixel text-[6px] text-green-600 transition-opacity duration-1000 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}>Pronto</span>
        )}
      </div>
      <div ref={containerRef} className="w-full h-20 rounded overflow-hidden" />
    </div>
  )
}

export default Waveform
