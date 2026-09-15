import { useState, useEffect, useRef } from 'react'
import TitleBar from './components/TitleBar'
import DropZone from './components/DropZone'
import Controls from './components/Controls'
import BottomBar from './components/BottomBar'
import SettingsModal from './components/SettingsModal'
import ErrorModal from './components/ErrorModal'
import AboutModal from './components/AboutModal'
import SubtitlesPanel from './components/SubtitlesPanel'
import { generateAssContent } from './lib/subtitleRender'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [outputFolder, setOutputFolder] = useState('')
  const [outputFormat, setOutputFormat] = useState('mp3')
  const [threshold, setThreshold] = useState('-30')
  const [marginVal, setMarginVal] = useState('0.5')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, text: '0%' })
  const [showSettings, setShowSettings] = useState(false)
  const [showError, setShowError] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const errorBuffer = useRef('')
  const lastPct = useRef(0)
  const videoDurationRef = useRef(0)

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false)
  const [subtitleModel, setSubtitleModel] = useState('tiny')
  const [subtitlePosition, setSubtitlePosition] = useState('bottom')
  const [subtitleStyle, setSubtitleStyle] = useState('hormozi')
  const [greenScreen, setGreenScreen] = useState(false)
  const [burnSubtitles, setBurnSubtitles] = useState(true)
  const [subtitles, setSubtitles] = useState([])
  const [generatingSubtitles, setGeneratingSubtitles] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTo, setSeekTo] = useState(null)

  useEffect(() => {
    window.api.getConfig().then((c) => {
      setThreshold(c.threshold)
      setMarginVal(c.margin)
      setOutputFormat(c.output_format || 'mp3')
      if (c.output_folder) setOutputFolder(c.output_folder)
      setSubtitlesEnabled(c.subtitles === 'true')
      setSubtitleModel(c.subtitle_model || 'tiny')
      setSubtitlePosition(c.subtitle_position || 'bottom')
      setSubtitleStyle(c.subtitle_style || 'hormozi')
      setGreenScreen(c.green_screen === 'true')
      setBurnSubtitles(c.burn_subtitles !== 'false')
    })

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
      if (clean.includes('Finished')) setProgress({ pct: 100, text: 'PRONTO' })
      errorBuffer.current += raw
    })

    window.api.onDone((ok) => {
      setProcessing(false)
      if (ok) {
        setProgress({ pct: 100, text: 'PRONTO' })
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
      window.api.resizeWindow(900, 420)
    } else {
      window.api.resizeWindow(640, 420)
    }
  }, [subtitlesEnabled])

  const handleExport = async () => {
    if (!selectedFile || processing) return
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
      setProcessing(false)
      return
    }

    setProgress({ pct: 90, text: 'Convertendo...' })

    const outputDir = outputFolder || selectedFile.folder

    try {
      let assPath = null

      if (needsVideo) {
        const bgColor = greenScreen ? 'green' : 'black'
        const duration = hasSubtitles
          ? parseSrtTime(subtitles[subtitles.length - 1].end) / 1000
          : 3600

        videoDurationRef.current = duration

        const ffmpegArgs = [
          '-y',
          '-f', 'lavfi',
          '-i', `color=c=${bgColor}:s=1920x1080:d=${duration}`,
          '-i', tempOutPath,
        ]

        if (shouldBurn) {
          assPath = await window.api.joinPath(outputDir, 'corgi_sub.ass')
          const assContent = generateAssContent(
            subtitles,
            subtitleStyle,
            subtitlePosition,
            1920,
            1080
          )
          if (assContent) {
            await window.api.writeFile(assPath, assContent)

            setProgress({ pct: 95, text: 'Imbutindo legenda...' })

            ffmpegArgs.push(
              '-vf', 'ass=corgi_sub.ass',
            )
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
      setProgress({ pct: 100, text: 'CONCLUÍDO' })
    } finally {
      await window.api.deleteFile(tempOutPath)
      setTimeout(() => {
        setProcessing(false)
        setProgress({ pct: 0, text: '' })
      }, 1500)
    }
  }

  const handleGenerateSubtitles = async () => {
    if (!selectedFile || generatingSubtitles) return
    setGeneratingSubtitles(true)
    setSubtitles([])

    const baseName = selectedFile.name.replace(/\.[^.]+$/, '')
    const srtPath = await window.api.joinPath(selectedFile.folder, `${baseName}.srt`)
    const wordsSrtPath = await window.api.joinPath(selectedFile.folder, `${baseName}_words.srt`)

    const args = [
      'whisper',
      selectedFile.path,
      subtitleModel,
      '--format', 'srt',
      '--output', srtPath,
      '--language', 'pt'
    ]

    await window.api.runWhisper(args)

    const wordsArgs = [
      'whisper',
      selectedFile.path,
      subtitleModel,
      '--format', 'srt',
      '--split-word',
      '--output', wordsSrtPath,
      '--language', 'pt'
    ]

    await window.api.runWhisper(wordsArgs)

    setTimeout(async () => {
      const text = await window.api.readFile(srtPath)
      const wordsText = await window.api.readFile(wordsSrtPath)
      if (text) {
        const parsed = parseSrt(text)
        const wordTimings = wordsText ? parseSrt(wordsText) : []
        const enriched = parsed.map((sub) => {
          const subStart = parseSrtTimeMs(sub.start)
          const subEnd = parseSrtTimeMs(sub.end)
          const matchingWords = wordTimings.filter((w) => {
            const wStart = parseSrtTimeMs(w.start)
            const wEnd = parseSrtTimeMs(w.end)
            return wStart >= subStart - 50 && wEnd <= subEnd + 50
          })
          return { ...sub, words: matchingWords.map((w) => ({ text: w.text, start: w.start, end: w.end })) }
        })
        setSubtitles(enriched)
      }
      await window.api.deleteFile(wordsSrtPath)
      setGeneratingSubtitles(false)
    }, 1000)
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
    setSubtitles((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  const handleDeleteSubtitle = (index) => {
    setSubtitles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSplitSubtitle = (index) => {
    setSubtitles((prev) => {
      const sub = prev[index]
      const startTime = parseSrtTime(sub.start)
      const endTime = parseSrtTime(sub.end)
      const midTime = (startTime + endTime) / 2
      const midStr = formatSrtTime(midTime)

      const words = sub.text.split(' ')
      const midWordIndex = Math.ceil(words.length / 2)
      const text1 = words.slice(0, midWordIndex).join(' ')
      const text2 = words.slice(midWordIndex).join(' ')

      const newSub1 = { start: sub.start, end: midStr, text: text1 }
      const newSub2 = { start: midStr, end: sub.end, text: text2 }

      const next = [...prev]
      next.splice(index, 1, newSub1, newSub2)
      return next
    })
  }

  const handleAddSubtitle = () => {
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
    if (newConfig.subtitles !== undefined) setSubtitlesEnabled(newConfig.subtitles)
    if (newConfig.subtitle_model !== undefined) setSubtitleModel(newConfig.subtitle_model)
    if (newConfig.subtitle_position !== undefined) setSubtitlePosition(newConfig.subtitle_position)
    if (newConfig.subtitle_style !== undefined) setSubtitleStyle(newConfig.subtitle_style)
    if (newConfig.green_screen !== undefined) setGreenScreen(newConfig.green_screen)
    if (newConfig.burn_subtitles !== undefined) setBurnSubtitles(newConfig.burn_subtitles)

    await window.api.saveConfig({
      threshold: newConfig.threshold ?? threshold,
      margin: newConfig.margin ?? marginVal,
      output_folder: newConfig.output_folder ?? outputFolder,
      output_format: newConfig.output_format ?? outputFormat,
      subtitles: String(newConfig.subtitles ?? subtitlesEnabled),
      subtitle_model: newConfig.subtitle_model ?? subtitleModel,
      subtitle_position: newConfig.subtitle_position ?? subtitlePosition,
      subtitle_style: newConfig.subtitle_style ?? subtitleStyle,
      green_screen: String(newConfig.green_screen ?? greenScreen),
      burn_subtitles: String(newConfig.burn_subtitles ?? burnSubtitles),
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
        <DropZone
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          processing={processing}
          onTimeUpdate={handleTimeUpdate}
          seekTo={seekTo}
        />
        <Controls
          threshold={threshold}
          setThreshold={setThreshold}
          marginVal={marginVal}
          setMarginVal={setMarginVal}
          processing={processing}
          onExport={handleExport}
          progress={progress}
          onSaveConfig={handleSaveSettings}
        />
        <SubtitlesPanel
          subtitles={subtitles}
          onGenerate={handleGenerateSubtitles}
          generating={generatingSubtitles}
          selectedFile={selectedFile}
          subtitlesEnabled={subtitlesEnabled}
          onUpdateSubtitle={handleUpdateSubtitle}
          onDeleteSubtitle={handleDeleteSubtitle}
          onSplitSubtitle={handleSplitSubtitle}
          onAddSubtitle={handleAddSubtitle}
          onSeekTo={handleSeekTo}
          currentTime={currentTime}
          subtitleStyle={subtitleStyle}
          subtitlePosition={subtitlePosition}
          onStyleChange={(style) => handleSaveSettings({ subtitle_style: style })}
          onPositionChange={(pos) => handleSaveSettings({ subtitle_position: pos })}
        />
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
          subtitles={subtitlesEnabled}
          subtitleModel={subtitleModel}
          subtitlePosition={subtitlePosition}
          subtitleStyle={subtitleStyle}
          greenScreen={greenScreen}
          burnSubtitles={burnSubtitles}
          selectedFile={selectedFile}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}
      {showError && (
        <ErrorModal
          message={errorMessage}
          onClose={() => setShowError(false)}
        />
      )}
      {showAbout && (
        <AboutModal onClose={() => setShowAbout(false)} />
      )}
    </div>
  )
}

export default App
