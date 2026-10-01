/**
 * CENTRALIZED SUBTITLE CONFIGURATION
 *
 * Controls position and font size for 3 modes:
 * - preview: normal editor window
 * - fullscreen: fullscreen mode
 * - export: exported ASS file
 */


export const SUBTITLE_DISPLAY_DEFAULTS = {
  preview: {
    positionMode: 'fixed',
    positionFixed: 'bottom',
    positionPercent: 80,
    fontSize: 14,
  },
  fullscreen: {
    positionMode: 'fixed',
    positionFixed: 'bottom',
    positionPercent: 80,
    fontSize: 32,
  },
  export: {
    positionMode: 'fixed',
    positionFixed: 'bottom',
    positionPercent: 80,
  },
}

export const SUBTITLE_HIGHLIGHT_BOX = {
  borderRadiusRatio: 0.18,
  paddingXRatio: 0.16,
  paddingYRatio: 0.08,
}

// POPLINE: THIN band at the base of the word - "almost like a line" with
// slightly rounded corners (reference: popline.png / popline.md),
// instead of a box wrapping the word:
//   - width exactly the word's (paddingXRatio 0);
//   - top of the band = bandTopRatio x font ABOVE the baseline (it only grazes
//     the base of the letters, as in the reference);
//   - height of the band = bandHeightRatio x font;
//   - borderRadiusRatio is relative to the HEIGHT of the band (not the font).
export const SUBTITLE_POPLINE_BOX = {
  paddingXRatio: 0,
  bandTopRatio: 0.03,
  bandHeightRatio: 0.27,
  borderRadiusRatio: 0.30,
}

export function getPreviewFontSize(baseFontSize, fullscreen = false) {
  const displayFontSize = fullscreen
    ? SUBTITLE_DISPLAY_DEFAULTS.fullscreen.fontSize
    : SUBTITLE_DISPLAY_DEFAULTS.preview.fontSize
  return Math.round((baseFontSize / 105) * displayFontSize)
}

export function getExportFontSize(baseFontSize, videoHeight) {
  const dimensionScale = Math.max(videoHeight / 1080, 0.5)
  return Math.round(baseFontSize * dimensionScale)
}
