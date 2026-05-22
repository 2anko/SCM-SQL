const { contextBridge, ipcRenderer } = require('electron')

// The renderer talks to the Fastify backend over fetch — these bridges are
// only for things the renderer can't do on its own (filesystem, IPC, OS
// dialogs, embedded backend lifecycle).
contextBridge.exposeInMainWorld('electron', {
  versions: {
    node:     process.versions.node,
    electron: process.versions.electron,
  },

  // PDF export — see main/index.js export-pdf handler.
  exportPDF: (opts) => ipcRenderer.invoke('export-pdf', opts ?? {}),

  // First-run setup wizard bridges.
  setup: {
    getState:       ()         => ipcRenderer.invoke('setup:get-state'),
    testConnection: (dbConfig) => ipcRenderer.invoke('setup:test-connection', dbConfig),
    saveAndStart:   (payload)  => ipcRenderer.invoke('setup:save-and-start', payload),
    markComplete:   ()         => ipcRenderer.invoke('setup:mark-complete'),
  },
})
