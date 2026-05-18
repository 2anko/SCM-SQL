const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const fs   = require('fs/promises')
const path = require('path')

/**
 * Render the calling renderer's current DOM to PDF, then show a save dialog.
 *
 * The renderer toggles a `printing` class on <body> just before invoking this
 * (and removes it after), so the print stylesheet in index.css hides everything
 * outside .printable and removes elements marked .no-print. Result: the PDF
 * matches what the user sees, minus the chrome.
 *
 * Returns { ok: true, path } on success, { ok: false, canceled: true } if the
 * user dismissed the save dialog, or { ok: false, error } on failure.
 */
ipcMain.handle('export-pdf', async (event, { defaultFilename = 'report.pdf' } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { ok: false, error: 'No window' }

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save PDF',
    defaultPath: defaultFilename,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  try {
    const buffer = await event.sender.printToPDF({
      printBackground:   true,
      // Let the @page rule in index.css drive page size + margins so the
      // CSS is the single source of truth. Without this flag Electron
      // would override CSS margins with its own defaults.
      preferCSSPageSize: true,
    })
    await fs.writeFile(filePath, buffer)
    // Reveal in OS file manager so the user can find it immediately.
    shell.showItemInFolder(filePath)
    return { ok: true, path: filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    title: 'SCM — Supply Chain Manager',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setMenuBarVisibility(false)
  win.on('ready-to-show', () => win.show())

  // In dev, electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
