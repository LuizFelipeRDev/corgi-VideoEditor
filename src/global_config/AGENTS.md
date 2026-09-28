# AGENTS.md — `src/global_config/` (frozen zone)

> Scope: every file and folder under `src/global_config/`.
> This is the **only** folder in this repository whose files must never be refactored.

## Golden rule

**Do not refactor, rename, reformat, reorder, "modernize" or delete anything in this
folder.** Changes here silently break the visual parity between the editor preview and
the exported video (ASS/libass), the Electron main window, or the i18n contract.

If you believe a change in this folder is necessary, **stop and ask the maintainer
first, listing the concrete advantages** — never apply it on your own initiative.

What is allowed without asking:

- Adding a new key to **both** `languages/en.js` and `languages/pt.js` (same path in
  both files; parity must hold).
- Appending a new export (constant or function) at the end of a config file, without
  touching existing entries.
- Changing an existing value **only** when the maintainer explicitly asked for that
  exact change.

Anything else → ask first.

## Why this folder is frozen (file by file)

| File | Holds | Consumed by | Why it must not be refactored |
|---|---|---|---|
| `fontMetrics.js` | **Generated** libass render scales per font (`renderScale`, winAscent…) | `src/lib/subtitleRender.js` | Machine-generated from libass/ffmpeg probe measurements. Hand-editing or reformatting desyncs the exported subtitle box, word spacing and line centering from the preview. Regenerate via the probe tooling only; never edit by hand. |
| `fonts.js` | Font registry: `id`, `family` (CSS) and `assName` (internal TTF family name) | `SubtitleOverlay.jsx`, `SubtitleConfigModal.jsx`, `lib/subtitleRender.js` | `assName` must match the internal family name inside the `.ttf` exactly, or libass falls back to a system font on export. `id`s are persisted in user settings — renaming them breaks stored preferences. |
| `fonts/*.ttf` + `LICENSE*` | Binary font assets and their license files | `src/index.css` (`@font-face`); `electron/main.cjs` `getFontsDir()` → libass `fontsdir=` on export (dev: this folder; production: `%APPDATA%/corgi-editor/fonts/`) | Binary assets with license obligations (see `fonts/LICENSES.md`). Never rename, move, subset or delete. New fonts are added on request, together with their license file. |
| `subtitleConfig.js` | Position/size/highlight defaults for `preview`, `fullscreen` and `export` | `App.jsx`, `SubtitleOverlay.jsx`, `lib/subtitleRender.js`, `lib/subtitleStyles.js` | Values were tuned against real ffmpeg renders. Reordering, merging or renaming keys changes export output and stored user overrides. |
| `subtitleLanguages.js` | Whisper output-language semantics (`auto` / `en` / other) | `App.jsx`, `SettingsModal.jsx` | Documents the whisper CLI contract (`-l auto`, `-l auto -tr`, `-l <code>`) consumed by the main process. |
| `languages/` | UI dictionaries (`en`, `pt`), `LANGS`, `normalizeLang`, `checkLangParity` | `src/lib/i18n.jsx` and every component using `t()` | en/pt key parity is enforced (`checkLangParity()` runs in dev). Never reorder, rename or "clean up" keys; always edit both dictionaries together. |
| `window.js` | Main-window geometry and `WINDOW_OPTIONS` | **`electron/main.cjs` via `require()`** (bundled into `dist/electron/main.js`) **and** `App.jsx` | Shared by renderer and main process; sizes are documented in `docs/wireframe ascii.md`. Changing the module shape or format can break the main-process bundle. |
| `version.js` | `APP_VERSION` shown in the About box | `AboutModal.jsx` | Single source for the displayed version — keep it equal to `package.json` → `version`. |

## Conventions

- **UTF-8 files.** Preserve bytes when touching a line. Do **not** round-trip these
  files through PowerShell (`Get-Content`/`Set-Content` mangles UTF-8); use an editor
  or a Node script instead.
- **Extension-less imports** (`./languages`, not `./languages/index.js`) — consumed by
  Vite for both the renderer and the Electron main build. Keep them as they are.
- **Portuguese comments are intentional history/context** (probe results, wireframe
  decisions). Leave them untouched.
- Keep `version.js` in sync with `package.json` on every release bump.

## Before editing anything here

1. Re-read this file.
2. State what you want to change and which allowed bucket it falls into (new i18n key
   in both dicts / appended export / maintainer-requested value change).
3. If it fits none of them → ask the maintainer first and show the advantages.
