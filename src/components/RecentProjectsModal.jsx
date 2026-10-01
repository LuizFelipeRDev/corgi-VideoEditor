import { useEffect, useState } from 'react'
import { IconFolder } from '@tabler/icons-react'
import { useLang } from '../lib/i18n'
import { projectLabel } from '../lib/recentProjects'

// "RECENT PROJECTS" modal — opens when clicking OPEN (TitleBar). Lists the 5
// last opened/saved projects (config.ini → recent_projects); clicking a
// row loads it directly, and whoever prefers still opens through the
// native dialog (OPEN MANUALLY). A file missing from disk stays visible with
// a "file not found" badge and disabled.
function RecentProjectsModal({ projects, onOpenPath, onOpenManual, onClose }) {
  const { t, lang } = useLang()
  const [missing, setMissing] = useState({})

  // Per-row existence check (pathExists is cheap and local). Runs on every
  // list change; unmount does not apply a late pathExists result.
  useEffect(() => {
    let alive = true
    const check = async () => {
      const out = {}
      for (const p of projects) {
        try {
          const ok = window.api?.pathExists ? await window.api.pathExists(p.path) : false
          out[p.path] = !ok
        } catch {
          out[p.path] = true
        }
      }
      if (alive) setMissing(out)
    }
    check()
    return () => {
      alive = false
    }
  }, [projects])

  const fmtDate = (at) => {
    if (!at) return ''
    const d = new Date(at)
    if (Number.isNaN(d.getTime())) return ''
    try {
      return d.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const btn =
    'h-7 px-3 border-2 border-retro-black rounded bg-retro-bg shadow-retro-sm font-pixel text-[6px] text-retro-black uppercase hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed'
  const btnPrimary =
    'h-7 px-3 border-2 border-retro-black rounded bg-retro-black text-retro-bg shadow-retro-sm font-pixel text-[6px] uppercase hover:bg-gray-800'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[460px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-pixel text-[9px] text-retro-black uppercase flex items-center gap-1.5">
            <IconFolder size={14} />
            {t('project.recentTitle')}
          </h2>
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>

        <p className="font-pixel text-[6px] text-retro-black/70 leading-relaxed mb-3">{t('project.recentHint')}</p>

        <div className="flex flex-col gap-1.5 mb-3 max-h-[240px] overflow-y-auto">
          {projects.length === 0 && (
            <p className="font-pixel text-[7px] text-retro-black/50 text-center py-4">{t('project.recentEmpty')}</p>
          )}
          {projects.map((p) => {
            const gone = missing[p.path] === true
            return (
              <button
                key={p.path}
                onClick={() => onOpenPath(p.path)}
                disabled={gone}
                title={p.path}
                className="w-full text-left bg-retro-bg border-2 border-retro-black rounded px-2.5 py-2 hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="font-pixel text-[8px] text-retro-black block truncate">{projectLabel(p.path)}</span>
                  <span className="font-pixel text-[6px] text-retro-black/50 block truncate">
                    {p.path.replace(/[\\/][^\\/]+$/, '')}
                  </span>
                </span>
                <span className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="font-pixel text-[6px] text-retro-black/60">{fmtDate(p.at)}</span>
                  {gone && (
                    <span className="font-pixel text-[6px] text-red-700 uppercase">{t('project.recentMissing')}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className={btn}>
            {t('project.cancel')}
          </button>
          <button onClick={onOpenManual} className={btnPrimary}>
            {t('project.openManual')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default RecentProjectsModal
