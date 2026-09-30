// ============================================
// Configuração centralizada da janela principal
// ============================================

// Largura e altura padrão da janela ao iniciar
export const WINDOW_DEFAULT_WIDTH = 700
// 510 → 550 (v1.5.0: barra de transporte) → 566 (v1.6.0: régua de tempo de
// 10 em 10s dentro do painel do waveform) — ver docs/wireframe ascii.md
export const WINDOW_DEFAULT_HEIGHT = 566

// Largura quando o painel de legendas está ativo
export const WINDOW_SUBTITLES_WIDTH = 900

// Largura quando o painel de legendas está desativado
export const WINDOW_NO_SUBTITLES_WIDTH = 640

// Opções da janela Electron (resizable, frame, transparent)
// resizable: true — a janela pode CRESCER (arrastar a borda / tela cheia),
// mas nunca abaixo do tamanho atual de cada estado: minWidth/minHeight são
// fixados no electron/main.cjs (640x566 sem legendas, 900x566 com legendas).
export const WINDOW_OPTIONS = {
  resizable: true,
  frame: false,
  transparent: false,
}
