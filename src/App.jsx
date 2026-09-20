import { useState, useEffect, useRef } from 'react'
import TitleBar from './components/TitleBar'
import DropZone from './components/DropZone'
import Controls from './components/Controls'
import BottomBar from './components/BottomBar'
import SettingsModal from './components/SettingsModal'
import ErrorModal from './components/ErrorModal'
import InfoModal from './components/InfoModal'
import AboutModal from './components/AboutModal'
import CudaDownloadModal from './components/CudaDownloadModal'
import SubtitlesPanel from './components/SubtitlesPanel'
import Waveform from './components/Waveform'
import { generateAssContent, groupWordsIntoSegments } from './lib/subtitleRender'
import { WINDOW_SUBTITLES_WIDTH, WINDOW_NO_SUBTITLES_WIDTH, WINDOW_DEFAULT_HEIGHT } from './global_config/window'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [outputFolder, setOutputFolder] = useState('')
  const [outputFormat, setOutputFormat] = useState('mp3')
  const [outputResolution, setOutputResolution] = useState('original')
  const [threshold, setThreshold] = useState('-30')
  const [marginVal, setMarginVal] = useState('0.5')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, text: '0%' })
  const [showSettings, setShowSettings] = useState(false)
  const [showError, setShowError] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const whisperStoppingRef = useRef(false)
  const whisperGenRef = useRef(0)
  const [showAbout, setShowAbout] = useState(false)
  const [showCudaModal, setShowCudaModal] = useState(false)
  const [whisperCliInstalled, setWhisperCliInstalled] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const errorBuffer = useRef('')
  const lastPct = useRef(0)
  const videoDurationRef = useRef(0)
  const videoRef = useRef(null)
  const exportingRef = useRef(false)
  const waveSurferRef = useRef(null)

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [subtitleModel, setSubtitleModel] = useState('small')
  const [subtitlePosition, setSubtitlePosition] = useState('bottom')
  const [positionMode, setPositionMode] = useState('fixed')
  const [positionPercent, setPositionPercent] = useState(80)
  const [subtitleStyle, setSubtitleStyle] = useState('hormozi')
  const [greenScreen, setGreenScreen] = useState(false)
  const [burnSubtitles, setBurnSubtitles] = useState(true)
  const [subtitles, setSubtitles] = useState([])
  const [generatingSubtitles, setGeneratingSubtitles] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTo, setSeekTo] = useState(null)
  const [wordsPerLine, setWordsPerLine] = useState(4)
  const [linesCount, setLinesCount] = useState(2)
  const [subtitleConfigs, setSubtitleConfigs] = useState({})
  const [subtitlesEdited, setSubtitlesEdited] = useState(false)

  useEffect(() => {
    window.api.getConfig().then((c) => {
      setThreshold(c.threshold)
      setMarginVal(c.margin)
      setOutputFormat(c.output_format || 'mp3')
      setOutputResolution(c.output_resolution || 'original')
      if (c.output_folder) setOutputFolder(c.output_folder)
      setSubtitlesEnabled(c.subtitles === 'true')
      setSubtitleModel(c.subtitle_model || 'small')
      setSubtitlePosition(c.subtitle_position || 'bottom')
      setPositionMode(c.subtitle_position_mode || 'fixed')
      setPositionPercent(Math.min(85, Math.max(5, Number(c.subtitle_position_percent) || 80)))
      setSubtitleStyle(c.subtitle_style || 'hormozi')
      setGreenScreen(c.green_screen === 'true')
      setBurnSubtitles(c.burn_subtitles !== 'false')
      setWordsPerLine(Number(c.words_per_line) || 4)
      setLinesCount(Number(c.lines_count) || 2)
      try { setSubtitleConfigs(JSON.parse(c.subtitle_configs || '{}')) } catch { setSubtitleConfigs({}) }
    })

    window.api.checkWhisperCli().then(setWhisperCliInstalled)

    window.api.onOutput((raw) => {
      const clean = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[\?[0-9]*[a-zA-Z]/g, '')
      for (const line of clean.split('\n')) {
        const t = line.trim()
        if (!t) continue
        const tildeIdx = t.lastIndexOf('~')
        if (tildeIdx === -1) continue
        const remaining = parseFloat(t.substring(tildeIdx + 1))
        if (isNaN(remaining)) continue
        const pct = Math.max(0, Math.min(100, Math.round((1 - remaining) * 100)))
        if (pct >= lastPct.current) {
          lastPct.current = pct
          setProgress({ pct, text: `${pct}%` })
        }
        return
      }
      if (clean.includes('Finished')) setProgress({ pct: 100, text: '100%' })
      errorBuffer.current += raw
    })

    window.api.onDone((ok) => {
      if (!exportingRef.current) setProcessing(false)
      if (ok) {
        setProgress({ pct: 100, text: '100%' })
      } else {
        setProgress({ pct: 0, text: 'ERRO' })
        if (errorBuffer.current.trim()) {
          setErrorMessage(errorBuffer.current.trim())
          setShowError(true)
        }
      }
      errorBuffer.current = ''
    })

    window.api.onError((msg) => {
      setErrorMessage(msg)
      setShowError(true)
    })

    window.api.onWhisperOutput((raw) => {
      console.log('Whisper output:', raw)
    })

    window.api.onWhisperDone((ok) => {
      setGeneratingSubtitles(false)
      if (!ok) {
        setErrorMessage('Erro ao gerar legendas')
        setShowError(true)
      }
    })

    window.api.onWhisperError((msg) => {
      setGeneratingSubtitles(false)
      setErrorMessage(msg)
      setShowError(true)
    })

    window.api.onWhisperCliOutput((raw) => {
      console.log('Whisper CLI output:', raw)
      if (raw.includes('CUDA: no') || raw.includes('CUDA devices: 0')) {
        console.log('CUDA não detectado, usando CPU')
      }
    })

    window.api.onWhisperCliDone((ok) => {
      if (whisperStoppingRef.current) {
        setGeneratingSubtitles(false)
        return
      }
      setGeneratingSubtitles(false)
      if (!ok) {
        setErrorMessage('Erro ao gerar legendas com whisper.cpp')
        setShowError(true)
      }
    })

    window.api.onWhisperCliError((msg) => {
      if (whisperStoppingRef.current || (msg && msg.toLowerCase().includes('cancelado'))) {
        setGeneratingSubtitles(false)
        return
      }
      setGeneratingSubtitles(false)
      if (msg) {
        setErrorMessage(msg)
        setShowError(true)
      }
    })

    window.api.onFfmpegOutput((raw) => {
      if (videoDurationRef.current > 0) {
        const timeMatch = raw.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
        if (timeMatch) {
          const [, hh, mm, ss, cs] = timeMatch
          const currentSecs = parseInt(hh) * 3600 + parseInt(mm) * 60 + parseInt(ss) + parseInt(cs) / 100
          const pct = Math.min(99, Math.round((currentSecs / videoDurationRef.current) * 100))
          if (pct > lastPct.current && pct >= 90) {
            lastPct.current = pct
            setProgress({ pct, text: `${pct}%` })
          }
        }
      }
    })

    window.api.onFfmpegDone((ok) => {
      if (!ok) {
        setErrorMessage('Erro ao renderizar legendas')
        setShowError(true)
      }
    })

    window.api.onFfmpegError((msg) => {
      setErrorMessage(msg)
      setShowError(true)
    })
  }, [])

  useEffect(() => {
    if (subtitlesEnabled) {
      window.api.resizeWindow(WINDOW_SUBTITLES_WIDTH, WINDOW_DEFAULT_HEIGHT)
    } else {
      window.api.resizeWindow(WINDOW_NO_SUBTITLES_WIDTH, WINDOW_DEFAULT_HEIGHT)
    }
  }, [subtitlesEnabled])

  const handleExport = async () => {
    if (!selectedFile || processing) return
    if (videoRef.current) {
      videoRef.current.pause()
      if (waveSurferRef?.current) waveSurferRef.current.pause()
    }
    exportingRef.current = true
    setProcessing(true)
    errorBuffer.current = ''
    lastPct.current = 0
    videoDurationRef.current = 0
    setProgress({ pct: 0, text: '0%' })

    const base = selectedFile.name.replace(/\.[^.]+$/, '')
    const inputExt = selectedFile.name.split('.').pop().toLowerCase()
    const hasSubtitles = subtitles.length > 0
    const shouldBurn = burnSubtitles && hasSubtitles
    const videoExts = ['mp4', 'mkv', 'mov', 'webm', 'avi']
    const isVideoInput = videoExts.includes(inputExt)
    const needsVideo = greenScreen || shouldBurn || !isVideoInput
    const finalFormat = needsVideo ? 'mp4' : outputFormat
    const outPath = outputFolder
      ? await window.api.joinPath(outputFolder, `${base}_ALTERED.${finalFormat}`)
      : await window.api.joinPath(selectedFile.folder, `${base}_ALTERED.${finalFormat}`)

    const tempOutPath = outputFolder
      ? await window.api.joinPath(outputFolder, `${base}_TEMP.${inputExt}`)
      : await window.api.joinPath(selectedFile.folder, `${base}_TEMP.${inputExt}`)

    const args = [
      selectedFile.path, '--progress', 'machine',
      '--edit', `audio:${Math.pow(10, parseFloat(threshold) / 20)}`,
      '--margin', `${marginVal}s`,
      '--output', tempOutPath
    ]

    const result = await window.api.runAutoEditor(args)

    if (!result.success) {
      exportingRef.current = false
      setProcessing(false)
      return
    }

    setProgress({ pct: 90, text: 'Convertendo...' })

    const outputDir = outputFolder || selectedFile.folder

    try {
      let assPath = null

      if (needsVideo) {
        const duration = hasSubtitles
          ? parseSrtTime(subtitles[subtitles.length - 1].end) / 1000
          : 3600

        videoDurationRef.current = duration

        let ffmpegArgs
        if (isVideoInput) {
          ffmpegArgs = [
            '-y',
            '-i', tempOutPath,
          ]
        } else {
          const bgColor = greenScreen ? 'green' : 'black'
          const bgRes = outputResolution === 'portrait' ? '1080x1920' : outputResolution === 'landscape' ? '1920x1080' : '1920x1080'
          ffmpegArgs = [
            '-y',
            '-f', 'lavfi',
            '-i', `color=c=${bgColor}:s=${bgRes}:d=${duration}`,
            '-i', tempOutPath,
          ]
        }

        const videoFilters = []
        if (isVideoInput && outputResolution !== 'original') {
          const outRes = outputResolution === 'portrait' ? '1080:1920' : '1920:1080'
          videoFilters.push(`scale=${outRes}`)
        }

        if (shouldBurn) {
          assPath = await window.api.joinPath(outputDir, 'corgi_sub.ass')
          const styleCfg = subtitleConfigs[subtitleStyle] || {}
          const inputW = videoRef.current?.videoWidth || 1920
          const inputH = videoRef.current?.videoHeight || 1080
          const videoW = outputResolution === 'portrait' ? 1080 : outputResolution === 'landscape' ? 1920 : inputW
          const videoH = outputResolution === 'portrait' ? 1920 : outputResolution === 'landscape' ? 1080 : inputH
          const assContent = generateAssContent(
            subtitles,
            subtitleStyle,
            subtitlePosition,
            videoW,
            videoH,
            styleCfg.wordsPerLine || wordsPerLine,
            styleCfg.linesCount || linesCount,
            styleCfg.primaryColor || undefined,
            styleCfg.highlightColor || undefined,
            styleCfg.fontId || undefined,
            positionMode,
            positionPercent
          )
          if (assContent) {
            await window.api.writeFile(assPath, assContent)

            setProgress({ pct: 95, text: 'Imbutindo legenda...' })

            const fontsDir = await window.api.getFontsPath()
            const escapedFontsDir = fontsDir.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\\\:')
            videoFilters.push(`ass=corgi_sub.ass:fontsdir=${escapedFontsDir}`)
          }

          if (videoFilters.length > 0) {
            ffmpegArgs.push('-vf', videoFilters.join(','))
          }
        }

        ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'aac', '-shortest', outPath)
        const ffmpegResult = await window.api.runFfmpeg(ffmpegArgs, outputDir)
        if (!ffmpegResult.success) {
          videoDurationRef.current = 0
          lastPct.current = 0
          setProgress({ pct: 0, text: 'ERRO' })
          return
        }
      } else {
        const ffmpegArgs = ['-y', '-i', tempOutPath, '-c:a', 'aac', outPath]
        const ffmpegResult = await window.api.runFfmpeg(ffmpegArgs)
        if (!ffmpegResult.success) {
          videoDurationRef.current = 0
          lastPct.current = 0
          setProgress({ pct: 0, text: 'ERRO' })
          return
        }
      }

      if (assPath) await window.api.deleteFile(assPath)

      videoDurationRef.current = 0
      lastPct.current = 0
      setProgress({ pct: 100, text: '100%' })
    } finally {
      await window.api.deleteFile(tempOutPath)
      exportingRef.current = false
      setProcessing(false)
    }
  }

  const handleGenerateSubtitles = async () => {
    if (!selectedFile || generatingSubtitles) return
    if (videoRef.current) {
      videoRef.current.pause()
      if (waveSurferRef?.current) waveSurferRef.current.pause()
    }
    whisperGenRef.current++
    whisperStoppingRef.current = false
    setGeneratingSubtitles(true)
    setSubtitles([])
    setSubtitlesEdited(false)

    try {
      const modelExists = await window.api.checkModel(subtitleModel)
      if (!modelExists) {
        setGeneratingSubtitles(false)
        setErrorMessage(`O modelo "${subtitleModel}" não está instalado.\n\nVá em Configurações (ícone de engrenagem) > Geral e baixe o modelo.`)
        setShowError(true)
        return
      }

      const baseName = selectedFile.name.replace(/\.[^.]+$/, '')
      const wordsSrtPath = await window.api.joinPath(selectedFile.folder, `${baseName}_words`)

      console.log('[subtitle] Starting whisper-cli with:', {
        audioFile: selectedFile.path,
        model: subtitleModel,
        output: wordsSrtPath,
        language: 'pt',
        splitWords: true
      })

      const result = await window.api.runWhisperCli({
        audioFile: selectedFile.path,
        model: subtitleModel,
        output: wordsSrtPath,
        language: 'pt',
        splitWords: true
      })

      console.log('[subtitle] whisper-cli result:', result)

      if (result.stopped) {
        setGeneratingSubtitles(false)
        return
      }

      if (!result.success) {
        setGeneratingSubtitles(false)
        if (result.error) {
          setErrorMessage(result.error)
          setShowError(true)
        }
        return
      }

      if (result.cuda === false) {
        console.log('CUDA não disponível, usando CPU (pode ser mais lento)')
      }

    setTimeout(async () => {
      const wordsText = await window.api.readFile(wordsSrtPath + '.srt')
      console.log('[subtitle] SRT file content:', wordsText ? wordsText.substring(0, 200) : 'EMPTY')
      if (wordsText) {
        const wordTimings = parseSrt(wordsText)
        const styleCfg = subtitleConfigs[subtitleStyle] || {}
        const enriched = groupWordsIntoSegments(
          wordTimings,
          styleCfg.wordsPerLine || wordsPerLine,
          styleCfg.linesCount || linesCount
        )
        setSubtitles(enriched)
      }
      setGeneratingSubtitles(false)
    }, 1000)
    } catch (err) {
      console.error('[subtitle] Error:', err)
      setGeneratingSubtitles(false)
      setErrorMessage(err.message || 'Erro desconhecido ao gerar legendas')
      setShowError(true)
    }
  }

  const parseSrtTimeMs = (timeStr) => {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
    if (!match) return 0
    const [, h, m, s, ms] = match
    return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms)
  }

  const parseSrt = (srtContent) => {
    const blocks = srtContent.trim().split('\n\n')
    const result = []

    for (const block of blocks) {
      const lines = block.split('\n')
      if (lines.length >= 3) {
        const timecode = lines[1]
        const [start, end] = timecode.split(' --> ')
        const text = lines.slice(2).join(' ')
        result.push({ start, end, text })
      }
    }

    return result
  }

  const handleUpdateSubtitle = (index, updates) => {
    setSubtitlesEdited(true)
    setSubtitles((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      if (updates.text !== undefined) {
        next[index].words = []
      }
      return next
    })
  }

  const handleDeleteSubtitle = (index) => {
    setSubtitlesEdited(true)
    setSubtitles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddSubtitle = () => {
    setSubtitlesEdited(true)
    setSubtitles((prev) => {
      let lastEnd = '00:00:00,000'
      if (prev.length > 0) {
        lastEnd = prev[prev.length - 1].end
      }
      const startMs = parseSrtTime(lastEnd)
      const endMs = startMs + 2000
      return [
        ...prev,
        {
          start: formatSrtTime(startMs),
          end: formatSrtTime(endMs),
          text: 'Nova legenda',
        },
      ]
    })
  }

  const handleSaveSubtitles = async () => {
    const baseName = selectedFile.name.replace(/\.[^.]+$/, '')
    const srtPath = await window.api.joinPath(selectedFile.folder, `${baseName}_words.srt`)
    const lines = []
    subtitles.forEach((sub, i) => {
      lines.push(String(i + 1))
      lines.push(`${sub.start} --> ${sub.end}`)
      lines.push(sub.text)
      lines.push('')
    })
    const srtContent = lines.join('\n')
    await window.api.writeFile(srtPath, srtContent)
    setSubtitlesEdited(false)
  }

  const parseSrtTime = (timeStr) => {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
    if (!match) return 0
    const [, h, m, s, ms] = match
    return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms)
  }

  const formatSrtTime = (ms) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    const mill = Math.floor(ms % 1000)
    return (
      String(h).padStart(2, '0') + ':' +
      String(m).padStart(2, '0') + ':' +
      String(s).padStart(2, '0') + ',' +
      String(mill).padStart(3, '0')
    )
  }

  const handleSaveSettings = async (newConfig) => {
    if (newConfig.threshold !== undefined) setThreshold(newConfig.threshold)
    if (newConfig.margin !== undefined) setMarginVal(newConfig.margin)
    if (newConfig.output_folder !== undefined) setOutputFolder(newConfig.output_folder)
    if (newConfig.output_format !== undefined) setOutputFormat(newConfig.output_format)
    if (newConfig.output_resolution !== undefined) setOutputResolution(newConfig.output_resolution)
    if (newConfig.subtitles !== undefined) setSubtitlesEnabled(newConfig.subtitles === true || newConfig.subtitles === 'true')
    if (newConfig.subtitle_model !== undefined) setSubtitleModel(newConfig.subtitle_model)
    if (newConfig.subtitle_position !== undefined) setSubtitlePosition(newConfig.subtitle_position)
    if (newConfig.subtitle_position_mode !== undefined) setPositionMode(newConfig.subtitle_position_mode)
    if (newConfig.subtitle_position_percent !== undefined) setPositionPercent(newConfig.subtitle_position_percent)
    if (newConfig.subtitle_style !== undefined) setSubtitleStyle(newConfig.subtitle_style)
    if (newConfig.green_screen !== undefined) setGreenScreen(newConfig.green_screen)
    if (newConfig.burn_subtitles !== undefined) setBurnSubtitles(newConfig.burn_subtitles)
    if (newConfig.words_per_line !== undefined) setWordsPerLine(newConfig.words_per_line)
    if (newConfig.lines_count !== undefined) setLinesCount(newConfig.lines_count)
    if (newConfig.subtitle_configs !== undefined) setSubtitleConfigs(newConfig.subtitle_configs)

    await window.api.saveConfig({
      threshold: newConfig.threshold ?? threshold,
      margin: newConfig.margin ?? marginVal,
      output_folder: newConfig.output_folder ?? outputFolder,
      output_format: newConfig.output_format ?? outputFormat,
      subtitles: String(newConfig.subtitles ?? subtitlesEnabled),
      subtitle_model: newConfig.subtitle_model ?? subtitleModel,
      subtitle_position: newConfig.subtitle_position ?? subtitlePosition,
      subtitle_position_mode: newConfig.subtitle_position_mode ?? positionMode,
      subtitle_position_percent: String(newConfig.subtitle_position_percent ?? positionPercent),
      subtitle_style: newConfig.subtitle_style ?? subtitleStyle,
      green_screen: String(newConfig.green_screen ?? greenScreen),
      burn_subtitles: String(newConfig.burn_subtitles ?? burnSubtitles),
      words_per_line: String(newConfig.words_per_line ?? wordsPerLine),
      lines_count: String(newConfig.lines_count ?? linesCount),
      subtitle_configs: JSON.stringify(newConfig.subtitle_configs ?? subtitleConfigs),
    })
  }

  const handleTimeUpdate = (time) => {
    setCurrentTime(time)
  }

  const handleSeekTo = (time) => {
    setSeekTo(time)
  }

  return (
    <div className="w-full h-full flex flex-col border-[4px] border-retro-black bg-retro-box">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <div className={`flex flex-col min-w-0 ${subtitlesEnabled ? 'w-[75%]' : 'w-full'}`}>
          <div className="flex flex-1 min-h-0">
            <div className="flex flex-col w-[66.6%] min-w-0 border-r-2 border-retro-black">
              <DropZone
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                processing={processing}
                onTimeUpdate={handleTimeUpdate}
                seekTo={seekTo}
                onClear={() => setSubtitles([])}
                videoRef={videoRef}
                waveSurferRef={waveSurferRef}
                subtitles={subtitles}
                subtitleStyle={subtitleStyle}
                subtitlePosition={subtitlePosition}
                subtitleConfigs={subtitleConfigs}
                positionMode={positionMode}
                positionPercent={positionPercent}
                outputResolution={outputResolution}
                greenScreen={greenScreen}
                subtitlesEnabled={subtitlesEnabled}
              />
            </div>
            <Controls
              threshold={threshold}
              setThreshold={setThreshold}
              marginVal={marginVal}
              setMarginVal={setMarginVal}
              processing={processing}
              generatingSubtitles={generatingSubtitles}
              onExport={handleExport}
              progress={progress}
              onSaveConfig={handleSaveSettings}
            />
          </div>
          <div className="px-4 pb-2 shrink-0">
            <Waveform
              selectedFile={selectedFile}
              onTimeUpdate={handleTimeUpdate}
              seekTo={seekTo}
              videoRef={videoRef}
              waveSurferRef={waveSurferRef}
              processing={processing}
              generatingSubtitles={generatingSubtitles}
            />
          </div>
        </div>
        {subtitlesEnabled && (
          <SubtitlesPanel
            subtitles={subtitles}
            onGenerate={handleGenerateSubtitles}
            generating={generatingSubtitles}
            processing={processing}
            onStop={() => {
              whisperStoppingRef.current = true
              window.api.stopWhisperCli()
              setGeneratingSubtitles(false)
            }}
            selectedFile={selectedFile}
            subtitlesEnabled={subtitlesEnabled}
            onUpdateSubtitle={handleUpdateSubtitle}
            onDeleteSubtitle={handleDeleteSubtitle}
            onAddSubtitle={handleAddSubtitle}
            onSeekTo={handleSeekTo}
            currentTime={currentTime}
            subtitleStyle={subtitleStyle}
            subtitlePosition={subtitlePosition}
            positionMode={positionMode}
            positionPercent={positionPercent}
            wordsPerLine={wordsPerLine}
            linesCount={linesCount}
            subtitleConfigs={subtitleConfigs}
            onStyleChange={(style) => handleSaveSettings({ subtitle_style: style })}
            onPositionChange={(pos) => handleSaveSettings({ subtitle_position: pos })}
            onPositionModeChange={(mode) => handleSaveSettings({ subtitle_position_mode: mode })}
            onPositionPercentChange={(pct) => handleSaveSettings({ subtitle_position_percent: pct })}
            onConfigSave={(cfg) => handleSaveSettings({ subtitle_configs: cfg })}
            hasChanges={subtitlesEdited}
            onSave={handleSaveSubtitles}
          />
        )}
      </div>
      <BottomBar
        outputFolder={outputFolder}
        selectedFile={selectedFile}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAbout={() => setShowAbout(true)}
      />
      {showSettings && (
        <SettingsModal
          outputFolder={outputFolder}
          outputFormat={outputFormat}
          outputResolution={outputResolution}
          subtitles={subtitlesEnabled}
          subtitleModel={subtitleModel}
          greenScreen={greenScreen}
          burnSubtitles={burnSubtitles}
          selectedFile={selectedFile}
          wordsPerLine={wordsPerLine}
          linesCount={linesCount}
          positionMode={positionMode}
          positionPercent={positionPercent}
          whisperCliInstalled={whisperCliInstalled}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
          onRequestCudaDownload={() => setShowCudaModal(true)}
        />
      )}
      <CudaDownloadModal
        open={showCudaModal}
        onClose={() => setShowCudaModal(false)}
        onComplete={() => setWhisperCliInstalled(true)}
      />
      {showError && !whisperStoppingRef.current && (
        <ErrorModal
          message={errorMessage}
          onClose={() => setShowError(false)}
        />
      )}
      {showInfo && (
        <InfoModal
          message={errorMessage}
          onClose={() => setShowInfo(false)}
        />
      )}
      {showAbout && (
        <AboutModal onClose={() => setShowAbout(false)} />
      )}
    </div>
  )
}

export default App
