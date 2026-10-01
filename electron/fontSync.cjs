const fs = require('fs')
const path = require('path')

/**
 * Mirrors the build's font folder (resources/fonts) into the user's folder
 * (%APPDATA%/corgi-editor/fonts).
 *
 * Why "if the folder does not exist, copy" is not enough: in old installations the
 * folder already existed outdated and was never updated again - fonts were
 * missing in production (e.g. Montserrat-ExtraBold, the default style one) and the export fell
 * into the system fallback (Arial) with no warning.
 *
 * Runs at every startup and:
 *  - copies the files that are missing (or whose size changed)
 *  - removes from the user's folder the .ttf files that no longer exist in the build
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

  // a font that left the build also leaves the user's folder
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
