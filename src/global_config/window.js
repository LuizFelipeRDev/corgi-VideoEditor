// ============================================
// Centralized configuration of the main window
// ============================================

// Default window width and height on startup
export const WINDOW_DEFAULT_WIDTH = 700
// 510 → 550 (v1.5.0: transport bar) → 566 (v1.6.0: time ruler in
// 10s steps inside the waveform panel) — see docs/wireframe ascii.md
export const WINDOW_DEFAULT_HEIGHT = 566

// Width when the subtitles panel is active
export const WINDOW_SUBTITLES_WIDTH = 900

// Width when the subtitles panel is disabled
export const WINDOW_NO_SUBTITLES_WIDTH = 640

// Electron window options (resizable, frame, transparent)
// resizable: true — the window can GROW (drag the border / fullscreen),
// but never below the current size of each state: minWidth/minHeight are
// fixed in electron/main.cjs (640x566 without subtitles, 900x566 with subtitles).
export const WINDOW_OPTIONS = {
  resizable: true,
  frame: false,
  transparent: false,
}
