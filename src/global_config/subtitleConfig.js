/**
 * CONFIGURACAO CENTRALIZADA DE LEGENDAS
 *
 * Controla posicao e tamanho de fonte para 3 modalidades:
 * - preview: janela normal do editor
 * - fullscreen: modo tela cheia
 * - export: arquivo ASS exportado
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
    positionMode: 'percentage',
    positionFixed: 'bottom',
    positionPercent: 80,
  },
}

export function getPreviewFontSize(config, baseFontSize) {
  const cfg = config?.preview || SUBTITLE_DISPLAY_DEFAULTS.preview
  return Math.round((baseFontSize / 105) * cfg.fontSize)
}

export function getExportFontSize(baseFontSize, videoHeight) {
  const dimensionScale = Math.max(videoHeight / 1080, 0.5)
  return Math.round(baseFontSize * dimensionScale)
}

export function mergeDisplayConfig(saved) {
  if (!saved) return { ...SUBTITLE_DISPLAY_DEFAULTS }
  return {
    preview: { ...SUBTITLE_DISPLAY_DEFAULTS.preview, ...saved.preview },
    fullscreen: { ...SUBTITLE_DISPLAY_DEFAULTS.fullscreen, ...saved.fullscreen },
    export: { ...SUBTITLE_DISPLAY_DEFAULTS.export, ...saved.export },
  }
}
