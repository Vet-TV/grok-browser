import type { Bookmark, DownloadEntry, HistoryEntry } from '../../preload/index'

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!

let overlayDepth = 0

async function syncOverlay(): Promise<void> {
  document.body.classList.toggle('overlay-ui-open', overlayDepth > 0)
  await window.grokBrowser.chrome.setOverlayOpen(overlayDepth > 0)
}

export function isOverlayActive(): boolean {
  return overlayDepth > 0
}

export async function pushOverlay(): Promise<void> {
  overlayDepth++
  await syncOverlay()
}

export async function popOverlay(): Promise<void> {
  overlayDepth = Math.max(0, overlayDepth - 1)
  await syncOverlay()
}

export async function openModal(id: string): Promise<void> {
  const modal = document.getElementById(id)
  if (!modal || !modal.hidden) return
  if (overlayDepth === 0) await pushOverlay()
  modal.hidden = false
}

export async function closeModal(id: string): Promise<void> {
  const modal = document.getElementById(id)
  if (!modal || modal.hidden) return
  modal.hidden = true
  await popOverlay()
}

export async function renderBookmarksBar(): Promise<void> {
  const bar = document.getElementById('bookmarks-bar-items')
  if (!bar) return
  const bookmarks = await window.grokBrowser.bookmarks.list()
  if (!bookmarks.length) {
    bar.innerHTML = '<span class="bookmarks-bar-empty">Bookmark pages with Ctrl+D — they appear here</span>'
    return
  }
  bar.innerHTML = bookmarks.slice(0, 30).map((b) => `
    <button class="bookmark-bar-item" data-url="${escapeAttr(b.url)}" title="${escapeAttr(b.title)}">
      ${b.favicon ? `<img src="${escapeAttr(b.favicon)}" alt="" width="14" height="14"/>` : '⭐'}
      <span>${escapeHtml(b.title || b.url)}</span>
    </button>
  `).join('')
  bar.querySelectorAll('.bookmark-bar-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = (btn as HTMLElement).dataset.url
      if (url) window.grokBrowser.tabs.navigate(url)
    })
  })
}

export async function setBookmarksBarVisible(visible: boolean): Promise<void> {
  const el = document.getElementById('bookmarks-bar')
  if (!el) return
  el.hidden = !visible
  await window.grokBrowser.settings.set({ showBookmarksBar: visible })
  if (visible) await renderBookmarksBar()
  document.dispatchEvent(new CustomEvent('chrome-layout-changed'))
}

export function setupPanelModals(): void {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = (btn as HTMLElement).dataset.close
      if (target) closeModal(target)
    })
  })

  document.querySelectorAll('.panel-modal').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id)
    })
  })
}

export async function renderBookmarks(): Promise<void> {
  const list = $('#bookmarks-list')
  const bookmarks: Bookmark[] = await window.grokBrowser.bookmarks.list()

  if (!bookmarks.length) {
    list.innerHTML = '<div class="list-empty">No bookmarks yet. Press Ctrl+D to save the current page.</div>'
    return
  }

  list.innerHTML = bookmarks.map((b) => `
    <div class="list-item" data-url="${escapeAttr(b.url)}">
      <span class="list-item-icon">⭐</span>
      <div class="list-item-content">
        <div class="list-item-title">${escapeHtml(b.title)}</div>
        <div class="list-item-url">${escapeHtml(b.url)}</div>
      </div>
      <div class="list-item-actions">
        <button class="list-action-btn btn-remove-bookmark" data-id="${b.id}" title="Remove">✕</button>
      </div>
    </div>
  `).join('')

  list.querySelectorAll('.list-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.list-action-btn')) return
      const url = (item as HTMLElement).dataset.url
      if (url) {
        window.grokBrowser.tabs.navigate(url)
        closeModal('bookmarks-modal')
      }
    })
  })

  list.querySelectorAll('.btn-remove-bookmark').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      await window.grokBrowser.bookmarks.remove((btn as HTMLElement).dataset.id!)
      renderBookmarks()
    })
  })
}

export async function renderHistory(): Promise<void> {
  const list = $('#history-list')
  const history: HistoryEntry[] = await window.grokBrowser.history.list()

  if (!history.length) {
    list.innerHTML = '<div class="list-empty">No browsing history yet.</div>'
    return
  }

  list.innerHTML = history.map((h) => `
    <div class="list-item" data-url="${escapeAttr(h.url)}">
      <span class="list-item-icon">🕐</span>
      <div class="list-item-content">
        <div class="list-item-title">${escapeHtml(h.title)}</div>
        <div class="list-item-url">${escapeHtml(h.url)}</div>
      </div>
      <span class="list-item-meta">${formatTime(h.visitedAt)}</span>
    </div>
  `).join('')

  list.querySelectorAll('.list-item').forEach((item) => {
    item.addEventListener('click', () => {
      const url = (item as HTMLElement).dataset.url
      if (url) {
        window.grokBrowser.tabs.navigate(url)
        closeModal('history-modal')
      }
    })
  })
}

export async function renderDownloads(): Promise<void> {
  const list = $('#downloads-list')
  const downloads: DownloadEntry[] = await window.grokBrowser.downloads.list()

  if (!downloads.length) {
    list.innerHTML = '<div class="list-empty">No downloads yet.</div>'
    return
  }

  list.innerHTML = downloads.map((d) => {
    const pct = d.totalBytes > 0 ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0
    const stateLabel = d.state === 'completed' ? '✓' : d.state === 'progressing' ? `${pct}%` : d.state
    return `
      <div class="list-item" data-path="${escapeAttr(d.path)}">
        <span class="list-item-icon">${d.state === 'completed' ? '✅' : '⬇️'}</span>
        <div class="list-item-content">
          <div class="list-item-title">${escapeHtml(d.filename)}</div>
          <div class="list-item-url">${formatBytes(d.receivedBytes)}${d.totalBytes > 0 ? ` / ${formatBytes(d.totalBytes)}` : ''}</div>
          ${d.state === 'progressing' ? `<div class="download-progress"><div class="download-progress-bar" style="width:${pct}%"></div></div>` : ''}
        </div>
        <span class="list-item-meta">${stateLabel}</span>
      </div>
    `
  }).join('')

  list.querySelectorAll('.list-item').forEach((item) => {
    item.addEventListener('click', () => {
      const path = (item as HTMLElement).dataset.path
      if (path) window.grokBrowser.downloads.open(path)
    })
  })
}

export function updateDownloadsBadge(count: number): void {
  const badge = $('#downloads-badge')
  if (count > 0) {
    badge.hidden = false
    badge.textContent = String(count)
  } else {
    badge.hidden = true
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}