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
 *   'scale'        = scale on the active WORD, SMOOTH (grows to the peak over
 *                    popDuration and returns by the end of the word) - Headline
 *   'scalesnap'    = same pop with NO smoothing: the active word jumps straight
 *                    to the peak on both axes - Simple Pop
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
 * GLOW PROPERTIES (neon look) — optional, 0/absent = no glow:
 *
 *   glowBlur:        Gaussian blur on the border (the export's \blur) — the soft
 *                    halo around the letters. In PlayRes units, the SAME unit as
 *                    outlineSize, so the preview's em and the file's \blur are the
 *                    same ratio.
 *   glowBlurActive:  glow of the ACTIVE word (the 'highlight' animationType
 *                    lights it up like a brighter LED). Without it the active
 *                    word uses glowBlur.
 *   The glow wears outlineColor (one hue), like the export: \blur changes the
 *   softness, \c changes the fill.
 *
 * To add a new style reusing an existing animationType, just define:
 *   animationType + popIntensity + popDuration + popSize
 * No need to change SubtitleOverlay.jsx or subtitleRender.js. A NEW
 * animationType also needs a case in SubtitleOverlay.jsx (preview/fullscreen)
 * and in subtitleRender.js (export).
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
    // Hidden from the user's style list while it has issues (asked by the
    // maintainer). It KEEPS working: projects saved with it still render and
    // export with it, and the panel still shows it as the selected option.
    hidden: true,
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
    // SMOOTH pop: grows to +10% over 120ms and returns by the end of the word.
    // Export (\t grow + \t shrink) and preview (transform transition) run the
    // SAME window, so the file matches what the preview/fullscreen shows.
    popDuration: 0.12,
    popSize: 10,
    bestFor: 'Professional & clean',
  },
  simplepop: {
    id: 'simplepop',
    name: 'Simple Pop',
    fontFamily: 'Bebas Neue, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 120,
    primaryColor: '#FFFFFF',
    highlightColor: '#F5F5F5',
    outlineColor: '#000000',
    shadowColor: '#000000',
    shadowAlpha: 128,
    outlineSize: 4.0,
    // No hard offset shadow: libass draws \shad as a SOLID copy, and together
    // with the border it read heavier than in the preview (asked by the
    // maintainer after the export looked like it had a stronger border).
    shadowDepth: 0,
    bold: true,
    italic: false,
    letterSpacing: 3.0,
    wordSpacing: 110,
    // Headline's geometry with the pop INSTANT on both sides (no \t on the
    // export, no transition on the preview) - the legacy Headline look, kept
    // as its own style now that Headline eases.
    animationType: 'scalesnap',
    popIntensity: 1,
    popDuration: 0, // unused by 'scalesnap' (the pop has no time curve)
    popSize: 10,
    bestFor: 'Headlines with a hard pop',
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
  neon: {
    id: 'neon',
    name: 'Neon',
    // Rajdhani Bold: condensed, squared and techno — the face the maintainer
    // asked for on the Neon style (it replaced Titan One, which read too
    // "cartoon"). Added on request with its .ttf and the OFL 1.1 entry; the
    // file is weight 700, so bold:true selects the real face on both sides.
    fontFamily: 'Rajdhani, sans-serif',
    fontNameFallback: 'IBM Plex Sans, sans-serif',
    fontSize: 105,
    // Body: a cold white. Lit word: magenta LED. The GLOW is outlineColor (cyan)
    // in both the preview and the export — only its strength changes.
    primaryColor: '#EAF7FF',
    highlightColor: '#FF2D95',
    outlineColor: '#00E5FF',
    shadowColor: '#000000',
    shadowAlpha: 0,
    // The border here is a thin hard edge; the neon look is the GLOW.
    outlineSize: 1.5,
    shadowDepth: 0,
    // The sentence already has a slight blur; the lit word burns brighter.
    glowBlur: 6,
    glowBlurActive: 16,
    // Rajdhani ships as Bold only, and it IS the face we want: bold:true makes
    // libass pick the Bold outline and the browser ask for weight 700 — the same
    // face on both sides (no synthetic embolden).
    bold: true,
    italic: false,
    letterSpacing: 0,
    wordSpacing: 100,
    // Same animation as Hormozi: the active word lights up.
    animationType: 'highlight',
    popIntensity: 0,
    popDuration: 0,
    popSize: 0,
    bestFor: 'Cyberpunk & nightlife',
  },
  simple: {
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

// Styles with `hidden: true` are NOT listed for the user (they disappear from
// SUBTITLE_STYLE_LIST) but keep working everywhere else: a project saved with
// them still previews and exports with that style, and the panel keeps showing
// it as the selected option so the select never lies about what is rendering.
// The Headline is hidden while it has issues (mantenedor, 2026-10).
export const SUBTITLE_STYLE_LIST = Object.values(SUBTITLE_STYLES).filter((s) => !s.hidden)
export const SUBTITLE_POSITION_LIST = Object.values(SUBTITLE_POSITIONS)

export const hasPopEffect = (styleId) => {
  const style = SUBTITLE_STYLES[styleId]
  return style && style.popIntensity > 0
}
