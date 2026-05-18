const { contextBridge, ipcRenderer } = require('electron')

// The renderer calls the Fastify backend directly via fetch — no IPC needed for API calls.
// IPC is reserved for OS-level capabilities the renderer can't do on its own.
contextBridge.exposeInMainWorld('electron', {
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
  /**
   * Render the current page to PDF and prompt the user to save it.
   * The main process snapshots whatever's in the renderer's DOM via
   * webContents.printToPDF(), using the @media print rules from index.css.
   *
   * @param {{ defaultFilename?: string }} opts
   * @returns {Promise<{ ok: boolean, path?: string, canceled?: boolean, error?: string }>}
   */
  exportPDF: (opts) => ipcRenderer.invoke('export-pdf', opts ?? {}),
})
