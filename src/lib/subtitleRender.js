import { SUBTITLE_STYLES, hasPopEffect } from './subtitleStyles'
import { SUBTITLE_DISPLAY_DEFAULTS, getExportFontSize, SUBTITLE_HIGHLIGHT_BOX, SUBTITLE_POPLINE_BOX, SUBTITLE_EXPORT_NOMINAL, SUBTITLE_EXPORT_MARGINS, SUBTITLE_EXPORT_PORTRAIT_FACTOR, SUBTITLE_POP_PEAK_RATIO, WORDPOP_PUSH_FACTOR } from '../global_config/subtitleConfig'
import { FONTS } from '../global_config/fonts'
import { getFontRenderScale, getFontWinAscent } from '../global_config/fontMetrics'

// WORDPOP's push-x force now lives with the other subtitle/export numbers, in
// src/global_config/subtitleConfig.js (WORDPOP_PUSH_FACTOR) and is imported
// above — preview (SubtitleOverlay) and export read the same value.

const resolveAssFontName = (fontId, styleFontFamily) => {
  const picked = FONTS.find(f => f.id === fontId)
  if (picked) return picked.assName
  // Without an explicit fontId (the style's default) or with an unknown id,
  // resolve by CSS FAMILY: the real embedded font name may differ from the CSS
  // name (Montserrat -> Montserrat ExtraBold, Poppins -> Poppins ExtraBold,
  // Roboto -> Roboto Black). Using the CSS name in the Style, libass selects
  // ANOTHER system font and the rendered widths stop matching the canvas
  // measurements — words glued/spaced in the export (highlightbox
  // positions each word by absolute coordinate).
  const cssFamily = (styleFontFamily || '').split(',')[0].trim()
  const byFamily = FONTS.find(f => f.family.split(',')[0].trim() === cssFamily)
    || FONTS.find(f => f.id === cssFamily)
  if (byFamily) return byFamily.assName
  return cssFamily || fontId || 'Arial'
}

// Makes sure the webfont is LOADED in the document before the canvas measures.
// ctx.measureText does not trigger the @font-face load: if the font is
// still "loading"/"unloaded", the canvas falls back to the system font,
// measures words/spaces ~5-10% narrower than Montserrat ExtraBold and
// highlightbox's absolute layout exports the words GLUED (the box
// also comes out smaller). The preview is unaffected: it is DOM, with real
// spaces.
// Returns true if the measurement font is usable.
export async function ensureExportFontLoaded(fontId, styleId, fontSizeOverride) {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return true
  const styleConfig = SUBTITLE_STYLES[styleId] || SUBTITLE_STYLES['corgi-bold']
  const cssFontFamily = (FONTS.find(f => f.id === fontId)?.family || styleConfig?.fontFamily || 'Montserrat, sans-serif')
  const family = cssFontFamily.split(',')[0].replace(/['"]/g, '').trim()
  const spec = `${styleConfig?.bold === false ? 'normal' : 'bold'} ${fontSizeOverride || styleConfig?.fontSize || 105}px "${family}"`
  try {
    await document.fonts.load(spec)
    await document.fonts.ready
    return document.fonts.check(spec)
  } catch (e) {
    return false
  }
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function rgbToAss(r, g, b, alpha = 0) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  return `&H${clamp(alpha).toString(16).padStart(2, '0').toUpperCase()}${clamp(b).toString(16).padStart(2, '0').toUpperCase()}${clamp(g).toString(16).padStart(2, '0').toUpperCase()}${clamp(r).toString(16).padStart(2, '0').toUpperCase()}&`
}

function hexToAss(hex, alpha = 0) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToAss(r, g, b, alpha)
}

function parseSrtTimeToSeconds(timeStr) {
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/)
  if (!match) return 0
  const [, h, m, s, ms] = match
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000
}

function secondsToAssTime(seconds) {
  const totalMs = Math.round(seconds * 1000)
  const h = Math.floor(totalMs / 3600000)
  const m = Math.floor((totalMs % 3600000) / 60000)
  const s = Math.floor((totalMs % 60000) / 1000)
  const cs = Math.floor((totalMs % 1000) / 10)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function stripEmojis(text) {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{200D}]/gu, '')
    .replace(/[\u{20E3}]/gu, '')
    .replace(/[\u{FE0F}]/gu, '')
    .trim()
}

export function generateAssContent(subtitles, styleId, position, videoWidth, videoHeight, wordsPerLine = 4, linesCount = 2, primaryColorOverride, highlightColorOverride, fontId, fontSizeOverride, positionMode, positionPercent, autoLineWrap = false, hMarginPct = 0) {
  const styleConfig = SUBTITLE_STYLES[styleId] || SUBTITLE_STYLES['corgi-bold']

  const playResX = videoWidth || SUBTITLE_EXPORT_NOMINAL.landscape.width
  const playResY = videoHeight || SUBTITLE_EXPORT_NOMINAL.landscape.height

  // Horizontal margin (% of width) to the video edge/wall: reduces the
  // usable width and FORCES the line break. Only applies with autoLineWrap on
  // (gated here too, so the render is self-contained). 0 = legacy (10px on
  // each side) - the 10px cap keeps the current behavior for small
  // percentages at smaller resolutions (0.5% of 1280 = 6px < 10px).
  const effHMarginPct = autoLineWrap ? hMarginPct : 0
  const hMarginPx = Math.max(10, Math.round((effHMarginPct / 100) * playResX))

  const assFontName = resolveAssFontName(fontId, styleConfig.fontFamily)
  const cssFontFamily = (FONTS.find(f => f.id === fontId)?.family || styleConfig.fontFamily || 'Montserrat, sans-serif')
  const baseFontSize = fontSizeOverride || styleConfig.fontSize
  // No italic size shrink: the preview and fullscreen render the style at its
  // full size (the browser only skews synthetic italic), so the export must
  // use the same base size to match them (italic styles were 10% smaller).
  // The font follows the frame's WIDTH, not its height: scaling by height made
  // a 9:16 output (1920 tall) blow the subtitles up to 50% of the frame width
  // against 27% in landscape — the words stopped fitting the line and the
  // export looked nothing like the preview. Both orientations now keep the same
  // proportion of the frame (for 16:9 the two formulas agree), and the width
  // is converted into the equivalent "height" so getExportFontSize keeps being
  // the single place with the scale floor.
  const widthAsHeight = (playResX * SUBTITLE_EXPORT_NOMINAL.landscape.height) / SUBTITLE_EXPORT_NOMINAL.landscape.width
  // Portrait knob (subtitleConfig.js): the width-based scale already matches
  // the landscape proportion, so it starts at 1 and only the maintainer tunes
  // it — landscape is never touched by this factor.
  const portraitTuning = playResY > playResX ? SUBTITLE_EXPORT_PORTRAIT_FACTOR : 1
  const scaledFontSize = Math.round(getExportFontSize(baseFontSize, widthAsHeight) * portraitTuning)

  const exportCtx = SUBTITLE_DISPLAY_DEFAULTS.export
  const effectivePositionMode = positionMode || exportCtx.positionMode || 'fixed'
  const effectivePositionFixed = position || exportCtx.positionFixed || 'bottom'
  const effectivePositionPercent = positionPercent ?? exportCtx.positionPercent ?? 80

  let alignment = 2
  let marginV = SUBTITLE_EXPORT_MARGINS.bottom

  if (effectivePositionMode === 'percentage') {
    alignment = 2
    const percent = Math.min(90, Math.max(5, effectivePositionPercent))
    marginV = Math.round((percent / 100) * (playResY - SUBTITLE_EXPORT_MARGINS.percentHeadroom) + SUBTITLE_EXPORT_MARGINS.bottom)
  } else if (effectivePositionFixed === 'top') {
    alignment = 8
    marginV = SUBTITLE_EXPORT_MARGINS.top
  } else if (effectivePositionFixed === 'middle') {
    alignment = 5
    marginV = SUBTITLE_EXPORT_MARGINS.middle
  }

  const effectivePrimary = primaryColorOverride || styleConfig.primaryColor
  const effectiveHighlight = highlightColorOverride || styleConfig.highlightColor
  const primaryAss = hexToAss(effectivePrimary)
  const highlightAss = hexToAss(effectiveHighlight)
  const outlineAss = hexToAss(styleConfig.outlineColor, 0)
  const shadowAss = hexToAss(styleConfig.shadowColor, styleConfig.shadowAlpha)

  let assContent = `[Script Info]
Title: Corgi Editor Subtitles
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${assFontName},${scaledFontSize},${primaryAss},${highlightAss},${outlineAss},${shadowAss},${styleConfig.bold ? -1 : 0},${styleConfig.italic ? -1 : 0},0,0,100,100,${styleConfig.letterSpacing},0,1,${styleConfig.outlineSize},${styleConfig.shadowDepth},${alignment},${hMarginPx},${hMarginPx},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  // Collects the words of a segment (subtitle) already grouped at generation.
  const collectSegmentWords = (sub) => {
    const out = []
    if (sub.words && sub.words.length > 0) {
      for (const word of sub.words) {
        const wordText = stripEmojis(word.text)
        if (!wordText) continue
        out.push({
          text: wordText,
          start: parseSrtTimeToSeconds(word.start),
          end: parseSrtTimeToSeconds(word.end),
        })
      }
      return out
    }

    const words = (sub.text || '').split(/\s+/).filter(Boolean)
    const subStart = parseSrtTimeToSeconds(sub.start)
    const subEnd = parseSrtTimeToSeconds(sub.end)
    const wordDuration = words.length > 0 ? (subEnd - subStart) / words.length : 0

    for (let i = 0; i < words.length; i++) {
      const wordText = stripEmojis(words[i])
      if (!wordText) continue
      out.push({
        text: wordText,
        start: subStart + i * wordDuration,
        end: subStart + (i + 1) * wordDuration,
      })
    }
    return out
  }

  // Each segment becomes its own blocks: the breaks made at generation
  // (smart subtitle by punctuation, silence gap and persistence)
  // are preserved, same as preview and fullscreen.
  const segments = []
  for (const sub of subtitles) {
    const words = collectSegmentWords(sub)
    if (words.length === 0) continue
    segments.push({ sub, words })
  }

  if (segments.length === 0) return null

  const blocks = []
  for (let i = 0; i < segments.length; i++) {
    const { sub, words } = segments[i]
    const segmentBlocks = groupWordsIntoBlocks(words, playResX, scaledFontSize, styleConfig, wordsPerLine, linesCount, styleId, autoLineWrap, cssFontFamily, assFontName, hMarginPx)
    if (segmentBlocks.length === 0) continue

    // The segment's last block lasts until sub.end (persistence applied at
    // generation or manual edit), limited to the start of the next segment.
    const lastBlock = segmentBlocks[segmentBlocks.length - 1]
    const blockStart = lastBlock.words[0].start
    const subEnd = parseSrtTimeToSeconds(sub.end)
    const nextStart = i < segments.length - 1 ? segments[i + 1].words[0].start : Infinity
    const visibleEnd = Math.min(subEnd, nextStart)
    if (Number.isFinite(visibleEnd) && visibleEnd > blockStart) {
      lastBlock.end = visibleEnd
    }

    blocks.push(...segmentBlocks)
  }

  for (const block of blocks) {
    const blockWords = block.words

    // Active word measurement in PlayRes units - feeds the pop's \fsp
    // compensation (see getAnimationTag). renderScale aligns the canvas
    // nominal measurement to the real glyph (fontMetrics), same as the
    // highlightbox layout.
    const popMeasure = (t) => measureTextMetrics(t, scaledFontSize, cssFontFamily, styleConfig.bold).width * getFontRenderScale(assFontName)

    if (styleConfig.animationType === 'simple' || styleConfig.animationType === 'bounce') {
      const useHighlight = styleConfig.animationType === 'bounce' && Math.random() > 0.5
      const popOn = hasPopEffect(styleId)
      const popSz = styleConfig.popSize || 5
      const popDur = styleConfig.popDuration || 0.18
      const popStart = 100 - popSz
      const popPeak = 100 + popSz
      const durCs = Math.round(popDur * 1000)
      const growCs = Math.round(durCs * 0.55)
      const shrinkCs = durCs
      const parts = []
      let lastLineIdx = -1
      for (const w of blockWords) {
        if (w.lineIdx !== lastLineIdx && lastLineIdx !== -1) parts.push('\\N')
        lastLineIdx = w.lineIdx
        if (useHighlight) parts.push(`{\\c${highlightAss}}`)
        if (styleConfig.animationType === 'bounce' && popOn) {
          parts.push(`{\\fscx${popStart}\\fscy${popStart}\\t(0,${growCs},\\fscx${popPeak}\\fscy${popPeak})\\t(${growCs},${shrinkCs},\\fscx100\\fscy100)}`)
        }
        parts.push(w.text.toUpperCase())
        if (useHighlight) parts.push(`{\\c${primaryAss}}`)
        if (w !== blockWords[blockWords.length - 1] && blockWords[blockWords.indexOf(w) + 1]?.lineIdx === w.lineIdx) {
          parts.push(' ')
        }
      }
      assContent += `Dialogue: 0,${secondsToAssTime(blockWords[0].start)},${secondsToAssTime(block.end)},Default,,0,0,0,,${parts.join('')}\n`
      continue
    }

    // WORDPOP (velhinho.mp4 default): at every time slice (a highlight
    // switch) each WORD becomes its own Dialogue with
    // \an2\pos/\move ABSOLUTE at the center of its own advance:
    //  - active word: born at the 90% base, grows to popPeak and
    //    HOLDS until the next slice;
    //  - the rest (no highlight): a SMALLER base (90%) with a light
    //    90->95->90 pop over 100ms at each highlight switch;
    //  - the one that just lost the highlight shrinks smoothly 120->90
    //    (no pop - the shrinking is already the transition);
    //  - push x: the words on the SAME line as the active one retreat
    //    slightly (WORDPOP_PUSH_FACTOR of the half-width it opens)
    //    and come back when the highlight leaves the line.
    // Why PER WORD (probes with the bundled ffmpeg - probe*.ass,
    // probe-an2, probe-org):
    //  - absolute position per word => no neighbor moves:
    //    the whole-line recentring is gone (the "kick"/"pulsing
    //    sentence" from reports) and one line's \fscy never
    //    re-stacks the other again;
    //  - in a multi-word Dialogue libass anchors the scale on the run's
    //    PEN: the word grew only rightward and upward (bottom-left
    //    corner - the active word's x1 stayed glued to the natural one).
    //   A single word with \an2 recenters by the SCALED width => the
    //    center stays fixed (probe-an2: x1 moves -0.1*advance and the
    //    measured center 959.5 = pos.x). \org doesn't help: the
    //    probe-org probe showed it only changes the ROTATION anchor;
    //  - vertically the scale anchors on the baseline (the active "rose"
    //    ~4px along with the growth): so the INK CENTER stays
    //    fixed, the \move lowers the line by
    //      delta = (S-100)/100 * (desc + cap/2)
    //    in sync with the \t (both linear => exact center the
    //    whole time) and with delta=0 at t=0 => slice switch without a jump.
    // posY base = lineTop + lineHeight because libass normalizes
    // asc+desc = 1.0 x nominal (fontMetrics.js), so it is exactly the
    // natural bottom anchor of \an2. No \fsp (single word = the
    // width that grows recenters by itself) and no \r/\N.
    if (styleConfig.animationType === 'wordpop') {
      const layout = computeHighlightBoxLayout(
        blockWords, playResX, playResY, scaledFontSize, alignment, marginV,
        cssFontFamily, styleConfig.bold, styleConfig.wordSpacing, assFontName, SUBTITLE_HIGHLIGHT_BOX, hMarginPx
      )
      const popPeak = 100 + (styleConfig.popSize || 0)
      // SMALLER base for the words without highlight (manual tweak): they
      // stay at 90% the whole time and do a faster 90->95->90 pop
      // (30ms up / 100ms total). The one that loses the highlight shrinks
      // smoothly 120->90 (same path in reverse with a fixed center); no
      // pop - the shrinking is already the transition (same as the preview's
      // transition).
      const BASE_SCALE = 90
      const SMALL_PEAK = 95
      const SMALL_UP_MS = 30
      const SMALL_TOTAL_MS = 100
      const renderScale = getFontRenderScale(assFontName)
      // nominal desc (asc+desc = 1.0 x nominal size, fontMetrics)
      // and cap in screen px (glyphs render at nominal*renderScale)
      const descNominal = scaledFontSize * (1 - getFontWinAscent(assFontName))
      const capScreen = measureTextMetrics('H', scaledFontSize, cssFontFamily, styleConfig.bold).ascent * renderScale
      // ink center fixed at ANY scale: y(S) = cy - (100-S)/100*K.
      // Linear in S => the linear \move tracks the linear \t exactly (and the
      // slice switch too: every slice is born at yBase/BASE_SCALE).
      const centerK = descNominal + capScreen / 2
      const yAt = (cy, S) => cy - Math.round((100 - S) / 100 * centerK)
      // PUSH X (manual request): along with the active word's growth, the
      // words on the SAME line retreat sign(j-active)*P - P = PUSH_FACTOR
      // of the half-width the active word opens (slight; there is always
      // room left because the sides stay at 90%). x1 of each event = x2 of the
      // previous one (continuity without a jump) and the active word always ENDS at the
      // natural cx (the highlight anchors in its own place); when the highlight
      // leaves the line, the displaced ones return via the same \move.
      const pushOf = (activeIdx) => activeIdx < 0
        ? 0
        : Math.round(WORDPOP_PUSH_FACTOR * ((popPeak - 100) / 100) * layout.wordWidths[activeIdx] / 2)
      const xAt = (j, activeIdx, P) => {
        const cxj = layout.wordXs[j] + layout.wordWidths[j] / 2
        if (activeIdx < 0 || P === 0) return cxj
        if (blockWords[j].lineIdx !== blockWords[activeIdx].lineIdx) return cxj
        return cxj + Math.sign(j - activeIdx) * P
      }

      for (let i = 0; i < blockWords.length; i++) {
        const eventStart = blockWords[i].start
        const eventEnd = i < blockWords.length - 1 ? blockWords[i + 1].start : block.end
        // duration of this slice's active word growth: applies to its \t
        // AND to every word's \move (everything in sync)
        const durationMs = Math.round((blockWords[i].end - blockWords[i].start) * 1000)
        const growMs = Math.max(30, Math.min(Math.round((styleConfig.popDuration || 0.08) * 1000), Math.floor(durationMs / 2)))
        const P = pushOf(i)
        const Pprev = i > 0 ? pushOf(i - 1) : 0
        for (let j = 0; j < blockWords.length; j++) {
          const w = blockWords[j]
          const wUpper = (w.text || '').toUpperCase()
          const cy = Math.round(layout.lineTops[w.lineIdx] + layout.lineHeight)
          const yBase = yAt(cy, BASE_SCALE)
          const yPeak = yAt(cy, popPeak)
          // end of previous slice -> state of this slice (continuity)
          const x1 = Math.round(xAt(j, i - 1, Pprev))
          const y1 = j === i - 1 ? yPeak : yBase
          const x2 = Math.round(xAt(j, i, P))
          const y2 = j === i ? yPeak : yBase
          const posTag = x1 === x2 && y1 === y2
            ? `\\pos(${x2},${y2})`
            : `\\move(${x1},${y1},${x2},${y2},0,${growMs})`
          let tags
          if (j === i) {
            // active word: born at the 90% base (continues straight from the
            // previous slice, no pulse), grows to popPeak and ends at the
            // natural cx. \move at the same instant as the \t => ink
            // center fixed during the scale.
            tags = `\\an2${posTag}\\fscx${BASE_SCALE}\\fscy${BASE_SCALE}\\c${highlightAss}\\t(0,${growMs},\\fscx${popPeak}\\fscy${popPeak})`
          } else if (i > 0 && j === i - 1) {
            tags = `\\an2${posTag}\\fscx${popPeak}\\fscy${popPeak}\\c${primaryAss}\\t(0,${growMs},\\fscx${BASE_SCALE}\\fscy${BASE_SCALE})`
          } else {
            tags = `\\an2${posTag}\\fscx${BASE_SCALE}\\fscy${BASE_SCALE}\\c${primaryAss}\\t(0,${SMALL_UP_MS},\\fscx${SMALL_PEAK}\\fscy${SMALL_PEAK})\\t(${SMALL_UP_MS},${SMALL_TOTAL_MS},\\fscx${BASE_SCALE}\\fscy${BASE_SCALE})`
          }
          // 1 Dialogue PER WORD: several \pos/\move in the same Dialogue
          // would be ignored by libass (only the first counts - the old
          // version's "DEDRAGONBALLZ on one line" bug). No space
          // between the tag block and the word: with \an2 centered the
          // space would render the word ~13px to the left.
          assContent += `Dialogue: 0,${secondsToAssTime(eventStart)},${secondsToAssTime(eventEnd)},Default,,0,0,0,,{${tags}}${wUpper}\n`
        }
      }
      continue
    }

    // HIGHLIGHT BOX / POPLINE: background highlight on the active word. The
    // layout is computed ONCE per block and used by the text and the
    // highlight, so the drawing always matches the visible word. The
    // text is emitted once per block (layer 1) and the highlight once
    // per word slice (layer 0, behind the text) - no duplicated
    // text. In highlightbox the highlight is a box surrounding the
    // line; in POPLINE it is a thin band at the base of the word ("almost a
    // line", slightly rounded corners - reference popline.png).
    //
    // POPLINE adds the pop: the band and the active word scale together
    // around the SAME point (\org at the word's center), so the band
    // stays glued to the word throughout the scale. In the preview both
    // are the same span, so they scale together effortlessly - and the time
    // windows match the `subtitle-popline` animation (peak at 40%).
    if (styleConfig.animationType === 'highlightbox' || styleConfig.animationType === 'popline') {
      const isPopline = styleConfig.animationType === 'popline'
      const boxCfg = isPopline ? SUBTITLE_POPLINE_BOX : SUBTITLE_HIGHLIGHT_BOX
      const layout = computeHighlightBoxLayout(
        blockWords, playResX, playResY, scaledFontSize, alignment, marginV,
        cssFontFamily, styleConfig.bold, styleConfig.wordSpacing, assFontName, boxCfg, hMarginPx
      )

      // Pop window: \t times are MILLISECONDS in libass/VSFilter
      // (not centiseconds like Dialogue times) - validated by a
      // probe with the bundled ffmpeg: values in cs ended the pop 10x
      // before it appeared. *Ms names on purpose (the legacy code has
      // "durCs" storing ms - confusing).
      const popPeak = 100 + (styleConfig.popSize || 0)
      const popTagFor = (w, t1Ms) => {
        const wordMs = Math.max(8, Math.round((w.end - w.start) * 1000))
        const durMs = Math.max(8, Math.min(Math.round((styleConfig.popDuration || 0.10) * 1000), wordMs))
        const growMs = Math.max(3, Math.round(durMs * SUBTITLE_POP_PEAK_RATIO))
        return `\\t(${t1Ms},${t1Ms + growMs},\\fscx${popPeak}\\fscy${popPeak})\\t(${t1Ms + growMs},${t1Ms + durMs},\\fscx100\\fscy100)`
      }

      const textStart = secondsToAssTime(blockWords[0].start)
      const textEnd = secondsToAssTime(block.end)
      const blockStart = blockWords[0].start
      for (let j = 0; j < blockWords.length; j++) {
        const w = blockWords[j]
        const wx = Math.round(layout.wordXs[j])
        const wy = Math.round(layout.lineTops[w.lineIdx])
        let wordTag = `{\\an7\\pos(${wx},${wy})`
        if (isPopline) {
          // The text is born at blockStart, so the pop starts when the
          // word becomes active: t1 = word start relative to the block.
          const cx = Math.round(layout.wordXs[j] + layout.wordWidths[j] / 2)
          const cy = Math.round(wy + scaledFontSize / 2)
          const t1 = Math.max(0, Math.round((w.start - blockStart) * 1000))
          wordTag += `\\org(${cx},${cy})${popTagFor(w, t1)}`
        }
        wordTag += '}'
        assContent += `Dialogue: 1,${textStart},${textEnd},Default,,0,0,0,,${wordTag}${w.text.toUpperCase()}\n`
      }

      for (let i = 0; i < blockWords.length; i++) {
        const w = blockWords[i]
        const nextStart = i < blockWords.length - 1 ? blockWords[i + 1].start : block.end
        const boxX = Math.round(layout.wordXs[i] - layout.padX)
        // POPLINE: thin band anchored on the line's baseline (bandOffsetY
        // already measures from the line top to the band top); highlightbox
        // keeps the box surrounding the line (lineTop - padY).
        const boxY = isPopline
          ? Math.round(layout.lineTops[w.lineIdx] + layout.bandOffsetY)
          : Math.round(layout.lineTops[w.lineIdx] - layout.padY)
        const boxW = Math.round(layout.wordWidths[i] + layout.padX * 2)
        const boxH = isPopline
          ? Math.round(layout.bandHeight)
          : Math.round(scaledFontSize + layout.padY * 2)
        const path = highlightBoxPath(boxW, boxH, layout.radius)
        let boxTag = `{\\an7\\pos(${boxX},${boxY})`
        if (isPopline) {
          // The box is born together with the active word => t1 = 0. Same
          // \org center as the text: scales in perfect sync.
          const cx = Math.round(layout.wordXs[i] + layout.wordWidths[i] / 2)
          const cy = Math.round(layout.lineTops[w.lineIdx] + scaledFontSize / 2)
          boxTag += `\\org(${cx},${cy})`
        }
        boxTag += `\\p1\\bord0\\shad0\\c${highlightAss}`
        if (isPopline) boxTag += popTagFor(w, 0)
        boxTag += `}${path}{\\p0}`
        assContent += `Dialogue: 0,${secondsToAssTime(w.start)},${secondsToAssTime(nextStart)},Default,,0,0,0,,${boxTag}\n`
      }
      continue
    }

    // SCALE (Headline) and SCALE SNAP (Simple Pop): one Dialogue PER LINE per
    // active-word slice, each
    // line pinned with \an2\pos at its fixed line bottom (layout computed
    // once per block). The legacy single multi-line Dialogue let the inline
    // \fscy of the pop scale the LINE BOX (+0.1 x fontSize), so the \an2
    // block anchor re-stacked the other line on every slice: ffmpeg probe
    // (2-line block, fscy110) - the top line's baseline bounced 139 -> 127
    // -> 135 px depending on which line held the active word (the reported
    // "second line pushes the top line"). Absolute per-line positions kill
    // the movement: neighbors never move, only the active glyph scales. The
    // line holding the active word adds (popPeak-100)/100 x desc to pos.y:
    // the scaled box anchors its baseline at cy - 1.1 x desc (probe: +3px
    // rise), so the compensation restores the exact natural baseline.
    //
    // Headline's pop is VERTICAL ONLY (see getAnimationTag): \fscx changes the
    // glyph advance, so a horizontal pop re-flows the line and the centered
    // block jumps sideways at every word change (probe: 6px). With \fscy
    // alone the line's layout is identical to a no-pop render — same as the
    // preview's transform, which never reflows.
    if (styleConfig.animationType === 'scale' || styleConfig.animationType === 'scalesnap') {
      const layout = computeHighlightBoxLayout(
        blockWords, playResX, playResY, scaledFontSize, alignment, marginV,
        cssFontFamily, styleConfig.bold, styleConfig.wordSpacing, assFontName, SUBTITLE_HIGHLIGHT_BOX, hMarginPx
      )
      const popPeak = 100 + (styleConfig.popSize || 5)
      const descNominal = scaledFontSize * (1 - getFontWinAscent(assFontName))
      const popLineComp = Math.round(((popPeak - 100) / 100) * descNominal)
      // Contiguous groups of lineIdx (groupWordsIntoBlocks assigns lines in
      // order); each entry holds the blockWords indexes of that line.
      const lineGroups = []
      for (let j = 0; j < blockWords.length; j++) {
        const w = blockWords[j]
        if (lineGroups.length === 0 || lineGroups[lineGroups.length - 1].lineIdx !== w.lineIdx) {
          lineGroups.push({ lineIdx: w.lineIdx, idxs: [] })
        }
        lineGroups[lineGroups.length - 1].idxs.push(j)
      }
      for (let i = 0; i < blockWords.length; i++) {
        const eventStart = blockWords[i].start
        const eventEnd = i < blockWords.length - 1 ? blockWords[i + 1].start : block.end
        for (const group of lineGroups) {
          // + popLineComp only on the line that carries the pop: its scaled
          // box grows downward-anchored, lifting the baseline by 0.1 x desc.
          const cy = Math.round(layout.lineTops[group.lineIdx] + layout.lineHeight) +
            (group.idxs.includes(i) ? popLineComp : 0)
          const posTag = `{\\an2\\pos(${Math.round(playResX / 2)},${cy})}`
          const parts = []
          for (const j of group.idxs) {
            const w = blockWords[j]
            if (j === i) {
              parts.push(getAnimationTag(styleConfig, highlightAss, w, w.end - w.start, popMeasure))
              parts.push(w.text.toUpperCase())
              // \r resets to the Style - including alignment/position - so
              // the pin is re-asserted right after it: words past the active
              // one keep the fixed \pos (otherwise they fall back to the
              // margin-based anchor and the line jumps).
              parts.push(`{\\r}${posTag}`)
            } else {
              parts.push(w.text.toUpperCase())
            }
            if (j !== group.idxs[group.idxs.length - 1]) parts.push(' ')
          }
          let text = parts.join('')
          if (styleConfig.wordSpacing !== 100) {
            // Same gap scaling as the legacy path: tag before the space the
            // split consumed (110 -> 1.1x gap, like the preview word-spacing).
            const spaceParts = text.split(' ')
            text = spaceParts
              .map((part, idx) => (idx < spaceParts.length - 1 ? part + `{\\fscx${styleConfig.wordSpacing}} {\\fscx100}` : part))
              .join('')
          }
          assContent += `Dialogue: 0,${secondsToAssTime(eventStart)},${secondsToAssTime(eventEnd)},Default,,0,0,0,,${posTag}${text}\n`
        }
      }
      continue
    }

    for (let i = 0; i < blockWords.length; i++) {
      const word = blockWords[i]
      const nextStart = i < blockWords.length - 1 ? blockWords[i + 1].start : block.end
      const eventStart = word.start
      const eventEnd = nextStart

      const parts = []
      let lastLineIdx = -1

      for (let j = 0; j < blockWords.length; j++) {
        const w = blockWords[j]
        const wUpper = w.text.toUpperCase()

        if (w.lineIdx !== lastLineIdx && lastLineIdx !== -1) {
          parts.push('\\N')
        }
        lastLineIdx = w.lineIdx

        if (styleConfig.animationType === 'karaoke') {
          if (j <= i) {
            parts.push(`{\\c${highlightAss}}${wUpper}{\\c${primaryAss}}`)
          } else {
            parts.push(wUpper)
          }
        } else {
          if (j === i) {
            parts.push(getAnimationTag(styleConfig, highlightAss, w, w.end - w.start, popMeasure))
            parts.push(wUpper)
            parts.push('{\\r}')
          } else {
            parts.push(wUpper)
          }
        }

        if (j < blockWords.length - 1 && blockWords[j + 1].lineIdx === w.lineIdx) {
          parts.push(' ')
        }
      }

      let text = parts.join('')

      if (styleConfig.wordSpacing !== 100) {
        // Scale the gap between words to wordSpacing% (110 -> 1.1x, same as
        // the preview CSS word-spacing). The tag goes BEFORE the gap: the
        // split consumed the original space, so a leading space in the suffix
        // rendered TWO gaps (1.0x + 1.1x) and the words looked spread apart.
        const spaceParts = text.split(' ')
        text = spaceParts
          .map((part, idx) => {
            if (idx < spaceParts.length - 1) {
              return part + `{\\fscx${styleConfig.wordSpacing}} {\\fscx100}`
            }
            return part
          })
          .join('')
      }

      assContent += `Dialogue: 0,${secondsToAssTime(eventStart)},${secondsToAssTime(eventEnd)},Default,,0,0,0,,${text}\n`
    }
  }

  return assContent
}

function groupWordsIntoBlocks(allWords, playResX, fontSize, styleConfig, wordsPerLine = 4, linesCount = 2, styleId = null, autoLineWrap = false, cssFontFamily = '', assFontName = '', marginPx = 10) {
  const maxWordsPerLine = wordsPerLine
  const maxLines = linesCount
  const maxWordsPerBlock = maxWordsPerLine * maxLines

  const hasPop = styleId ? hasPopEffect(styleId) : false
  const popScale = hasPop ? (100 + (styleConfig.popSize || 0)) / 100 : 1

  const marginL = marginPx
  const marginR = marginPx
  const availableWidth = playResX - marginL - marginR

  // REAL width (canvas + renderScale), the SAME as the highlightbox layout and
  // the pop's \fsp compensation. The old character-based estimate
  // (0.63em/word) overestimates the text: the line "grew" more than
  // libass draws and broke even when it fit - with autoLineWrap
  // off that false break blew past maxLines and pushed the last
  // word into its own Dialogue, while the preview (which only breaks
  // by count) kept everything together in the same subtitle.
  const renderScale = getFontRenderScale(assFontName)
  const spaceWidth = measureTextMetrics(' ', fontSize, cssFontFamily, styleConfig.bold).width * ((styleConfig.wordSpacing || 100) / 100) * renderScale

  const blocks = []
  let currentBlock = { words: [], start: 0, end: 0, lineIdx: 0, wordsInLine: 0, lineWidth: 0 }

  const pushBlock = () => {
    if (currentBlock.words.length > 0) {
      currentBlock.end = currentBlock.words[currentBlock.words.length - 1].end
      blocks.push(currentBlock)
    }
    currentBlock = { words: [], start: 0, end: 0, lineIdx: 0, wordsInLine: 0, lineWidth: 0 }
  }

  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i]

    if (currentBlock.words.length >= maxWordsPerBlock) {
      pushBlock()
      currentBlock.start = word.start
    }

    const wordWidth = measureTextMetrics(word.text.toUpperCase(), fontSize, cssFontFamily, styleConfig.bold).width * renderScale * popScale

    if (currentBlock.wordsInLine >= maxWordsPerLine) {
      currentBlock.lineIdx++
      currentBlock.wordsInLine = 0
      currentBlock.lineWidth = 0
      // With automatic wrapping the extra line does not close the group: it
      // only ends when the word count is reached (words x lines).
      if (!autoLineWrap && currentBlock.lineIdx >= maxLines) {
        pushBlock()
        currentBlock.start = word.start
      }
    }

    if (currentBlock.wordsInLine > 0 && currentBlock.lineWidth + spaceWidth + wordWidth > availableWidth) {
      currentBlock.lineIdx++
      currentBlock.wordsInLine = 0
      currentBlock.lineWidth = 0
      if (!autoLineWrap && currentBlock.lineIdx >= maxLines) {
        pushBlock()
        currentBlock.start = word.start
      }
    }

    currentBlock.words.push({ ...word, lineIdx: currentBlock.lineIdx })
    currentBlock.wordsInLine++
    currentBlock.lineWidth += currentBlock.wordsInLine === 1 ? wordWidth : spaceWidth + wordWidth
  }

  pushBlock()

  return blocks
}

function buildBlockText(block, activeWordIndex, styleConfig, highlightAss, eventDuration) {
  const parts = []
  let lastLineIdx = -1

  for (let i = 0; i < block.words.length; i++) {
    const word = block.words[i]
    const isActive = i === activeWordIndex

    if (word.lineIdx !== lastLineIdx && lastLineIdx !== -1) {
      parts.push('\\N')
    }
    lastLineIdx = word.lineIdx

    const wUpper = word.text.toUpperCase()

    if (isActive) {
      parts.push(getAnimationTag(styleConfig, highlightAss, word, eventDuration))
      parts.push(wUpper)
      parts.push('{\\r}')
    } else {
      parts.push(wUpper)
    }

    if (i < block.words.length - 1 && block.words[i + 1].lineIdx === word.lineIdx) {
      parts.push(' ')
    }
  }

  let text = parts.join('')

  if (styleConfig.wordSpacing !== 100) {
    // Same single-gap scaling as the block renderer (tag before the gap, not
    // a leading space, or the words render twice as far apart as the preview).
    const spaceParts = text.split(' ')
    text = spaceParts
      .map((part, i) => {
        if (i < spaceParts.length - 1) {
          return part + `{\\fscx${styleConfig.wordSpacing}} {\\fscx100}`
        }
        return part
      })
      .join('')
  }

  return text
}

let measureCanvas = null
const textMeasureCache = {}

function getCanvasFontStyle(fontSize, fontFamily, bold) {
  const cssFamily = (fontFamily || 'Montserrat, sans-serif').split(',')[0].replace(/['"]/g, '').trim()
  return `${bold ? 'bold' : 'normal'} ${fontSize}px "${cssFamily}"`
}

export function measureTextMetrics(text, fontSize, fontFamily, bold) {
  const key = `${fontFamily}|${bold}|${Math.round(fontSize)}|${text}`
  if (textMeasureCache[key] !== undefined) return textMeasureCache[key]

  const fallback = {
    width: text.length * fontSize * 0.63,
    ascent: fontSize * 0.8,
    descent: fontSize * 0.2,
  }
  try {
    if (typeof document !== 'undefined' && document.createElement) {
      if (!measureCanvas) measureCanvas = document.createElement('canvas')
      const ctx = measureCanvas.getContext('2d')
      ctx.font = getCanvasFontStyle(fontSize, fontFamily, bold)
      const m = ctx.measureText(text)
      const width = m.width
      const ascent = m.actualBoundingBoxAscent || fallback.ascent
      const descent = m.actualBoundingBoxDescent || fallback.descent
      const result = { width, ascent, descent }
      textMeasureCache[key] = result
      return result
    }
  } catch (e) {
    // fallback to estimate
  }
  return fallback
}

// Layout of the "highlight box" style: the box and the text share the
// SAME coordinates, so the box always surrounds the visible word.
//
// Anchoring validated by a probe with the bundled ffmpeg (bin/ffmpeg.exe),
// rendering "HHH" at size=200 and reading the baseline in the pixels:
//   - libass's line box is 1.0 x nominal font size
//     (asc + desc = 1.000) for the app's 16 fonts;
//   - the advance between lines is also 1.0 x nominal size;
//   - {\an7\pos(x,y)} anchors the TOP of the line box at y and the origin of
//     the "pen" (advance) at x - same rule as the native alignments
//     \an2 (base = playResY - marginV - desc), \an8 (top = marginV) and
//     \an5 (block center at the middle of the frame);
//   - the {\p1} drawing uses 1 unit = 1 px, regardless of size.
// When swapping ffmpeg, revalidate with the same probe.
//
// Widths: libass positions the line box at the nominal size but
// renders the glyphs at nominal*renderScale (see fontMetrics.js), since
// it normalizes by the OS/2 winAscent+winDescent pair. The canvas measures in "real
// em", so the widths are multiplied by renderScale - without that
// the words come out too spaced and the box does not surround the word.
// The padding/radius ratios come from boxCfg (SUBTITLE_HIGHLIGHT_BOX or
// SUBTITLE_POPLINE_BOX), keeping preview and export with the SAME slack.
function computeHighlightBoxLayout(blockWords, playResX, playResY, fontSize, alignment, marginV, fontFamily, bold, wordSpacing = 100, assFontName = '', boxCfg = SUBTITLE_HIGHLIGHT_BOX, marginPx = 10) {
  const marginL = marginPx
  const marginR = marginPx
  const availableWidth = playResX - marginL - marginR

  const renderScale = getFontRenderScale(assFontName)

  // padX follows the render scale: the box must keep the SAME
  // proportion to the word as the preview (padX/word = paddingXRatio/em in
  // both). Without scaling, for fonts with low renderScale the nominal padX
  // (16.8px) ends up larger than the visible space and the box touches the
  // neighboring word. padY and radius stay in nominal units because they
  // attach to the line box (nominal height = fontSize), not to the glyphs.
  const padX = fontSize * boxCfg.paddingXRatio * renderScale

  // POPLINE (bandHeightRatio present): thin band at the BASE of the word
  // instead of a box surrounding the line. The band top comes from the line's
  // baseline (winAscent x font from the top, see fontMetrics.js)
  // minus bandTopRatio x font - so the band only grazes the base of the
  // letters, as in the reference (popline.png). The radius is relative to the
  // band's HEIGHT; highlightbox keeps padY/radius in font units.
  const isBand = boxCfg.bandHeightRatio !== undefined
  const padY = isBand ? 0 : fontSize * boxCfg.paddingYRatio
  const bandHeight = isBand ? fontSize * boxCfg.bandHeightRatio : 0
  const bandOffsetY = isBand ? fontSize * (getFontWinAscent(assFontName) - boxCfg.bandTopRatio) : 0
  const radius = Math.max(1, Math.round(
    isBand ? bandHeight * boxCfg.borderRadiusRatio : fontSize * boxCfg.borderRadiusRatio
  ))

  const lineHeight = fontSize
  const numLines = Math.max(...blockWords.map(w => w.lineIdx)) + 1

  const spaceWidth = measureTextMetrics(' ', fontSize, fontFamily, bold).width * (wordSpacing / 100) * renderScale
  const wordWidths = blockWords.map(w => measureTextMetrics(w.text.toUpperCase(), fontSize, fontFamily, bold).width * renderScale)

  // top of the first line replicating libass's native anchoring
  let lineTop0
  if (alignment <= 3) {
    // baseline of the last line = playResY - marginV - desc*fontSize
    lineTop0 = playResY - marginV - (numLines - 1) * lineHeight - fontSize
  } else if (alignment >= 7) {
    lineTop0 = marginV
  } else {
    lineTop0 = playResY / 2 - (numLines * lineHeight) / 2
  }

  const lineTops = []
  for (let li = 0; li < numLines; li++) lineTops.push(lineTop0 + li * lineHeight)

  // each line centered the way libass does it, without exceeding the margins
  const lineStarts = []
  for (let li = 0; li < numLines; li++) {
    const idxs = []
    for (let i = 0; i < blockWords.length; i++) {
      if (blockWords[i].lineIdx === li) idxs.push(i)
    }
    const lineWidth = idxs.reduce((acc, i) => acc + wordWidths[i], 0) +
      Math.max(0, idxs.length - 1) * spaceWidth
    lineStarts[li] = Math.max(marginL, marginL + (availableWidth - lineWidth) / 2)
  }

  // advance x of each word (pen origin, as \an7\pos uses)
  const wordXs = blockWords.map((w, idx) => {
    let x = lineStarts[w.lineIdx]
    for (let j = 0; j < idx; j++) {
      if (blockWords[j].lineIdx === w.lineIdx) x += wordWidths[j] + spaceWidth
    }
    return x
  })

  return { wordWidths, wordXs, lineTops, padX, padY, radius, bandOffsetY, bandHeight, lineHeight, numLines }
}

function highlightBoxPath(boxW, boxH, radius) {
  // CSS automatically clamps the border-radius to the element size;
  // the manual path needs the same protection - in POPLINE padX is 0 and
  // a narrow word would produce negative corners (inverted coordinates).
  radius = Math.max(0, Math.min(radius, boxW / 2, boxH / 2))
  const k = radius * 0.5523
  const x = (v) => Math.round(v)
  return (
    `m ${x(radius)} 0 ` +
    `l ${x(boxW - radius)} 0 ` +
    `b ${x(boxW - radius + k)} 0 ${x(boxW)} ${x(radius - k)} ${x(boxW)} ${x(radius)} ` +
    `l ${x(boxW)} ${x(boxH - radius)} ` +
    `b ${x(boxW)} ${x(boxH - radius + k)} ${x(boxW - radius + k)} ${x(boxH)} ${x(boxW - radius)} ${x(boxH)} ` +
    `l ${x(radius)} ${x(boxH)} ` +
    `b ${x(radius - k)} ${x(boxH)} 0 ${x(boxH - radius + k)} 0 ${x(boxH - radius)} ` +
    `l 0 ${x(radius)} ` +
    `b 0 ${x(radius - k)} ${x(radius - k)} 0 ${x(radius)} 0`
  )
}

function getAnimationTag(styleConfig, highlightAss, word, eventDuration, measure) {
  const { animationType } = styleConfig
  const popSz = styleConfig.popSize || 5
  const popDur = styleConfig.popDuration || 0.18
  const popPeak = 100 + popSz

  // LAYOUT COMPENSATION (pushing the phrase):
  // in libass \fscx takes part in the line measurement - the glyph advance is
  // scaled, so the active word "pushes" its neighbors during the pop.
  // The proportional \fsp (width * (scale-100)/100 / nLetters) gives back
  // exactly the pixels gained in the advance: the line STAYS PUT and the
  // word grows in place - same as the preview (CSS transform does not
  // reflow). \fsp negative when scale > 100 (shrinks the internal
  // gaps) and positive when < 100 (compensates the shrinkage).
  // measure comes from the call site (width in PlayRes units, already with
  // renderScale) - without it the old behavior without \fsp is kept.
  const wordUpper = (word.text || '').toUpperCase()
  const nLetters = wordUpper.length
  const widthPx = measure && nLetters > 0 ? measure(wordUpper) : null
  const fspAt = (scale) => {
    if (widthPx === null) return null
    const v = -widthPx * ((scale - 100) / 100) / nLetters
    return Math.abs(v) < 0.05 ? 0 : parseFloat(v.toFixed(2))
  }
  const fspTag = (v) => (v === null || v === 0 ? '' : `\\fsp${v}`)

  switch (animationType) {
    case 'karaoke': {
      const durationCs = Math.round(eventDuration * 100)
      return `{\\kf${durationCs}}`
    }
    case 'scale': {
      // SMOOTH + VERTICAL ONLY (Headline). \fscx changes the glyph ADVANCE, so
      // a horizontal pop re-flows the line and the centered block jumps
      // sideways at every word change (probe: 6px, and the \fsp compensation
      // that should prevent it is not interpolated by libass inside a \t).
      // \fscy alone leaves the line's layout identical to a no-pop render,
      // matching the preview's scaleY (a CSS transform never reflows).
      const durationMs = Math.max(0, Math.round((word.end - word.start) * 1000))
      const growMs = Math.max(1, Math.min(Math.round(popDur * 1000), Math.floor(durationMs / 2)))
      const shrinkMs = Math.max(growMs, Math.min(durationMs, growMs + Math.round(popDur * 1000)))
      return `{\\fscy100\\t(0,${growMs},\\fscy${popPeak})\\t(${growMs},${shrinkMs},\\fscy100)\\c${highlightAss}}`
    }
    case 'scalesnap': {
      // SNAP (Simple Pop): instantly at the peak on BOTH axes for the whole
      // word — no \t at all.
      return `{\\fscx${popPeak}\\fscy${popPeak}${fspTag(fspAt(popPeak))}\\c${highlightAss}}`
    }
    case 'wordpop': {
      // Velhinho.mp4: the active word only GROWS (100 -> popPeak) and
      // HOLDS until the end of the event - it never starts shrunk (the old
      // 90 -> 110 -> 100 "blinked" small) and never returns to normal in the
      // middle of the speech. NO \\fsp: the scaled advance pushes the neighbors
      // and libass recenters the line - same as the preview's font-size.
      const durationMs = Math.round((word.end - word.start) * 1000)
      const growMs = Math.max(30, Math.min(Math.round(popDur * 1000), Math.floor(durationMs / 2)))
      return `{\\t(0,${growMs},\\fscx${popPeak}\\fscy${popPeak})\\c${highlightAss}}`
    }
    case 'highlight':
    default:
      return `{\\c${highlightAss}}`
  }
}

export function parseSrtTimeToSecondsExport(timeStr) {
  return parseSrtTimeToSeconds(timeStr)
}

function secondsToSrtTime(seconds) {
  const totalMs = Math.round(seconds * 1000)
  const h = Math.floor(totalMs / 3600000)
  const m = Math.floor((totalMs % 3600000) / 60000)
  const s = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function parsePremiereXml(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  const timebaseEl = doc.querySelector('timebase')
  const fps = timebaseEl ? parseInt(timebaseEl.textContent) : 30

  const clipItems = doc.querySelectorAll('clipitem')
  const segments = []

  clipItems.forEach(item => {
    const inEl = item.querySelector('in')
    const outEl = item.querySelector('out')
    const startEl = item.querySelector('start')
    const endEl = item.querySelector('end')

    if (inEl && outEl && startEl && endEl) {
      segments.push({
        in: parseInt(inEl.textContent),
        out: parseInt(outEl.textContent),
        start: parseInt(startEl.textContent),
        end: parseInt(endEl.textContent),
      })
    }
  })

  segments.sort((a, b) => a.start - b.start)

  console.log(`[parsePremiereXml] fps=${fps}, segments=${segments.length}`)
  segments.forEach((seg, i) => {
    console.log(`  seg ${i}: in=${seg.in} out=${seg.out} start=${seg.start} end=${seg.end} (kept ${(seg.out - seg.in) / fps}s, timeline ${(seg.end - seg.start) / fps}s)`)
  })

  return { fps, segments }
}

export function remapSubtitleTimestamps(subtitles, segments, fps) {
  if (!segments || segments.length === 0) return subtitles

  function findCutTime(originalTimeSec) {
    const originalFrame = Math.round(originalTimeSec * fps)

    for (const seg of segments) {
      if (originalFrame >= seg.in && originalFrame < seg.out) {
        return (seg.start + (originalFrame - seg.in)) / fps
      }
      if (originalFrame < seg.in) {
        return seg.start / fps
      }
    }

    const last = segments[segments.length - 1]
    return last.end / fps
  }

  return subtitles.map(sub => {
    const origStart = parseSrtTimeToSeconds(sub.start)
    const origEnd = parseSrtTimeToSeconds(sub.end)

    const newStart = Math.max(0, findCutTime(origStart))
    const newEnd = Math.max(newStart + 0.01, findCutTime(origEnd))

    const result = {
      ...sub,
      start: secondsToSrtTime(newStart),
      end: secondsToSrtTime(newEnd)
    }

    if (sub.words && sub.words.length > 0) {
      result.words = sub.words.map(w => ({
        ...w,
        start: secondsToSrtTime(Math.max(0, findCutTime(parseSrtTimeToSeconds(w.start)))),
        end: secondsToSrtTime(Math.max(0, findCutTime(parseSrtTimeToSeconds(w.end))))
      }))
    }

    return result
  })
}

export function formatSecondsToSrtTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return (
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0') + ',' +
    String(ms).padStart(3, '0')
  )
}

export function groupWordsIntoSegments(wordEntries, wordsPerLine = 4, linesCount = 2, persistence = 1, smart = false) {
  if (!wordEntries || wordEntries.length === 0) return []

  const formatTime = (timeStr) => {
    if (!timeStr) return '00:00:00,000'
    if (timeStr.includes(',')) return timeStr
    const parts = timeStr.split(':')
    if (parts.length === 3) {
      return parts[0] + ':' + parts[1] + ':' + parts[2].replace('.', ',')
    }
    return timeStr
  }

  const stripTrailingDot = (text) => {
    if (!smart) return text
    return text.replace(/\.$/, '')
  }

  const segments = []
  let currentWords = []
  let currentStart = null

  const pushSegment = () => {
    if (currentWords.length === 0) return
    const text = currentWords.map(w => stripTrailingDot(w.text)).join(' ')
    const lastWord = currentWords[currentWords.length - 1]
    segments.push({
      start: formatTime(currentStart),
      end: formatTime(lastWord.end),
      text,
      words: currentWords.map(w => ({ text: stripTrailingDot(w.text), start: formatTime(w.start), end: formatTime(w.end) })),
    })
    currentWords = []
    currentStart = null
  }

  for (let i = 0; i < wordEntries.length; i++) {
    const word = wordEntries[i]
    const wordText = (word.text || '').trim()
    if (!wordText) continue

    if (currentStart === null) currentStart = word.start
    currentWords.push({ text: wordText, start: word.start, end: word.end })

    const nextWord = wordEntries[i + 1]
    const maxWords = wordsPerLine * linesCount
    const endsSentence = smart ? /[.!?]$/.test(wordText) : /[.!?;]$/.test(wordText)
    const hasGap = nextWord && (parseSrtTimeToSeconds(nextWord.start) - parseSrtTimeToSeconds(word.end)) > 0.3

    if (currentWords.length >= maxWords || endsSentence || hasGap) {
      pushSegment()
    }
  }

  pushSegment()

  if (persistence > 0) {
    for (let i = 0; i < segments.length - 1; i++) {
      const currentEnd = parseSrtTimeToSeconds(segments[i].end)
      const nextStart = parseSrtTimeToSeconds(segments[i + 1].start)
      const gap = nextStart - currentEnd
      if (gap > 0 && gap <= persistence) {
        segments[i].end = secondsToSrtTime(Math.min(currentEnd + persistence, nextStart))
      }
    }
  }

  return segments
}
