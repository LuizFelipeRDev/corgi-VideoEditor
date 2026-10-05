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

// Preview-only trim on top of the portrait size (1 = the preview follows the
// file, which is the default). The preview size is proportional to the frame (see
// SUBTITLE_DISPLAY_EXPORT_RATIO) and already carries SUBTITLE_EXPORT_PORTRAIT_FACTOR;
// this only exists to shrink the portrait preview ALONE, without touching the
// export. Landscape is never touched by this factor.
export const SUBTITLE_PREVIEW_PORTRAIT_FACTOR = 1

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

// Size factor for the PORTRAIT frame (export AND preview/fullscreen): the font
// follows the frame's width and then this multiplier, so the portrait captions
// keep the size the maintainer tuned in the file and the preview follows it
// automatically (SubtitleOverlay multiplies it in too — one place to tune, the
// preview can't drift from the export). Landscape is never touched.
export const SUBTITLE_EXPORT_PORTRAIT_FACTOR = 2

// Preview/fullscreen font size as a fraction of the EXPORT's own size for the
// frame on screen: the preview multiplies the export's font by
// (frameWidth / 1920) and then by this factor, so 1 = the subtitle occupies
// exactly the same proportion of the frame in the preview, in the fullscreen and
// in the exported file, at any window size. Before, the size was a fixed px per
// context (SUBTITLE_DISPLAY_DEFAULTS preview 14 / fullscreen 60), so the subtitle
// kept its pixels while the frame grew — at 1920 wide the fullscreen showed it at
// half the export's proportion. Lower it to shrink the preview against the file.
export const SUBTITLE_DISPLAY_EXPORT_RATIO = 1

// Border (outline) tuning per context — ONE dial per place the subtitle is
// drawn. All three multiply the style's `outlineSize` (the ASS \bord unit, in
// PlayRes of the nominal 1920 width), so 1 = every context shows the border at
// the same proportion as the exported file:
//   export     -> subtitleRender.js writes it into the ASS `Outline` column
//   fullscreen  -> SubtitleOverlay with `fullscreen`
//   preview    -> SubtitleOverlay in the editor panel
// Raise a factor to make the border thicker ONLY in that place (e.g. preview 1.4
// to read it better on the small panel) without touching the file, or lower the
// export one to thin the border everywhere.
export const SUBTITLE_OUTLINE_FACTORS = {
  export: 1,
  fullscreen: 1,
  preview: 1,
}
