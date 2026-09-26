const fs = require('fs')
const path = require('path')

/**
 * Espelha a pasta de fontes da build (resources/fonts) para a pasta do usuario
 * (%APPDATA%/corgi-editor/fonts).
 *
 * Por que nao basta "se a pasta nao existir, copia": em instalacoes antigas a
 * pasta ja existia desatualizada e nunca mais era atualizada - faltavam fontes
 * em producao (ex.: Montserrat-ExtraBold, a do estilo padrao) e o export caia
 * no fallback do sistema (Arial) sem nenhum aviso.
 *
 * Roda a cada inicializacao e:
 *  - copia os arquivos que faltam (ou que mudaram de tamanho)
 *  - remove da pasta do usuario os .ttf que nao existem mais na build
 *
 * @returns {{missingSrc?: true, emptySrc?: true, added?: number, removed?: number, total?: number}}
 */
function syncFontsDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return { missingSrc: true }

  const srcFiles = fs.readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith('.ttf'))
  if (srcFiles.length === 0) return { emptySrc: true }

  fs.mkdirSync(dstDir, { recursive: true })

  let added = 0
  for (const f of srcFiles) {
    const from = path.join(srcDir, f)
    const to = path.join(dstDir, f)
    const missing = !fs.existsSync(to)
    const changed = !missing && fs.statSync(to).size !== fs.statSync(from).size
    if (missing || changed) {
      fs.copyFileSync(from, to)
      added++
    }
  }

  // fonte que saiu da build tambem sai da pasta do usuario
  let removed = 0
  for (const f of fs.readdirSync(dstDir)) {
    if (f.toLowerCase().endsWith('.ttf') && !srcFiles.includes(f)) {
      fs.unlinkSync(path.join(dstDir, f))
      removed++
    }
  }

  return { added, removed, total: srcFiles.length }
}

module.exports = { syncFontsDir }
