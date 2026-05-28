const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const crypto = require('crypto')
const fs    = require('fs/promises')
const path  = require('path')
const { pathToFileURL } = require('url')

// Helper so the dynamic backend imports build a correct file:// URL on both
// Windows (file:///C:/...) and POSIX (file:///home/...). Doing this by hand
// produced file://C:/... on Windows, which ES module resolution rejects.
const importBackend = (relPath) =>
  import(pathToFileURL(path.join(backendRoot, relPath)).href)

// ── Config storage ──────────────────────────────────────────────────────────
// %APPDATA%\SCM\config.json on Windows. Holds DB connection + JWT secret +
// a flag we use to tell the renderer whether to show the setup wizard.

const configPath = () => path.join(app.getPath('userData'), 'config.json')

async function readConfig() {
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}
async function writeConfig(config) {
  await fs.mkdir(path.dirname(configPath()), { recursive: true })
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2), 'utf8')
}

// ── Backend bootstrap ───────────────────────────────────────────────────────
// In dev (`electron-vite dev`), __dirname is .../frontend/out/main/, so the
// backend lives three levels up. When packaged by electron-builder, the
// backend and sql/migrations folders land under process.resourcesPath thanks
// to the extraResources entries in package.json's "build" config.

const isDev = !!process.env.ELECTRON_RENDERER_URL
const backendRoot = isDev
  ? path.resolve(__dirname, '../../../backend')
  : path.join(process.resourcesPath, 'backend')

const migrationsDir = isDev
  ? path.resolve(__dirname, '../../../sql/migrations')
  : path.join(process.resourcesPath, 'sql/migrations')

let backendApp = null   // running Fastify instance
let backendUrl = null   // e.g. http://127.0.0.1:3000 — exposed to renderer

async function startBackend(config) {
  if (backendApp) return backendUrl

  // Dynamic import so this CJS main can pull in the ESM backend modules.
  const appModule    = await importBackend('src/app.js')
  const dbModule     = await importBackend('src/config/db.js')
  const runnerModule = await importBackend('src/migrations/runner.js')

  const port = 3000
  try {
    backendApp = await appModule.startServer(config, { port, host: '127.0.0.1' })
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      // Port 3000 is already serving — almost always a separately-run dev
      // backend (`npm run dev` in backend/). Use that one instead of starting
      // our own. Migrations are that backend's responsibility, so we skip them.
      backendUrl = `http://127.0.0.1:${port}`
      console.log('Port 3000 already in use — using the external backend already running there (dev mode). Skipping embedded backend + migrations.')
      return backendUrl
    }
    throw err
  }
  backendUrl = `http://127.0.0.1:${port}`

  // Apply pending migrations using the same pool the server's now using.
  const { applied, adopted } = await runnerModule.runPendingMigrations(dbModule.db, migrationsDir)
  if (applied.length > 0) {
    backendApp.log.info(`Applied ${applied.length} migration(s): ${applied.join(', ')}`)
  }
  if (adopted.length > 0) {
    backendApp.log.info(`Adopted ${adopted.length} pre-existing migration(s) — DB already populated.`)
  }
  return backendUrl
}

// ── IPC: setup wizard ──────────────────────────────────────────────────────

ipcMain.handle('setup:get-state', async () => {
  const config = await readConfig()
  return {
    configured: !!config?.setupComplete,
    backendUrl,                                  // null until backend is up
    migrationsDir,                               // useful for diagnostics
  }
})

ipcMain.handle('setup:test-connection', async (_e, dbConfig) => {
  const dbModule = await importBackend('src/config/db.js')
  try {
    await dbModule.testConnection(dbConfig)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('setup:save-and-start', async (_e, { db: dbConfig }) => {
  // Generate a JWT secret on first save (kept across reconfigurations so
  // existing tokens don't get invalidated if the user re-runs setup).
  const existing = await readConfig()
  const config = {
    db: dbConfig,
    jwtSecret: existing?.jwtSecret ?? crypto.randomBytes(48).toString('hex'),
    setupComplete: false,                        // flipped after first user lands
  }
  await writeConfig(config)

  try {
    const url = await startBackend(config)
    return { ok: true, backendUrl: url }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('setup:mark-complete', async () => {
  const config = await readConfig()
  if (!config) return { ok: false, error: 'No config to update.' }
  await writeConfig({ ...config, setupComplete: true })
  return { ok: true }
})

// ── IPC: PDF export (unchanged from before) ─────────────────────────────────

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
      preferCSSPageSize: true,
    })
    await fs.writeFile(filePath, buffer)
    shell.showItemInFolder(filePath)
    return { ok: true, path: filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ── Window ──────────────────────────────────────────────────────────────────

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

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // If we have a saved config, start the backend up front so the login screen
  // works immediately. If we don't, the renderer will show the setup wizard,
  // which calls setup:save-and-start to bring the backend up.
  try {
    const config = await readConfig()
    if (config) await startBackend(config)
  } catch (err) {
    console.error('Backend failed to start with saved config:', err.message)
    // Fall through — the renderer will surface the error and offer re-setup.
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
