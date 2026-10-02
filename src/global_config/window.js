// ============================================
// Centralized configuration of the main window
// ============================================

// Default window width and height on startup
export const WINDOW_DEFAULT_WIDTH = 700
// 510 → 550 (v1.5.0: transport bar) → 566 (v1.6.0: time ruler in
// 10s steps inside the waveform panel) — see docs/wireframe ascii.md
// v1.11.0 (ducking) keeps 566 as the BASE: while the music track row is
// visible the window grows by WINDOW_DUCKING_EXTRA_HEIGHT (appended at the
// end of this file), so the internal spacings never compress.
export const WINDOW_DEFAULT_HEIGHT = 566

// Width when the subtitles panel is active (960 = 900 + 60: the Controls
// column grew 200 -> 260 and the window follows with the same +60, so the
// preview keeps its space at the minimum size)
export const WINDOW_SUBTITLES_WIDTH = 960

// Width when the subtitles panel is disabled (700 = 640 + 60, same +60)
export const WINDOW_NO_SUBTITLES_WIDTH = 700

// Electron window options (resizable, frame, transparent)
// resizable: true — the window can GROW (drag the border / fullscreen),
// but never below the current size of each state: minWidth/minHeight are
// fixed in electron/main.cjs (700x566 without subtitles, 960x566 with
// subtitles — +120 height while ducking is on, see WINDOW_DUCKING_EXTRA_HEIGHT).
export const WINDOW_OPTIONS = {
  resizable: true,
  frame: false,
  transparent: false,
}

// v1.11.0 (ducking): extra window height while the music track row is
// visible — the row's natural height (music box = border 4px + padding
// 16px + wave min-h 96px = 116px, plus the 4px gap above it) = 120px.
// App.jsx adds it to WINDOW_DEFAULT_HEIGHT when ducking activates, so the
// preview/controls row above keeps EXACTLY its original height and the
// extra window space belongs to the soundwave (wireframe 1.11.0:
// "O tamanho da janela aumentará proporcionalmente"). Removing the row
// subtracts it again.
export const WINDOW_DUCKING_EXTRA_HEIGHT = 120
