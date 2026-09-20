# Guias de Alteracao

## Tamanho da Fonte

### Fonte do Video Exportado (ASS)
- **Arquivo**: `src/lib/subtitleStyles.js`
- Cada estilo tem um campo `fontSize` (valor base, ex: 105, 120)
- O tamanho final e calculado em `src/lib/subtitleRender.js:65`:
  ```js
  const scaledFontSize = Math.round(styleConfig.fontSize * fontScale * dimensionScale)
  ```
  - `fontScale` = 0.9 se italic, 1.0 se normal
  - `dimensionScale` = `Math.max(playResY / 1080, 0.5)` (escala com resolucao do video)

### Fonte do Preview (HTML)
- **Arquivo**: `src/components/SubtitleOverlay.jsx:71`
  ```js
  fontSize: fullscreen ? '32px' : '14px'
  ```
  - `14px` = tamanho no preview normal
  - `32px` = tamanho no fullscreen

---

## Altura Minima e Maxima do Slider de Posicao

### Limites do Slider (SubtitlesPanel)
- **Arquivo**: `src/components/SubtitlesPanel.jsx:178-179`
  ```html
  min="5"
  max="85"
  ```
  - `5` = posicao minima (perto do baixo)
  - `85` = posicao maxima (perto do topo)

### Limites do Preview (SubtitleOverlay)
- **Arquivo**: `src/components/SubtitleOverlay.jsx:38`
  ```js
  const previewMax = fullscreen ? 90 : 85
  const clampedPercent = Math.min(previewMax, Math.max(5, ...))
  ```
  - `previewMax` = 85 no preview, 90 no fullscreen
  - `5` = minimo em ambos

### Limites do Export ASS
- **Arquivo**: `src/lib/subtitleRender.js:72`
  ```js
  const percent = Math.min(90, Math.max(5, positionPercent ?? 80))
  ```
  - Export usa 90 como maximo (permite um pouco mais que o preview)

### Limites ao Carregar Config
- **Arquivo**: `src/App.jsx:67`
  ```js
  setPositionPercent(Math.min(85, Math.max(5, Number(c.subtitle_position_percent) || 80)))
  ```
  - Valor padrao: 80%
