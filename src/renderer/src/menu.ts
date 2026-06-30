import {
  EXTENSIONS_MENU,
  MENU_CATEGORIES,
  MENU_QUICK_ITEMS,
  MENU_STANDALONE_ITEMS,
  PROFILE_MENU,
  type MenuItem
} from './menu-data'
import {
  closeModal,
  openModal,
  popOverlay,
  pushOverlay,
  renderBookmarks,
  renderBookmarksBar,
  renderDownloads,
  renderHistory,
  setBookmarksBarVisible
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
let menuOpening = false

function $(sel: string) {
  return document.querySelector(sel) as HTMLElement | null
}

async function closeAllDropdowns(): Promise<void> {
  document.querySelectorAll('.toolbar-dropdown.open').forEach((el) => {
    el.classList.remove('open')
  })
  document.getElementById('menu-backdrop')?.remove()
  if (activeDropdown) {
    activeDropdown = null
    await popOverlay()
  }
}

async function openDropdown(id: string): Promise<void> {
  const el = $(id)
  if (!el) return

  const wasOpen = el.classList.contains('open')
  await closeAllDropdowns()
  if (wasOpen) return

  menuOpening = true
  await pushOverlay()

  let backdrop = document.getElementById('menu-backdrop')
  if (!backdrop) {
    backdrop = document.createElement('div')
    backdrop.id = 'menu-backdrop'
    backdrop.className = 'menu-backdrop'
    backdrop.addEventListener('click', () => { void closeAllDropdowns() })
    document.body.appendChild(backdrop)
  }

  el.classList.add('open')
  activeDropdown = el
  menuOpening = false
}

function menuItemHtml(item: MenuItem): string {
  return `
    <button class="menu-item" data-action="${item.action}" type="button">
      <span class="menu-item-label">${item.label}</span>
      ${item.shortcut ? `<span class="menu-shortcut">${item.shortcut}</span>` : ''}
    </button>
  `
}

function bindMenuActions(root: HTMLElement): void {
  root.querySelectorAll('.menu-item[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const action = (btn as HTMLElement).dataset.action!
      void closeAllDropdowns().then(() => handleMenuAction(action))
    })
  })
}

function renderMenuList(container: HTMLElement, items: MenuItem[]): void {
  container.innerHTML = items.map((item) => menuItemHtml(item)).join('')
  bindMenuActions(container)
}

function renderAppMenu(): void {
  const container = $('#app-menu-body')
  if (!container) return

  const quickHtml = MENU_QUICK_ITEMS.map((item) => menuItemHtml(item)).join('')
  const standaloneHtml = MENU_STANDALONE_ITEMS.map((item) => menuItemHtml(item)).join('')
  const categoriesHtml = MENU_CATEGORIES.map((cat) => `
    <div class="menu-category" data-category="${cat.id}">
      <div class="menu-category-row" tabindex="0">
        <span class="menu-category-label">${cat.label}</span>
        <span class="menu-chevron">›</span>
      </div>
      <div class="menu-submenu" role="menu">
        ${cat.items.map((item) => menuItemHtml(item)).join('')}
      </div>
    </div>
  `).join('')

  container.innerHTML = `
    <div class="menu-quick">${quickHtml}</div>
    <div class="menu-divider"></div>
    <div class="menu-standalone">${standaloneHtml}</div>
    <div class="menu-divider"></div>
    <div class="menu-categories">${categoriesHtml}</div>
  `

  bindMenuActions(container)

  container.querySelectorAll('.menu-category').forEach((cat) => {
    const row = cat.querySelector('.menu-category-row') as HTMLElement
    const submenu = cat.querySelector('.menu-submenu') as HTMLElement
    if (!row || !submenu) return

    const show = () => {
      container.querySelectorAll('.menu-category.active').forEach((c) => {
        c.classList.remove('active')
        const sub = c.querySelector('.menu-submenu') as HTMLElement
        if (sub) {
          sub.style.position = ''
          sub.style.left = ''
          sub.style.top = ''
        }
      })
      cat.classList.add('active')
      submenu.style.display = 'block'
      const rowRect = row.getBoundingClientRect()
      const subW = submenu.offsetWidth || 260
      const subH = submenu.offsetHeight
      let top = rowRect.top
      const maxTop = window.innerHeight - subH - 8
      if (top > maxTop) top = Math.max(8, maxTop)
      submenu.style.position = 'fixed'
      submenu.style.left = `${rowRect.left - subW - 8}px`
      submenu.style.top = `${top}px`
      submenu.style.right = 'auto'
    }

    row.addEventListener('mouseenter', show)
    cat.addEventListener('mouseenter', show)
    cat.addEventListener('mouseleave', () => {
      cat.classList.remove('active')
      submenu.style.display = ''
      submenu.style.position = ''
      submenu.style.left = ''
      submenu.style.top = ''
    })
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
    case 'toggle-bookmarks-bar': {
      const s = await api.settings.get()
      const next = !s.showBookmarksBar
      await setBookmarksBarVisible(next)
      cb.showToast(next ? 'Bookmarks bar shown' : 'Bookmarks bar hidden', 'success')
      break
    }
    case 'password-manager':
    case 'password-payments':
    case 'password-contacts':
    case 'password-identity':
    case 'password-travel':
      openPasswordManager(action.replace('password-', ''))
      break
    case 'history':
      await renderHistory()
      await openModal('history-modal')
      break
    case 'bookmarks':
      await renderBookmarks()
      await openModal('bookmarks-modal')
      break
    case 'downloads':
      await renderDownloads()
      await openModal('downloads-modal')
      break
    case 'tab-groups':
      await openModal('tab-groups-modal')
      renderTabGroups()
      break
    case 'create-tab-group':
      await api.tabs.createGroup()
      cb.showToast('Tab group created', 'success')
      break
    case 'clear-data':
      await openModal('clear-data-modal')
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
    case 'find-in-page':
    case 'find':
      cb.showFindBar()
      break
    case 'cut': api.page.clipboard('cut'); break
    case 'copy': api.page.clipboard('copy'); break
    case 'paste': api.page.clipboard('paste'); break
    case 'cast':
      cb.showToast('Cast requires a Chromecast-enabled device.')
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
      cb.showToast('Page saved — use the file as a shortcut.')
      api.page.save()
      break
    case 'tab-search':
      await openModal('tab-search-modal')
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
      await openModal('task-manager-modal')
      renderTaskManager()
      break
    case 'devtools': api.page.devtools(); break
    case 'extensions':
      await openModal('extensions-modal')
      renderExtensions()
      break
    case 'chrome-store':
      api.shell.openExternal('https://chromewebstore.google.com/')
      break
    case 'about':
      await openModal('about-modal')
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
  if (!list) return
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
      void closeModal('tab-search-modal')
    })
  })
}

async function renderTabGroups(): Promise<void> {
  const list = $('#tab-groups-list')
  if (!list) return
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
  if (!list) return
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
  if (!list) return
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
  if (img) img.src = url
  await openModal('qr-modal')
}

function openPasswordManager(tab = 'passwords'): void {
  void openModal('password-manager-modal').then(() => {
    switchPasswordTab(tab === 'manager' ? 'passwords' : tab)
    renderPasswordManager()
  })
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
  const render = (panel: string, fields: (item: Record<string, string>) => string) => {
    const el = document.querySelector(`[data-panel="${panel}"] .pw-list`) as HTMLElement
    if (!el) return
    const list = (data as Record<string, unknown[]>)[panel] || []
    el.innerHTML = list.length
      ? (list as Record<string, string>[]).map((item) => `
        <div class="pw-entry">${fields(item)}<button class="pw-del" data-type="${panel}" data-id="${item.id}">✕</button></div>
      `).join('')
      : '<div class="list-empty">No entries yet</div>'
  }

  render('passwords', (p) => `<strong>${escapeHtml(p.site)}</strong> — ${escapeHtml(p.username)}`)
  render('payments', (p) => `<strong>${escapeHtml(p.label)}</strong> •••• ${escapeHtml(p.last4)}`)
  render('contacts', (p) => `<strong>${escapeHtml(p.name)}</strong> — ${escapeHtml(p.email)}`)
  render('identities', (p) => `<strong>${escapeHtml(p.type)}</strong> — ${escapeHtml(p.number)}`)
  render('travel', (p) => `<strong>${escapeHtml(p.type)}</strong> — ${escapeHtml(p.number)}`)

  document.querySelectorAll('.pw-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = (btn as HTMLElement).dataset.type!
      const id = (btn as HTMLElement).dataset.id!
      if (type === 'passwords') await window.grokBrowser.passwords.remove(id)
      else if (type === 'payments') await window.grokBrowser.passwords.removePayment(id)
      else if (type === 'contacts') await window.grokBrowser.passwords.removeContact(id)
      else if (type === 'identities') await window.grokBrowser.passwords.removeIdentity(id)
      else if (type === 'travel') await window.grokBrowser.passwords.removeTravel(id)
      renderPasswordManager()
    })
  })
}

function bindDropdownButton(btnId: string, dropdownId: string): void {
  const btn = $(btnId)
  if (!btn) return
  btn.addEventListener('mousedown', (e) => e.stopPropagation())
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void openDropdown(dropdownId)
  })
}

export function setupMenu(cbs: MenuCallbacks): void {
  callbacks = cbs
  renderAppMenu()

  const extMenu = $('#extensions-menu-body')
  const profMenu = $('#profile-menu-body')
  if (extMenu) renderMenuList(extMenu, EXTENSIONS_MENU)
  if (profMenu) renderMenuList(profMenu, PROFILE_MENU)

  bindDropdownButton('#btn-menu', '#app-menu-dropdown')
  bindDropdownButton('#btn-extensions', '#extensions-dropdown')
  bindDropdownButton('#btn-profile', '#profile-dropdown')

  document.addEventListener('click', (e) => {
    if (menuOpening) return
    const t = e.target as HTMLElement
    if (t.closest('.toolbar-dropdown-wrap') || t.closest('.toolbar-dropdown') || t.id === 'menu-backdrop') return
    void closeAllDropdowns()
  })

  document.querySelectorAll('.toolbar-dropdown').forEach((dropdown) => {
    dropdown.addEventListener('click', (e) => e.stopPropagation())
  })

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
    await closeModal('clear-data-modal')
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

  $('#btn-pw-add-payment')?.addEventListener('click', async () => {
    const label = ($('#pw-pay-label') as HTMLInputElement).value.trim()
    const cardholder = ($('#pw-pay-holder') as HTMLInputElement).value.trim()
    const last4 = ($('#pw-pay-last4') as HTMLInputElement).value.trim()
    const expiry = ($('#pw-pay-expiry') as HTMLInputElement).value.trim()
    if (!label || !last4) return
    await window.grokBrowser.passwords.addPayment({ label, cardholder, last4, expiry })
    ;($('#pw-pay-label') as HTMLInputElement).value = ''
    ;($('#pw-pay-holder') as HTMLInputElement).value = ''
    ;($('#pw-pay-last4') as HTMLInputElement).value = ''
    ;($('#pw-pay-expiry') as HTMLInputElement).value = ''
    renderPasswordManager()
    cbs.showToast('Payment method saved', 'success')
  })

  $('#btn-pw-add-contact')?.addEventListener('click', async () => {
    const name = ($('#pw-contact-name') as HTMLInputElement).value.trim()
    const email = ($('#pw-contact-email') as HTMLInputElement).value.trim()
    const phone = ($('#pw-contact-phone') as HTMLInputElement).value.trim()
    const address = ($('#pw-contact-address') as HTMLInputElement).value.trim()
    if (!name) return
    await window.grokBrowser.passwords.addContact({ name, email, phone, address })
    ;($('#pw-contact-name') as HTMLInputElement).value = ''
    ;($('#pw-contact-email') as HTMLInputElement).value = ''
    ;($('#pw-contact-phone') as HTMLInputElement).value = ''
    ;($('#pw-contact-address') as HTMLInputElement).value = ''
    renderPasswordManager()
    cbs.showToast('Contact saved', 'success')
  })

  $('#btn-pw-add-identity')?.addEventListener('click', async () => {
    const type = ($('#pw-id-type') as HTMLInputElement).value.trim()
    const number = ($('#pw-id-number') as HTMLInputElement).value.trim()
    const issuer = ($('#pw-id-issuer') as HTMLInputElement).value.trim()
    const expiry = ($('#pw-id-expiry') as HTMLInputElement).value.trim()
    if (!type || !number) return
    await window.grokBrowser.passwords.addIdentity({ type, number, issuer, expiry })
    ;($('#pw-id-type') as HTMLInputElement).value = ''
    ;($('#pw-id-number') as HTMLInputElement).value = ''
    ;($('#pw-id-issuer') as HTMLInputElement).value = ''
    ;($('#pw-id-expiry') as HTMLInputElement).value = ''
    renderPasswordManager()
    cbs.showToast('Identity document saved', 'success')
  })

  $('#btn-pw-add-travel')?.addEventListener('click', async () => {
    const type = ($('#pw-travel-type') as HTMLInputElement).value.trim()
    const number = ($('#pw-travel-number') as HTMLInputElement).value.trim()
    const holder = ($('#pw-travel-holder') as HTMLInputElement).value.trim()
    const expiry = ($('#pw-travel-expiry') as HTMLInputElement).value.trim()
    if (!type || !number) return
    await window.grokBrowser.passwords.addTravel({ type, number, holder, expiry })
    ;($('#pw-travel-type') as HTMLInputElement).value = ''
    ;($('#pw-travel-number') as HTMLInputElement).value = ''
    ;($('#pw-travel-holder') as HTMLInputElement).value = ''
    ;($('#pw-travel-expiry') as HTMLInputElement).value = ''
    renderPasswordManager()
    cbs.showToast('Travel document saved', 'success')
  })
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export { handleMenuAction, renderTabSearch, openPasswordManager }