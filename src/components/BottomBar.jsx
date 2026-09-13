function BottomBar({ outputFolder, selectedFile, onOpenSettings, onOpenAbout }) {
  const handleOpenFolder = async () => {
    if (outputFolder) {
      await window.api.openFolder(outputFolder)
    } else if (selectedFile?.folder) {
      await window.api.openFolder(selectedFile.folder)
    }
  }

  return (
    <div className="bg-retro-bg border-t-2 border-retro-black px-3 py-1.5 shrink-0 flex items-center justify-between">
      <span className="font-pixel text-[7px] text-retro-black/60 truncate flex-1">
        PASTA: {outputFolder || 'MESMA DO ARQUIVO'}
      </span>
      <button
        onClick={onOpenAbout}
        className="btn-retro w-6 h-6 bg-retro-box border-2 border-retro-black rounded-full shadow-retro-sm flex items-center justify-center hover:bg-gray-200 shrink-0 ml-2"
        title="Sobre"
      >
        ?
      </button>
      <button
        onClick={handleOpenFolder}
        className="btn-retro w-6 h-6 bg-retro-box border-2 border-retro-black rounded-full shadow-retro-sm flex items-center justify-center hover:bg-gray-200 shrink-0 ml-2"
        title="Abrir pasta de destino"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
      </button>
      <button
        onClick={onOpenSettings}
        className="btn-retro w-6 h-6 bg-retro-box border-2 border-retro-black rounded-full shadow-retro-sm flex items-center justify-center text-[9px] hover:bg-gray-200 shrink-0 ml-2"
        title="Configurações"
      >
        ⚙
      </button>
    </div>
  )
}

export default BottomBar
