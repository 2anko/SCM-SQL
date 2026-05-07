const { contextBridge } = require('electron')

// The renderer calls the Fastify backend directly via fetch — no IPC needed for API calls.
// Add OS-level bridges here as needed (file dialogs, etc.).
contextBridge.exposeInMainWorld('electron', {
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
  },
})
