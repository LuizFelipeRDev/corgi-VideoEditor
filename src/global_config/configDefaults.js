// ============================================================
// FIRST-INSTALL defaults — config.ini (%APPDATA%)
// ============================================================
//
// Everything config.ini ships with on a fresh install (or whenever a key
// is missing from the file) lives here as easy-to-edit variables.
//
// How it works:
//   electron/main.cjs → readConfig() uses CONFIG_DEFAULTS as the base and
//   the config.ini file (when present) overrides it key by key.
//   The renderer receives everything through window.api.getConfig() →
//   applyConfig().
//
// IMPORTANT — values are STRINGS (ini format "key = value"):
//   'true'/'false' for booleans, numbers as text. This is exactly what
//   readConfig returns when reading the file, so the first boot is
//   IDENTICAL to every boot after that (no type swap between runs).
//   Ex.: theme = 'modern', subtitles = 'true'.
//
// To change the fresh-install default: edit the variable below.
// EXISTING installs do not change — their config.ini already has a value.
// ============================================================

// --- UI appearance and language ---
export const THEME = 'modern'                // 'modern' | 'retro'
export const LANGUAGE = 'en'                 // UI language: 'en' | 'pt'

// --- Silence cutting (AUTO CUT) ---
export const THRESHOLD = '-30'               // min volume (dB) — below this counts as silence
export const MARGIN_BEFORE = '0.5'           // margin BEFORE the cut (s)
export const MARGIN_AFTER = '0.5'            // margin AFTER the cut (s)
export const CUT_SMOOTHNESS = '0.2'          // smoothness/mincut (s) — '0' = off

// --- Export ---
export const OUTPUT_FOLDER = ''              // '' = save next to the source file
export const OUTPUT_FORMAT = 'mp3'           // 'mp3' | 'wav' | 'mp4'...
export const OUTPUT_RESOLUTION = 'original'  // 'original' | '1080x1920' | '1920x1080'...

// --- Subtitles ---
export const ENABLE_SUBTITLES = 'false'      // 'true' turns subtitles on out of the box
export const SUBTITLE_MODEL = 'tiny'         // whisper: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3'
export const SUBTITLE_LANGUAGE = 'auto'      // whisper language: 'auto' | code ('pt', 'en'...)
export const SUBTITLE_POSITION = 'bottom'    // 'top' | 'bottom' | 'custom'
export const SUBTITLE_POSITION_MODE = 'fixed'// 'fixed' | 'percent'
export const SUBTITLE_POSITION_PERCENT = '80'// position in % when mode is 'percent'
export const SUBTITLE_STYLE = 'hormozi'      // visual style (see SubtitleConfigModal)
export const WORDS_PER_LINE = '4'            // words per subtitle line
export const LINES_COUNT = '2'               // max number of lines
export const SUBTITLE_PERSISTENCE = '1'      // 1 = generated subtitles stay saved in the project
export const SMART_SUBTITLE = 'false'        // 'true' = smart subtitles (automatic line breaking)
export const AUTO_LINE_WRAP = 'true'        // 'true' = automatic line wrapping
export const SUBTITLE_H_MARGIN = '0.5'       // horizontal box margin (0–20)
export const GREEN_SCREEN = 'false'          // 'true' = green screen behind subtitles
export const BURN_SUBTITLES = 'true'         // 'true' = burn subtitles into the exported video
export const SUBTITLE_CONFIGS = '{}'         // JSON: per-context styles (preview/export/fullscreen)

// --- Sound (treatment) ---
export const SOUND_CONFIG = ''               // '' = use the built-in DEFAULT_SOUND_CONFIG (src/lib/soundChain.js)
export const SOUND_PRESETS = '[]'            // JSON: presets saved by the user

// --- Tools and misc ---
export const ADVANCED_TOOLS = 'true'         // 'true' = sidebar (ADVANCED OPTIONS) enabled
export const RECENT_PROJECTS = '[]'          // JSON: [{ path, at }] — OPEN dialog
export const FAVORITE_FONTS = ''             // CSV: font ids starred in SubtitleConfigModal

// --- Cut timing (AUTO CUT) ---
export const CUT_IMMEDIATE = 'true'          // 'true' = the toggle runs the cut right away; 'false' = the cut runs only on export

// ------------------------------------------------------------
// EXACT config.ini keys — consumed by electron/main.cjs.
// New key recipe: variable above + entry here + a read in
// applyConfig (src/App.jsx) whenever the renderer needs it.
// ------------------------------------------------------------
export const CONFIG_DEFAULTS = {
  theme: THEME,
  language: LANGUAGE,

  threshold: THRESHOLD,
  margin: MARGIN_BEFORE,
  margin_after: MARGIN_AFTER,
  smooth: CUT_SMOOTHNESS,

  output_folder: OUTPUT_FOLDER,
  output_format: OUTPUT_FORMAT,
  output_resolution: OUTPUT_RESOLUTION,

  subtitles: ENABLE_SUBTITLES,
  subtitle_model: SUBTITLE_MODEL,
  subtitle_language: SUBTITLE_LANGUAGE,
  subtitle_position: SUBTITLE_POSITION,
  subtitle_position_mode: SUBTITLE_POSITION_MODE,
  subtitle_position_percent: SUBTITLE_POSITION_PERCENT,
  subtitle_style: SUBTITLE_STYLE,
  words_per_line: WORDS_PER_LINE,
  lines_count: LINES_COUNT,
  subtitle_persistence: SUBTITLE_PERSISTENCE,
  smart_subtitle: SMART_SUBTITLE,
  auto_line_wrap: AUTO_LINE_WRAP,
  subtitle_h_margin: SUBTITLE_H_MARGIN,
  green_screen: GREEN_SCREEN,
  burn_subtitles: BURN_SUBTITLES,
  subtitle_configs: SUBTITLE_CONFIGS,

  sound_config: SOUND_CONFIG,
  sound_presets: SOUND_PRESETS,

  advanced_tools: ADVANCED_TOOLS,
  recent_projects: RECENT_PROJECTS,
  favorite_fonts: FAVORITE_FONTS,

  cut_immediate: CUT_IMMEDIATE,
}
