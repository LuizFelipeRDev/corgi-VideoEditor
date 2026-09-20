import { SUBTITLE_STYLES, hasPopEffect } from './subtitleStyles'

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

export function generateAssContent(subtitles, styleId, position, videoWidth, videoHeight, wordsPerLine = 4, linesCount = 2, primaryColorOverride, highlightColorOverride, fontId, positionMode, positionPercent, fontSizeOverride) {
  const styleConfig = SUBTITLE_STYLES[styleId] || SUBTITLE_STYLES['corgi-bold']

  const playResX = videoWidth || 1920
  const playResY = videoHeight || 1080
  const dimensionScale = Math.max(playResY / 1080, 0.5)

  const assFontName = fontId || styleConfig.fontFamily.split(',')[0].trim()
  const fontScale = styleConfig.italic ? 0.9 : 1.0
  const baseFontSize = fontSizeOverride || styleConfig.fontSize
  const scaledFontSize = Math.round(baseFontSize * fontScale * dimensionScale)

  let alignment = 2
  let marginV = 40

  if (positionMode === 'percentage') {
    alignment = 2
    const percent = Math.min(90, Math.max(5, positionPercent ?? 80))
    marginV = Math.round((percent / 100) * (playResY - 60) + 40)
  } else if (position === 'top') {
    alignment = 8
    marginV = 20
  } else if (position === 'middle') {
    alignment = 5
    marginV = 0
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

  const blocks = groupWordsIntoBlocks(allWords, playResX, scaledFontSize, styleConfig, wordsPerLine, linesCount)

  for (const block of blocks) {
    const blockWords = block.words

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
        } else if (styleConfig.animationType === 'popline') {
          if (j === i) {
            const popSz = styleConfig.popSize || 5
            const popDur = styleConfig.popDuration || 0.18
            const popStart = 100 - popSz
            const popPeak = 100 + popSz
            const durCs = Math.round(popDur * 1000)
            const growCs = Math.round(durCs * 0.55)
            const shrinkCs = durCs
            parts.push(`{\\u1\\c${highlightAss}\\fscx${popStart}\\fscy${popStart}\\t(0,${growCs},\\fscx${popPeak}\\fscy${popPeak})\\t(${growCs},${shrinkCs},\\fscx100\\fscy100)}`)
          }
          parts.push(wUpper)
          if (j === i) {
            parts.push('{\\u0\\c' + primaryAss + '}')
          }
        } else {
          if (j === i) {
            parts.push(getAnimationTag(styleConfig, highlightAss, w, w.end - w.start))
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
        const spaceParts = text.split(' ')
        text = spaceParts
          .map((part, idx) => {
            if (idx < spaceParts.length - 1) {
              return part + ` {\\fscx${styleConfig.wordSpacing}} {\\fscx100}`
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

function groupWordsIntoBlocks(allWords, playResX, fontSize, styleConfig, wordsPerLine = 4, linesCount = 2) {
  const maxWordsPerLine = wordsPerLine
  const maxLines = linesCount
  const maxWordsPerBlock = maxWordsPerLine * maxLines

  const blocks = []
  let currentBlock = { words: [], start: 0, end: 0, lineIdx: 0, wordsInLine: 0 }

  for (const word of allWords) {
    if (currentBlock.words.length >= maxWordsPerBlock && currentBlock.words.length > 0) {
      currentBlock.end = currentBlock.words[currentBlock.words.length - 1].end
      blocks.push(currentBlock)
      currentBlock = { words: [], start: word.start, end: 0, lineIdx: 0, wordsInLine: 0 }
    }

    if (currentBlock.wordsInLine >= maxWordsPerLine && currentBlock.words.length > 0) {
      currentBlock.lineIdx++
      currentBlock.wordsInLine = 0
      if (currentBlock.lineIdx >= maxLines) {
        currentBlock.end = currentBlock.words[currentBlock.words.length - 1].end
        blocks.push(currentBlock)
        currentBlock = { words: [], start: word.start, end: 0, lineIdx: 0, wordsInLine: 0 }
      }
    }

    currentBlock.words.push({ ...word, lineIdx: currentBlock.lineIdx })
    currentBlock.wordsInLine++
  }

  if (currentBlock.words.length > 0) {
    currentBlock.end = currentBlock.words[currentBlock.words.length - 1].end
    blocks.push(currentBlock)
  }

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

function getAnimationTag(styleConfig, highlightAss, word, eventDuration) {
  const { animationType } = styleConfig
  const popSz = styleConfig.popSize || 5
  const popDur = styleConfig.popDuration || 0.18
  const popStart = 100 - popSz
  const popPeak = 100 + popSz

  switch (animationType) {
    case 'karaoke': {
      const durationCs = Math.round(eventDuration * 100)
      return `{\\kf${durationCs}}`
    }
    case 'scale':
      return `{\\fscx${popPeak}\\fscy${popPeak}\\c${highlightAss}}`
    case 'wordpop': {
      const durationMs = Math.round((word.end - word.start) * 1000)
      const growMs = Math.min(100, Math.floor(durationMs / 3))
      const shrinkMs = Math.min(150, Math.floor(durationMs / 2))
      return `{\\fscx${popStart}\\fscy${popStart}\\t(0,${growMs},\\fscx${popPeak}\\fscy${popPeak})\\t(${growMs},${growMs + shrinkMs},\\fscx100\\fscy100)\\c${highlightAss}}`
    }
    case 'popline':
      return ''
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

export function groupWordsIntoSegments(wordEntries, wordsPerLine = 4, linesCount = 2, persistence = 1) {
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

  const segments = []
  let currentWords = []
  let currentStart = null

  const pushSegment = () => {
    if (currentWords.length === 0) return
    const text = currentWords.map(w => w.text).join(' ')
    const lastWord = currentWords[currentWords.length - 1]
    segments.push({
      start: formatTime(currentStart),
      end: formatTime(lastWord.end),
      text,
      words: currentWords.map(w => ({ text: w.text, start: formatTime(w.start), end: formatTime(w.end) })),
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
    const endsSentence = /[.!?;]$/.test(wordText)
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
