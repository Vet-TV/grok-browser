import Store from 'electron-store'

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

export interface SessionState {
  tabs: { url: string; title: string }[]
  activeIndex: number
}

const bookmarksStore = new Store<{ items: Bookmark[] }>({
  name: 'grok-browser-bookmarks',
  defaults: { items: [] }
})

const historyStore = new Store<{ items: HistoryEntry[] }>({
  name: 'grok-browser-history',
  defaults: { items: [] }
})

const downloadsStore = new Store<{ items: DownloadEntry[] }>({
  name: 'grok-browser-downloads',
  defaults: { items: [] }
})

const sessionStore = new Store<{ lastSession: SessionState | null }>({
  name: 'grok-browser-session',
  defaults: { lastSession: null }
})

const MAX_HISTORY = 500
const MAX_DOWNLOADS = 100

export const dataStore = {
  getBookmarks(): Bookmark[] {
    return bookmarksStore.get('items')
  },

  addBookmark(entry: Omit<Bookmark, 'id' | 'createdAt'>): Bookmark {
    const items = bookmarksStore.get('items')
    const existing = items.find((b) => b.url === entry.url)
    if (existing) return existing

    const bookmark: Bookmark = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    }
    bookmarksStore.set('items', [bookmark, ...items])
    return bookmark
  },

  removeBookmark(id: string): void {
    bookmarksStore.set(
      'items',
      bookmarksStore.get('items').filter((b) => b.id !== id)
    )
  },

  isBookmarked(url: string): boolean {
    return bookmarksStore.get('items').some((b) => b.url === url)
  },

  addHistory(entry: Omit<HistoryEntry, 'id' | 'visitedAt'>): void {
    if (!entry.url || entry.url.startsWith('grok-browser://') || entry.url === 'about:blank') return

    const items = historyStore.get('items')
    const filtered = items.filter((h) => h.url !== entry.url)
    const record: HistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      visitedAt: Date.now()
    }
    historyStore.set('items', [record, ...filtered].slice(0, MAX_HISTORY))
  },

  getHistory(): HistoryEntry[] {
    return historyStore.get('items')
  },

  clearHistory(): void {
    historyStore.set('items', [])
  },

  getDownloads(): DownloadEntry[] {
    return downloadsStore.get('items')
  },

  upsertDownload(entry: DownloadEntry): void {
    const items = downloadsStore.get('items')
    const idx = items.findIndex((d) => d.id === entry.id)
    if (idx >= 0) items[idx] = entry
    else items.unshift(entry)
    downloadsStore.set('items', items.slice(0, MAX_DOWNLOADS))
  },

  saveSession(session: SessionState): void {
    sessionStore.set('lastSession', session)
  },

  getSession(): SessionState | null {
    return sessionStore.get('lastSession')
  },

  clearSession(): void {
    sessionStore.set('lastSession', null)
  }
}