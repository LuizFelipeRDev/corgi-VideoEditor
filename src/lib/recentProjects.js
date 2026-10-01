// Recent projects (modal "OPEN") — pure functions.
// Source of truth: config.ini, recent_projects key (JSON of [{ path, at }]).
// Only the list logic lives here so it can be tested outside Electron.

export const MAX_RECENTS = 5

// Reads the config key (JSON string from the ini, or an object in mock/dev)
// always returning a list of valid entries [{ path, at }].
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

// Opened/saved → path goes to the top, duplicate is removed, list is cut at max.
export function touchRecent(list, path, at = new Date().toISOString(), max = MAX_RECENTS) {
  if (!path || typeof path !== 'string') return list
  const rest = (Array.isArray(list) ? list : []).filter((e) => e.path !== path)
  return [{ path, at }, ...rest].slice(0, max)
}

// Recent file gone/corrupted → disappears from the list (self-cleaning).
export function evictRecent(list, path) {
  return (Array.isArray(list) ? list : []).filter((e) => e.path !== path)
}

// "church reward.corgi.json" → "church reward"
export function projectLabel(path) {
  const base = String(path).split(/[/\\]/).pop() || String(path)
  return base.replace(/\.corgi\.json$/i, '').replace(/\.json$/i, '')
}
