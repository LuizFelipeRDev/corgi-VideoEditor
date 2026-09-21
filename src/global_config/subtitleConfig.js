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
    positionMode: 'fixed',
    positionFixed: 'bottom',
    positionPercent: 80,
  },
}

export function getPreviewFontSize(baseFontSize) {
  return Math.round((baseFontSize / 105) * SUBTITLE_DISPLAY_DEFAULTS.preview.fontSize)
}

export function getExportFontSize(baseFontSize, videoHeight) {
  const dimensionScale = Math.max(videoHeight / 1080, 0.5)
  return Math.round(baseFontSize * dimensionScale)
}
