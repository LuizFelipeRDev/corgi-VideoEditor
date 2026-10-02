import { useState, useEffect } from 'react'
import logo from '../../assets/novaLogo.png'
import { APP_VERSION } from '../global_config/version'
import { useLang } from '../lib/i18n'

// About box + manual update flow (electron-updater). The check runs ONLY when the
// user clicks the button, and every user-facing message is its own modal dialog
// (confirm / info / error / progress / installing) — no inline warning labels.
function AboutModal({ onClose }) {
  const { t } = useLang()

  // Button state: 'idle' | 'checking' (disabled) | 'error' (TRY AGAIN).
  const [updateState, setUpdateState] = useState('idle')
  // Download numbers live outside the dialog so the bar updates in place.
  const [updateProgress, setUpdateProgress] = useState({ percent: 0, transferred: 0, total: 0 })
  // type: 'confirm' | 'info' | 'error' | 'progress' | 'installing'.
  // 'progress' and 'installing' are NOT closable — the flow owns the screen until
  // the download ends and the app installs itself.
  const [updateDialog, setUpdateDialog] = useState(null)

  // Statuses pushed by electron/main.cjs. Messages are stored as i18n keys + vars
  // (not rendered text) so a language switch retranslates the open dialog live.
  useEffect(() => {
    const handler = (status) => {
      if (!status) return
      if (status.state === 'checking') {
        setUpdateState('checking')
        return
      }
      if (status.state === 'available') {
        setUpdateState('idle')
        setUpdateDialog({ type: 'confirm', key: 'about.updateAvailableMsg', vars: { version: status.version || '' } })
        return
      }
      if (status.state === 'not-available') {
        setUpdateState('idle')
        setUpdateDialog({ type: 'info', key: 'about.updateUpToDate', vars: { version: status.current || '' } })
        return
      }
      if (status.state === 'downloading') {
        setUpdateProgress({
          percent: status.percent || 0,
          transferred: status.transferred || 0,
          total: status.total || 0,
        })
        setUpdateDialog((d) => (d && d.type === 'progress' ? d : { type: 'progress' }))
        return
      }
      if (status.state === 'downloaded') {
        setUpdateDialog({ type: 'installing', key: 'about.updateInstalling', vars: { version: status.version || '' } })
        return
      }
      if (status.state === 'error') {
        setUpdateState('error')
        setUpdateDialog({ type: 'error', text: status.message || '' })
      }
    }
    window.api.onUpdaterStatus(handler)
    return () => window.api.onUpdaterStatus(null)
  }, [])

  // Entry point — the check only runs on click (nothing happens on startup).
  const handleCheckUpdate = async () => {
    setUpdateState('checking')
    // Rejection guard: an IPC failure must not leave the button stuck on "checking".
    let res
    try {
      res = (await window.api.updateCheck()) || { ok: false, reason: 'dev' }
    } catch (err) {
      res = { ok: false, message: String((err && err.message) || err) }
    }
    if (!res.ok) {
      if (res.reason === 'dev') {
        setUpdateState('idle')
        setUpdateDialog({ type: 'info', key: 'about.updateDevOnly' })
      } else {
        setUpdateState('error')
        setUpdateDialog({ type: 'error', text: res.message || '' })
      }
    } else {
      // Resolved without a terminal event yet — free the button; the next event
      // (available / not-available / error) overrides this state anyway.
      setUpdateState('idle')
    }
  }

  // Confirm dialogs open the download right away; info/error just dismiss.
  const closeDialog = () => setUpdateDialog(null)
  const startDownload = () => {
    setUpdateDialog({ type: 'progress' })
    window.api.updateDownload()
  }

  const dialogClosable = !!updateDialog && ['confirm', 'info', 'error'].includes(updateDialog.type)
  let dialogMessage = ''
  if (updateDialog) {
    if (updateDialog.key) dialogMessage = t(updateDialog.key, updateDialog.vars)
    else if (updateDialog.type === 'error') {
      dialogMessage = t('about.updateError') + (updateDialog.text ? `: ${updateDialog.text}` : '')
    }
  }
  const leftMb = Math.max(0, Math.round((updateProgress.total - updateProgress.transferred) / 1048576))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-72 p-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
          >
            ✕
          </button>
        </div>
        <img src={logo} alt="Logo" className="w-20 h-20 mx-auto mb-3" />
        <h2 className="font-pixel text-[10px] text-retro-black mb-1">A Lue Project</h2>
        <p className="font-pixel text-[7px] text-retro-black/60">CORGI-EDITOR v{APP_VERSION}</p>

        <button
          onClick={handleCheckUpdate}
          disabled={updateState === 'checking'}
          className="btn-retro w-full h-8 mt-4 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm font-pixel text-[8px] text-retro-black uppercase hover:bg-yellow-100 disabled:opacity-40"
        >
          {updateState === 'checking'
            ? t('about.updateChecking')
            : updateState === 'error'
              ? t('about.updateRetry')
              : t('about.updateCheck')}
        </button>
      </div>

      {/* Update dialog — stacked over the About box (later sibling wins z-50). */}
      {updateDialog && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation()
            if (dialogClosable) closeDialog()
          }}
        >
          <div
            className="bg-retro-box border-2 border-retro-black rounded-lg shadow-retro w-[480px] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2
                className={`font-pixel text-[9px] uppercase ${
                  updateDialog.type === 'error' ? 'text-red-600' : 'text-retro-black'
                }`}
              >
                {updateDialog.type === 'error' ? t('common.error') : t('about.update')}
              </h2>
              {dialogClosable && (
                <button
                  onClick={closeDialog}
                  className="btn-retro w-6 h-6 bg-retro-bg border-2 border-retro-black rounded shadow-retro-sm flex items-center justify-center text-[10px] font-bold hover:bg-red-200"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="bg-retro-bg border-2 border-retro-black rounded p-3 mb-3">
              {dialogMessage && (
                <p className="font-pixel text-[7px] text-retro-black whitespace-pre-wrap break-all">
                  {dialogMessage}
                </p>
              )}

              {updateDialog.type === 'progress' && (
                <div className={dialogMessage ? 'mt-3' : ''}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-pixel text-[6px] text-retro-black">
                      {t('about.updateDownloading')}
                    </span>
                    <span className="font-pixel text-[6px] text-retro-black">
                      {updateProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-retro-box border border-retro-black rounded overflow-hidden">
                    <div
                      className="h-full bg-green-400 transition-all duration-300"
                      style={{ width: `${updateProgress.percent}%` }}
                    />
                  </div>
                  <p className="font-pixel text-[6px] text-retro-black/50 mt-1">
                    {t('about.updateLeft', { left: leftMb })}
                  </p>
                </div>
              )}
            </div>

            {updateDialog.type === 'confirm' ? (
              <div className="flex gap-2">
                <button
                  onClick={startDownload}
                  className="btn-retro flex-1 h-9 bg-green-100 border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-green-200"
                >
                  {t('common.yes')}
                </button>
                <button
                  onClick={closeDialog}
                  className="btn-retro flex-1 h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[7px] text-retro-black uppercase hover:bg-gray-200"
                >
                  {t('common.no')}
                </button>
              </div>
            ) : dialogClosable ? (
              <button
                onClick={closeDialog}
                className="btn-retro w-full h-9 bg-retro-bg border-2 border-retro-black rounded shadow-retro font-pixel text-[8px] text-retro-black uppercase hover:bg-gray-200"
              >
                {t('common.close')}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default AboutModal
