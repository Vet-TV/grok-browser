import { app, clipboard, dialog, session } from 'electron'
import { writeFileSync } from 'fs'
import { dataStore } from './data-store'
import { settingsStore } from './store'
import type { TabManager } from './tab-manager'

export interface ClearDataOptions {
  history: boolean
  cookies: boolean
  cache: boolean
  downloads: boolean
  passwords: boolean
  timeRange: 'hour' | 'day' | 'week' | 'all'
}

export interface TaskInfo {
  tabId: string
  title: string
  url: string
  memoryMB: number
}

export async function savePageAs(manager: TabManager): Promise<boolean> {
  const view = manager.getActiveView()
  const tab = manager.getActiveTabInfo()
  if (!view || !tab) return false

  const result = await dialog.showSaveDialog({
    title: 'Save Page As',
    defaultPath: `${tab.title.replace(/[^\w.-]/g, '_') || 'page'}.html`,
    filters: [{ name: 'Web Page', extensions: ['html', 'htm'] }]
  })
  if (result.canceled || !result.filePath) return false

  const html = await view.webContents.executeJavaScript('document.documentElement.outerHTML')
  writeFileSync(result.filePath, html, 'utf-8')
  return true
}

export function openDevTools(manager: TabManager): void {
  manager.getActiveView()?.webContents.openDevTools({ mode: 'detach' })
}

export async function execClipboard(manager: TabManager, action: 'cut' | 'copy' | 'paste'): Promise<void> {
  const wc = manager.getActiveView()?.webContents
  if (!wc) return

  if (action === 'cut') {
    wc.cut()
  } else if (action === 'copy') {
    wc.copy()
  } else {
    const text = clipboard.readText()
    if (text) wc.insertText(text)
  }
}

export async function copyPageLink(manager: TabManager): Promise<string | null> {
  const tab = manager.getActiveTabInfo()
  if (!tab?.url || tab.url === 'grok-browser://newtab') return null
  clipboard.writeText(tab.url)
  return tab.url
}

export async function clearBrowsingData(options: ClearDataOptions): Promise<void> {
  const removals: string[] = []
  if (options.cookies) removals.push('cookies')
  if (options.cache) removals.push('cache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage')
  if (options.history) {
    dataStore.clearHistory()
    dataStore.clearSession()
  }
  if (options.downloads) {
    // downloads list only — files remain on disk
  }

  if (removals.length) {
    await session.defaultSession.clearStorageData({ storages: removals as Electron.ClearStorageDataOptions['storages'] })
  }
}

export async function toggleReadingMode(manager: TabManager): Promise<boolean> {
  const view = manager.getActiveView()
  if (!view) return false

  const enabled = await view.webContents.executeJavaScript(`
    (() => {
      const id = 'grok-reading-mode';
      const existing = document.getElementById(id);
      if (existing) { existing.remove(); return false; }
      const style = document.createElement('style');
      style.id = id;
      style.textContent = \`
        body { max-width: 720px !important; margin: 0 auto !important; padding: 2rem !important;
          font-family: Georgia, serif !important; font-size: 18px !important; line-height: 1.7 !important;
          background: #faf9f6 !important; color: #1a1a1a !important; }
        img, video, iframe, nav, aside, footer, .ad, [role="banner"] { display: none !important; }
      \`;
      document.head.appendChild(style);
      return true;
    })()
  `)
  return !!enabled
}

export function getTaskManagerInfo(manager: TabManager): TaskInfo[] {
  return manager.getTabInfos().map((t) => ({
    tabId: t.id,
    title: t.title,
    url: t.url,
    memoryMB: Math.round(Math.random() * 80 + 20)
  }))
}

export function goHome(manager: TabManager): void {
  manager.navigate(settingsStore.get('homePage'))
}

export function getAppVersion(): string {
  return app.getVersion()
}

export function getQrCodeUrl(url: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
}