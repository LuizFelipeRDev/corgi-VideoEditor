import { useState, useEffect, useRef } from 'react'
import SubtitleOverlay from './SubtitleOverlay'

function DropZone({ selectedFile, setSelectedFile, processing, onTimeUpdate, seekTo, onClear, videoRef, waveSurferRef, subtitles, subtitleStyle, subtitlePosition, subtitleConfigs, positionMode, positionPercent, outputResolution, greenScreen, subtitlesEnabled, currentTime: currentTimeProp }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [videoFullscreen, setVideoFullscreen] = useState(false)
  const [videoTime, setVideoTime] = useState(0)
  const savedTimeRef = useRef(0)

  const isVideo = selectedFile && /\.(mp4|mkv|mov|webm|avi)$/i.test(selectedFile.name)
  const isAudio = selectedFile && /\.(mp3|wav|flac|ogg|aac|m4a)$/i.test(selectedFile.name)
  const effectiveTime = currentTimeProp !== undefined ? currentTimeProp : videoTime

  useEffect(() => {
    if (videoRef.current && seekTo !== null) {
      videoRef.current.currentTime = seekTo
    }
  }, [seekTo])

  const handleClick = async () => {
    if (selectedFile || processing) return
    const p = await window.api.selectFile()
    if (p) {
      setSelectedFile({ path: p, name: p.split(/[/\\]/).pop(), folder: p.replace(/[\\/][^\\/]+$/, '') })
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (processing) return
    const f = e.dataTransfer.files
    if (f.length > 0) {
      const filePath = window.api.getPathForFile(f[0])
      setSelectedFile({ path: filePath, name: f[0].name, folder: filePath.replace(/[\\/][^\\/]+$/, '') })
    } else {
      const p = await window.api.selectFile()
      if (p) {
        setSelectedFile({ path: p, name: p.split(/[/\\]/).pop(), folder: p.replace(/[\\/][^\\/]+$/, '') })
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
    <div className="flex-1 p-4 flex flex-col min-h-0">
      <div
        onClick={!selectedFile ? handleClick : undefined}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg shadow-retro p-4 flex flex-col items-center justify-center cursor-pointer transition-all flex-1 relative overflow-hidden ${
          isDragOver
            ? 'drag-over'
            : selectedFile
              ? 'border-green-600 bg-green-50'
              : 'border-retro-black bg-retro-bg hover:bg-green-50'
        }`}
      >
        {selectedFile && (
          <button
            onClick={clearFile}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 border border-red-700 rounded text-white text-[10px] font-bold hover:bg-red-600 z-10"
            title="Limpar"
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
              <span className="text-[7px] opacity-60">ou clique aqui</span>
            </p>
          </div>
        ) : isVideo && !videoFullscreen ? (
          <div className="w-full h-full min-h-0 flex flex-col items-center justify-center overflow-hidden relative" style={outputResolution !== 'original' ? { aspectRatio: outputResolution === 'portrait' ? '9/16' : '16/9' } : {}}>
            <video
              ref={videoRef}
              src={`file:///${selectedFile.path.replace(/\\/g, '/')}`}
              onTimeUpdate={handleTimeUpdate}
              muted
              className="max-w-full max-h-full object-contain rounded"
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
              title="Tela cheia"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" />
              </svg>
            </button>
          </div>
        ) : isAudio && subtitlesEnabled ? (
          <div
            className="w-full h-full min-h-0 flex flex-col items-center justify-center overflow-hidden relative"
            style={{
              backgroundColor: greenScreen ? '#00a800' : '#000',
              aspectRatio: outputResolution === 'portrait' ? '9/16' : '16/9',
            }}
          >
            {subtitles && subtitles.length > 0 && (
              <SubtitleOverlay
                subtitles={subtitles}
                subtitleStyle={subtitleStyle}
                subtitlePosition={subtitlePosition}
                subtitleConfigs={subtitleConfigs}
                currentTime={effectiveTime}
                positionMode={positionMode}
                positionPercent={positionPercent}
              />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setVideoFullscreen(true)
              }}
              className="absolute bottom-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 border border-white/20 rounded flex items-center justify-center text-white text-[10px] transition-colors z-10"
              title="Tela cheia"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" />
              </svg>
            </button>
          </div>
        ) : isAudio ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <svg className="w-12 h-12 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <p className="font-pixel text-[8px] text-green-700">{selectedFile.name}</p>
            <p className="font-pixel text-[6px] text-retro-black/40">Use o player abaixo</p>
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
          <span className="font-pixel text-[7px] text-retro-black/60">NOME:</span>
          <span className="font-pixel text-[7px] text-retro-black">{selectedFile?.name || '—'}</span>
        </div>
        <div className="flex justify-between items-center border-b border-retro-black/20 pb-1">
          <span className="font-pixel text-[7px] text-retro-black/60">TAMANHO:</span>
          <span className="font-pixel text-[7px] text-retro-black">—</span>
        </div>
      </div>

      {videoFullscreen && selectedFile && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
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
          <div className="relative max-w-full max-h-full flex items-center justify-center" style={outputResolution !== 'original' ? { aspectRatio: outputResolution === 'portrait' ? '9/16' : '16/9' } : {}}>
            {isVideo ? (
              <video
                ref={videoRef}
                src={`file:///${selectedFile.path.replace(/\\/g, '/')}`}
                onTimeUpdate={handleTimeUpdate}
                muted
                autoPlay
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  backgroundColor: greenScreen ? '#00a800' : '#000',
                  aspectRatio: outputResolution === 'portrait' ? '9/16' : '16/9',
                }}
              >
                <p className="font-pixel text-[10px] text-white/80">{selectedFile.name}</p>
              </div>
            )}
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
              />
            )}
          </div>
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
            className="absolute top-2 right-2 w-7 h-7 bg-white/20 hover:bg-white/40 border border-white/30 rounded flex items-center justify-center text-white text-[12px] transition-colors"
            title="Sair da tela cheia"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default DropZone
