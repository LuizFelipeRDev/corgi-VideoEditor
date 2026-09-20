import { SUBTITLE_STYLES, SUBTITLE_POSITIONS } from '../lib/subtitleStyles'
import { parseSrtTimeToSecondsExport } from '../lib/subtitleRender'

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function SubtitleOverlay({ subtitles, subtitleStyle, subtitlePosition, subtitleConfigs, currentTime, fullscreen, positionMode, positionPercent, outputResolution }) {
  if (!subtitles || subtitles.length === 0) return null

  const isPortrait = outputResolution === 'portrait'

  const stylePreset = SUBTITLE_STYLES[subtitleStyle] || SUBTITLE_STYLES.hormozi
  const posPreset = SUBTITLE_POSITIONS[subtitlePosition] || SUBTITLE_POSITIONS.bottom
  const cfg = subtitleConfigs?.[subtitleStyle] || {}

  const primaryColor = cfg.primaryColor || stylePreset.primaryColor
  const highlightColor = cfg.highlightColor || stylePreset.highlightColor
  const fontId = cfg.fontId || stylePreset.fontFamily.split(',')[0].trim()
  const configFontSize = cfg.fontSize || stylePreset.fontSize
  const animType = stylePreset.animationType

  const activeSub = subtitles.find((sub) => {
    const start = parseSrtTimeToSecondsExport(sub.start)
    const end = parseSrtTimeToSecondsExport(sub.end)
    return currentTime >= start && currentTime <= end
  })

  if (!activeSub) return null

  const useHighlightBlock = animType === 'bounce'
    ? hashString(activeSub.text) % 2 === 0
    : false

  const isPercentage = positionMode === 'percentage'

  const previewMax = fullscreen ? 90 : 85
  const clampedPercent = Math.min(previewMax, Math.max(5, isPercentage ? (positionPercent ?? 80) : 80))

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
      : posPreset.justifyContent === 'center'
        ? { top: '50%', transform: 'translateY(-50%)' }
        : posPreset.justifyContent === 'flex-start'
          ? { top: fullscreen ? (posPreset.paddingTop || '0') : (posPreset.paddingTop ? '16px' : '10px') }
          : { bottom: fullscreen ? (posPreset.paddingBottom || '40px') : (posPreset.paddingBottom ? '24px' : '40px') }
    ),
  }

  const previewFontSize = fullscreen
    ? Math.round((configFontSize / 105) * 32)
    : Math.round((configFontSize / 105) * 14)

  const blockStyle = {
    fontFamily: `'${fontId}', sans-serif`,
    fontSize: `${previewFontSize}px`,
    fontWeight: stylePreset.bold ? 'bold' : 'normal',
    fontStyle: stylePreset.italic ? 'italic' : 'normal',
    letterSpacing: `${stylePreset.letterSpacing * 0.2}px`,
    textAlign: 'center',
    lineHeight: 1.3,
    textShadow: `0 0 2px ${stylePreset.outlineColor}, 0 0 4px ${stylePreset.outlineColor}`,
    maxWidth: isPortrait ? '90%' : '85%',
    wordBreak: 'break-word',
    ...(isPortrait ? { padding: '0 3%' } : {}),
    ...(animType === 'bounce' ? { animation: 'subtitle-bounce 0.18s ease-out' } : {}),
  }

  const now = currentTime
  const words = activeSub.words && activeSub.words.length > 0
    ? activeSub.words
    : activeSub.text.split(/\s+/).map(w => ({ text: w }))

  const getWordStyle = (word, i) => {
    const wordStart = word.start ? parseSrtTimeToSecondsExport(word.start) : null
    const wordEnd = word.end ? parseSrtTimeToSecondsExport(word.end) : null

    const base = {
      display: 'inline',
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
        return {
          ...base,
          color: isActive ? highlightColor : primaryColor,
          transform: isActive ? 'scale(1.1)' : 'scale(1)',
        }
      }

      case 'wordpop': {
        const isActive = wordStart !== null && wordEnd !== null && now >= wordStart && now < wordEnd
        return {
          ...base,
          color: isActive ? highlightColor : primaryColor,
          animation: isActive ? 'subtitle-wordpop 0.3s ease-out' : 'none',
        }
      }

      case 'popline': {
        const isActive = wordStart !== null && wordEnd !== null && now >= wordStart && now < wordEnd
        return {
          ...base,
          color: isActive ? highlightColor : primaryColor,
          textDecoration: isActive ? 'underline' : 'none',
          animation: isActive ? 'subtitle-popline-bounce 0.18s ease-out' : 'none',
        }
      }
    }
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...blockStyle, ...textStyle }}>
        {words.map((word, i) => (
          <span key={i} style={getWordStyle(word, i)}>
            {word.text}{i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

export default SubtitleOverlay
