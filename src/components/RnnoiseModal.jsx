import { useEffect, useState } from 'react'
import { IconBrain, IconDownload } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'
import { describeSoundChain } from '../lib/soundChain'

// Módulo da barra lateral: status/download do modelo neural (rnnoise) +
// escolha do motor de ruído (off / clássico afftdn / neural arnndn).
// APLICAR persiste noise no sound_config (mesmo merge do ANALISAR).
function RnnoiseModal({ config, rnnoiseInstalled, onStatusChange, onApply, onClose }) {
  const { t } = useLang()
  const [draft, setDraft] = useState(() => ({ ...config.noise }))
  const [installed, setInstalled] = useState(!!rnnoiseInstalled)
  const [downloading, setDownloading] = useState(false)
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  // códigos de falha de rede vindos do main → chaves i18n
  const ERR_I18N = { dns: 'rnnoise.errorDns', timeout: 'rnnoise.errorTimeout', conn: 'rnnoise.errorConn' }

  // Progresso do download (main -> preload). Limpo ao fechar.
  useEffect(() => {
    window.api.onRnnoiseDownloadProgress?.((d) => setPct(d?.progress || 0))
    return () => window.api.onRnnoiseDownloadProgress?.(null)
  }, [])

  const mode = !draft.denoiseOn ? 'off' : draft.denoiseMode === 'rnnoise' ? 'rnnoise' : 'classic'
  const setMode = (m) =>
    setDraft((d) => ({
      ...d,
      denoiseOn: m !== 'off',
      denoiseMode: m === 'rnnoise' ? 'rnnoise' : 'classic',
    }))
  const setNoise = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const handleDownload = async () => {
    setErr('')
    setDownloading(true)
    setPct(0)
    try {
      if (!window.api?.downloadRnnoise) throw new Error('IPC downloadRnnoise ausente')
      const res = await window.api.downloadRnnoise()
      if (!res || !res.success) {
        // main devolve um code de rede (dns/timeout/conn) → texto em i18n
        const key = res && ERR_I18N[res.code]
        throw new Error(key ? t(key) : (res && res.error) || t('rnnoise.downloadFailed'))
      }
      setInstalled(true)
      setPct(100)
      onStatusChange?.()
    } catch (e) {
      setErr(e.message || t('rnnoise.downloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  const chain = describeSoundChain({ ...config, noise: draft })
  const pillCls = (active) =>
    `h-6 px-2 border-2 border-retro-black rounded font-pixel text-[6px] uppercase ${
      active ? 'bg-retro-black text-retro-bg' : 'bg-retro-bg text-retro-black hover:bg-gray-200'
    } disabled:opacity-40 disabled:cursor-not-allowed`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[460px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[9px] text-retro-black uppercase flex items-center gap-1.5">
            <IconBrain size={14} />
            {t('rnnoise.title')}
          </h2>
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>

        <p className="font-pixel text-[6px] text-retro-black/70 leading-relaxed mb-3">{t('rnnoise.desc')}</p>

        {/* Modelo neural (status + download) */}
        <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="font-pixel text-[6px] text-retro-black/60 uppercase">{t('rnnoise.model')}</span>
            <span
              className={`font-pixel text-[6px] uppercase flex items-center gap-1 ${
                installed ? 'text-green-700' : 'text-retro-black/50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${installed ? 'bg-green-600' : 'bg-retro-black/30'}`} />
              {installed ? t('rnnoise.modelReady') : t('rnnoise.modelMissing')}
            </span>
          </div>
          <p className="font-pixel text-[6px] text-retro-black/50 leading-relaxed mb-2">{t('rnnoise.source')}</p>
          {!installed && !downloading && (
            <button
              onClick={handleDownload}
              className="btn-retro w-full h-8 bg-retro-black text-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] uppercase hover:bg-gray-800 flex items-center justify-center gap-1"
            >
              <IconDownload size={13} />
              {t('rnnoise.download')}
            </button>
          )}
          {downloading && (
            <div>
              <p className="font-pixel text-[6px] text-retro-black uppercase mb-1">{t('rnnoise.downloading', { pct })}</p>
              <div className="w-full h-2 bg-retro-box border border-retro-black rounded overflow-hidden">
                <div className="h-full bg-retro-black transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {err && <p className="font-pixel text-[6px] text-red-700 mt-1">{err}</p>}
        </div>

        {/* Motor de ruído: off / clássico (afftdn) / neural (arnndn) */}
        <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
          <span className="font-pixel text-[6px] text-retro-black/60 uppercase block mb-1.5">{t('rnnoise.mode')}</span>
          <div className="flex gap-1.5 flex-wrap">
            <button className={pillCls(mode === 'off')} onClick={() => setMode('off')}>
              {t('rnnoise.modeOff')}
            </button>
            <button className={pillCls(mode === 'classic')} onClick={() => setMode('classic')}>
              {t('rnnoise.modeClassic')}
            </button>
            <button className={pillCls(mode === 'rnnoise')} disabled={!installed} onClick={() => setMode('rnnoise')}>
              {t('rnnoise.modeNeural')}
            </button>
          </div>
          {!installed && (
            <p className={`font-pixel text-[6px] mt-1.5 ${mode === 'rnnoise' ? 'text-red-700' : 'text-retro-black/50'}`}>
              {t('rnnoise.needModel')}
            </p>
          )}
          {mode === 'classic' && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="font-pixel text-[6px] text-retro-black/70 uppercase">{t('sound.strength')}</span>
                <span className="font-pixel text-[7px] text-retro-black">{draft.denoiseDb} dB</span>
              </div>
              <input
                type="range"
                min={-80}
                max={-20}
                step={1}
                value={draft.denoiseDb}
                onChange={(e) => setNoise({ denoiseDb: Number(e.target.value) })}
                className="w-full h-2 bg-retro-box border border-retro-black rounded appearance-none cursor-pointer accent-retro-black"
              />
            </div>
          )}
        </div>

        {/* Cadeia que vai ao export */}
        <div className="border-2 border-retro-black rounded bg-retro-bg px-2 py-1.5 mb-3">
          <span className="font-pixel text-[6px] text-retro-black/60 uppercase block mb-0.5">{t('sound.chainLabel')}</span>
          <span className="font-pixel text-[7px] text-retro-black break-all">
            {chain.length ? chain.join(' → ') : t('sound.chainEmpty')}
          </span>
        </div>

        <p className="font-pixel text-[6px] text-retro-black/50 leading-relaxed mb-3">{t('rnnoise.previewNote')}</p>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="btn-retro flex-1 h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-gray-200"
          >
            {t('analyze.cancel')}
          </button>
          <button
            onClick={() => onApply(draft)}
            disabled={downloading || (mode === 'rnnoise' && !installed)}
            className="btn-retro flex-1 h-9 bg-retro-black text-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] uppercase hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('analyze.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RnnoiseModal
