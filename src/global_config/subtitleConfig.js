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
    fontSize: 60,
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
  return Math.round((baseFontSize / SUBTITLE_STYLE_BASE_SIZE) * displayFontSize)
}

export function getExportFontSize(baseFontSize, videoHeight) {
  const dimensionScale = Math.max(videoHeight / 1080, 0.5)
  return Math.round(baseFontSize * dimensionScale)
}

// Preview-only size factor for the PORTRAIT frame (1 = same size as landscape).
// The portrait frame is the 9:16 OUTPUT rect, about a third of the landscape
// width, so the landscape display size (SUBTITLE_DISPLAY_DEFAULTS.preview.fontSize)
// no longer fits a 4-word line there. Landscape is untouched; this is the single
// knob for the portrait preview size (0.59 = 14px -> 8px, tuned on the app).
export const SUBTITLE_PREVIEW_PORTRAIT_FACTOR = 0.59

// Base size the styles are authored against: getPreviewFontSize scales the
// display size from it, so a style with fontSize 105 renders at the display px.
export const SUBTITLE_STYLE_BASE_SIZE = 105

// Nominal EXPORT size per aspect. Used as the PlayRes fallback when the caller
// has no measured size, and as the reference the preview converts the export's
// vertical margin into a % of the frame (the real export uses the output rect;
// these are the standard heights).
export const SUBTITLE_EXPORT_NOMINAL = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
}

// Vertical margin (in PlayRes units) the export leaves around the subtitle
// block: the fixed positions, and the headroom the percentage mode subtracts
// before adding the margin back. The preview divides these by the nominal
// height, so both land on the same spot.
export const SUBTITLE_EXPORT_MARGINS = {
  bottom: 40,
  top: 20,
  middle: 0,
  percentHeadroom: 60,
}

// Point of the pop window where the word reaches its peak (0.4 = 40% of the
// window) — shared by the export's \t pairs and the preview's keyframes.
export const SUBTITLE_POP_PEAK_RATIO = 0.4

// Horizontal push the 'wordpop' active word gives its neighbors (fraction of the
// word width) — preview and export share the same factor.
export const WORDPOP_PUSH_FACTOR = 0.4

// Export-only size factor for the PORTRAIT frame (1 = the width-based scale,
// which already matches the landscape proportion). The maintainer tunes this
// one by eye: measured at 1 on a 1080x1920 output, the Headline comes out at
// 68px / a line 29.5% of the frame width (landscape is 27.6%) — lower it to
// shrink the portrait subtitles further (0.8 -> ~54px), raise it to grow them.
export const SUBTITLE_EXPORT_PORTRAIT_FACTOR = 3
