import { useState } from 'react'
import { IconHeadphones, IconDeviceFloppy, IconTrash, IconX, IconCircleDashed, IconCircleCheckFilled } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'
import {
  SYSTEM_PRESETS,
  DEFAULT_SOUND_CONFIG,
  describeSoundChain,
  findPreset,
} from '../lib/soundChain'

const clone = (o) => JSON.parse(JSON.stringify(o))

// Valores padrão de banda por "tom" do EQ (aplicados ao trocar o tom)
const TONE_BANDS = {
  flat: [0, 0, 0],
  brilho: [0, 1, 4],
  quente: [4, 1, -3],
  radio: [0, 0, 0],
}

// Checkbox retrô (mesmo desenho do SubtitleConfigModal)
function Check({ checked, onChange, label, children }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => onChange(!checked)}>
        <div className={`w-4 h-4 border-2 border-retro-black rounded flex items-center justify-center shrink-0 ${checked ? 'bg-retro-black' : 'bg-retro-bg'}`}>
          {checked && <span className="text-retro-bg text-[8px] leading-none">✓</span>}
        </div>
        <span className="font-pixel text-[7px] text-retro-black uppercase">{label}</span>
      </div>
      {checked && children && <div className="mt-2 ml-6 flex flex-col gap-2.5">{children}</div>}
    </div>
  )
}

// Slider com rótulo + valor à direita
function RangeRow({ label, value, display, min, max, step, onChange }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="font-pixel text-[6px] text-retro-black/70 uppercase">{label}</span>
        <span className="font-pixel text-[7px] text-retro-black">{display ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-retro-bg border border-retro-black rounded appearance-none cursor-pointer accent-retro-black"
      />
    </div>
  )
}

// Input numérico compacto (Hz)
function HzRow({ label, value, min, max, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-pixel text-[6px] text-retro-black/70 uppercase">{label}</span>
      <div className="w-20 h-6 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center overflow-hidden">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          onBlur={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="w-full px-2 font-pixel text-[7px] text-retro-black outline-none bg-transparent"
        />
        <span className="pr-1.5 font-pixel text-[6px] text-retro-black/60">Hz</span>
      </div>
    </div>
  )
}

function SoundConfigModal({ config, customPresets, onPreview, onClose, onApply, onPresetsChange, onListen, rnnoiseInstalled }) {
  const { t } = useLang()
  const [cfg, setCfg] = useState(() => clone(config))
  const [tab, setTab] = useState('noise')
  const [saveOpen, setSaveOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [deleteArm, setDeleteArm] = useState(false)

  const isCustom = customPresets.some((p) => p.id === cfg.presetId)
  const chain = describeSoundChain(cfg)
  // Indicador entre os botões (wireframe linha 113) — v1.8.0: a prévia é em
  // TEMPO REAL (Web Audio), então nunca há espera de render: 'ready' quando a
  // cadeia tem o que tratar; 'idle' = tudo desligado (o OUÇA TRATADO toca o
  // original).
  const previewStatus = chain.length ? 'ready' : 'idle'

  const set = (group, key, value) =>
    setCfg((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }))

  // Pill retrô do seletor de motor de ruído (clássico afftdn x neural arnndn)
  const pillCls = (active) =>
    `h-6 px-2 border-2 border-retro-black rounded font-pixel text-[6px] uppercase ${
      active ? 'bg-retro-black text-retro-bg' : 'bg-retro-bg text-retro-black hover:bg-gray-200'
    } disabled:opacity-40 disabled:cursor-not-allowed`

  const applyPreset = (id) => {
    const preset = findPreset(id, customPresets)
    if (!preset) return
    setDeleteArm(false)
    const next = { ...cfg, ...clone(preset.params), presetId: id }
    setCfg(next)
    // Selecionar preset sincroniza a prévia em tempo real do rascunho (121)
    onPreview?.(next)
  }

  const handleSavePreset = () => {
    const name = presetName.trim()
    if (!name) return
    const id = `c${Date.now()}`
    onPresetsChange([
      ...customPresets,
      { id, name, params: { noise: cfg.noise, dynamics: cfg.dynamics, eq: cfg.eq, fx: cfg.fx } },
    ])
    setCfg((prev) => ({ ...prev, presetId: id }))
    setPresetName('')
    setSaveOpen(false)
  }

  const handleDeletePreset = () => {
    if (!isCustom) return
    if (!deleteArm) {
      setDeleteArm(true)
      return
    }
    onPresetsChange(customPresets.filter((p) => p.id !== cfg.presetId))
    // Params atuais são mantidos — só sai da origem apagada
    setCfg((prev) => ({ ...prev, presetId: 'podcast' }))
    setDeleteArm(false)
  }

  const handleRestore = () => {
    const preset = findPreset(cfg.presetId, customPresets)
    const params = preset
      ? clone(preset.params)
      : {
          noise: clone(DEFAULT_SOUND_CONFIG.noise),
          dynamics: clone(DEFAULT_SOUND_CONFIG.dynamics),
          eq: clone(DEFAULT_SOUND_CONFIG.eq),
          fx: clone(DEFAULT_SOUND_CONFIG.fx),
        }
    const next = { ...cfg, ...params }
    setCfg(next)
    // RESTAURAR também sincroniza a prévia em tempo real (mesmo fluxo do preset)
    onPreview?.(next)
  }

  const TABS = [
    ['noise', 'sound.tab.noise'],
    ['dynamics', 'sound.tab.dynamics'],
    ['eq', 'sound.tab.eq'],
    ['fx', 'sound.tab.fx'],
  ]

  const btn =
    'h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm font-pixel text-[6px] text-retro-black uppercase hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed'
  const btnPrimary =
    'h-7 border-2 border-retro-black rounded bg-retro-black text-retro-bg shadow-retro-sm font-pixel text-[6px] uppercase hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[26rem] max-w-[94vw] max-h-[86vh] p-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-pixel text-[8px] text-retro-black uppercase">{t('sound.modalTitle')}</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center justify-center hover:bg-red-200 shrink-0"
          >
            <IconX size={12} stroke={2.5} />
          </button>
        </div>

        {/* PRESET: sistema + CRUD do usuário */}
        <label className="font-pixel text-[6px] text-retro-black/70 uppercase block mb-1">{t('sound.preset')}</label>
        <div className="flex gap-1.5 mb-2">
          <select
            value={cfg.presetId}
            onChange={(e) => applyPreset(e.target.value)}
            className="flex-1 min-w-0 h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[7px] text-retro-black outline-none appearance-none cursor-pointer"
          >
            <optgroup label={t('sound.presetSystem')}>
              {SYSTEM_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{t(p.nameKey)}</option>
              ))}
            </optgroup>
            {customPresets.length > 0 && (
              <optgroup label={t('sound.presetCustom')}>
                {customPresets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            onClick={() => { setSaveOpen((v) => !v); setDeleteArm(false) }}
            title={t('sound.saveAs')}
            className={`${btn} w-7 flex items-center justify-center px-0`}
          >
            <IconDeviceFloppy size={13} stroke={2} />
          </button>
          <button
            onClick={handleDeletePreset}
            disabled={!isCustom}
            title={isCustom ? t('sound.delete') : t('sound.deleteSystemTip')}
            className={`${btn} w-7 flex items-center justify-center px-0 ${deleteArm ? 'bg-red-300' : ''}`}
          >
            <IconTrash size={13} stroke={2} />
          </button>
        </div>

        {/* Salvar como preset */}
        {saveOpen && (
          <div className="flex gap-1.5 mb-2">
            <input
              autoFocus
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              maxLength={28}
              placeholder={t('sound.presetName')}
              className="flex-1 min-w-0 h-7 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-2 font-pixel text-[7px] text-retro-black outline-none placeholder:text-retro-black/40"
            />
            <button onClick={handleSavePreset} disabled={!presetName.trim()} className={btnPrimary}>
              {t('common.save')}
            </button>
            <button onClick={() => { setSaveOpen(false); setPresetName('') }} className={btn}>
              {t('common.close')}
            </button>
          </div>
        )}
        {deleteArm && (
          <p className="font-pixel text-[6px] text-red-700 uppercase mb-2">{t('sound.deleteAsk')}</p>
        )}

        {/* Cadeia ativa (prévia do -af montado) */}
        <div className="border-2 border-retro-black rounded bg-retro-bg px-2 py-1.5 mb-2">
          <span className="font-pixel text-[6px] text-retro-black/60 uppercase block mb-0.5">{t('sound.chainLabel')}</span>
          <span className="font-pixel text-[7px] text-retro-black break-all">
            {chain.length ? chain.join(' → ') : t('sound.chainEmpty')}
          </span>
        </div>

        {/* Abas */}
        <div className="flex gap-0.5 shrink-0">
          {TABS.map(([id, key]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 h-7 border-2 border-retro-black rounded-t font-pixel text-[7px] uppercase ${
                tab === id ? 'bg-retro-black text-retro-bg' : 'bg-retro-bg text-retro-black hover:bg-gray-200'
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>

        {/* Conteúdo (rolável) */}
        <div className="border-2 border-t-0 border-retro-black rounded-b bg-retro-box p-3 overflow-y-auto min-h-0 flex-1">
          {tab === 'noise' && (
            <div className="flex flex-col gap-3 min-h-[147.5px]">
              <Check checked={cfg.noise.denoiseOn} onChange={(v) => set('noise', 'denoiseOn', v)} label={t('sound.denoise')}>
                {cfg.noise.denoiseMode !== 'rnnoise' && (
                  <RangeRow
                    label={t('sound.strength')}
                    value={cfg.noise.denoiseDb}
                    display={`${cfg.noise.denoiseDb} dB`}
                    min={-80} max={-20} step={1}
                    onChange={(v) => set('noise', 'denoiseDb', v)}
                  />
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-pixel text-[6px] text-retro-black/70 uppercase mr-1">{t('rnnoise.mode')}</span>
                  <button
                    className={pillCls(cfg.noise.denoiseMode !== 'rnnoise')}
                    onClick={() => set('noise', 'denoiseMode', 'classic')}
                  >
                    {t('rnnoise.modeClassic')}
                  </button>
                  <button
                    className={pillCls(cfg.noise.denoiseMode === 'rnnoise')}
                    disabled={!rnnoiseInstalled}
                    onClick={() => set('noise', 'denoiseMode', 'rnnoise')}
                  >
                    {t('rnnoise.modeNeural')}
                  </button>
                </div>
                {!rnnoiseInstalled && (
                  <p className="font-pixel text-[6px] text-retro-black/50">{t('rnnoise.needModel')}</p>
                )}
              </Check>
              <Check checked={cfg.noise.highpassOn} onChange={(v) => set('noise', 'highpassOn', v)} label={t('sound.highpass')}>
                <HzRow label={t('sound.freq')} value={cfg.noise.highpassHz} min={20} max={500} onChange={(v) => set('noise', 'highpassHz', v)} />
              </Check>
              <Check checked={cfg.noise.lowpassOn} onChange={(v) => set('noise', 'lowpassOn', v)} label={t('sound.lowpass')}>
                <HzRow label={t('sound.freq')} value={cfg.noise.lowpassHz} min={1000} max={20000} onChange={(v) => set('noise', 'lowpassHz', v)} />
              </Check>
              <Check checked={cfg.noise.deEssOn} onChange={(v) => set('noise', 'deEssOn', v)} label={t('sound.deEss')} />
            </div>
          )}

          {tab === 'dynamics' && (
            <div className="flex flex-col gap-3 min-h-[147.5px]">
              <Check checked={cfg.dynamics.normalizeOn} onChange={(v) => set('dynamics', 'normalizeOn', v)} label={t('sound.normalize')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-[6px] text-retro-black/70 uppercase">{t('sound.lufsTarget')}</span>
                  <select
                    value={cfg.dynamics.lufs}
                    onChange={(e) => set('dynamics', 'lufs', Number(e.target.value))}
                    className="h-6 w-40 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-1 font-pixel text-[6px] text-retro-black outline-none appearance-none cursor-pointer"
                  >
                    <option value={-16}>{t('sound.lufs16')}</option>
                    <option value={-23}>{t('sound.lufs23')}</option>
                    <option value={-14}>{t('sound.lufs14')}</option>
                  </select>
                </div>
              </Check>
              <Check checked={cfg.dynamics.compOn} onChange={(v) => set('dynamics', 'compOn', v)} label={t('sound.comp')}>
                <RangeRow label={t('sound.threshold')} value={cfg.dynamics.threshold} display={`${cfg.dynamics.threshold} dB`} min={-40} max={-5} step={1} onChange={(v) => set('dynamics', 'threshold', v)} />
                <RangeRow label={t('sound.ratio')} value={cfg.dynamics.ratio} display={`${cfg.dynamics.ratio}:1`} min={1} max={10} step={1} onChange={(v) => set('dynamics', 'ratio', v)} />
                <RangeRow label={t('sound.attack')} value={cfg.dynamics.attack} display={`${cfg.dynamics.attack} ms`} min={1} max={50} step={1} onChange={(v) => set('dynamics', 'attack', v)} />
              </Check>
              <Check checked={cfg.dynamics.limiterOn} onChange={(v) => set('dynamics', 'limiterOn', v)} label={t('sound.limiter')}>
                <RangeRow label={t('sound.ceiling')} value={cfg.dynamics.ceiling} display={`${cfg.dynamics.ceiling} dB`} min={-6} max={-1} step={1} onChange={(v) => set('dynamics', 'ceiling', v)} />
                {cfg.dynamics.normalizeOn && (
                  <p className="font-pixel text-[6px] text-retro-black/50 leading-relaxed">{t('sound.limiterHint')}</p>
                )}
              </Check>
            </div>
          )}

          {tab === 'eq' && (
            <div className="flex flex-col gap-3 min-h-[147.5px]">
              <Check checked={cfg.eq.on} onChange={(v) => set('eq', 'on', v)} label={t('sound.eqOn')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-[6px] text-retro-black/70 uppercase">{t('sound.tone')}</span>
                  <select
                    value={cfg.eq.tone}
                    onChange={(e) => {
                      const tone = e.target.value
                      const [low, mid, high] = TONE_BANDS[tone] || [0, 0, 0]
                      setCfg((prev) => ({ ...prev, eq: { ...prev.eq, tone, low, mid, high } }))
                    }}
                    className="h-6 w-40 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm px-1 font-pixel text-[6px] text-retro-black outline-none appearance-none cursor-pointer"
                  >
                    <option value="flat">{t('sound.toneFlat')}</option>
                    <option value="brilho">{t('sound.toneBrilho')}</option>
                    <option value="quente">{t('sound.toneQuente')}</option>
                    <option value="radio">{t('sound.toneRadio')}</option>
                  </select>
                </div>
                <RangeRow label={t('sound.low')} value={cfg.eq.low} display={`${cfg.eq.low > 0 ? '+' : ''}${cfg.eq.low} dB`} min={-12} max={12} step={1} onChange={(v) => set('eq', 'low', v)} />
                <RangeRow label={t('sound.mid')} value={cfg.eq.mid} display={`${cfg.eq.mid > 0 ? '+' : ''}${cfg.eq.mid} dB`} min={-12} max={12} step={1} onChange={(v) => set('eq', 'mid', v)} />
                <RangeRow label={t('sound.high')} value={cfg.eq.high} display={`${cfg.eq.high > 0 ? '+' : ''}${cfg.eq.high} dB`} min={-12} max={12} step={1} onChange={(v) => set('eq', 'high', v)} />
              </Check>
            </div>
          )}

          {tab === 'fx' && (
            <div className="flex flex-col gap-3 min-h-[147.5px]">
              <Check checked={cfg.fx.speedOn} onChange={(v) => set('fx', 'speedOn', v)} label={t('sound.speed')}>
                <RangeRow label={t('sound.speed')} value={cfg.fx.speed} display={`${Number(cfg.fx.speed).toFixed(2)}×`} min={0.5} max={2} step={0.05} onChange={(v) => set('fx', 'speed', v)} />
                <p className="font-pixel text-[6px] text-orange-700 leading-relaxed">{t('sound.speedWarn')}</p>
              </Check>
              <Check checked={cfg.fx.echoOn} onChange={(v) => set('fx', 'echoOn', v)} label={t('sound.echo')}>
                <RangeRow label={t('sound.echoDelay')} value={cfg.fx.echoDelay} display={`${cfg.fx.echoDelay} ms`} min={50} max={800} step={10} onChange={(v) => set('fx', 'echoDelay', v)} />
                <RangeRow label={t('sound.echoDecay')} value={cfg.fx.echoDecay} display={`${Math.round(cfg.fx.echoDecay * 100)}%`} min={0.1} max={0.8} step={0.05} onChange={(v) => set('fx', 'echoDecay', v)} />
              </Check>
            </div>
          )}
        </div>

        {/* Prévia A/B em TEMPO REAL — troca na hora, na posição atual, sem
            esperar render nem recarregar a fonte (crossfade no player) */}
        <div className="flex items-center gap-2 mt-2">
          <IconHeadphones size={14} stroke={2} className="text-retro-black shrink-0" />
          <button
            onClick={() => onListen('original')}
            className={`${btn} flex-1`}
          >
            {t('sound.listenOriginal')}
          </button>
          {/* Indicador da cadeia (mesmo estilo dos botões — wireframe 113):
              [verde] = há tratamento em tempo real | [tracejado] = cadeia vazia */}
          <div
            title={t(previewStatus === 'ready' ? 'sound.previewReady' : 'sound.previewIdle')}
            className="w-7 h-7 shrink-0 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm flex items-center justify-center"
          >
            {previewStatus === 'ready' && (
              <IconCircleCheckFilled size={14} className="text-green-600" />
            )}
            {previewStatus === 'idle' && (
              <IconCircleDashed size={14} stroke={2} className="text-retro-black/40" />
            )}
          </div>
          <button
            onClick={() => onListen('treated', cfg)}
            className={`${btn} flex-1`}
          >
            {t('sound.listenTreated')}
          </button>
        </div>

        {/* Rodapé */}
        <p className="font-pixel text-[6px] text-retro-black/50 mt-2 uppercase">{t('sound.applyHint')}</p>
        <div className="flex gap-2 mt-1">
          <button onClick={handleRestore} className={`${btn} flex-1`}>{t('sound.restore')}</button>
          <button onClick={() => onApply(cfg)} className={`${btnPrimary} flex-1 h-8`}>{t('sound.apply')}</button>
        </div>
      </div>
    </div>
  )
}

export default SoundConfigModal
