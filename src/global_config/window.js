// ============================================
// Centralized configuration of the main window
// ============================================

// Default window width and height on startup
export const WINDOW_DEFAULT_WIDTH = 700
// 510 → 550 (v1.5.0: transport bar) → 566 (v1.6.0: time ruler in
// 10s steps inside the waveform panel) — see docs/wireframe ascii.md
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
// fixed in electron/main.cjs (700x566 without subtitles, 960x566 with subtitles).
export const WINDOW_OPTIONS = {
  resizable: true,
  frame: false,
  transparent: false,
}
