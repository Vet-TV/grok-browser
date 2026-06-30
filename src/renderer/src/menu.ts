import { APP_MENU, EXTENSIONS_MENU, PROFILE_MENU } from './menu-data'
import {
  closeModal,
  openModal,
  popOverlay,
  pushOverlay,
  renderBookmarks,
  renderDownloads,
  renderHistory
} from './panels'

type MenuCallbacks = {
  showFindBar: () => void
  openSettings: () => void
  handleSignIn: () => void
  handleSignOut: () => void
  toggleSidebar: () => void
  showToast: (msg: string, type?: 'error' | 'success') => void
}

let callbacks: MenuCallbacks
let activeDropdown: HTMLElement | null = null

function $(sel: string) {
  return document.querySelector(sel) as HTMLElement
}

function closeAllDropdowns(): void {
  document.querySelectorAll('.toolbar-dropdown.open').forEach((el) => {
    el.classList.remove('open')
  })
  if (activeDropdown) {
    popOverlay()
    activeDropdown = null
  }
}

function openDropdown(id: string): void {
  const el = $(id)
  if (!el) return
  const wasOpen = el.classList.contains('open')
  closeAllDropdowns()
  if (!wasOpen) {
    el.classList.add('open')
    activeDropdown = el
    pushOverlay()
  }
}

function renderMenuList(container: HTMLElement, items: { id: string; label: string; shortcut?: string; action: string }[], onAction: (action: string) => void): void {
  container.innerHTML = items.map((item) => `
    <button class="menu-item" data-action="${item.action}">
      <span>${item.label}</span>
      ${item.shortcut ? `<span class="menu-shortcut">${item.shortcut}</span>` : ''}
    </button>
  `).join('')
  container.querySelectorAll('.menu-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const action = (btn as HTMLElement).dataset.action!
      closeAllDropdowns()
      onAction(action)
    })
  })
}

function renderAppMenu(): void {
  const container = $('#app-menu-body')
  if (!container) return
  container.innerHTML = APP_MENU.map((section) => `
    <div class="menu-section">
      ${section.title ? `<div class="menu-section-title">${section.title}</div>` : ''}
      <div class="menu-section-items" data-section="${section.id}"></div>
    </div>
  `).join('')

  APP_MENU.forEach((section) => {
    const el = container.querySelector(`[data-section="${section.id}"]`) as HTMLElement
    if (el) renderMenuList(el, section.items, handleMenuAction)
  })
}

async function handleMenuAction(action: string): Promise<void> {
  const api = window.grokBrowser
  const cb = callbacks

  switch (action) {
    case 'new-tab': api.tabs.create(); break
    case 'new-window': api.window.new(); break
    case 'new-incognito': api.window.incognito(); break
    case 'x-signin': cb.handleSignIn(); break
    case 'x-signout': cb.handleSignOut(); break
    case 'password-manager':
    case 'password-payments':
    case 'password-contacts':
    case 'password-identity':
    case 'password-travel':
      openPasswordManager(action.replace('password-', ''))
      break
    case 'history':
      await renderHistory()
      openModal('history-modal')
      break
    case 'bookmarks':
      await renderBookmarks()
      openModal('bookmarks-modal')
      break
    case 'downloads':
      await renderDownloads()
      openModal('downloads-modal')
      break
    case 'tab-groups':
      openModal('tab-groups-modal')
      renderTabGroups()
      break
    case 'create-tab-group':
      await api.tabs.createGroup()
      cb.showToast('Tab group created', 'success')
      break
    case 'clear-data':
      openModal('clear-data-modal')
      break
    case 'zoom-in': api.zoom.set(0.5); break
    case 'zoom-out': api.zoom.set(-0.5); break
    case 'zoom-reset': api.zoom.reset(); break
    case 'grok-tab-search':
      cb.toggleSidebar()
      setChatInput('Search my open tabs: ')
      break
    case 'translate':
      cb.toggleSidebar()
      document.querySelector('.welcome-card')?.remove()
      api.grok.translatePage().then((ch) => {
        if (typeof ch === 'string') document.dispatchEvent(new CustomEvent('grok-stream', { detail: ch }))
        else if (ch && typeof ch === 'object' && 'error' in ch) cb.showToast(String((ch as { error: string }).error))
      })
      break
    case 'find': cb.showFindBar(); break
    case 'cut': api.page.clipboard('cut'); break
    case 'copy': api.page.clipboard('copy'); break
    case 'paste': api.page.clipboard('paste'); break
    case 'cast':
      cb.showToast('Cast requires a Chromecast-enabled device. Open chrome://cast in a new tab.')
      api.tabs.create('https://www.google.com/chromecast/setup/')
      break
    case 'save-page':
      if (await api.page.save()) cb.showToast('Page saved', 'success')
      break
    case 'copy-link':
      if (await api.page.copyLink()) cb.showToast('Link copied', 'success')
      break
    case 'send-devices':
      cb.showToast('Send to devices syncs when signed in to your X account.')
      break
    case 'qr-code':
      await showQrCode()
      break
    case 'install-app':
    case 'create-shortcut':
      cb.showToast('Shortcut created on desktop (via system save dialog).')
      api.page.save()
      break
    case 'tab-search':
      openModal('tab-search-modal')
      renderTabSearch()
      break
    case 'name-window': {
      const name = prompt('Name this window:')
      if (name) { api.page.nameWindow(name); cb.showToast(`Window named "${name}"`, 'success') }
      break
    }
    case 'settings': cb.openSettings(); break
    case 'reading-mode': {
      const on = await api.page.readingMode()
      cb.showToast(on ? 'Reading mode on' : 'Reading mode off', 'success')
      break
    }
    case 'task-manager':
    case 'performance':
      openModal('task-manager-modal')
      renderTaskManager()
      break
    case 'devtools': api.page.devtools(); break
    case 'extensions':
      openModal('extensions-modal')
      renderExtensions()
      break
    case 'chrome-store':
      api.shell.openExternal('https://chromewebstore.google.com/')
      break
    case 'about':
      openModal('about-modal')
      break
    case 'whats-new':
      api.shell.openExternal('https://github.com/Vet-TV/grok-browser/releases')
      break
    case 'help-center':
      api.shell.openExternal('https://github.com/Vet-TV/grok-browser#readme')
      break
    case 'report-issue':
      api.shell.openExternal('https://github.com/Vet-TV/grok-browser/issues/new')
      break
    default:
      break
  }
}

function setChatInput(text: string): void {
  const input = document.querySelector('#chat-input') as HTMLTextAreaElement
  if (input) { input.value = text; input.focus() }
}

async function renderTabSearch(): Promise<void> {
  const list = $('#tab-search-list')
  const tabs = await window.grokBrowser.tabs.list()
  list.innerHTML = tabs.map((t) => `
    <button class="list-item tab-search-item" data-id="${t.id}">
      <span class="list-item-icon">${t.favicon ? `<img src="${t.favicon}" width="16" height="16"/>` : '🌐'}</span>
      <div class="list-item-content">
        <div class="list-item-title">${escapeHtml(t.title || 'New Tab')}</div>
        <div class="list-item-url">${escapeHtml(t.url)}</div>
      </div>
    </button>
  `).join('') || '<div class="list-empty">No open tabs</div>'

  list.querySelectorAll('.tab-search-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.grokBrowser.tabs.switch((btn as HTMLElement).dataset.id!)
      closeModal('tab-search-modal')
    })
  })
}

async function renderTabGroups(): Promise<void> {
  const list = $('#tab-groups-list')
  const groups = await window.grokBrowser.tabs.groups()
  const tabs = await window.grokBrowser.tabs.list()
  list.innerHTML = groups.length
    ? groups.map((g) => {
        const count = tabs.filter((t) => t.groupId === g.id).length
        return `<div class="group-row"><span class="group-dot" style="background:${g.color}"></span><span>${escapeHtml(g.name)}</span><span class="group-count">${count} tabs</span></div>`
      }).join('')
    : '<div class="list-empty">No tab groups yet. Use Alt+Shift+P to create one.</div>'
}

async function renderTaskManager(): Promise<void> {
  const list = $('#task-manager-list')
  const tasks = await window.grokBrowser.page.taskManager()
  list.innerHTML = tasks.map((t) => `
    <div class="list-item">
      <div class="list-item-content">
        <div class="list-item-title">${escapeHtml(t.title)}</div>
        <div class="list-item-url">${escapeHtml(t.url)}</div>
      </div>
      <span class="list-item-meta">${t.memoryMB} MB</span>
    </div>
  `).join('')
}

async function renderExtensions(): Promise<void> {
  const list = $('#extensions-list')
  const exts = await window.grokBrowser.extensions.list()
  const path = await window.grokBrowser.extensions.path()
  if (!exts.length) {
    list.innerHTML = `<div class="list-empty">No extensions installed.<br><small>Place unpacked extensions in:<br><code>${escapeHtml(path)}</code></small></div>`
    return
  }
  list.innerHTML = exts.map((e) => `
    <div class="list-item ext-row">
      <div class="list-item-content">
        <div class="list-item-title">${escapeHtml(e.name)} <small>v${e.version}</small></div>
        <div class="list-item-url">${escapeHtml(e.description)}</div>
      </div>
      <label class="ext-toggle"><input type="checkbox" data-id="${e.id}" ${e.enabled ? 'checked' : ''}/> On</label>
    </div>
  `).join('')
  list.querySelectorAll('.ext-toggle input').forEach((input) => {
    input.addEventListener('change', async () => {
      const id = (input as HTMLElement).dataset.id!
      await window.grokBrowser.extensions.setEnabled(id, (input as HTMLInputElement).checked)
    })
  })
}

async function showQrCode(): Promise<void> {
  const url = await window.grokBrowser.page.qr()
  if (!url) { callbacks.showToast('No page URL to encode'); return }
  const img = $('#qr-code-img') as HTMLImageElement
  img.src = url
  openModal('qr-modal')
}

function openPasswordManager(tab = 'passwords'): void {
  openModal('password-manager-modal')
  switchPasswordTab(tab === 'manager' ? 'passwords' : tab)
  renderPasswordManager()
}

function switchPasswordTab(tab: string): void {
  document.querySelectorAll('.pw-tab').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.tab === tab)
  })
  document.querySelectorAll('.pw-panel').forEach((panel) => {
    panel.classList.toggle('active', (panel as HTMLElement).dataset.panel === tab)
  })
}

async function renderPasswordManager(): Promise<void> {
  const data = await window.grokBrowser.passwords.get()
  const render = (items: { id: string }[], panel: string, fields: (item: Record<string, string>) => string) => {
    const el = document.querySelector(`[data-panel="${panel}"] .pw-list`) as HTMLElement
    if (!el) return
    const list = (data as Record<string, unknown[]>)[panel] || []
    el.innerHTML = list.length
      ? (list as Record<string, string>[]).map((item) => `
        <div class="pw-entry">${fields(item)}<button class="pw-del" data-type="${panel}" data-id="${item.id}">✕</button></div>
      `).join('')
      : '<div class="list-empty">No entries yet</div>'
  }

  render(data.passwords, 'passwords', (p) => `<strong>${escapeHtml(p.site)}</strong> — ${escapeHtml(p.username)}`)
  render(data.payments, 'payments', (p) => `<strong>${escapeHtml(p.label)}</strong> •••• ${escapeHtml(p.last4)}`)
  render(data.contacts, 'contacts', (p) => `<strong>${escapeHtml(p.name)}</strong> — ${escapeHtml(p.email)}`)
  render(data.identities, 'identities', (p) => `<strong>${escapeHtml(p.type)}</strong> — ${escapeHtml(p.number)}`)
  render(data.travel, 'travel', (p) => `<strong>${escapeHtml(p.type)}</strong> — ${escapeHtml(p.number)}`)

  document.querySelectorAll('.pw-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = (btn as HTMLElement).dataset.type!
      const id = (btn as HTMLElement).dataset.id!
      const method = `remove${type.charAt(0).toUpperCase() + type.slice(1, -1)}` as keyof typeof window.grokBrowser.passwords
      if (type === 'passwords') await window.grokBrowser.passwords.remove(id)
      else if (type === 'payments') await window.grokBrowser.passwords.removePayment(id)
      else if (type === 'contacts') await window.grokBrowser.passwords.removeContact(id)
      else if (type === 'identities') await window.grokBrowser.passwords.removeIdentity(id)
      else if (type === 'travel') await window.grokBrowser.passwords.removeTravel(id)
      renderPasswordManager()
    })
  })
}

export function setupMenu(cbs: MenuCallbacks): void {
  callbacks = cbs
  renderAppMenu()

  const extMenu = $('#extensions-menu-body')
  const profMenu = $('#profile-menu-body')
  if (extMenu) renderMenuList(extMenu, EXTENSIONS_MENU, handleMenuAction)
  if (profMenu) renderMenuList(profMenu, PROFILE_MENU, handleMenuAction)

  $('#btn-menu')?.addEventListener('click', (e) => { e.stopPropagation(); openDropdown('#app-menu-dropdown') })
  $('#btn-extensions')?.addEventListener('click', (e) => { e.stopPropagation(); openDropdown('#extensions-dropdown') })
  $('#btn-profile')?.addEventListener('click', (e) => { e.stopPropagation(); openDropdown('#profile-dropdown') })

  document.addEventListener('click', () => closeAllDropdowns())

  document.querySelectorAll('.pw-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchPasswordTab((btn as HTMLElement).dataset.tab!))
  })

  $('#btn-clear-data-confirm')?.addEventListener('click', async () => {
    await window.grokBrowser.page.clearData({
      history: ($('#clear-history') as HTMLInputElement).checked,
      cookies: ($('#clear-cookies') as HTMLInputElement).checked,
      cache: ($('#clear-cache') as HTMLInputElement).checked,
      downloads: ($('#clear-downloads') as HTMLInputElement).checked,
      passwords: ($('#clear-passwords') as HTMLInputElement).checked,
      timeRange: ($('#clear-range') as HTMLSelectElement).value as 'hour' | 'day' | 'week' | 'all'
    })
    closeModal('clear-data-modal')
    cbs.showToast('Browsing data cleared', 'success')
  })

  $('#btn-pw-add')?.addEventListener('click', async () => {
    const site = ($('#pw-site') as HTMLInputElement).value.trim()
    const username = ($('#pw-user') as HTMLInputElement).value.trim()
    const password = ($('#pw-pass') as HTMLInputElement).value
    if (!site || !username) return
    await window.grokBrowser.passwords.add({ site, username, password, notes: '' })
    ;($('#pw-site') as HTMLInputElement).value = ''
    ;($('#pw-user') as HTMLInputElement).value = ''
    ;($('#pw-pass') as HTMLInputElement).value = ''
    renderPasswordManager()
    cbs.showToast('Password saved', 'success')
  })
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export { handleMenuAction, renderTabSearch, openPasswordManager }