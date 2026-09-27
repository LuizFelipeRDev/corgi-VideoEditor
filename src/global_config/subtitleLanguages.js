import { LANGS } from './languages'

/*
  Idioma de SAIDA da legenda (Settings > Saida) — fonte unica.
  - SUBTITLE_LANG_AUTO: padrao. O whisper detecta o idioma FALADO no audio,
    independente do idioma da UI (UI em ingles + audio PT -> legenda PT).
  - As demais opcoes vem de LANGS (registro de idiomas do sistema): adicionar
    um idioma de UI la faz o dropdown crescer sozinho.
  - Semantica (whisper nao traduz para idiomas arbitrarios):
      auto -> -l auto  (transcreve no idioma falado)
      en   -> -l auto -tr (traduz qualquer audio para ingles; -tr so traduz
              PARA ingles)
      outro -> -l <codigo> (forca o idioma falado; qualidade garantida apenas
              se o audio realmente for desse idioma)
*/
export const SUBTITLE_LANG_AUTO = 'auto'

export const SUBTITLE_LANGS = [
  { id: SUBTITLE_LANG_AUTO },
  ...LANGS,
]
