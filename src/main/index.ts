import { app, BrowserWindow, ipcMain, shell } from 'electron'
import {
  clearBrowsingData,
  copyPageLink,
  execClipboard,
  getAppVersion,
  getQrCodeUrl,
  getTaskManagerInfo,
  goHome,
  openDevTools,
  savePageAs,
  toggleReadingMode
} from './browser-actions'
import {
  configureAuthSession,
  getXAccountStatus,
  markOnboardingComplete,
  openXSignIn,
  signOutXAccount
} from './auth-service'
import { dataStore } from './data-store'
import { openDownload } from './downloads'
import { extensionsService } from './extensions-service'
import { grokService } from './grok-service'
import { passwordStore } from './password-store'
import { settingsStore } from './store'
import { configureSession } from './tab-manager'
import {
  createBrowserWindow,
  getTabManagerFromSender,
  handleChromeLayout
} from './window-manager'

function setupIpc(): void {
  ipcMain.handle('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.handle('window:maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.handle('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle('window:is-maximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)
  ipcMain.handle('window:new', () => { createBrowserWindow(); return true })
  ipcMain.handle('window:incognito', () => { createBrowserWindow({ incognito: true }); return true })
  ipcMain.handle('app:version', () => getAppVersion())

  ipcMain.handle('chrome:report-layout', (e, layout) => {
    handleChromeLayout(e.sender, layout)
    return true
  })
  ipcMain.handle('chrome:set-overlay-open', (e, open: boolean) => {
    getTabManagerFromSender(e.sender)?.setOverlayOpen(open)
    return true
  })

  ipcMain.handle('auth:status', () => getXAccountStatus())
  ipcMain.handle('auth:sign-in', (e) => openXSignIn(BrowserWindow.fromWebContents(e.sender)))
  ipcMain.handle('auth:sign-out', () => { signOutXAccount(); return getXAccountStatus() })
  ipcMain.handle('auth:complete-onboarding', () => { markOnboardingComplete(); return getXAccountStatus() })

  const tm = (e: Electron.IpcMainInvokeEvent) => getTabManagerFromSender(e.sender)

  ipcMain.handle('tabs:create', (e, url?: string) => tm(e)?.createTab(url))
  ipcMain.handle('tabs:switch', (e, id: string) => tm(e)?.switchTab(id))
  ipcMain.handle('tabs:close', (e, id: string) => tm(e)?.closeTab(id))
  ipcMain.handle('tabs:duplicate', (e, id?: string) => tm(e)?.duplicateTab(id))
  ipcMain.handle('tabs:navigate', (e, url: string) => tm(e)?.navigate(url))
  ipcMain.handle('tabs:back', (e) => tm(e)?.goBack())
  ipcMain.handle('tabs:forward', (e) => tm(e)?.goForward())
  ipcMain.handle('tabs:reload', (e) => tm(e)?.reload())
  ipcMain.handle('tabs:stop', (e) => tm(e)?.stop())
  ipcMain.handle('tabs:list', (e) => tm(e)?.getTabInfos() ?? [])
  ipcMain.handle('tabs:create-group', (e, name?: string) => tm(e)?.createTabGroup(name))
  ipcMain.handle('tabs:assign-group', (e, tabId: string, groupId: string | null) => tm(e)?.assignTabToGroup(tabId, groupId))
  ipcMain.handle('tabs:groups', (e) => tm(e)?.getTabGroups() ?? [])

  ipcMain.handle('find:in-page', (e, text: string, options?: object) =>
    tm(e)?.findInPage(text, (options || {}) as { forward?: boolean; findNext?: boolean })
  )
  ipcMain.handle('find:stop', (e) => tm(e)?.stopFindInPage())

  ipcMain.handle('zoom:set', (e, delta: number) => tm(e)?.setZoom(delta) ?? 0)
  ipcMain.handle('zoom:reset', (e) => tm(e)?.resetZoom() ?? 0)
  ipcMain.handle('zoom:get', (e) => tm(e)?.getZoom() ?? 0)

  ipcMain.handle('bookmarks:toggle', (e) => tm(e)?.toggleBookmark() ?? false)
  ipcMain.handle('bookmarks:list', () => dataStore.getBookmarks())
  ipcMain.handle('bookmarks:remove', (_, id: string) => dataStore.removeBookmark(id))
  ipcMain.handle('bookmarks:add', (_, entry: { title: string; url: string }) => dataStore.addBookmark(entry))

  ipcMain.handle('history:list', () => dataStore.getHistory())
  ipcMain.handle('history:clear', () => dataStore.clearHistory())

  ipcMain.handle('downloads:list', () => dataStore.getDownloads())
  ipcMain.handle('downloads:open', (_, path: string) => openDownload(path))

  ipcMain.handle('sidebar:set', (e, open: boolean, width?: number) => {
    const manager = tm(e)
    manager?.setSidebar(open, width)
    return manager?.getSidebarState()
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
    onboardingComplete: settingsStore.get('onboardingComplete'),
    showBookmarksBar: settingsStore.get('showBookmarksBar')
  }))

  ipcMain.handle('settings:set', (_, settings: Record<string, string | boolean>) => {
    if (settings.apiKey && settings.apiKey !== '••••••••') settingsStore.set('apiKey', settings.apiKey as string)
    if (settings.model) settingsStore.set('model', settings.model as string)
    if (settings.searchMode) settingsStore.set('searchMode', settings.searchMode as 'auto' | 'on' | 'off')
    if (settings.homePage) settingsStore.set('homePage', settings.homePage as string)
    if (typeof settings.restoreSession === 'boolean') settingsStore.set('restoreSession', settings.restoreSession)
    if (typeof settings.showBookmarksBar === 'boolean') settingsStore.set('showBookmarksBar', settings.showBookmarksBar)
    return true
  })

  ipcMain.handle('page:get-content', async (e) => tm(e)?.extractPageContent())
  ipcMain.handle('page:save', async (e) => { const m = tm(e); return m ? savePageAs(m) : false })
  ipcMain.handle('page:copy-link', async (e) => { const m = tm(e); return m ? copyPageLink(m) : null })
  ipcMain.handle('page:qr', async (e) => {
    const tab = tm(e)?.getActiveTabInfo()
    return tab?.url ? getQrCodeUrl(tab.url) : null
  })
  ipcMain.handle('page:home', (e) => { const m = tm(e); if (m) goHome(m); return true })
  ipcMain.handle('page:reading-mode', async (e) => { const m = tm(e); return m ? toggleReadingMode(m) : false })
  ipcMain.handle('page:devtools', (e) => { const m = tm(e); if (m) openDevTools(m); return true })
  ipcMain.handle('page:clipboard', async (e, action: 'cut' | 'copy' | 'paste') => { const m = tm(e); if (m) await execClipboard(m, action) })
  ipcMain.handle('page:clear-data', async (_, opts) => clearBrowsingData(opts))
  ipcMain.handle('page:task-manager', (e) => { const m = tm(e); return m ? getTaskManagerInfo(m) : [] })
  ipcMain.handle('page:name-window', (e, name: string) => { tm(e)?.setWindowName(name); return true })

  ipcMain.handle('extensions:list', () => extensionsService.list())
  ipcMain.handle('extensions:set-enabled', (_, id: string, enabled: boolean) => extensionsService.setEnabled(id, enabled))
  ipcMain.handle('extensions:path', () => extensionsService.getExtensionsPath())

  ipcMain.handle('passwords:get', () => passwordStore.getAll())
  ipcMain.handle('passwords:add', (_, entry) => passwordStore.addPassword(entry))
  ipcMain.handle('passwords:remove', (_, id: string) => passwordStore.removePassword(id))
  ipcMain.handle('passwords:add-payment', (_, entry) => passwordStore.addPayment(entry))
  ipcMain.handle('passwords:remove-payment', (_, id: string) => passwordStore.removePayment(id))
  ipcMain.handle('passwords:add-contact', (_, entry) => passwordStore.addContact(entry))
  ipcMain.handle('passwords:remove-contact', (_, id: string) => passwordStore.removeContact(id))
  ipcMain.handle('passwords:add-identity', (_, entry) => passwordStore.addIdentity(entry))
  ipcMain.handle('passwords:remove-identity', (_, id: string) => passwordStore.removeIdentity(id))
  ipcMain.handle('passwords:add-travel', (_, entry) => passwordStore.addTravel(entry))
  ipcMain.handle('passwords:remove-travel', (_, id: string) => passwordStore.removeTravel(id))

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
        event.sender.send(channel, { type: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
      }
    })()
    return channel
  }

  ipcMain.handle('grok:chat', (event, messages, options) =>
    streamGrok(event, messages as { role: 'system' | 'user' | 'assistant'; content: string }[], options)
  )
  ipcMain.handle('grok:summarize-page', async (event) => {
    const page = await tm(event)?.extractPageContent()
    if (!page) return { error: 'No active page' }
    return streamGrok(event, grokService.buildSummarizePrompt(page.title, page.url, page.text), { searchMode: 'off' })
  })
  ipcMain.handle('grok:ask-page', async (event, query: string) => {
    const page = await tm(event)?.extractPageContent()
    if (!page) return { error: 'No active page' }
    return streamGrok(event, grokService.buildPageContextPrompt(page.title, page.url, page.text, query), { searchMode: 'auto' })
  })
  ipcMain.handle('grok:research', async (event, topic: string) =>
    streamGrok(event, grokService.buildResearchPrompt(topic), { searchMode: 'on' })
  )
  ipcMain.handle('grok:translate-page', async (event) => {
    const page = await tm(event)?.extractPageContent()
    if (!page) return { error: 'No active page' }
    return streamGrok(event, [
      { role: 'system', content: 'Translate the page content to English. Preserve structure with markdown.' },
      { role: 'user', content: `Title: ${page.title}\nURL: ${page.url}\n\n${page.text.slice(0, 12000)}` }
    ], { searchMode: 'off' })
  })

  ipcMain.handle('shell:open-external', (_, url: string) => shell.openExternal(url))
}

app.whenReady().then(() => {
  configureSession()
  configureAuthSession()
  setupIpc()
  createBrowserWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createBrowserWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})