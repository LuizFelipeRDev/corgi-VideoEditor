import { SUBTITLE_STYLES, SUBTITLE_POSITIONS, hasPopEffect } from '../lib/subtitleStyles'
import { parseSrtTimeToSecondsExport, measureTextMetrics, WORDPOP_PUSH_FACTOR } from '../lib/subtitleRender'
import { SUBTITLE_DISPLAY_DEFAULTS, getPreviewFontSize, SUBTITLE_HIGHLIGHT_BOX, SUBTITLE_POPLINE_BOX } from '../global_config/subtitleConfig'
import { FONTS } from '../global_config/fonts'

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function SubtitleOverlay({ subtitles, subtitleStyle, subtitlePosition, subtitleConfigs, currentTime, fullscreen, positionMode, positionPercent, outputResolution, wordsPerLine, linesCount, hMarginPct = 0 }) {
  if (!subtitles || subtitles.length === 0) return null

  const isPortrait = outputResolution === 'portrait'

  const stylePreset = SUBTITLE_STYLES[subtitleStyle] || SUBTITLE_STYLES.hormozi
  const posPreset = SUBTITLE_POSITIONS[subtitlePosition] || SUBTITLE_POSITIONS.bottom
  const cfg = subtitleConfigs?.[subtitleStyle] || {}

  const primaryColor = cfg.primaryColor || stylePreset.primaryColor
  const highlightColor = cfg.highlightColor || stylePreset.highlightColor
  const fontId = cfg.fontId || stylePreset.fontFamily.split(',')[0].trim()
const fontFamily = FONTS.find(f => f.id === fontId)?.family || `'${fontId}', sans-serif`
  const configFontSize = cfg.fontSize || stylePreset.fontSize
  const animType = stylePreset.animationType
  const popOn = hasPopEffect(subtitleStyle)
  const popDur = stylePreset.popDuration
  const popSz = stylePreset.popSize

  const activeSub = subtitles.find((sub) => {
    const start = parseSrtTimeToSecondsExport(sub.start)
    const end = parseSrtTimeToSecondsExport(sub.end)
    return currentTime >= start && currentTime <= end
  })

  if (!activeSub) return null

  const useHighlightBlock = animType === 'bounce'
    ? hashString(activeSub.text) % 2 === 0
    : false

  const displayCtx = fullscreen
    ? SUBTITLE_DISPLAY_DEFAULTS.fullscreen
    : SUBTITLE_DISPLAY_DEFAULTS.preview

  const effectivePositionMode = positionMode || displayCtx.positionMode || 'fixed'
  const effectivePositionFixed = subtitlePosition || displayCtx.positionFixed || 'bottom'
  const effectivePositionPercent = positionPercent ?? displayCtx.positionPercent ?? 80

  const posPresetEffective = SUBTITLE_POSITIONS[effectivePositionFixed] || SUBTITLE_POSITIONS.bottom
  const isPercentage = effectivePositionMode === 'percentage'

  const previewMax = fullscreen ? 75 : 70
  const clampedPercent = Math.min(previewMax, Math.max(5, isPercentage ? (effectivePositionPercent ?? 80) : 80))

  const containerStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 5,
  }

  const textStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    width: 'fit-content',
    margin: '0 auto',
    ...(isPercentage
      ? { bottom: `${clampedPercent}%` }
      : posPresetEffective.justifyContent === 'center'
        ? { top: '50%', transform: 'translateY(-50%)' }
        : posPresetEffective.justifyContent === 'flex-start'
          ? { top: fullscreen ? (posPresetEffective.paddingTop || '0') : (posPresetEffective.paddingTop ? '16px' : '10px') }
          : { bottom: fullscreen ? (posPresetEffective.paddingBottom || '40px') : (posPresetEffective.paddingBottom ? '24px' : '40px') }
    ),
  }

  const previewFontSize = getPreviewFontSize(configFontSize, fullscreen)

  // POPLINE pede "borda um pouquinho grossa" nas letras: o contorno do
  // preview acompanha o outlineSize do estilo (5.0) em vez do fixo (2,4)
  // que os demais estilos usam - no export o \\bord ja sai pelo estilo.
  const outlineShadow = animType === 'popline'
    ? `0 0 ${stylePreset.outlineSize * 0.5}px ${stylePreset.outlineColor}, 0 0 ${stylePreset.outlineSize}px ${stylePreset.outlineColor}`
    : `0 0 2px ${stylePreset.outlineColor}, 0 0 4px ${stylePreset.outlineColor}`

  const blockStyle = {
    fontFamily,
    fontSize: `${previewFontSize}px`,
    fontWeight: stylePreset.bold ? 'bold' : 'normal',
    fontStyle: stylePreset.italic ? 'italic' : 'normal',
    letterSpacing: `${stylePreset.letterSpacing * 0.2}px`,
    // wordSpacing do preset: o export usa spaceWidth x wordSpacing/100,
    // entao aqui aplicamos a MESMA proporcao sobre o espaco natural do
    // navegador (negativo fecha, positivo abre - e em px do previewFontSize,
    // igual ao "em" do export).
    wordSpacing: `${(measureTextMetrics(' ', previewFontSize, fontFamily, stylePreset.bold).width * (((stylePreset.wordSpacing || 100) / 100) - 1)).toFixed(2)}px`,
    textAlign: 'center',
    lineHeight: 1.3,
    whiteSpace: 'pre-line',
    textTransform: 'uppercase',
    textShadow: outlineShadow,
    maxWidth: hMarginPct > 0 ? `${100 - 2 * hMarginPct}%` : (isPortrait ? '90%' : '85%'),
    wordBreak: 'break-word',
    // Sem margem configurada vale o legado (retrato com 3% de folga);
    // com margem a folga ja esta embutida em maxWidth, igual ao export.
    ...(isPortrait && hMarginPct <= 0 ? { padding: '0 3%' } : {}),
    ...(animType === 'bounce' && popOn ? { animation: `subtitle-bounce ${popDur}s ease-out` } : {}),
  }

  const now = currentTime
  const words = activeSub.words && activeSub.words.length > 0
    ? activeSub.words
    : activeSub.text.split(/\s+/).map(w => ({ text: w }))

  // Fatiamento do wordpop - MESMA fronteira do export (inicio de cada
  // palavra): activeIdx = palavra que detem o destaque agora, prevIdx =
  // a que acabou de perde-lo (ela so encolhe, sem pop).
  let activeIdx = -1
  let prevIdx = -1
  for (let k = 0; k < words.length; k++) {
    const s = words[k].start ? parseSrtTimeToSecondsExport(words[k].start) : null
    if (s !== null && now >= s) { prevIdx = activeIdx; activeIdx = k }
  }
  const lastStart = activeIdx >= 0 && words[activeIdx].start
    ? parseSrtTimeToSecondsExport(words[activeIdx].start)
    : null

  // Empurrao x (espelha o export): as palavras da MESMA linha da ativa
  // recuam PUSH_FACTOR da meia-extensao que ela abre. Usa a propriedade
  // `translate` (INDEPENDENTE de transform): o keyframe do pop, que anima
  // transform, nao derruba o empurrao durante os 100ms do pop.
  const wplPush = wordsPerLine || 4
  let pushPx = 0
  if (animType === 'wordpop' && popOn && activeIdx >= 0) {
    const aw = measureTextMetrics(
      String(words[activeIdx].text || '').toUpperCase(),
      previewFontSize, fontFamily, stylePreset.bold
    ).width
    pushPx = Math.round(WORDPOP_PUSH_FACTOR * ((popSz || 0) / 100) * aw / 2)
  }
  const pushDx = (idx) => {
    if (pushPx <= 0 || activeIdx < 0 || idx === activeIdx) return 0
    if (Math.floor(idx / wplPush) !== Math.floor(activeIdx / wplPush)) return 0
    return idx > activeIdx ? pushPx : -pushPx
  }

  const isWordActive = (word) => {
    if (!word.start || !word.end) return false
    const s = parseSrtTimeToSecondsExport(word.start)
    const e = parseSrtTimeToSecondsExport(word.end)
    return s !== null && e !== null && now >= s && now < e
  }

  // POPLINE: geometria da faixa fina na base da palavra (referencia
  // popline.png/md). A baseline dentro da caixa de linha (lineHeight 1.3
  // do bloco) sai da metrica da propria fonte no canvas: metade do
  // leading + ascent - o mesmo resultado do layout CSS do navegador.
  const popBand = (() => {
    if (animType !== 'popline') return null
    const fs = previewFontSize
    const lineH = fs * 1.3
    let asc = fs * 1.0
    let desc = fs * 0.3
    try {
      const ctx = document.createElement('canvas').getContext('2d')
      ctx.font = `${stylePreset.italic ? 'italic ' : ''}${stylePreset.bold ? '700' : '400'} ${fs}px ${fontFamily}`
      const m = ctx.measureText('H')
      if (m.fontBoundingBoxAscent) {
        asc = m.fontBoundingBoxAscent
        desc = m.fontBoundingBoxDescent
      }
    } catch (e) { /* sem canvas: aproximacao acima */ }
    const baseline = (lineH - (asc + desc)) / 2 + asc
    // top/height fracionarios: sem arredondamento a faixa bate a baseline
    // exatamente igual ao export (que arredonda so no ASS, +-0.5px em fs105).
    return {
      // do TOPO da caixa de linha ate o topo da faixa
      top: baseline - fs * SUBTITLE_POPLINE_BOX.bandTopRatio,
      height: fs * SUBTITLE_POPLINE_BOX.bandHeightRatio,
      radius: Math.max(1, Math.round(fs * SUBTITLE_POPLINE_BOX.bandHeightRatio * SUBTITLE_POPLINE_BOX.borderRadiusRatio)),
    }
  })()

  const getWordStyle = (word, i) => {
    const wordStart = word.start ? parseSrtTimeToSecondsExport(word.start) : null
    const wordEnd = word.end ? parseSrtTimeToSecondsExport(word.end) : null

    const base = {
      // inline-block: transform so se aplica fora de caixas inline. Sem ele
      // o pop do wordpop/scale simplesmente nao renderizava. E como
      // transform NUNCA participa do layout, a palavra cresce "por cima"
      // das vizinhas sem empurra-las (mesma base que o popline usa).
      display: 'inline-block',
      transition: 'color 0.05s, transform 0.1s',
    }

    switch (animType) {
      case 'simple':
        return { ...base, color: primaryColor }

      case 'bounce': {
        return {
          ...base,
          color: useHighlightBlock ? highlightColor : primaryColor,
        }
      }

      case 'karaoke': {
        const isSpoken = wordEnd !== null && now >= wordEnd
        return {
          ...base,
          color: isSpoken ? highlightColor : primaryColor,
        }
      }

      case 'highlight':
      default: {
        const isActive = wordStart !== null && wordEnd !== null && now >= wordStart && now < wordEnd
        return {
          ...base,
          color: isActive ? highlightColor : primaryColor,
        }
      }

      case 'scale': {
        const isActive = wordStart !== null && wordEnd !== null && now >= wordStart && now < wordEnd
        const scaleVal = 1 + (popSz / 100)
        return {
          ...base,
          color: isActive ? highlightColor : primaryColor,
          transform: isActive ? `scale(${scaleVal})` : 'scale(1)',
        }
      }

      case 'wordpop': {
        // Velhinho.mp4: a palavra ativa cresce (~1.2x) e SEGURA o
        // tamanho enquanto o destaque estiver nela (sem encolher
        // antes, sem overshoot). As demais palavras ficam MENORES
        // (90% = BASE_SCALE do export) e dao um leve pop 90->95->90
        // em 100ms (subtitle-wordpop-small) a cada troca de destaque.
        // transform (nao font-size): nao participa do layout => a frase
        // nao pulsa nem a linha de cima leva empurrao indevido; o
        // empurrao x INTENCIONAL das palavras da linha vem da
        // propriedade `translate` (pushDx), mesmo fator do export.
        const isActive = wordStart !== null && wordEnd !== null && now >= wordStart && now < wordEnd
        const scaleVal = popOn ? 1 + (popSz / 100) : 1
        // base das sem destaque espelha BASE_SCALE=90 do export
        const baseScale = popOn ? 0.9 : 1
        // a que perdeu o destaque (prevIdx, la em cima) so ENCOLHE
        // (transition 1.2->0.9, o mesmo \t de saida do export); o pop
        // 90->95->90 em 100ms e so para quem ja estava parada na base.
        // activeIdx % 2 alterna o NOME do keyframe a cada troca => o
        // browser reinicia a animacao mesmo com render chegando a ~4Hz
        // (onTimeUpdate nativo do video).
        const isPrevActive = i === prevIdx
        const inSmallPop = !isActive && !isPrevActive && popOn && lastStart !== null && (now - lastStart) * 1000 < 100
        const dx = pushDx(i)
        return {
          ...base,
          color: isActive ? highlightColor : primaryColor,
          transform: isActive ? `scale(${scaleVal})` : `scale(${baseScale})`,
          translate: `${dx}px 0`,
          transition: `color 0.05s, transform ${popDur || 0.08}s ease-out, translate ${popDur || 0.08}s ease-out`,
          ...(inSmallPop ? { animation: `${activeIdx % 2 === 0 ? 'subtitle-wordpop-small' : 'subtitle-wordpop-small-b'} 100ms linear` } : {}),
        }
      }

      case 'highlightbox': {
        const isActive = wordStart !== null && wordEnd !== null && now >= wordStart && now < wordEnd
        const radius = Math.round(previewFontSize * SUBTITLE_HIGHLIGHT_BOX.borderRadiusRatio)
        const padX = Math.round(previewFontSize * SUBTITLE_HIGHLIGHT_BOX.paddingXRatio)
        const padY = Math.round(previewFontSize * SUBTITLE_HIGHLIGHT_BOX.paddingYRatio)
        return {
          ...base,
          display: 'inline-block',
          color: primaryColor,
          backgroundColor: isActive ? highlightColor : 'transparent',
          borderRadius: `${radius}px`,
          padding: isActive ? `${padY}px ${padX}px` : '0',
          margin: isActive ? `-${padY}px -${padX}px` : '0',
        }
      }

      case 'popline': {
        // POPLINE: faixa fina na BASE da palavra ("quase uma linha",
        // cantos levemente arredondados - referencia popline.png/md)
        // em vez de caixa envolvendo. A faixa e um filho posicionado
        // dentro do span (largura = palavra, z-index -1 atras das
        // letras - renderizado no JSX) e o pop anima o span inteiro =>
        // faixa e palavra escalam JUNTAS, centradas no meio da palavra
        // (transform-origin padrao), igual ao \org compartilhado do export.
        const isActive = isWordActive(word)
        return {
          ...base,
          display: 'inline-block',
          position: 'relative',
          color: primaryColor,
          animation: isActive && popOn ? `subtitle-popline ${popDur}s ease-out` : 'none',
        }
      }
    }
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...blockStyle, ...textStyle }}>
        {(() => {
          const wpl = wordsPerLine || 4
          const maxLines = linesCount || 2
          const maxWords = wpl * maxLines
          const visibleWords = words.slice(0, maxWords)
          return visibleWords.map((word, i) => {
            const isLast = i === visibleWords.length - 1
            const isLineEnd = (i + 1) % wpl === 0 && !isLast
            return (
              <span key={i}>
                <span style={getWordStyle(word, i)}>
                  {popBand && isWordActive(word) && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${popBand.top}px`,
                        height: `${popBand.height}px`,
                        background: highlightColor,
                        borderRadius: `${popBand.radius}px`,
                        zIndex: -1,
                      }}
                    />
                  )}
                  {word.text}
                </span>
                {isLast ? '' : isLineEnd ? '\n' : ' '}
              </span>
            )
          })
        })()}
      </div>
    </div>
  )
}

export default SubtitleOverlay
