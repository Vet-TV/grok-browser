import { app, BrowserView, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { dataStore } from './data-store'
import { settingsStore } from './store'

export interface TabInfo {
  id: string
  title: string
  url: string
  favicon?: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  isBookmarked: boolean
}

interface Tab {
  id: string
  view: BrowserView
  title: string
  url: string
  favicon?: string
  loading: boolean
  zoomLevel: number
}

const CHROME_HEIGHT = 88
const SIDEBAR_MIN = 0
const NEW_TAB_URL = 'grok-browser://newtab'

function getNewTabPath(): string {
  return join(app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources'), 'newtab.html')
}

export class TabManager {
  private window: BrowserWindow
  private tabs = new Map<string, Tab>()
  private activeTabId: string | null = null
  private sidebarWidth = settingsStore.get('sidebarWidth')
  private sidebarOpen = settingsStore.get('sidebarOpen')

  constructor(window: BrowserWindow) {
    this.window = window
    this.sidebarWidth = settingsStore.get('sidebarWidth')
    this.sidebarOpen = settingsStore.get('sidebarOpen')
  }

  createTab(url?: string): string {
    const id = crypto.randomUUID()
    const view = new BrowserView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true
      }
    })

    const tab: Tab = { id, view, title: 'New Tab', url: NEW_TAB_URL, loading: true, zoomLevel: 0 }
    this.tabs.set(id, tab)
    this.setupViewEvents(id, view)

    if (url) {
      this.loadUrl(view, url)
    } else {
      view.webContents.loadFile(getNewTabPath()).catch(() => {
        view.webContents.loadURL(settingsStore.get('homePage')).catch(() => {})
      })
    }

    if (!this.activeTabId) {
      this.switchTab(id)
    }

    this.emitTabsUpdate()
    return id
  }

  restoreSession(urls: string[], activeIndex: number): void {
    for (const tab of this.tabs.values()) {
      this.window.removeBrowserView(tab.view)
      tab.view.webContents.close()
    }
    this.tabs.clear()
    this.activeTabId = null

    urls.forEach((url, i) => {
      const id = this.createTab(url)
      if (i === activeIndex) this.switchTab(id)
    })

    if (!this.activeTabId && urls.length > 0) {
      const first = [...this.tabs.keys()][0]
      if (first) this.switchTab(first)
    }
  }

  getSessionUrls(): { tabs: { url: string; title: string }[]; activeIndex: number } {
    const tabs = [...this.tabs.values()].map((t) => ({
      url: t.url === NEW_TAB_URL ? '' : t.url,
      title: t.title
    }))
    const keys = [...this.tabs.keys()]
    const activeIndex = this.activeTabId ? keys.indexOf(this.activeTabId) : 0
    return { tabs, activeIndex: Math.max(0, activeIndex) }
  }

  private loadUrl(view: BrowserView, url: string): void {
    if (url === NEW_TAB_URL || !url) {
      view.webContents.loadFile(getNewTabPath()).catch(() => {})
    } else {
      view.webContents.loadURL(url).catch(() => {})
    }
  }

  private setupViewEvents(id: string, view: BrowserView): void {
    const wc = view.webContents

    wc.on('did-start-loading', () => {
      const tab = this.tabs.get(id)
      if (tab) {
        tab.loading = true
        this.emitTabsUpdate()
      }
    })

    wc.on('did-stop-loading', () => {
      const tab = this.tabs.get(id)
      if (tab) {
        tab.loading = false
        this.emitTabsUpdate()
      }
    })

    wc.on('page-title-updated', (_, title) => {
      const tab = this.tabs.get(id)
      if (tab) {
        tab.title = title
        this.emitTabsUpdate()
      }
    })

    wc.on('did-navigate', (_, url) => {
      const tab = this.tabs.get(id)
      if (tab) {
        tab.url = url.includes('newtab.html') ? NEW_TAB_URL : url
        if (tab.url !== NEW_TAB_URL) {
          dataStore.addHistory({ title: tab.title, url: tab.url })
        }
        this.emitActiveTabUpdate()
        this.emitTabsUpdate()
      }
    })

    wc.on('did-navigate-in-page', (_, url) => {
      const tab = this.tabs.get(id)
      if (tab) {
        tab.url = url
        this.emitActiveTabUpdate()
        this.emitTabsUpdate()
      }
    })

    wc.on('page-favicon-updated', (_, favicons) => {
      const tab = this.tabs.get(id)
      if (tab && favicons[0]) {
        tab.favicon = favicons[0]
        this.emitTabsUpdate()
      }
    })

    wc.setWindowOpenHandler(({ url }) => {
      this.createTab(url)
      return { action: 'deny' }
    })
  }

  switchTab(id: string): void {
    if (!this.tabs.has(id)) return

    if (this.activeTabId) {
      const prev = this.tabs.get(this.activeTabId)
      if (prev) this.window.removeBrowserView(prev.view)
    }

    this.activeTabId = id
    const tab = this.tabs.get(id)!
    this.window.addBrowserView(tab.view)
    this.layoutViews()
    this.emitActiveTabUpdate()
    this.emitTabsUpdate()
  }

  closeTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return

    this.window.removeBrowserView(tab.view)
    tab.view.webContents.close()
    this.tabs.delete(id)

    if (this.activeTabId === id) {
      this.activeTabId = null
      const remaining = [...this.tabs.keys()]
      if (remaining.length) {
        this.switchTab(remaining[remaining.length - 1])
      } else {
        this.createTab()
      }
    }

    this.emitTabsUpdate()
  }

  duplicateTab(id?: string): string | undefined {
    const sourceId = id || this.activeTabId
    if (!sourceId) return undefined
    const tab = this.tabs.get(sourceId)
    if (!tab || tab.url === NEW_TAB_URL) return this.createTab()
    const newId = this.createTab(tab.url)
    this.switchTab(newId)
    return newId
  }

  getActiveView(): BrowserView | null {
    if (!this.activeTabId) return null
    return this.tabs.get(this.activeTabId)?.view ?? null
  }

  navigate(url: string): void {
    const view = this.getActiveView()
    if (!view) return

    let target = url.trim()
    if (!target) return

    const isUrl =
      /^https?:\/\//i.test(target) ||
      /^localhost/i.test(target) ||
      /^[\w-]+\.[\w.-]+/.test(target)

    if (isUrl) {
      if (!/^https?:\/\//i.test(target)) target = 'https://' + target
      view.webContents.loadURL(target).catch(() => {})
    } else {
      view.webContents.loadURL(`https://www.google.com/search?q=${encodeURIComponent(target)}`).catch(() => {})
    }
  }

  goBack(): void { this.getActiveView()?.webContents.goBack() }
  goForward(): void { this.getActiveView()?.webContents.goForward() }
  reload(): void { this.getActiveView()?.webContents.reload() }
  stop(): void { this.getActiveView()?.webContents.stop() }

  findInPage(text: string, options: { forward?: boolean; findNext?: boolean }): void {
    const view = this.getActiveView()
    if (!view || !text) return
    view.webContents.findInPage(text, {
      forward: options.forward ?? true,
      findNext: options.findNext ?? false
    })
  }

  stopFindInPage(): void {
    this.getActiveView()?.webContents.stopFindInPage('clearSelection')
  }

  setZoom(delta: number): number {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null
    const view = this.getActiveView()
    if (!tab || !view) return 0
    tab.zoomLevel = Math.max(-5, Math.min(5, tab.zoomLevel + delta))
    view.webContents.setZoomLevel(tab.zoomLevel)
    return tab.zoomLevel
  }

  resetZoom(): number {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null
    const view = this.getActiveView()
    if (!tab || !view) return 0
    tab.zoomLevel = 0
    view.webContents.setZoomLevel(0)
    return 0
  }

  getZoom(): number {
    return this.activeTabId ? (this.tabs.get(this.activeTabId)?.zoomLevel ?? 0) : 0
  }

  toggleBookmark(): boolean {
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null
    if (!tab || tab.url === NEW_TAB_URL || !tab.url) return false

    if (dataStore.isBookmarked(tab.url)) {
      const bookmark = dataStore.getBookmarks().find((b) => b.url === tab.url)
      if (bookmark) dataStore.removeBookmark(bookmark.id)
      this.emitActiveTabUpdate()
      return false
    }

    dataStore.addBookmark({ title: tab.title, url: tab.url, favicon: tab.favicon })
    this.emitActiveTabUpdate()
    return true
  }

  setSidebar(open: boolean, width?: number): void {
    this.sidebarOpen = open
    if (width !== undefined) this.sidebarWidth = width
    settingsStore.set('sidebarOpen', open)
    if (width !== undefined) settingsStore.set('sidebarWidth', width)
    this.layoutViews()
  }

  layoutViews(): void {
    const [width, height] = this.window.getContentSize()
    const sidebar = this.sidebarOpen ? this.sidebarWidth : SIDEBAR_MIN
    const viewWidth = Math.max(0, width - sidebar)
    const viewHeight = Math.max(0, height - CHROME_HEIGHT)

    for (const tab of this.tabs.values()) {
      tab.view.setBounds({ x: 0, y: CHROME_HEIGHT, width: viewWidth, height: viewHeight })
      tab.view.setAutoResize({ width: true, height: true })
    }
  }

  async extractPageContent(): Promise<{ title: string; url: string; text: string } | null> {
    const view = this.getActiveView()
    const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null
    if (!view || !tab || tab.url === NEW_TAB_URL) return null

    try {
      const result = await view.webContents.executeJavaScript(`
        (() => {
          const clone = document.body?.cloneNode(true);
          if (clone) {
            clone.querySelectorAll('script, style, noscript, nav, footer, header, aside, iframe').forEach(el => el.remove());
          }
          const text = clone?.innerText || document.body?.innerText || '';
          return {
            title: document.title || '',
            url: location.href,
            text: text.replace(/\\s+/g, ' ').trim().slice(0, 20000)
          };
        })()
      `)
      return result
    } catch {
      return { title: tab.title, url: tab.url, text: '' }
    }
  }

  private getTabInfos(): TabInfo[] {
    return [...this.tabs.values()].map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      favicon: t.favicon,
      loading: t.loading,
      canGoBack: t.view.webContents.canGoBack(),
      canGoForward: t.view.webContents.canGoForward(),
      isBookmarked: t.url !== NEW_TAB_URL && dataStore.isBookmarked(t.url)
    }))
  }

  private emitTabsUpdate(): void {
    this.window.webContents.send('tabs:updated', this.getTabInfos(), this.activeTabId)
  }

  private emitActiveTabUpdate(): void {
    const view = this.getActiveView()
    if (!view || !this.activeTabId) return
    const tab = this.tabs.get(this.activeTabId)!
    this.window.webContents.send('tab:active-updated', {
      id: this.activeTabId,
      title: tab.title,
      url: tab.url,
      loading: tab.loading,
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward(),
      isBookmarked: tab.url !== NEW_TAB_URL && dataStore.isBookmarked(tab.url)
    })
  }

  getSidebarState(): { open: boolean; width: number } {
    return { open: this.sidebarOpen, width: this.sidebarWidth }
  }
}

export function configureSession(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true)
  })
}