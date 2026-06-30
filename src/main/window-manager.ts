import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { setupDownloads } from './downloads'
import { TabManager } from './tab-manager'
import { settingsStore } from './store'
import { dataStore } from './data-store'

export interface BrowserInstance {
  window: BrowserWindow
  tabManager: TabManager
  incognito: boolean
  tabsInitialized: boolean
}

const instances = new Map<number, BrowserInstance>()
const isDev = !app.isPackaged

function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function getRendererPath(): string {
  return join(__dirname, '../renderer/index.html')
}

export function getInstance(win: BrowserWindow | null | undefined): BrowserInstance | null {
  if (!win) return null
  return instances.get(win.id) ?? null
}

export function getTabManagerFromSender(sender: Electron.WebContents): TabManager | null {
  const win = BrowserWindow.fromWebContents(sender)
  return getInstance(win)?.tabManager ?? null
}

export function getFocusedTabManager(): TabManager | null {
  const focused = BrowserWindow.getFocusedWindow()
  return getInstance(focused)?.tabManager ?? instances.values().next().value?.tabManager ?? null
}

function initTabsForInstance(instance: BrowserInstance): void {
  if (instance.tabsInitialized) return
  instance.tabsInitialized = true

  const { tabManager, incognito } = instance
  if (!incognito && settingsStore.get('restoreSession')) {
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

export function createBrowserWindow(options?: { incognito?: boolean }): BrowserInstance {
  const incognito = options?.incognito ?? false
  const partition = incognito ? `temp:incognito-${crypto.randomUUID()}` : undefined

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: incognito ? 'Grok Browser — Incognito' : 'Grok Browser',
    backgroundColor: '#0a0a0f',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition
    }
  })

  const tabManager = new TabManager(win, { incognito, partition })
  const instance: BrowserInstance = { window: win, tabManager, incognito, tabsInitialized: false }
  instances.set(win.id, instance)

  setupDownloads(win, tabManager.getSession(), incognito)

  win.on('resize', () => tabManager.layoutViews())
  win.on('maximize', () => tabManager.layoutViews())
  win.on('unmaximize', () => tabManager.layoutViews())

  win.on('close', () => {
    if (!incognito && tabManager && settingsStore.get('restoreSession')) {
      const sessionData = tabManager.getSessionUrls()
      const validTabs = sessionData.tabs.filter((t) => t.url)
      if (validTabs.length) {
        dataStore.saveSession({ tabs: validTabs, activeIndex: sessionData.activeIndex })
      }
    }
    if (incognito && partition) {
      session.fromPartition(partition).clearStorageData().catch(() => {})
    }
  })

  win.on('closed', () => {
    instances.delete(win.id)
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(getRendererPath())
  }

  win.webContents.once('did-finish-load', () => {
    const sidebar = tabManager.getSidebarState()
    win.webContents.send('sidebar:state', sidebar)
    win.webContents.send('window:meta', { incognito, version: app.getVersion() })
  })

  return instance
}

export function handleChromeLayout(sender: Electron.WebContents, layout: { chromeHeight: number; sidebarWidth: number }): void {
  const instance = getInstance(BrowserWindow.fromWebContents(sender))
  if (!instance) return
  instance.tabManager.setChromeLayout(layout)
  if (!instance.tabsInitialized) {
    instance.tabManager.markTabsReady()
    initTabsForInstance(instance)
  }
}

export function getAllInstances(): BrowserInstance[] {
  return [...instances.values()]
}