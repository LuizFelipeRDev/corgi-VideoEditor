import { useRef, useEffect, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useTheme } from '../lib/theme'
import { useLang } from '../lib/i18n'
import realtimeChain from '../lib/realtimeChain'

// Pixels por segundo de audio renderizados. Mantem a densidade MINIMA de
// ~0,5s por barra (barWidth 2 + barGap 1 = 3px; 3px / 6px-s = 0,5s): arquivos
// mais longos que ~3min viram faixa com scroll horizontal em vez de ficarem
// espremidos. Curtos (<= ~3min) continuam preenchendo o container como antes.
const MIN_PX_PER_SEC = 6

// Scrollbar fina DENTRO do Shadow DOM do wavesurfer — o ::-webkit-scrollbar do
// documento nao alcanca shadow root. So aparece quando o audio e longo o
// suficiente para gerar scroll (o .scroll interno so ganha overflow-x: auto
// nesse caso).
const WS_SCROLLBAR_CSS = `
  .scroll::-webkit-scrollbar { height: 8px; }
  .scroll::-webkit-scrollbar-track { background: transparent; }
  .scroll::-webkit-scrollbar-thumb {
    background: rgba(148, 148, 148, 0.55);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  .scroll::-webkit-scrollbar-thumb:hover {
    background-color: rgba(170, 170, 170, 0.85);
    background-clip: content-box;
  }
  .scroll::-webkit-scrollbar-corner { background: transparent; }
`

// Estilo unico dos botoes de transporte (40x40 — wireframe v1.5.0)
const TRANSPORT_BTN_CLASS =
  'w-10 h-10 flex items-center justify-center bg-retro-box border border-retro-black rounded hover:bg-green-100 disabled:opacity-30 disabled:cursor-not-allowed'

// Regua de tempo (estilo Premiere — wireframe v1.6.0): rotulo + tick grande a
// cada 10s, tick pequeno a cada 5s. As posicoes sao % da duracao, entao nao
// dependem da escala px/s (que muda com o preenchimento/scroll da faixa).
const fmtTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Relogio do transporte (hh:mm:ss): posicao atual / duracao total
const fmtHMS = (s) => {
  const total = Math.max(0, Math.floor(s))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function Waveform({ selectedFile, onTimeUpdate, seekTo, videoRef, waveSurferRef, processing, generatingSubtitles, playRequest, onPlayer, shapeCfg }) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const { theme } = useTheme()
  const { t } = useLang()
  const [ready, setReady] = useState(false)
  const [showReady, setShowReady] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [rulerW, setRulerW] = useState(0)
  const [curTime, setCurTime] = useState(0)
  const rulerInnerRef = useRef(null)
  const playheadRef = useRef(null)
  const durationRef = useRef(0)
  // v1.8.0: a prévia A/B é feita em TEMPO REAL (Web Audio dentro do player) —
  // a fonte de áudio nunca troca mais; a posição só precisa sobreviver à
  // recriação do wavesurfer (troca de tema/arquivo).
  const lastTimeRef = useRef(0) // última posição conhecida do transporte
  const lastFileRef = useRef(null) // arquivo que "detém" a posição atual
  const restoreTimeRef = useRef(0) // posição a restaurar no próximo 'ready'
  const pendingPlayRef = useRef(false) // play pedido antes do wavesurfer ficar pronto
  const appliedSeekRef = useRef(null) // último seekTo já aplicado (evita reaplicar no 'ready')
  // v1.8.0: FORMA da onda seguindo o tratamento (render offline → envelope)
  const shapeTokenRef = useRef(0) // descarta renders de cfgs antigas
  const shapeTimerRef = useRef(null) // debounce do render offline
  const shapeDrawnRef = useRef(null) // { ws, key } já desenhado (evita refazer)

  // Elemento com overflow-x que realmente rola (dentro do Shadow DOM do
  // wavesurfer) — a regua acompanha o scroll por ele.
  const getScroller = () => {
    const host = containerRef.current && containerRef.current.firstElementChild
    const shadow = host && host.shadowRoot
    return (shadow && shadow.querySelector('.scroll')) || null
  }

  // Posicao da linha do playhead na regua (% da duracao — sem re-render)
  const updatePlayhead = (time) => {
    const d = durationRef.current
    if (playheadRef.current && d > 0) {
      playheadRef.current.style.left = `${Math.min(100, (time / d) * 100)}%`
    }
  }

  // Relogio hh:mm:ss do transporte: so re-renderiza quando o segundo muda
  const syncClock = (time) => {
    const sec = Math.floor(time)
    setCurTime((prev) => (prev === sec ? prev : sec))
  }

  useEffect(() => {
    if (!selectedFile || !containerRef.current) {
      if (wsRef.current) {
        wsRef.current.pause()
        wsRef.current.destroy()
        wsRef.current = null
      }
      durationRef.current = 0
      setDuration(0)
      setRulerW(0)
      setCurTime(0)
      lastFileRef.current = null
      lastTimeRef.current = 0
      return
    }

    setReady(false)
    setShowReady(false)
    setFadingOut(false)
    setPlaying(false)
    durationRef.current = 0
    setDuration(0)
    setCurTime(0)
    // Mesmo arquivo (ex.: troca de tema): a posição do transporte sobrevive
    // à recriação do wavesurfer; arquivo novo começa em 0.
    const sameFile = lastFileRef.current === selectedFile.path
    restoreTimeRef.current = sameFile ? lastTimeRef.current : 0
    lastFileRef.current = selectedFile.path
    if (!sameFile) appliedSeekRef.current = null
    let detachScroll = () => {}

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: theme === 'modern' ? '#3f3f46' : '#4a5568',
      progressColor: theme === 'modern' ? '#9B30FF' : '#22c55e',
      cursorColor: theme === 'modern' ? '#e8e8ea' : '#1a1a1a',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      minPxPerSec: MIN_PX_PER_SEC,
      normalize: true,
      backend: 'WebAudio',
    })

    // Estiliza a scrollbar nativa do .scroll (shadow root do wavesurfer)
    const host = containerRef.current && containerRef.current.firstElementChild
    const shadow = host && host.shadowRoot
    if (shadow && !shadow.querySelector('style[data-ws-scrollbar]')) {
      const styleEl = document.createElement('style')
      styleEl.setAttribute('data-ws-scrollbar', '')
      styleEl.textContent = WS_SCROLLBAR_CSS
      shadow.appendChild(styleEl)
    }

    // O vídeo é mudo — o wavesurfer é a saída de áudio do app inteiro. O
    // tratamento do 🎤 acontece DESTE lado (Web Audio em tempo real), então a
    // fonte é sempre o arquivo original.
    ws.load(`file:///${selectedFile.path.replace(/\\/g, '/')}`)

    ws.on('ready', () => {
      setReady(true)
      setShowReady(true)
      const d = ws.getDuration() || 0
      durationRef.current = d
      setDuration(d)
      // Restaura a posição quando o wavesurfer é recriado (não mexe em arquivo novo)
      const restore = restoreTimeRef.current
      if (restore > 0 && (!d || restore < d)) {
        ws.setTime(restore)
        lastTimeRef.current = restore
        updatePlayhead(restore)
        syncClock(restore)
      }
      // Play pedido antes do wavesurfer ficar pronto (prévia A/B do modal)
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false
        ws.play()
        if (videoRef?.current) videoRef.current.play()
      }
      // Regua: acompanha o scroll horizontal da faixa (.scroll do shadow DOM)
      const scroller = getScroller()
      if (scroller) {
        const onScroll = () => {
          if (rulerInnerRef.current) {
            rulerInnerRef.current.style.transform = `translateX(${-scroller.scrollLeft}px)`
          }
        }
        scroller.addEventListener('scroll', onScroll)
        onScroll()
        detachScroll = () => scroller.removeEventListener('scroll', onScroll)
      }
      // Largura da regua = largura real do wrapper do wavesurfer (mede no
      // proximo frame, apos o proprio wavesurfer concluir o layout)
      requestAnimationFrame(() => {
        if (wsRef.current !== ws) return
        const wrapper = ws.getWrapper()
        if (wrapper) setRulerW(wrapper.offsetWidth)
      })
    })

    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => {
      setPlaying(false)
      if (videoRef?.current) videoRef.current.pause()
    })

    ws.on('timeupdate', (time) => {
      lastTimeRef.current = time
      if (onTimeUpdate) onTimeUpdate(time)
      updatePlayhead(time)
      syncClock(time)
    })

    ws.on('seeking', (time) => {
      lastTimeRef.current = time
      if (videoRef?.current) videoRef.current.currentTime = time
      updatePlayhead(time)
      syncClock(time)
    })

    wsRef.current = ws
    if (waveSurferRef) waveSurferRef.current = ws
    // v1.8.0: entrega o player (WebAudioPlayer) pra cadeia de prévia em tempo
    // real se conectar no AudioContext dele.
    if (onPlayer) onPlayer(ws.getMediaElement())

    return () => {
      detachScroll()
      ws.pause()
      ws.destroy()
      wsRef.current = null
      if (waveSurferRef) waveSurferRef.current = null
      if (onPlayer) onPlayer(null)
    }
  }, [selectedFile, theme])

  // v1.8.0: a FORMA da onda acompanha o que está sendo OUVIDO — quando a
  // prévia está tratada, a MESMA cadeia roda offline (realtimeChain.
  // renderEnvelope) e os picos são redesenhados. Nada mexe no player nem na
  // reprodução; lado original (ou 🎤 off) volta à forma do arquivo original.
  // Debounce: refaz só quando a cfg para de mudar (preset/ajustes/A-B).
  useEffect(() => {
    const ws = wsRef.current
    const token = ++shapeTokenRef.current
    clearTimeout(shapeTimerRef.current)
    if (!ready || !ws) return
    const decoded = ws.getDecodedData()
    if (!decoded) return
    const key = shapeCfg ? JSON.stringify(shapeCfg) : 'original'
    if (shapeDrawnRef.current && shapeDrawnRef.current.ws === ws && shapeDrawnRef.current.key === key) return

    const draw = (env) => {
      const renderer = ws.renderer
      if (!renderer || typeof renderer.render !== 'function') return
      try {
        if (env) {
          // Buffer "falso": o renderer mapeia array↔largura por tempo de
          // duração — o envelope esticado na duração real vira a forma.
          const dur = decoded.duration || 0
          renderer.render({
            duration: dur,
            length: env[0].length,
            sampleRate: dur > 0 ? env[0].length / dur : 48000,
            numberOfChannels: env.length,
            getChannelData: (i) => env[i] || env[0],
          })
        } else if (renderer.audioData !== decoded) {
          renderer.render(decoded)
        }
        // repinta cursor/preenchimento na posição atual (sem dar play)
        try {
          ws.updateProgress()
        } catch {
          // sem progresso ainda — ok
        }
        shapeDrawnRef.current = { ws, key }
      } catch (e) {
        console.warn('[forma] falha ao redesenhar a onda:', e)
      }
    }

    if (!shapeCfg) {
      draw(null)
      return
    }
    shapeTimerRef.current = setTimeout(() => {
      realtimeChain
        .renderEnvelope(decoded, shapeCfg, () => shapeTokenRef.current !== token)
        .then((env) => {
          if (shapeTokenRef.current !== token || wsRef.current !== ws) return
          if (env) draw(env)
        })
    }, 350)
    return () => clearTimeout(shapeTimerRef.current)
  }, [shapeCfg, ready])

  // Scroll horizontal com a roda do mouse: a faixa interna do wavesurfer so
  // roda na horizontal via Shift+roda ou barra de rolagem; aqui a roda
  // vertical comum tambem desloca a faixa. Anexado no PAINEL (e nao na faixa)
  // para responder tambem sobre a regua de tempo acima.
  useEffect(() => {
    const container = containerRef.current
    const panel = container && container.parentElement
    if (!panel) return
    const onWheel = (e) => {
      const ws = wsRef.current
      if (!ws) return
      // Evento ja horizontal (trackpad): deixa o navegador tratar
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const wrapper = ws.getWrapper()
      // Sem scroll quando a faixa cabe no container (audio curto)
      if (!wrapper || wrapper.offsetWidth <= container.clientWidth) return
      e.preventDefault()
      ws.setScroll(ws.getScroll() + e.deltaY)
    }
    panel.addEventListener('wheel', onWheel, { passive: false })
    return () => panel.removeEventListener('wheel', onWheel)
  }, [])

  // A largura da regua acompanha a largura da faixa: quando a janela muda
  // (640 <-> 900 com legendas) o wavesurfer re-layouta e o wrapper muda.
  // O rAF garante a medicao Depois do proprio wavesurfer processar o resize.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const ws = wsRef.current
        const wrapper = ws && ws.getWrapper()
        if (wrapper) setRulerW(wrapper.offsetWidth)
      })
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

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
    if (seekTo === null) {
      appliedSeekRef.current = null
      return
    }
    // Aplica cada seekTo UMA vez: no 'ready' da recarga de fonte (🎤/A-B) a
    // posição volta a ser a do transporte, não o último clique do painel.
    if (appliedSeekRef.current === seekTo) return
    if (wsRef.current && ready) {
      appliedSeekRef.current = seekTo
      lastTimeRef.current = seekTo
      wsRef.current.setTime(seekTo)
    }
  }, [seekTo, ready])

  // v1.7.0: play pedido pelo SoundConfigModal (prévia A/B). Se o wavesurfer
  // está recarregando a fonte de áudio, o 'ready' consome a intenção; se já
  // está pronto, toca na hora.
  useEffect(() => {
    if (!playRequest) return
    if (wsRef.current && ready) {
      wsRef.current.play()
      if (videoRef?.current) videoRef.current.play()
    } else {
      pendingPlayRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playRequest])

  // Botoes DEDICADOS: [▶] so toca, [⏸] so pausa (o estado atual fica
  // desabilitado, virando leitura visual imediata — wireframe v1.5.0).
  const handlePlay = (e) => {
    e.stopPropagation()
    if (wsRef.current) {
      wsRef.current.play()
    }
    if (videoRef?.current) {
      videoRef.current.play()
    }
  }

  const handlePause = (e) => {
    e.stopPropagation()
    if (wsRef.current) {
      wsRef.current.pause()
    }
    if (videoRef?.current) {
      videoRef.current.pause()
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

  // Posicoes da regua: rotulo/tick grande de 10 em 10s, tick menor a cada 5s
  const rulerMajors = []
  const rulerMinors = []
  if (duration > 0) {
    for (let s = 0; s <= duration + 1e-6; s += 10) rulerMajors.push(s)
    for (let s = 5; s <= duration + 1e-6; s += 10) rulerMinors.push(s)
  }

  return (
    <div className="space-y-1">
      <div className="w-full border-2 border-retro-black rounded bg-retro-bg shadow-retro p-2">
        {/* Regua de tempo estilo Premiere (v1.6.0): rotulos de 10 em 10s,
            ticks 10s/5s e linha do playhead — acompanha o scroll da faixa */}
        <div className="relative w-full h-[16px] overflow-hidden select-none pointer-events-none">
          {duration > 0 && rulerW > 0 && (
            <div
              ref={rulerInnerRef}
              className="absolute top-0 left-0 h-full"
              style={{ width: `${rulerW}px` }}
            >
              {rulerMinors.map((s) => (
                <div
                  key={`m${s}`}
                  className="absolute bottom-0 w-[1px] h-[3px] bg-retro-black/30"
                  style={{ left: `${(s / duration) * 100}%` }}
                />
              ))}
              {rulerMajors.map((s) => (
                <div
                  key={`M${s}`}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${(s / duration) * 100}%` }}
                >
                  <span className="absolute top-0 left-[2px] font-pixel text-[6px] leading-none text-retro-black/70 whitespace-nowrap">
                    {fmtTime(s)}
                  </span>
                  <span className="absolute bottom-0 left-0 w-[1px] h-[5px] bg-retro-black/50" />
                </div>
              ))}
              <div
                ref={playheadRef}
                className="absolute top-0 bottom-0 w-[2px] bg-retro-black/80"
                style={{ left: '0%' }}
              />
            </div>
          )}
        </div>
        <div ref={containerRef} className="w-full min-h-[80px] rounded overflow-hidden" />
      </div>

      {/* Container proprio de transporte (wireframe v1.5.0): relogio
          hh:mm:ss a esquerda, botoes centralizados + status Carregando/Pronto
          alinhado a direita */}
      <div className="relative w-full border-2 border-retro-black rounded bg-retro-bg shadow-retro p-2 flex items-center justify-center">
        <span className="absolute left-2 font-pixel text-[6px] text-retro-black/70 tabular-nums">
          {fmtHMS(curTime)}/{fmtHMS(duration)}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRestart}
            disabled={!ready || processing || generatingSubtitles}
            className={TRANSPORT_BTN_CLASS}
          >
            <svg className="w-5 h-5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 6a4 4 0 1 1 1 2.5" />
              <polyline points="2,3 2,6 5,6" />
            </svg>
          </button>
          <button
            onClick={handlePlay}
            disabled={!ready || processing || generatingSubtitles || playing}
            className={TRANSPORT_BTN_CLASS}
          >
            <svg className="w-5 h-5 ml-0.5" viewBox="0 0 12 12" fill="currentColor">
              <polygon points="2,1 10,6 2,11" />
            </svg>
          </button>
          <button
            onClick={handlePause}
            disabled={!ready || processing || generatingSubtitles || !playing}
            className={TRANSPORT_BTN_CLASS}
          >
            <svg className="w-5 h-5" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1" width="3" height="10" />
              <rect x="7" y="1" width="3" height="10" />
            </svg>
          </button>
        </div>
        {selectedFile && !ready && (
          <span className="absolute right-2 font-pixel text-[6px] text-retro-black/40">{t('waveform.loading')}</span>
        )}
        {selectedFile && showReady && (
          <span className={`absolute right-2 font-pixel text-[6px] text-green-600 transition-opacity duration-1000 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}>{t('waveform.ready')}</span>
        )}
      </div>
    </div>
  )
}

export default Waveform
