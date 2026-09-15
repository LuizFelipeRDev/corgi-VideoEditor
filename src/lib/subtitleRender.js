import { SUBTITLE_STYLES } from './subtitleStyles'

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

export function generateAssContent(subtitles, styleId, position, videoWidth, videoHeight) {
  const styleConfig = SUBTITLE_STYLES[styleId] || SUBTITLE_STYLES['corgi-bold']

  const playResX = videoWidth || 1920
  const playResY = videoHeight || 1080
  const dimensionScale = Math.max(playResY / 1080, 0.5)

  const assFontName = styleConfig.fontFamily.split(',')[0].trim()
  const fontScale = styleConfig.italic ? 0.9 : 1.0
  const scaledFontSize = Math.round(styleConfig.fontSize * fontScale * dimensionScale)

  let alignment = 2
  let marginV = 40
  if (position === 'top') {
    alignment = 8
    marginV = 20
  } else if (position === 'middle') {
    alignment = 5
    marginV = 0
  }

  const primaryAss = hexToAss(styleConfig.primaryColor)
  const highlightAss = hexToAss(styleConfig.highlightColor)
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
Style: Default,${assFontName},${scaledFontSize},${primaryAss},${highlightAss},${outlineAss},${shadowAss},${styleConfig.bold ? -1 : 0},${styleConfig.italic ? -1 : 0},0,0,100,100,${styleConfig.letterSpacing},0,1,${styleConfig.outlineSize},${styleConfig.shadowDepth},${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const allWords = []
  for (const sub of subtitles) {
    if (sub.words && sub.words.length > 0) {
      for (const word of sub.words) {
        const wordText = stripEmojis(word.text)
        if (!wordText) continue
        allWords.push({
          text: wordText,
          start: parseSrtTimeToSeconds(word.start),
          end: parseSrtTimeToSeconds(word.end),
        })
      }
    } else {
      const words = sub.text.split(/\s+/).filter(Boolean)
      const subStart = parseSrtTimeToSeconds(sub.start)
      const subEnd = parseSrtTimeToSeconds(sub.end)
      const duration = subEnd - subStart
      const wordDuration = duration / words.length

      for (let i = 0; i < words.length; i++) {
        const wordText = stripEmojis(words[i])
        if (!wordText) continue
        allWords.push({
          text: wordText,
          start: subStart + i * wordDuration,
          end: subStart + (i + 1) * wordDuration,
        })
      }
    }
  }

  if (allWords.length === 0) return null

  const blocks = groupWordsIntoBlocks(allWords, playResX, scaledFontSize, styleConfig)

  for (const block of blocks) {
    const blockWords = block.words
    for (let i = 0; i < blockWords.length; i++) {
      const word = blockWords[i]
      const nextStart = i < blockWords.length - 1 ? blockWords[i + 1].start : block.end
      const eventStart = word.start
      const eventEnd = nextStart

      const lineText = buildBlockText(block, i, styleConfig, highlightAss)
      const event = `Dialogue: 0,${secondsToAssTime(eventStart)},${secondsToAssTime(eventEnd)},Default,,0,0,0,,${lineText}`
      assContent += event + '\n'
    }
  }

  return assContent
}

function groupWordsIntoBlocks(allWords, playResX, fontSize, styleConfig) {
  const avgCharWidth = fontSize * 0.6
  const maxCharsPerLine = Math.floor((playResX * 0.8) / avgCharWidth)
  const maxLines = 2
  const maxCharsPerBlock = maxCharsPerLine * maxLines

  const blocks = []
  let currentBlock = { words: [], charCount: 0, start: 0, end: 0, lineIdx: 0 }

  for (const word of allWords) {
    const wordLen = word.text.length + 1

    if (currentBlock.charCount + wordLen > maxCharsPerBlock && currentBlock.words.length > 0) {
      currentBlock.end = currentBlock.words[currentBlock.words.length - 1].end
      blocks.push(currentBlock)
      currentBlock = { words: [], charCount: 0, start: word.start, end: 0, lineIdx: 0 }
    }

    if (currentBlock.charCount + wordLen > maxCharsPerLine && currentBlock.words.length > 0) {
      currentBlock.lineIdx++
      if (currentBlock.lineIdx >= maxLines) {
        currentBlock.end = currentBlock.words[currentBlock.words.length - 1].end
        blocks.push(currentBlock)
        currentBlock = { words: [], charCount: 0, start: word.start, end: 0, lineIdx: 0 }
      } else {
        currentBlock.charCount = 0
      }
    }

    currentBlock.words.push({ ...word, lineIdx: currentBlock.lineIdx })
    currentBlock.charCount += wordLen
  }

  if (currentBlock.words.length > 0) {
    currentBlock.end = currentBlock.words[currentBlock.words.length - 1].end
    blocks.push(currentBlock)
  }

  return blocks
}

function buildBlockText(block, activeWordIndex, styleConfig, highlightAss) {
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
      parts.push(getAnimationTag(styleConfig, highlightAss, word))
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
    const spaceParts = text.split(' ')
    text = spaceParts
      .map((part, i) => {
        if (i < spaceParts.length - 1) {
          return part + ` {\\fscx${styleConfig.wordSpacing}} {\\fscx100}`
        }
        return part
      })
      .join('')
  }

  return text
}

function getAnimationTag(styleConfig, highlightAss, word) {
  const { animationType } = styleConfig

  switch (animationType) {
    case 'karaoke': {
      const durationCs = Math.round((word.end - word.start) * 100)
      return `{\\kf${durationCs}\\c${highlightAss}}`
    }
    case 'scale':
      return `{\\fscx110\\fscy110\\c${highlightAss}}`
    case 'bounce': {
      const bouncePct = 120
      return `{\\t(0,50,\\fscx${bouncePct}\\fscy${bouncePct})\\t(50,100,\\fscx100\\fscy100)\\c${highlightAss}}`
    }
    case 'highlight':
    default:
      return `{\\c${highlightAss}}`
  }
}

export function parseSrtTimeToSecondsExport(timeStr) {
  return parseSrtTimeToSeconds(timeStr)
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
