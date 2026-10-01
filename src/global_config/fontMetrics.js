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
  'Open Sans': 0.6935, // OpenSans-Bold.ttf: 2048/(2302+651)
  'Lato': 0.7062, // Lato-Bold.ttf: 2000/(2233+599)
  'Raleway': 0.7205, // Raleway-Bold.ttf: 1000/(1154+234)
  'Nunito': 0.7262, // Nunito-Bold.ttf: 1000/(1077+300)
  'Work Sans': 0.6906, // WorkSans-Bold.ttf: 1000/(1105+343)
  'Playfair Display': 0.7092, // PlayfairDisplay-Bold.ttf: 1000/(1159+251)
  'Caveat': 0.7758, // Caveat-Bold.ttf: 1000/(974+315)
  'Lobster': 0.6711, // Lobster-Regular.ttf: 1000/(1000+490)
  'Pacifico': 0.5168, // Pacifico-Regular.ttf: 1000/(1478+457)
  'Permanent Marker': 0.7009, // PermanentMarker-Regular.ttf: 1024/(1136+325)
}

// Fallback para fontes fora da lista (estilos com familia propria).
export const DEFAULT_RENDER_SCALE = 0.72

// Posicao da baseline dentro da caixa de linha do libass (gerado - nao
// editar a mao):
//
//   asc = usWinAscent / (usWinAscent + usWinDescent)
//
// O libass normaliza asc+desc para 1.0 x tamanho nominal (ver acima), e a
// baseline fica em asc x tamanho a partir do TOPO da linha - usado pelo
// POPLINE para posicionar a faixa em cima da baseline no export.
// Validado: Montserrat 1109/1379 = 0.8042 bate com a baseline medida por
// sonda (y=1019 para topo de linha y=935, size=105 => 0.8043).
export const FONT_WIN_ASCENT = {
  'Montserrat ExtraBold': 0.8042, // 1109/(1109+270)
  'Bebas Neue': 0.7308, // 950/(950+350)
  'Bangers': 0.7974, // 1401/(1401+356)
  'Lilita One': 0.8075, // 923/(923+220)
  'Komika Axis': 0.8440, // 1380/(1380+255)
  'IBM Plex Sans': 0.8029, // 1120/(1120+275)
  'Anton': 0.8101, // 2876/(2876+674)
  'Archivo Black': 0.7684, // 1035/(1035+312)
  'Poppins ExtraBold': 0.6442, // 1135/(1135+627)
  'Rubik ExtraBold': 0.6958, // 1066/(1066+466)
  'Roboto Black': 0.7917, // 1946/(1946+512)
  'Oswald': 0.7785, // 1325/(1325+377)
  'Inter': 0.7747, // 2269/(2269+660)
  'Fira Sans Condensed': 0.7792, // 935/(935+265)
  'Luckiest Guy': 0.7992, // 2006/(2006+504)
  'Titan One': 0.8472, // 970/(970+175)
  'Open Sans': 0.7795, // 2302/(2302+651)
  'Lato': 0.7885, // 2233/(2233+599)
  'Raleway': 0.8314, // 1154/(1154+234)
  'Nunito': 0.7821, // 1077/(1077+300)
  'Work Sans': 0.7631, // 1105/(1105+343)
  'Playfair Display': 0.8220, // 1159/(1159+251)
  'Caveat': 0.7556, // 974/(974+315)
  'Lobster': 0.6711, // 1000/(1000+490)
  'Pacifico': 0.7638, // 1478/(1478+457)
  'Permanent Marker': 0.7775, // 1136/(1136+325)
}

// Fallback para fontes fora da lista (estilos com familia propria).
export const DEFAULT_WIN_ASCENT = 0.79

export function getFontRenderScale(assFontName) {
  return FONT_RENDER_SCALE[assFontName] ?? DEFAULT_RENDER_SCALE
}

export function getFontWinAscent(assFontName) {
  return FONT_WIN_ASCENT[assFontName] ?? DEFAULT_WIN_ASCENT
}
