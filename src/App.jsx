import { useState, useEffect, useRef } from 'react'
import TitleBar from './components/TitleBar'
import DropZone from './components/DropZone'
import Controls from './components/Controls'
import BottomBar from './components/BottomBar'
import SettingsModal from './components/SettingsModal'
import ErrorModal from './components/ErrorModal'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [outputFolder, setOutputFolder] = useState('')
  const [outputFormat, setOutputFormat] = useState('mp3')
  const [threshold, setThreshold] = useState('-35')
  const [marginVal, setMarginVal] = useState('0.1')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, text: '0%' })
  const [showSettings, setShowSettings] = useState(false)
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const errorBuffer = useRef('')
  const lastPct = useRef(0)

  useEffect(() => {
    window.api.getConfig().then((c) => {
      setThreshold(c.threshold)
      setMarginVal(c.margin)
      setOutputFormat(c.output_format || 'mp3')
      if (c.output_folder) setOutputFolder(c.output_folder)
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
  }, [])

  const handleExport = async () => {
    if (!selectedFile || processing) return
    setProcessing(true)
    errorBuffer.current = ''
    lastPct.current = 0
    setProgress({ pct: 0, text: '0%' })

    const base = selectedFile.name.replace(/\.[^.]+$/, '')
    const outPath = outputFolder
      ? await window.api.joinPath(outputFolder, `${base}_ALTERED.${outputFormat}`)
      : await window.api.joinPath(selectedFile.folder, `${base}_ALTERED.${outputFormat}`)

    const args = [
      selectedFile.path, '--progress', 'machine',
      '--edit', `audio:threshold=${Math.pow(10, parseFloat(threshold) / 20)}`,
      '--margin', `${marginVal}s`,
      '--output', outPath
    ]

    await window.api.runAutoEditor(args)
  }

  const handleSaveSettings = async (newConfig) => {
    if (newConfig.threshold !== undefined) setThreshold(newConfig.threshold)
    if (newConfig.margin !== undefined) setMarginVal(newConfig.margin)
    if (newConfig.output_folder !== undefined) setOutputFolder(newConfig.output_folder)
    if (newConfig.output_format !== undefined) setOutputFormat(newConfig.output_format)
    await window.api.saveConfig({
      threshold: newConfig.threshold ?? threshold,
      margin: newConfig.margin ?? marginVal,
      output_folder: newConfig.output_folder ?? outputFolder,
      output_format: newConfig.output_format ?? outputFormat,
    })
  }

  return (
    <div className="w-full h-full flex flex-col border-[4px] border-retro-black bg-retro-box">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <DropZone
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          processing={processing}
        />
        <Controls
          threshold={threshold}
          setThreshold={setThreshold}
          marginVal={marginVal}
          setMarginVal={setMarginVal}
          processing={processing}
          onExport={handleExport}
          progress={progress}
        />
      </div>
      <BottomBar
        outputFolder={outputFolder}
        selectedFile={selectedFile}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && (
        <SettingsModal
          outputFolder={outputFolder}
          outputFormat={outputFormat}
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
    </div>
  )
}

export default App
