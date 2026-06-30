import { contextBridge, ipcRenderer } from 'electron'

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

export interface GrokStreamChunk {
  type: 'delta' | 'done' | 'error' | 'citations'
  content?: string
  citations?: string[]
  error?: string
}

export interface Bookmark {
  id: string
  title: string
  url: string
  favicon?: string
  createdAt: number
}

export interface HistoryEntry {
  id: string
  title: string
  url: string
  visitedAt: number
}

export interface DownloadEntry {
  id: string
  filename: string
  url: string
  path: string
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  receivedBytes: number
  totalBytes: number
  startedAt: number
}

export interface XAccountInfo {
  linked: boolean
  username: string
  email: string
  linkedAt: number | null
  hasApiKey: boolean
  onboardingComplete: boolean
}

const api = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized')
  },
  tabs: {
    create: (url?: string) => ipcRenderer.invoke('tabs:create', url),
    switch: (id: string) => ipcRenderer.invoke('tabs:switch', id),
    close: (id: string) => ipcRenderer.invoke('tabs:close', id),
    duplicate: (id?: string) => ipcRenderer.invoke('tabs:duplicate', id),
    navigate: (url: string) => ipcRenderer.invoke('tabs:navigate', url),
    back: () => ipcRenderer.invoke('tabs:back'),
    forward: () => ipcRenderer.invoke('tabs:forward'),
    reload: () => ipcRenderer.invoke('tabs:reload'),
    stop: () => ipcRenderer.invoke('tabs:stop'),
    onUpdated: (cb: (tabs: TabInfo[], activeId: string | null) => void) => {
      const handler = (_: unknown, tabs: TabInfo[], activeId: string | null) => cb(tabs, activeId)
      ipcRenderer.on('tabs:updated', handler)
      return () => ipcRenderer.removeListener('tabs:updated', handler)
    },
    onActiveUpdated: (cb: (tab: TabInfo) => void) => {
      const handler = (_: unknown, tab: TabInfo) => cb(tab)
      ipcRenderer.on('tab:active-updated', handler)
      return () => ipcRenderer.removeListener('tab:active-updated', handler)
    }
  },
  find: {
    inPage: (text: string, options?: { forward?: boolean; findNext?: boolean }) =>
      ipcRenderer.invoke('find:in-page', text, options),
    stop: () => ipcRenderer.invoke('find:stop')
  },
  zoom: {
    set: (delta: number) => ipcRenderer.invoke('zoom:set', delta),
    reset: () => ipcRenderer.invoke('zoom:reset'),
    get: () => ipcRenderer.invoke('zoom:get')
  },
  bookmarks: {
    toggle: () => ipcRenderer.invoke('bookmarks:toggle'),
    list: () => ipcRenderer.invoke('bookmarks:list'),
    remove: (id: string) => ipcRenderer.invoke('bookmarks:remove', id),
    add: (entry: { title: string; url: string }) => ipcRenderer.invoke('bookmarks:add', entry)
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    clear: () => ipcRenderer.invoke('history:clear')
  },
  downloads: {
    list: () => ipcRenderer.invoke('downloads:list'),
    open: (path: string) => ipcRenderer.invoke('downloads:open', path),
    onUpdated: (cb: (items: DownloadEntry[]) => void) => {
      const handler = (_: unknown, items: DownloadEntry[]) => cb(items)
      ipcRenderer.on('downloads:updated', handler)
      return () => ipcRenderer.removeListener('downloads:updated', handler)
    },
    onComplete: (cb: (item: DownloadEntry) => void) => {
      const handler = (_: unknown, item: DownloadEntry) => cb(item)
      ipcRenderer.on('downloads:complete', handler)
      return () => ipcRenderer.removeListener('downloads:complete', handler)
    }
  },
  sidebar: {
    set: (open: boolean, width?: number) => ipcRenderer.invoke('sidebar:set', open, width),
    onState: (cb: (state: { open: boolean; width: number }) => void) => {
      const handler = (_: unknown, state: { open: boolean; width: number }) => cb(state)
      ipcRenderer.on('sidebar:state', handler)
      return () => ipcRenderer.removeListener('sidebar:state', handler)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: Record<string, string | boolean>) => ipcRenderer.invoke('settings:set', settings)
  },
  page: {
    getContent: () => ipcRenderer.invoke('page:get-content')
  },
  grok: {
    chat: (messages: { role: string; content: string }[], options?: object) =>
      ipcRenderer.invoke('grok:chat', messages, options),
    summarizePage: () => ipcRenderer.invoke('grok:summarize-page'),
    askPage: (query: string) => ipcRenderer.invoke('grok:ask-page', query),
    research: (topic: string) => ipcRenderer.invoke('grok:research', topic),
    onStreamStart: (cb: (channel: string) => void) => {
      const handler = (_: unknown, channel: string) => cb(channel)
      ipcRenderer.on('grok:stream-start', handler)
      return () => ipcRenderer.removeListener('grok:stream-start', handler)
    },
    onStreamChunk: (channel: string, cb: (chunk: GrokStreamChunk) => void) => {
      const handler = (_: unknown, chunk: GrokStreamChunk) => cb(chunk)
      ipcRenderer.on(channel, handler)
      return () => ipcRenderer.removeListener(channel, handler)
    }
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  },
  chrome: {
    reportLayout: (layout: { chromeHeight: number; sidebarWidth: number }) =>
      ipcRenderer.invoke('chrome:report-layout', layout),
    setOverlayOpen: (open: boolean) => ipcRenderer.invoke('chrome:set-overlay-open', open)
  },
  auth: {
    status: () => ipcRenderer.invoke('auth:status') as Promise<XAccountInfo>,
    signIn: () => ipcRenderer.invoke('auth:sign-in') as Promise<XAccountInfo>,
    signOut: () => ipcRenderer.invoke('auth:sign-out') as Promise<XAccountInfo>,
    completeOnboarding: () => ipcRenderer.invoke('auth:complete-onboarding') as Promise<XAccountInfo>
  }
}

contextBridge.exposeInMainWorld('grokBrowser', api)

export type GrokBrowserAPI = typeof api