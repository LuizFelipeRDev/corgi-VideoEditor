/**
 * ESTILOS DE LEGENDA
 *
 * PROPRIEDADES DE POP (animacao de escala):
 *
 * popIntensity: Controle se o estilo tem efeito pop
 *   0 = sem efeito pop (legenda estatica)
 *   1 = com efeito pop (animacao de escala)
 *
 * popDuration: Duracao da animacao pop em segundos
 *   Exemplo: 0.18 = 180ms (rapido), 0.3 = 300ms (medio)
 *   Usado em conjunto com popSize para controlar a animacao.
 *
 * popSize: Tamanho do efeito de escala (em pontos percentuais)
 *   Representa a variacao de escala a partir de 100%.
 *   Exemplo:  5 = escala de 95% -> 105% -> 100% (sutil)
 *            10 = escala de 90% -> 110% -> 100% (medio)
 *            15 = escala de 85% -> 115% -> 100% (forte)
 *
 * animationType: Determina O TIPO de animacao (ainda necessario):
 *   'highlight'  = muda cor da palavra ativa
 *   'simple'     = cor estatica, sem animacao
 *   'bounce'     = animacao no BLOCO inteiro (pop no bloco)
 *   'karaoke'    = palavras ficam destacadas apos faladas
 *   'scale'      = escala na PALAVRA ativa (pop por palavra)
 *   'wordpop'    = animacao de pop na PALAVRA ativa
 *   'popline'    = pop + sublinhado na PALAVRA ativa
 *
 * Para adicionar um novo estilo com pop, basta definir:
 *   animationType + popIntensity + popDuration + popSize
 * Nao e necessario alterar SubtitleOverlay.jsx ou subtitleRender.js.
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
    fontFamily: 'Bangers, sans-serif',
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
    popDuration: 0.18,
    popSize: 5,
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
    name: 'Minimal',
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
    italic: true,
    letterSpacing: 3.0,
    wordSpacing: 110,
    animationType: 'scale',
    popIntensity: 1,
    popDuration: 0,
    popSize: 10,
    bestFor: 'Professional & clean',
  },
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
    wordSpacing: 100,
    animationType: 'wordpop',
    popIntensity: 1,
    popDuration: 0.30,
    popSize: 15,
    bestFor: 'TikTok & viral content',
  },
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
  popline: {
    id: 'popline',
    name: 'Pop Line',
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
    animationType: 'popline',
    popIntensity: 1,
    popDuration: 0.18,
    popSize: 5,
    bestFor: 'Viral & trending content',
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
