import { useState, useRef, useEffect } from 'react'
import { SUBTITLE_STYLE_LIST, SUBTITLE_POSITION_LIST } from '../lib/subtitleStyles'
import SubtitleConfigModal from './SubtitleConfigModal'

function SubtitlesPanel({
  subtitles,
  onGenerate,
  generating,
  processing,
  onStop,
  selectedFile,
  subtitlesEnabled,
  onUpdateSubtitle,
  onDeleteSubtitle,
  onAddSubtitle,
  onSeekTo,
  currentTime,
  subtitleStyle,
  subtitlePosition,
  positionMode,
  positionPercent,
  wordsPerLine,
  linesCount,
  subtitleConfigs,
  onStyleChange,
  onPositionChange,
  onPositionModeChange,
  onPositionPercentChange,
  onConfigSave,
  hasChanges,
  onSave,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [editingText, setEditingText] = useState(null)
  const [editingStart, setEditingStart] = useState(null)
  const [editingEnd, setEditingEnd] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const textRef = useRef(null)
  const startRef = useRef(null)
  const endRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (editingText !== null && textRef.current) {
      textRef.current.focus()
      textRef.current.select()
    }
  }, [editingText])

  useEffect(() => {
    if (editingStart !== null && startRef.current) {
      startRef.current.focus()
      startRef.current.select()
    }
  }, [editingStart])

  useEffect(() => {
    if (editingEnd !== null && endRef.current) {
      endRef.current.focus()
      endRef.current.select()
    }
  }, [editingEnd])

  const parseSrtTime = (timeStr) => {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
    if (!match) return 0
    const [, h, m, s, ms] = match
    return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms)
  }

  const getCurrentSubtitleIndex = () => {
    if (!currentTime || subtitles.length === 0) return -1
    const nowMs = currentTime * 1000
    for (let i = 0; i < subtitles.length; i++) {
      const startMs = parseSrtTime(subtitles[i].start)
      const endMs = parseSrtTime(subtitles[i].end)
      if (nowMs >= startMs && nowMs <= endMs) {
        return i
      }
    }
    return -1
  }

  const currentSubtitleIndex = getCurrentSubtitleIndex()

  useEffect(() => {
    if (currentSubtitleIndex >= 0 && listRef.current) {
      const el = listRef.current.children[currentSubtitleIndex]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [currentSubtitleIndex])

  if (!subtitlesEnabled) return null

  const handleTextBlur = (index, value) => {
    onUpdateSubtitle(index, { text: value })
    setEditingText(null)
  }

  const handleStartBlur = (index, value) => {
    onUpdateSubtitle(index, { start: value })
    setEditingStart(null)
  }

  const handleEndBlur = (index, value) => {
    onUpdateSubtitle(index, { end: value })
    setEditingEnd(null)
  }

  const handleTextKeyDown = (e, index, value) => {
    if (e.key === 'Enter') {
      e.target.blur()
    } else if (e.key === 'Escape') {
      setEditingText(null)
    }
  }

  const handleTimeKeyDown = (e, index, value, field) => {
    if (e.key === 'Enter') {
      e.target.blur()
    } else if (e.key === 'Escape') {
      if (field === 'start') setEditingStart(null)
      else setEditingEnd(null)
    }
  }

  const handleSeekTo = (index) => {
    if (onSeekTo) {
      const startMs = parseSrtTime(subtitles[index].start)
      onSeekTo(startMs / 1000)
    }
  }

  return (
    <div className="w-64 border-l-2 border-retro-black bg-retro-bg flex flex-col">
      <div className="p-3 border-b-2 border-retro-black">
        <h3 className="font-pixel text-[8px] text-retro-black uppercase">LEGENDAS</h3>
      </div>

      {subtitlesEnabled && (
        <div className="p-3 border-b-2 border-retro-black/30">
          <div className="mb-3">
            <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">Estilo</label>
            <select
              value={subtitleStyle}
              onChange={(e) => onStyleChange(e.target.value)}
              className="w-full h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[7px] text-retro-black outline-none appearance-none cursor-pointer"
            >
              {SUBTITLE_STYLE_LIST.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">Posicao</label>
            {positionMode === 'fixed' ? (
              <div className="flex gap-1">
                {SUBTITLE_POSITION_LIST.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPositionChange(p.id)}
                    className={`flex-1 h-7 border-2 border-retro-black rounded font-pixel text-[6px] ${
                      subtitlePosition === p.id
                        ? 'bg-retro-black text-retro-bg'
                        : 'bg-retro-bg text-retro-black hover:bg-gray-200'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <input
                  type="range"
                  min="5"
                  max="70"
                  value={positionPercent}
                  onChange={(e) => onPositionPercentChange(Number(e.target.value))}
                  className="w-full h-2 bg-retro-bg border border-retro-black rounded appearance-none cursor-pointer accent-retro-black"
                />
                <div className="flex justify-between mt-0.5">
                  <span className="font-pixel text-[5px] text-retro-black/50">BAIXO</span>
                  <span className="font-pixel text-[5px] text-retro-black">{positionPercent}%</span>
                  <span className="font-pixel text-[5px] text-retro-black/50">TOPO</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowConfig(true)}
            className="mt-3 w-full h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm font-pixel text-[6px] text-retro-black uppercase hover:bg-gray-200"
          >
            CONFIGURACAO LEGENDA
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 p-3 overflow-y-auto">
        {!selectedFile && (
          <p className="font-pixel text-[7px] text-retro-black/50 text-center mt-8">
            Selecione um arquivo para gerar legendas
          </p>
        )}

        {selectedFile && !generating && subtitles.length === 0 && (
          <div className="flex flex-col items-center gap-3 mt-8">
            <p className="font-pixel text-[7px] text-retro-black/50 text-center">
              Nenhuma legenda gerada
            </p>
            <button
              onClick={onGenerate}
              disabled={processing}
              className="btn-retro w-full h-8 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[7px] text-retro-black uppercase hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              GERAR LEGENDAS
            </button>
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center gap-3 mt-8">
            <p className="font-pixel text-[7px] text-retro-black text-center">
              Gerando legendas...
            </p>
            <div className="w-full h-4 border-2 border-retro-black rounded bg-retro-box overflow-hidden">
              <div className="h-full bg-retro-black/30 animate-pulse" />
            </div>
            <button
              onClick={onStop}
              className="w-full h-8 border-2 border-red-700 rounded bg-red-500 shadow-retro-sm font-pixel text-[7px] text-white uppercase hover:bg-red-600"
            >
              PARAR
            </button>
          </div>
        )}

        {subtitles.length > 0 && !generating && (
          <div className="flex flex-col gap-2">
            {subtitles.map((sub, index) => {
              const isActive = index === currentSubtitleIndex
              return (
                <div
                  key={index}
                  className={`p-2 border-2 rounded transition-colors cursor-pointer ${
                    isActive
                      ? 'border-retro-black bg-retro-box shadow-retro-sm'
                      : hoveredIndex === index
                        ? 'border-retro-black/50 bg-retro-box/50'
                        : 'border-retro-black/30 bg-transparent'
                  }`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => handleSeekTo(index)}
                >
                  <div className="flex items-center gap-1 mb-1 font-pixel text-[6px] text-retro-black/70">
                    {editingStart === index ? (
                      <input
                        ref={startRef}
                        type="text"
                        defaultValue={sub.start}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => handleStartBlur(index, e.target.value)}
                        onKeyDown={(e) => handleTimeKeyDown(e, index, e.target.value, 'start')}
                        className="w-16 h-4 px-1 border border-retro-black rounded bg-retro-bg text-[6px] font-pixel outline-none"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-retro-black hover:bg-retro-box px-1 rounded"
                        onClick={(e) => { e.stopPropagation(); setEditingStart(index) }}
                      >
                        {sub.start}
                      </span>
                    )}

                    <span>-</span>

                    {editingEnd === index ? (
                      <input
                        ref={endRef}
                        type="text"
                        defaultValue={sub.end}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => handleEndBlur(index, e.target.value)}
                        onKeyDown={(e) => handleTimeKeyDown(e, index, e.target.value, 'end')}
                        className="w-16 h-4 px-1 border border-retro-black rounded bg-retro-bg text-[6px] font-pixel outline-none"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:text-retro-black hover:bg-retro-box px-1 rounded"
                        onClick={(e) => { e.stopPropagation(); setEditingEnd(index) }}
                      >
                        {sub.end}
                      </span>
                    )}
                  </div>

                  {editingText === index ? (
                    <textarea
                      ref={textRef}
                      defaultValue={sub.text}
                      onBlur={(e) => handleTextBlur(index, e.target.value)}
                      onKeyDown={(e) => handleTextKeyDown(e, index, e.target.value)}
                      rows={2}
                      className="w-full px-1 py-1 border border-retro-black rounded bg-retro-bg text-[7px] font-pixel text-retro-black outline-none resize-none"
                    />
                   ) : (
                    <div
                      className="font-pixel text-[7px] min-h-[20px] px-1 rounded text-retro-black"
                      onClick={(e) => { e.stopPropagation(); setEditingText(index) }}
                    >
                      {sub.words && sub.words.length > 0 ? (
                        sub.words.slice(0, (wordsPerLine || 4) * (linesCount || 2)).map((word, wi) => {
                          const showBreak = wordsPerLine && (wi + 1) % wordsPerLine === 0 && wi < Math.min(sub.words.length, (wordsPerLine || 4) * (linesCount || 2)) - 1
                          return (
                            <span key={wi}>
                              <span>{word.text} </span>
                              {showBreak && <br />}
                            </span>
                          )
                        })
                      ) : (
                        <span>{sub.text}</span>
                      )}
                    </div>
                  )}

                  {hoveredIndex === index && (
                    <div className="flex gap-1 mt-1 pt-1 border-t border-retro-black/20">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteSubtitle(index) }}
                        className="btn-retro flex-1 h-5 bg-retro-bg border border-retro-black rounded font-pixel text-[5px] text-retro-black hover:bg-red-200"
                      >
                        EXCLUIR
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSave() }}
                        className={`btn-retro flex-1 h-5 border border-retro-black rounded font-pixel text-[5px] text-retro-black ${
                          hasChanges ? 'bg-yellow-100 hover:bg-yellow-200' : 'bg-retro-bg opacity-30 cursor-not-allowed'
                        }`}
                      >
                        SALVAR
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            <button
              onClick={onAddSubtitle}
              disabled={generating || processing}
              className={`btn-retro w-full h-7 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[6px] uppercase mt-2 ${
                generating || processing
                  ? 'bg-retro-bg text-retro-black/30 opacity-30 cursor-not-allowed'
                  : 'bg-retro-bg text-retro-black hover:bg-green-100'
              }`}
            >
              + ADICIONAR LEGENDA
            </button>

            {subtitles.length > 0 && (
              <button
                onClick={onGenerate}
                disabled={generating || processing}
                className={`btn-retro w-full h-7 border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[6px] uppercase mt-1 ${
                  generating || processing
                    ? 'bg-retro-bg text-retro-black/30 opacity-30 cursor-not-allowed'
                    : 'bg-retro-bg text-retro-black hover:bg-yellow-100'
                }`}
              >
                {generating ? 'REGERANDO...' : 'REGERAR LEGENDA'}
              </button>
            )}
          </div>
        )}
      </div>

      {showConfig && (
        <SubtitleConfigModal
          subtitleStyle={subtitleStyle}
          config={subtitleConfigs[subtitleStyle] || {}}
          defaultWordsPerLine={wordsPerLine}
          defaultLinesCount={linesCount}
          onSave={(styleConfig) => {
            const newConfigs = { ...subtitleConfigs, [subtitleStyle]: styleConfig }
            onConfigSave(newConfigs)
            setShowConfig(false)
          }}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}

export default SubtitlesPanel
