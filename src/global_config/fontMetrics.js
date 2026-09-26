/**
 * ESCALA DE RENDER DO LIBASS POR FONTE (gerado - nao editar a mao)
 *
 * O libass posiciona a caixa de linha no TAMANHO NOMINAL, mas renderiza os
 * glifos num tamanho efetivo de
 *
 *   efetivo = nominal * upem / (usWinAscent + usWinDescent)
 *
 * (sonda: caixa de linha asc+desc = 1.000 do tamanho nominal nas 16 fontes).
 * Como o canvas do navegador mede em "em real", as larguras medidas precisam
 * ser multiplicadas por renderScale para baterem com o que o ffmpeg desenha -
 * so assim a caixa, o espacamento entre palavras e a centralizacao da linha
 * do export ficam iguais ao texto nativo do libass (e ao preview).
 *
 * Valido por: probe-libass/ffmpeg (asc/desc/cap) e comparacao visual
 * export-vs-nativo (visual-hlbox). Regenerar ao trocar fontes ou ffmpeg.
 */
export const FONT_RENDER_SCALE = {
  'Montserrat ExtraBold': 0.7252, // Montserrat-ExtraBold.ttf: 1000/(1109+270)
  'Bebas Neue': 0.7692, // BebasNeue-Regular.ttf: 1000/(950+350)
  'Bangers': 0.5692, // Bangers-Regular.ttf: 1000/(1401+356)
  'Lilita One': 0.8749, // lilita-one.regular.ttf: 1000/(923+220)
  'Komika Axis': 0.6116, // komika-axis.regular.ttf: 1000/(1380+255)
  'IBM Plex Sans': 0.7168, // IBMPlexSans-Bold.ttf: 1000/(1120+275)
  'Anton': 0.5769, // Anton-Regular.ttf: 2048/(2876+674)
  'Archivo Black': 0.7424, // ArchivoBlack-Regular.ttf: 1000/(1035+312)
  'Poppins ExtraBold': 0.5675, // Poppins-ExtraBold.ttf: 1000/(1135+627)
  'Rubik ExtraBold': 0.6527, // Rubik-ExtraBold.ttf: 1000/(1066+466)
  'Roboto Black': 0.8332, // Roboto-Black.ttf: 2048/(1946+512)
  'Oswald': 0.5875, // Oswald-Bold.ttf: 1000/(1325+377)
  'Inter': 0.6992, // Inter-Bold.ttf: 2048/(2269+660)
  'Fira Sans Condensed': 0.8333, // FiraSansCondensed-Bold.ttf: 1000/(935+265)
  'Luckiest Guy': 0.8159, // LuckiestGuy-Regular.ttf: 2048/(2006+504)
  'Titan One': 0.8734, // TitanOne-Regular.ttf: 1000/(970+175)
}

// Fallback para fontes fora da lista (estilos com familia propria).
export const DEFAULT_RENDER_SCALE = 0.72

export function getFontRenderScale(assFontName) {
  return FONT_RENDER_SCALE[assFontName] ?? DEFAULT_RENDER_SCALE
}
