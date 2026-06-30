import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import {
  getXAccountStatus,
  markOnboardingComplete,
  openXSignIn,
  signOutXAccount
} from './auth-service'
import { dataStore } from './data-store'
import { openDownload, setupDownloads } from './downloads'
import { grokService } from './grok-service'
import { configureSession, TabManager } from './tab-manager'
import { settingsStore } from './store'

let mainWindow: BrowserWindow | null = null
let tabManager: TabManager | null = null
let tabsInitialized = false

const isDev = !app.isPackaged

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Grok Browser',
    backgroundColor: '#0a0a0f',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  tabManager = new TabManager(mainWindow)
  setupDownloads(mainWindow)

  mainWindow.on('resize', () => tabManager?.layoutViews())
  mainWindow.on('maximize', () => tabManager?.layoutViews())
  mainWindow.on('unmaximize', () => tabManager?.layoutViews())

  mainWindow.on('close', () => {
    if (tabManager && settingsStore.get('restoreSession')) {
      const session = tabManager.getSessionUrls()
      const validTabs = session.tabs.filter((t) => t.url)
      if (validTabs.length) {
        dataStore.saveSession({ tabs: validTabs, activeIndex: session.activeIndex })
      }
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    const sidebar = tabManager?.getSidebarState()
    if (sidebar) mainWindow?.webContents.send('sidebar:state', sidebar)
  })
}

function initTabs(): void {
  if (!tabManager || tabsInitialized) return
  tabsInitialized = true

  if (settingsStore.get('restoreSession')) {
    const saved = dataStore.getSession()
    if (saved && saved.tabs.length > 0) {
      const urls = saved.tabs.map((t) => t.url).filter(Boolean)
      if (urls.length) {
        tabManager.restoreSession(urls, saved.activeIndex)
        return
      }
    }
  }

  tabManager.createTab()
}

function setupIpc(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)

  ipcMain.handle('chrome:report-layout', (_, layout: { chromeHeight: number; sidebarWidth: number }) => {
    if (!tabManager) return false
    tabManager.setChromeLayout(layout)
    if (!tabsInitialized) {
      tabManager.markTabsReady()
      initTabs()
    }
    return true
  })

  ipcMain.handle('auth:status', () => getXAccountStatus())
  ipcMain.handle('auth:sign-in', () => openXSignIn(mainWindow))
  ipcMain.handle('auth:sign-out', () => {
    signOutXAccount()
    return getXAccountStatus()
  })
  ipcMain.handle('auth:complete-onboarding', () => {
    markOnboardingComplete()
    return getXAccountStatus()
  })

  ipcMain.handle('tabs:create', (_, url?: string) => tabManager?.createTab(url))
  ipcMain.handle('tabs:switch', (_, id: string) => tabManager?.switchTab(id))
  ipcMain.handle('tabs:close', (_, id: string) => tabManager?.closeTab(id))
  ipcMain.handle('tabs:duplicate', (_, id?: string) => tabManager?.duplicateTab(id))
  ipcMain.handle('tabs:navigate', (_, url: string) => tabManager?.navigate(url))
  ipcMain.handle('tabs:back', () => tabManager?.goBack())
  ipcMain.handle('tabs:forward', () => tabManager?.goForward())
  ipcMain.handle('tabs:reload', () => tabManager?.reload())
  ipcMain.handle('tabs:stop', () => tabManager?.stop())

  ipcMain.handle('find:in-page', (_, text: string, options?: object) =>
    tabManager?.findInPage(text, (options || {}) as { forward?: boolean; findNext?: boolean })
  )
  ipcMain.handle('find:stop', () => tabManager?.stopFindInPage())

  ipcMain.handle('zoom:set', (_, delta: number) => tabManager?.setZoom(delta) ?? 0)
  ipcMain.handle('zoom:reset', () => tabManager?.resetZoom() ?? 0)
  ipcMain.handle('zoom:get', () => tabManager?.getZoom() ?? 0)

  ipcMain.handle('bookmarks:toggle', () => tabManager?.toggleBookmark() ?? false)
  ipcMain.handle('bookmarks:list', () => dataStore.getBookmarks())
  ipcMain.handle('bookmarks:remove', (_, id: string) => dataStore.removeBookmark(id))
  ipcMain.handle('bookmarks:add', (_, entry: { title: string; url: string }) =>
    dataStore.addBookmark(entry)
  )

  ipcMain.handle('history:list', () => dataStore.getHistory())
  ipcMain.handle('history:clear', () => dataStore.clearHistory())

  ipcMain.handle('downloads:list', () => dataStore.getDownloads())
  ipcMain.handle('downloads:open', (_, path: string) => openDownload(path))

  ipcMain.handle('sidebar:set', (_, open: boolean, width?: number) => {
    tabManager?.setSidebar(open, width)
    return tabManager?.getSidebarState()
  })

  ipcMain.handle('settings:get', () => ({
    apiKey: settingsStore.get('apiKey') ? '••••••••' : '',
    hasApiKey: !!settingsStore.get('apiKey'),
    model: settingsStore.get('model'),
    searchMode: settingsStore.get('searchMode'),
    homePage: settingsStore.get('homePage'),
    restoreSession: settingsStore.get('restoreSession'),
    sidebarWidth: settingsStore.get('sidebarWidth'),
    sidebarOpen: settingsStore.get('sidebarOpen'),
    xAccountLinked: settingsStore.get('xAccountLinked'),
    xUsername: settingsStore.get('xUsername'),
    onboardingComplete: settingsStore.get('onboardingComplete')
  }))

  ipcMain.handle('settings:set', (_, settings: Record<string, string | boolean>) => {
    if (settings.apiKey && settings.apiKey !== '••••••••') {
      settingsStore.set('apiKey', settings.apiKey as string)
    }
    if (settings.model) settingsStore.set('model', settings.model as string)
    if (settings.searchMode) settingsStore.set('searchMode', settings.searchMode as 'auto' | 'on' | 'off')
    if (settings.homePage) settingsStore.set('homePage', settings.homePage as string)
    if (typeof settings.restoreSession === 'boolean') settingsStore.set('restoreSession', settings.restoreSession)
    return true
  })

  ipcMain.handle('page:get-content', async () => tabManager?.extractPageContent())

  const streamGrok = async (
    event: Electron.IpcMainInvokeEvent,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: { searchMode?: 'auto' | 'on' | 'off' }
  ) => {
    const channel = `grok:stream:${Date.now()}`
    event.sender.send('grok:stream-start', channel)

    ;(async () => {
      try {
        for await (const chunk of grokService.streamChat(messages, options)) {
          event.sender.send(channel, chunk)
        }
      } catch (err) {
        event.sender.send(channel, {
          type: 'error',
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    })()

    return channel
  }

  ipcMain.handle('grok:chat', (event, messages, options) =>
    streamGrok(event, messages as { role: 'system' | 'user' | 'assistant'; content: string }[], options)
  )

  ipcMain.handle('grok:summarize-page', async (event) => {
    const page = await tabManager?.extractPageContent()
    if (!page) return { error: 'No active page' }
    return streamGrok(event, grokService.buildSummarizePrompt(page.title, page.url, page.text), { searchMode: 'off' })
  })

  ipcMain.handle('grok:ask-page', async (event, query: string) => {
    const page = await tabManager?.extractPageContent()
    if (!page) return { error: 'No active page' }
    return streamGrok(event, grokService.buildPageContextPrompt(page.title, page.url, page.text, query), { searchMode: 'auto' })
  })

  ipcMain.handle('grok:research', async (event, topic: string) => {
    return streamGrok(event, grokService.buildResearchPrompt(topic), { searchMode: 'on' })
  })

  ipcMain.handle('shell:open-external', (_, url: string) => shell.openExternal(url))
}

app.whenReady().then(() => {
  configureSession()
  setupIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})