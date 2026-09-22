import { useState } from 'react'
import { SUBTITLE_STYLES } from '../lib/subtitleStyles'
import { FONTS } from '../global_config/fonts'

function SubtitleConfigModal({ subtitleStyle, config, defaultWordsPerLine, defaultLinesCount, onSave, onClose }) {
  const styleConfig = SUBTITLE_STYLES[subtitleStyle] || SUBTITLE_STYLES.hormozi
  const defaultFont = FONTS.find(f => f.family === styleConfig.fontFamily)?.id || 'Montserrat Bold'
  const [localPrimary, setLocalPrimary] = useState(config.primaryColor || styleConfig.primaryColor)
  const [localHighlight, setLocalHighlight] = useState(config.highlightColor || styleConfig.highlightColor)
  const [localWordsPerLine, setLocalWordsPerLine] = useState(config.wordsPerLine || defaultWordsPerLine)
  const [localLinesCount, setLocalLinesCount] = useState(config.linesCount || defaultLinesCount)
  const [localFont, setLocalFont] = useState(config.fontId || defaultFont)
  const [localFontSize, setLocalFontSize] = useState(config.fontSize || styleConfig.fontSize)
  const [useGlobalConfig, setUseGlobalConfig] = useState(config.useGlobalConfig ?? true)

  const handleReset = () => {
    setLocalPrimary(styleConfig.primaryColor)
    setLocalHighlight(styleConfig.highlightColor)
    setLocalWordsPerLine(defaultWordsPerLine)
    setLocalLinesCount(defaultLinesCount)
    setLocalFont(defaultFont)
    setLocalFontSize(styleConfig.fontSize)
  }

  const handleSave = () => {
    onSave({
      primaryColor: localPrimary,
      highlightColor: localHighlight,
      wordsPerLine: useGlobalConfig ? undefined : localWordsPerLine,
      linesCount: useGlobalConfig ? undefined : localLinesCount,
      fontId: localFont,
      fontSize: localFontSize,
      useGlobalConfig,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro h-auto w-80 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-pixel text-[8px] text-retro-black uppercase mb-4">Configuracao - {styleConfig.name}</h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">Fonte</label>
            <select
              value={localFont}
              onChange={(e) => setLocalFont(e.target.value)}
              className="w-full h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[7px] text-retro-black outline-none appearance-none cursor-pointer"
            >
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">Tamanho da Fonte - {localFontSize}</label>
            <input
              type="range"
              min="60"
              max="200"
              value={localFontSize}
              onChange={(e) => setLocalFontSize(Number(e.target.value))}
              className="w-full h-2 bg-retro-bg border border-retro-black rounded appearance-none cursor-pointer accent-retro-black"
            />
            <div className="flex justify-between mt-0.5">
              <span className="font-pixel text-[5px] text-retro-black/50">60</span>
              <span className="font-pixel text-[5px] text-retro-black/50">200</span>
            </div>
          </div>

          <div>
            <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">Cor Primaria (texto)</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={localPrimary}
                onChange={(e) => setLocalPrimary(e.target.value)}
                className="w-8 h-8 border-2 border-retro-black rounded cursor-pointer"
              />
              <span className="font-pixel text-[7px] text-retro-black">{localPrimary}</span>
            </div>
          </div>

          <div>
            <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">Cor Secundaria (destaque)</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={localHighlight}
                onChange={(e) => setLocalHighlight(e.target.value)}
                className="w-8 h-8 border-2 border-retro-black rounded cursor-pointer"
              />
              <span className="font-pixel text-[7px] text-retro-black">{localHighlight}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setUseGlobalConfig(!useGlobalConfig)}>
            <div className={`w-4 h-4 border-2 border-retro-black rounded flex items-center justify-center ${useGlobalConfig ? 'bg-retro-black' : 'bg-retro-bg'}`}>
              {useGlobalConfig && <span className="text-retro-bg text-[8px] leading-none">✓</span>}
            </div>
            <span className="font-pixel text-[6px] text-retro-black uppercase">Usar configuracoes globais</span>
          </div>

          <div>
            <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">Palavras por linha</label>
            <select
              value={localWordsPerLine}
              onChange={(e) => setLocalWordsPerLine(Number(e.target.value))}
              disabled={useGlobalConfig}
              className={`w-full h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[7px] text-retro-black outline-none appearance-none cursor-pointer ${useGlobalConfig ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">Linhas da legenda</label>
            <select
              value={localLinesCount}
              onChange={(e) => setLocalLinesCount(Number(e.target.value))}
              disabled={useGlobalConfig}
              className={`w-full h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[7px] text-retro-black outline-none appearance-none cursor-pointer ${useGlobalConfig ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleReset}
            className="flex-1 h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm font-pixel text-[6px] text-retro-black uppercase hover:bg-gray-200"
          >
            RESETAR
          </button>
          <button
            onClick={handleSave}
            className="flex-1 h-7 border-2 border-retro-black rounded bg-retro-black text-retro-bg shadow-retro-sm font-pixel text-[6px] uppercase hover:bg-gray-800"
          >
            SALVAR
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubtitleConfigModal
