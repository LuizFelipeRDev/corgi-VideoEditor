import { useState } from 'react'
import { SUBTITLE_STYLES, SUBTITLE_POSITIONS, hasPopEffect } from '../lib/subtitleStyles'
import { parseSrtTimeToSecondsExport, measureTextMetrics } from '../lib/subtitleRender'
import {
  SUBTITLE_DISPLAY_DEFAULTS,
  getPreviewFontSize,
  SUBTITLE_PREVIEW_PORTRAIT_FACTOR,
  SUBTITLE_EXPORT_NOMINAL,
  SUBTITLE_EXPORT_MARGINS,
  SUBTITLE_POP_PEAK_RATIO,
  WORDPOP_PUSH_FACTOR,
  SUBTITLE_HIGHLIGHT_BOX,
  SUBTITLE_POPLINE_BOX,
} from '../global_config/subtitleConfig'
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

  const clampedPercent = Math.min(90, Math.max(5, isPercentage ? (effectivePositionPercent ?? 80) : 80))

  // Vertical placement mirrors the EXPORT (generateAssContent): its marginV is
  // in PlayRes units, so the same spot is marginV / playResY of the frame. A
  // fixed px drifted with the window size — worst in portrait, where the frame
  // is short and the preview sat much higher than the file. playResYNominal is
  // the standard height of the chosen aspect (1080 landscape / 1920 portrait).
  const playResYNominal = (isPortrait ? SUBTITLE_EXPORT_NOMINAL.portrait : SUBTITLE_EXPORT_NOMINAL.landscape).height
  const marginAsPct = (units) => `${((units / playResYNominal) * 100).toFixed(3)}%`
  const bottomMarginUnits = isPercentage
    // percentage: the export's own formula for marginV
    ? Math.round((clampedPercent / 100) * (playResYNominal - SUBTITLE_EXPORT_MARGINS.percentHeadroom) + SUBTITLE_EXPORT_MARGINS.bottom)
    : SUBTITLE_EXPORT_MARGINS.bottom

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
      ? { bottom: marginAsPct(bottomMarginUnits) }
      : posPresetEffective.justifyContent === 'center'
        ? { top: '50%', transform: 'translateY(-50%)' }
        : posPresetEffective.justifyContent === 'flex-start'
          // export marginV for "top"
          ? { top: marginAsPct(SUBTITLE_EXPORT_MARGINS.top) }
          // export marginV for "bottom"
          : { bottom: marginAsPct(SUBTITLE_EXPORT_MARGINS.bottom) }
    ),
  }

  // Size: SUBTITLE_DISPLAY_DEFAULTS.preview.fontSize (14px) / fullscreen (32px),
  // via getPreviewFontSize — the size the maintainer tuned for the LANDSCAPE
  // editor, kept untouched. In PORTRAIT the frame is the 9:16 output rect, ~3x
  // NARROWER than the landscape one, so 14px wrapped the line before the words
  // fit; portrait runs smaller by SUBTITLE_PREVIEW_PORTRAIT_FACTOR (subtitleConfig.js).
  const previewFontSize = isPortrait
    ? Math.round(getPreviewFontSize(configFontSize, fullscreen) * SUBTITLE_PREVIEW_PORTRAIT_FACTOR)
    : getPreviewFontSize(configFontSize, fullscreen)

  // Outline/shadow and letter spacing used to be px on top of the fixed
  // display font size. The font is now proportional to the frame, so they
  // scale with it (em against the OLD display size) — same visual weight as
  // before, just bigger.
  const refDisplayPx = getPreviewFontSize(configFontSize, fullscreen)
  const asEm = (px) => `${(px / Math.max(1, refDisplayPx)).toFixed(4)}em`

  // POPLINE asks for a "border a little thick" on the letters: the preview
  // outline follows the style's outlineSize (5.0) instead of the fixed (2,4)
  // the other styles use - in the export the \\bord already comes from the style.
  const outlineShadow = animType === 'popline'
    ? `0 0 ${asEm(stylePreset.outlineSize * 0.5)} ${stylePreset.outlineColor}, 0 0 ${asEm(stylePreset.outlineSize)} ${stylePreset.outlineColor}`
    : `0 0 ${asEm(2)} ${stylePreset.outlineColor}, 0 0 ${asEm(4)} ${stylePreset.outlineColor}`

  const blockStyle = {
    fontFamily,
    fontSize: `${previewFontSize}px`,
    fontWeight: stylePreset.bold ? 'bold' : 'normal',
    fontStyle: stylePreset.italic ? 'italic' : 'normal',
    letterSpacing: asEm(stylePreset.letterSpacing * 0.2),
    // preset's wordSpacing: the export uses spaceWidth x wordSpacing/100,
    // so here we apply the SAME proportion to the browser's natural
    // space (negative closes, positive opens - and in previewFontSize px,
    // same as the export's "em").
    wordSpacing: `${(measureTextMetrics(' ', previewFontSize, fontFamily, stylePreset.bold).width * (((stylePreset.wordSpacing || 100) / 100) - 1)).toFixed(2)}px`,
    textAlign: 'center',
    lineHeight: 1.3,
    whiteSpace: 'pre-line',
    textTransform: 'uppercase',
    textShadow: outlineShadow,
    maxWidth: hMarginPct > 0 ? `${100 - 2 * hMarginPct}%` : (isPortrait ? '90%' : '85%'),
    wordBreak: 'break-word',
    // With no margin configured the legacy applies (portrait with 3% slack);
    // with a margin the slack is already built into maxWidth, same as the export.
    ...(isPortrait && hMarginPct <= 0 ? { padding: '0 3%' } : {}),
    ...(animType === 'bounce' && popOn ? { animation: `subtitle-bounce ${popDur}s ease-out` } : {}),
  }

  const now = currentTime
  const words = activeSub.words && activeSub.words.length > 0
    ? activeSub.words
    : activeSub.text.split(/\s+/).map(w => ({ text: w }))

  // wordpop slicing - SAME boundary as the export (start of each
  // word): activeIdx = word that holds the highlight now, prevIdx =
  // the one that just lost it (it only shrinks, no pop).
  let activeIdx = -1
  let prevIdx = -1
  for (let k = 0; k < words.length; k++) {
    const s = words[k].start ? parseSrtTimeToSecondsExport(words[k].start) : null
    if (s !== null && now >= s) { prevIdx = activeIdx; activeIdx = k }
  }
  const lastStart = activeIdx >= 0 && words[activeIdx].start
    ? parseSrtTimeToSecondsExport(words[activeIdx].start)
    : null

  // Push x (mirrors the export): the words on the SAME line as the active
  // word retreat PUSH_FACTOR of the half-width it opens. Uses the
  // `translate` property (INDEPENDENT of transform): the pop keyframe, which animates
  // transform, doesn't drop the push during the pop's 100ms.
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

  // Font metrics on the canvas: the baseline inside the word span's own line
  // box (the block's lineHeight 1.3) comes from the font's own metric: half
  // the leading + ascent - the same result as the browser's CSS layout. Feeds
  // the popline band and the scale pop's transform-origin.
  const fontMetrics = (() => {
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
    } catch (e) { /* no canvas: approximation above */ }
    return { fs, lineH, asc, desc, baseline: (lineH - (asc + desc)) / 2 + asc }
  })()

  // POPLINE: geometry of the thin band at the base of the word (reference
  // popline.png/md).
  const popBand = (() => {
    if (animType !== 'popline') return null
    const { fs, baseline } = fontMetrics
    // fractional top/height: without rounding the band matches the baseline
    // exactly like the export (which rounds only in the ASS, +-0.5px at fs105).
    return {
      // from the TOP of the line box to the band top
      top: baseline - fs * SUBTITLE_POPLINE_BOX.bandTopRatio,
      height: fs * SUBTITLE_POPLINE_BOX.bandHeightRatio,
      radius: Math.max(1, Math.round(fs * SUBTITLE_POPLINE_BOX.bandHeightRatio * SUBTITLE_POPLINE_BOX.borderRadiusRatio)),
    }
  })()

  const getWordStyle = (word, i) => {
    const wordStart = word.start ? parseSrtTimeToSecondsExport(word.start) : null
    const wordEnd = word.end ? parseSrtTimeToSecondsExport(word.end) : null

    const base = {
      // inline-block: transform only applies outside inline boxes. Without it
      // the wordpop/scale pop simply didn't render. And since
      // transform NEVER takes part in the layout, the word grows "over"
      // its neighbors without pushing them (same base popline uses).
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
        // VERTICAL ONLY, like the export: a horizontal scale would need a width
        // compensation the browser has no notion of (the export's \fsp), and
        // scaleY needs none — the word grows in place and nobody moves.
        // Anchor on the BASELINE: the export scales around the baseline and
        // popLineComp restores the line, so growing from the box center made
        // the preview word float where the file did not.
        const originPct = ((fontMetrics.baseline / fontMetrics.lineH) * 100).toFixed(2)
        return {
          ...base,
          color: isActive ? highlightColor : primaryColor,
          transformOrigin: `50% ${originPct}%`,
          transform: isActive ? `scaleY(${scaleVal})` : 'scaleY(1)',
          transition: `color 0.05s, transform ${popDur || 0.12}s linear`,
        }
      }

      case 'scalesnap': {
        const isActive = wordStart !== null && wordEnd !== null && now >= wordStart && now < wordEnd
        const scaleVal = 1 + (popSz / 100)
        // Anchor on the BASELINE, like the export's per-line slice (the pop
        // lifts the baseline by 0.1 x desc and popLineComp puts it back).
        const originPct = ((fontMetrics.baseline / fontMetrics.lineH) * 100).toFixed(2)
        return {
          ...base,
          color: isActive ? highlightColor : primaryColor,
          transformOrigin: `50% ${originPct}%`,
          // Instant on both axes (the export's static \fscx\fscy)
          scale: isActive ? `${scaleVal} ${scaleVal}` : '1 1',
          transform: 'none',
          transition: 'color 0.05s, scale 0s, transform 0s',
        }
      }

      case 'wordpop': {
        // Velhinho.mp4: the active word grows (~1.2x) and HOLDS the
        // size while the highlight is on it (no shrinking
        // before, no overshoot). The other words stay SMALLER
        // (90% = the export's BASE_SCALE) and do a light 90->95->90 pop
        // over 100ms (subtitle-wordpop-small) at each highlight switch.
        // transform (not font-size): doesn't take part in the layout => the sentence
        // doesn't pulse and the line above doesn't get an undue push; the
        // line's INTENTIONAL push x comes from the
        // `translate` property (pushDx), same factor as the export.
        const isActive = wordStart !== null && wordEnd !== null && now >= wordStart && now < wordEnd
        const scaleVal = popOn ? 1 + (popSz / 100) : 1
        // base of the non-highlighted mirrors the export's BASE_SCALE=90
        const baseScale = popOn ? 0.9 : 1
        // the one that lost the highlight (prevIdx, up there) only SHRINKS
        // (transition 1.2->0.9, the same \t exit as the export); the
        // 90->95->90 pop over 100ms is only for those already resting at the base.
        // activeIdx % 2 alternates the keyframe NAME at each switch => the
        // browser restarts the animation even with renders arriving at ~4Hz
        // (the video's native onTimeUpdate).
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
        // POPLINE: thin band at the BASE of the word ("almost a line",
        // slightly rounded corners - reference popline.png/md)
        // instead of a surrounding box. The band is a child positioned
        // inside the span (width = word, z-index -1 behind the
        // letters - rendered in JSX) and the pop animates the whole span =>
        // band and word scale TOGETHER, centered in the middle of the word
        // (default transform-origin), same as the export's shared \org.
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
