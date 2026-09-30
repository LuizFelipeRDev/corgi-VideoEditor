// Projetos recentes (modal "ABRIR") — funções puras.
// Fonte da verdade: config.ini, chave recent_projects (JSON de [{ path, at }]).
// Aqui só mora a lógica de lista pra poder testar fora do Electron.

export const MAX_RECENTS = 5

// Lê a chave do config (string JSON vinda do ini, ou objeto no mock/dev)
// retornando sempre uma lista de entradas válidas [{ path, at }].
export function parseRecents(raw) {
  let list = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return []
    try {
      list = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  return list
    .filter((e) => e && typeof e === 'object' && typeof e.path === 'string' && e.path.trim())
    .map((e) => ({ path: e.path, at: typeof e.at === 'string' ? e.at : '' }))
}

// Abriu/salvou → path vai pro topo, duplicata sai, lista corta em max.
export function touchRecent(list, path, at = new Date().toISOString(), max = MAX_RECENTS) {
  if (!path || typeof path !== 'string') return list
  const rest = (Array.isArray(list) ? list : []).filter((e) => e.path !== path)
  return [{ path, at }, ...rest].slice(0, max)
}

// Arquivo do recente sumiu/está corrompido → some da lista (auto-limpeza).
export function evictRecent(list, path) {
  return (Array.isArray(list) ? list : []).filter((e) => e.path !== path)
}

// "recompensa da igreja.corgi.json" → "recompensa da igreja"
export function projectLabel(path) {
  const base = String(path).split(/[/\\]/).pop() || String(path)
  return base.replace(/\.corgi\.json$/i, '').replace(/\.json$/i, '')
}
