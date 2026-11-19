import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { registerIpc, stopAllSessions } from './ipc'

let mainWindow: BrowserWindow | null = null

const isDev = !!process.env['ELECTRON_RENDERER_URL']

/**
 * Strict Content-Security-Policy applied to packaged builds only. In dev,
 * Vite/React Fast Refresh needs inline scripts and eval, so CSP is relaxed
 * there; the renderer never talks to the network directly in either mode.
 */
function applyCsp(): void {
  if (isDev) return
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
        ]
      }
    })
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0a',
    titleBarOverlay: { color: '#0a0a0a', symbolColor: '#c1c1c1', height: 56 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Open external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (url !== mainWindow?.webContents.getURL() && !(devUrl && url.startsWith(devUrl))) {
      event.preventDefault()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  applyCsp()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopAllSessions()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopAllSessions())
