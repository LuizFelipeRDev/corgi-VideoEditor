import { LANGS } from './languages'

/*
  Subtitle OUTPUT language (Settings > Output) — single source of truth.
  - SUBTITLE_LANG_AUTO: default. Whisper detects the language SPOKEN in the audio,
    regardless of the UI language (UI in English + PT audio -> PT subtitle).
  - The other options come from LANGS (system language registry): adding
    a UI language there makes the dropdown grow by itself.
  - Semantics (whisper does not translate into arbitrary languages):
      auto -> -l auto  (transcribes in the spoken language)
      en   -> -l auto -tr (translates any audio to English; -tr only translates
              TO English)
      other -> -l <code> (forces the spoken language; quality guaranteed only
              if the audio really is in that language)
*/
export const SUBTITLE_LANG_AUTO = 'auto'

export const SUBTITLE_LANGS = [
  { id: SUBTITLE_LANG_AUTO },
  ...LANGS,
]
