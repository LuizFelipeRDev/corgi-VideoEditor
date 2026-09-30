import { useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { parseAnalysisOutput, suggestSettings } from '../lib/audioAnalysis'

function Stat({ label, value, unit }) {
  return (
    <div className="border border-retro-black/40 rounded bg-retro-box px-1 py-1.5 text-center">
      <p className="font-pixel text-[6px] text-retro-black/60 uppercase">{label}</p>
      <p className="font-pixel text-[9px] text-retro-black">
        {value}
        {unit ? <span className="text-[6px] text-retro-black/60"> {unit}</span> : null}
      </p>
    </div>
  )
}

// ANALISAR E SUGERIR: roda o ffmpeg (silencedetect + astats janelado) no
// arquivo selecionado, mostra a medicao e os 3 valores sugeridos. APLICAR
// joga threshold/margin nos controles e liga o denoise medido no som.
function AnalyzeModal({ filePath, onApply, onClose }) {
  const { t } = useLang()
  const [phase, setPhase] = useState('running') // running | ready | error
  const [msg, setMsg] = useState('')
  const [measurements, setMeasurements] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  // Guarda contra o duplo-effect do React.StrictMode (dev): 1 execução só.
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ;(async () => {
      try {
        if (!window.api || !window.api.runFfmpegAnalysis) throw new Error('IPC runFfmpegAnalysis ausente')
        const args = [
          '-hide_banner',
          '-nostats',
          '-i',
          filePath,
          '-filter_complex',
          '[0:a:0]silencedetect=noise=-45dB:d=0.25,aresample=44100,asetnsamples=n=4410:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level[out]',
          '-map',
          '[out]',
          '-f',
          'null',
          '-',
        ]
        const res = await window.api.runFfmpegAnalysis(args)
        if (!res || !res.success) {
          setMsg((res && res.error) || t('analyze.failed'))
          setPhase('error')
          return
        }
        const result = suggestSettings(parseAnalysisOutput(res.output))
        if (result.error === 'tooShort') {
          setMsg(t('analyze.tooShort'))
          setPhase('error')
          return
        }
        if (result.error) {
          setMsg(t('analyze.noSpeech'))
          setPhase('error')
          return
        }
        setMeasurements(result.measurements)
        setSuggestions(result.suggestions)
        setPhase('ready')
      } catch (err) {
        setMsg(err.message || t('analyze.failed'))
        setPhase('error')
      }
    })()
  }, [filePath])

  const m = measurements
  const s = suggestions

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[460px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[9px] text-retro-black uppercase">{t('analyze.title')}</h2>
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>

        {phase === 'running' && (
          <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
            <p className="font-pixel text-[7px] text-retro-black leading-relaxed">{t('analyze.running')}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
            <p className="font-pixel text-[7px] text-red-600 leading-relaxed">{msg}</p>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
              <p className="font-pixel text-[6px] text-retro-black/50 mb-2">{t('analyze.measured')}</p>
              <div className="grid grid-cols-4 gap-2">
                <Stat label={t('analyze.floor')} value={String(m.noiseFloor)} unit="dB" />
                <Stat label={t('analyze.voice')} value={String(m.voice)} unit="dB" />
                <Stat label={t('analyze.snr')} value={String(m.snr)} unit="dB" />
                <Stat
                  label={t('analyze.pauses')}
                  value={String(m.pauses)}
                  unit={m.medianPause !== null ? `(${m.medianPause}s)` : ''}
                />
              </div>
            </div>

            <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
              <p className="font-pixel text-[6px] text-retro-black/50 mb-2">{t('analyze.suggested')}</p>
              <div className="grid grid-cols-3 gap-2">
                <Stat label={t('analyze.threshold')} value={String(s.threshold)} unit="dB" />
                <Stat label={t('analyze.margin')} value={String(s.margin)} unit="sec" />
                <Stat label={t('analyze.denoise')} value={String(s.denoiseDb)} unit="dB" />
              </div>
            </div>

            <p className="font-pixel text-[6px] text-retro-black/50 leading-relaxed mb-3">{t('analyze.hint')}</p>
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="btn-retro flex-1 h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-gray-200"
          >
            {t('analyze.cancel')}
          </button>
          <button
            onClick={() => onApply(s)}
            disabled={phase !== 'ready'}
            className="btn-retro flex-1 h-9 bg-retro-black text-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] uppercase hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('analyze.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AnalyzeModal
