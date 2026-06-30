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
  groupId?: string
  groupName?: string
  groupColor?: string
}

export interface TabGroup {
  id: string
  name: string
  color: string
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

export interface ExtensionInfo {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  path: string
}

export interface TaskInfo {
  tabId: string
  title: string
  url: string
  memoryMB: number
}

const api = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    new: () => ipcRenderer.invoke('window:new'),
    incognito: () => ipcRenderer.invoke('window:incognito'),
    onMeta: (cb: (meta: { incognito: boolean; version: string }) => void) => {
      const handler = (_: unknown, meta: { incognito: boolean; version: string }) => cb(meta)
      ipcRenderer.on('window:meta', handler)
      return () => ipcRenderer.removeListener('window:meta', handler)
    }
  },
  app: {
    version: () => ipcRenderer.invoke('app:version') as Promise<string>
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
    list: () => ipcRenderer.invoke('tabs:list') as Promise<TabInfo[]>,
    createGroup: (name?: string) => ipcRenderer.invoke('tabs:create-group', name) as Promise<TabGroup>,
    groups: () => ipcRenderer.invoke('tabs:groups') as Promise<TabGroup[]>,
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
    getContent: () => ipcRenderer.invoke('page:get-content'),
    save: () => ipcRenderer.invoke('page:save') as Promise<boolean>,
    copyLink: () => ipcRenderer.invoke('page:copy-link') as Promise<string | null>,
    qr: () => ipcRenderer.invoke('page:qr') as Promise<string | null>,
    home: () => ipcRenderer.invoke('page:home'),
    readingMode: () => ipcRenderer.invoke('page:reading-mode') as Promise<boolean>,
    devtools: () => ipcRenderer.invoke('page:devtools'),
    clipboard: (action: 'cut' | 'copy' | 'paste') => ipcRenderer.invoke('page:clipboard', action),
    clearData: (opts: object) => ipcRenderer.invoke('page:clear-data', opts),
    taskManager: () => ipcRenderer.invoke('page:task-manager') as Promise<TaskInfo[]>,
    nameWindow: (name: string) => ipcRenderer.invoke('page:name-window', name)
  },
  extensions: {
    list: () => ipcRenderer.invoke('extensions:list') as Promise<ExtensionInfo[]>,
    setEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('extensions:set-enabled', id, enabled),
    path: () => ipcRenderer.invoke('extensions:path') as Promise<string>
  },
  passwords: {
    get: () => ipcRenderer.invoke('passwords:get'),
    add: (entry: { site: string; username: string; password: string; notes: string }) =>
      ipcRenderer.invoke('passwords:add', entry),
    remove: (id: string) => ipcRenderer.invoke('passwords:remove', id),
    removePayment: (id: string) => ipcRenderer.invoke('passwords:remove-payment', id),
    removeContact: (id: string) => ipcRenderer.invoke('passwords:remove-contact', id),
    removeIdentity: (id: string) => ipcRenderer.invoke('passwords:remove-identity', id),
    removeTravel: (id: string) => ipcRenderer.invoke('passwords:remove-travel', id)
  },
  grok: {
    chat: (messages: { role: string; content: string }[], options?: object) =>
      ipcRenderer.invoke('grok:chat', messages, options),
    summarizePage: () => ipcRenderer.invoke('grok:summarize-page'),
    askPage: (query: string) => ipcRenderer.invoke('grok:ask-page', query),
    research: (topic: string) => ipcRenderer.invoke('grok:research', topic),
    translatePage: () => ipcRenderer.invoke('grok:translate-page'),
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