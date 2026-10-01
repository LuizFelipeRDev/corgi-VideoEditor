/**
 * SUBTITLE STYLES
 *
 * POP PROPERTIES (scale animation):
 *
 * popIntensity: Controls whether the style has a pop effect
 *   0 = no pop effect (static subtitle)
 *   1 = with pop effect (scale animation)
 *
 * popDuration: Duration of the pop animation in seconds
 *   Example: 0.18 = 180ms (fast), 0.3 = 300ms (medium)
 *   Used together with popSize to control the animation.
 *
 * popSize: Size of the scale effect (in percentage points)
 *   Represents the scale variation from 100%.
 *   Example:  5 = scale of 95% -> 105% -> 100% (subtle)
 *            10 = scale of 90% -> 110% -> 100% (medium)
 *            15 = scale of 85% -> 115% -> 100% (strong)
 *
 * animationType: Determines THE TYPE of animation (still needed):
 *   'highlight'    = changes the active word's color
 *   'simple'       = static color, no animation
 *   'bounce'       = animation on the whole BLOCK (pop on the block)
 *   'karaoke'      = words become highlighted after spoken
 *   'scale'        = scale on the active WORD (pop per word)
 *   'wordpop'      = pop animation on the active WORD
 *   'highlightbox' = background box on the active WORD (no pop)
 *   'popline'      = thin band on the BASE of the active WORD + pop (band and
 *                    word scale together around the word's center)
 *
 * The corner radius and padding of the 'highlightbox' box are
 * controlled centrally in global_config/subtitleConfig.js
 * (SUBTITLE_HIGHLIGHT_BOX) and those of the 'popline' band in
 * SUBTITLE_POPLINE_BOX (height/top relative to the line's baseline),
 * applying to preview, fullscreen and export.
 *
 * To add a new style with pop, just define:
 *   animationType + popIntensity + popDuration + popSize
 * No need to change SubtitleOverlay.jsx or subtitleRender.js.
 */

export const SUBTITLE_STYLES = {
  hormozi: {
    id: 'hormozi',
    name: 'Hormozi',
    fontFamily: 'Montserrat, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 105,
    primaryColor: '#FFFFFF',
    highlightColor: '#00FFFF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 128,
    outlineSize: 5.0,
    shadowDepth: 4.5,
    bold: true,
    italic: false,
    letterSpacing: 0,
    wordSpacing: 100,
    animationType: 'highlight',
    popIntensity: 0,
    popDuration: 0,
    popSize: 0,
    bestFor: 'Business & motivation',
  },
  mrbeast: {
    id: 'mrbeast',
    name: 'MrBeast',
    fontFamily: 'Komika Axis, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 120,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFD700',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 0,
    outlineSize: 8.0,
    shadowDepth: 6.0,
    bold: true,
    italic: false,
    letterSpacing: 0,
    wordSpacing: 100,
    animationType: 'bounce',
    popIntensity: 1,
    popDuration: 0.16,
    popSize: 15,
    bestFor: 'Gaming & entertainment',
  },
  karaoke: {
    id: 'karaoke',
    name: 'Karaoke',
    fontFamily: 'Montserrat, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 105,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFD700',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 128,
    outlineSize: 4.0,
    shadowDepth: 3.0,
    bold: true,
    italic: false,
    letterSpacing: 0,
    wordSpacing: 100,
    animationType: 'karaoke',
    popIntensity: 0,
    popDuration: 0,
    popSize: 0,
    bestFor: 'Music & sing-alongs',
  },
  minimal: {
    id: 'minimal',
    name: 'Headline',
    fontFamily: 'Bebas Neue, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 120,
    primaryColor: '#FFFFFF',
    highlightColor: '#F5F5F5',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 128,
    outlineSize: 4.0,
    shadowDepth: 3.0,
    bold: true,
    italic: false,
    letterSpacing: 3.0,
    wordSpacing: 110,
    animationType: 'scale',
    popIntensity: 1,
    popDuration: 0,
    popSize: 10,
    bestFor: 'Professional & clean',
  },
  /* WORD POP COMMENTED OUT (v1.9.0): hidden from the style selection until the
     preview problem is fixed. Outside SUBTITLE_STYLES it disappears
     from SUBTITLE_STYLE_LIST and projects saved with it fall back to the default
     style (hormozi in the preview / corgi-bold in the export).
  wordpop: {
    id: 'wordpop',
    name: 'Word Pop',
    fontFamily: 'Montserrat, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 105,
    primaryColor: '#FFFFFF',
    highlightColor: '#00FFFF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 128,
    outlineSize: 5.0,
    shadowDepth: 4.5,
    bold: true,
    italic: false,
    letterSpacing: 0,
    wordSpacing: 70,
    animationType: 'wordpop',
    popIntensity: 1,
    // short growth (~0.08s) - same as velhinho.mp4's pop
    popDuration: 0.08,
    // 1.2x on the active word (velhinho: ~1.2x, HELD while active)
    popSize: 20,
    bestFor: 'TikTok & viral content',
  },
  */
  simple: {
    id: 'simple',
    name: 'Simple',
    fontFamily: 'Montserrat, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 105,
    primaryColor: '#FFFFFF',
    highlightColor: '#FFFFFF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 128,
    outlineSize: 4.0,
    shadowDepth: 0,
    bold: true,
    italic: false,
    letterSpacing: 0,
    wordSpacing: 100,
    animationType: 'simple',
    popIntensity: 0,
    popDuration: 0,
    popSize: 0,
    bestFor: 'Podcast & conversation',
  },
  highlightbox: {
    id: 'highlightbox',
    name: 'Highlight Box',
    fontFamily: 'Montserrat, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 105,
    primaryColor: '#FFFFFF',
    highlightColor: '#9B30FF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 128,
    outlineSize: 4.0,
    shadowDepth: 3.0,
    bold: true,
    italic: false,
    letterSpacing: 0,
    wordSpacing: 100,
    animationType: 'highlightbox',
    popIntensity: 0,
    popDuration: 0,
    popSize: 0,
    bestFor: 'Viral & trending content',
  },
  popline: {
    id: 'popline',
    name: 'Popline',
    fontFamily: 'Montserrat, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 105,
    primaryColor: '#FFFFFF',
    highlightColor: '#9B30FF',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 128,
    outlineSize: 5.0,
    shadowDepth: 3.0,
    bold: true,
    italic: false,
    letterSpacing: 0,
    wordSpacing: 100,
    // Box glued to the active word (no horizontal slack, 20% vertical)
    // + synchronized pop: box and word scale TOGETHER around the
    // word's center (see the 'popline' cases in preview and export).
    animationType: 'popline',
    popIntensity: 1,
    popDuration: 0.10,
    popSize: 15,
    bestFor: 'Pop & viral content',
  },
}

export const SUBTITLE_POSITIONS = {
  top: {
    id: 'top',
    name: 'TOPO',
    justifyContent: 'flex-start',
    paddingTop: '20px',
  },
  middle: {
    id: 'middle',
    name: 'MEIO',
    justifyContent: 'center',
    paddingTop: '0',
  },
  bottom: {
    id: 'bottom',
    name: 'BAIXO',
    justifyContent: 'flex-end',
    paddingBottom: '40px',
  },
}

export const SUBTITLE_STYLE_LIST = Object.values(SUBTITLE_STYLES)
export const SUBTITLE_POSITION_LIST = Object.values(SUBTITLE_POSITIONS)

export const hasPopEffect = (styleId) => {
  const style = SUBTITLE_STYLES[styleId]
  return style && style.popIntensity > 0
}
