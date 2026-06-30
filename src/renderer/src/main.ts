import { marked } from 'marked'
import type { GrokStreamChunk, TabInfo, XAccountInfo } from '../../preload/index'
import {
  closeModal,
  openModal,
  renderBookmarks,
  renderDownloads,
  renderHistory,
  setupPanelModals,
  updateDownloadsBadge
} from './panels'

declare global {
  interface Window {
    grokBrowser: import('../../preload/index').GrokBrowserAPI
  }
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!

let activeTabId: string | null = null
let sidebarOpen = true
let sidebarWidth = 380
let isStreaming = false
let chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
let activeDownloads = 0

const tabsContainer = $('#tabs-container')
const omnibox = $('#omnibox') as HTMLInputElement
const loadingIndicator = $('#loading-indicator')
const chatMessages = $('#chat-messages')
const chatInput = $('#chat-input') as HTMLTextAreaElement
const grokSidebar = $('#grok-sidebar')
const settingsModal = $('#settings-modal')
const findBar = $('#find-bar')
const findInput = $('#find-input') as HTMLInputElement
const onboardingModal = $('#onboarding-modal')
const chromeShell = $('#chrome-shell')

marked.setOptions({ breaks: true })

function init(): void {
  setupWindowControls()
  setupNavigation()
  setupSidebar()
  setupChat()
  setupSettings()
  setupAuth()
  setupPanels()
  setupFindBar()
  setupKeyboardShortcuts()
  setupDownloads()
  setupChromeLayout()
  loadSettings()

  window.grokBrowser.tabs.onUpdated(renderTabs)
  window.grokBrowser.tabs.onActiveUpdated(updateActiveTab)
  window.grokBrowser.sidebar.onState((state) => {
    sidebarOpen = state.open
    sidebarWidth = state.width
    updateSidebarUI()
    reportChromeLayout()
  })

  checkOnboarding()
}

function setupChromeLayout(): void {
  reportChromeLayout()
  window.addEventListener('resize', reportChromeLayout)
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => reportChromeLayout())
    observer.observe(chromeShell)
  }
}

function reportChromeLayout(): void {
  const height = chromeShell.getBoundingClientRect().height
  const chromeHeight = Math.round(height) || 112
  document.documentElement.style.setProperty('--chrome-height', `${chromeHeight}px`)
  window.grokBrowser.chrome.reportLayout({
    chromeHeight,
    sidebarWidth: sidebarOpen ? sidebarWidth : 0
  })
}

function setupWindowControls(): void {
  $('#btn-minimize').onclick = () => window.grokBrowser.window.minimize()
  $('#btn-maximize').onclick = () => window.grokBrowser.window.maximize()
  $('#btn-close').onclick = () => window.grokBrowser.window.close()
}

function setupNavigation(): void {
  $('#btn-back').onclick = () => window.grokBrowser.tabs.back()
  $('#btn-forward').onclick = () => window.grokBrowser.tabs.forward()
  $('#btn-reload').onclick = () => window.grokBrowser.tabs.reload()
  $('#btn-home').onclick = () => window.grokBrowser.tabs.create()
  $('#btn-new-tab').onclick = () => window.grokBrowser.tabs.create()

  $('#btn-bookmark').onclick = async () => {
    const bookmarked = await window.grokBrowser.bookmarks.toggle()
    $('#btn-bookmark').classList.toggle('active', bookmarked)
    $('#btn-bookmark').textContent = bookmarked ? '★' : '☆'
  }

  omnibox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      window.grokBrowser.tabs.navigate(omnibox.value)
      omnibox.blur()
    }
  })
  omnibox.addEventListener('focus', () => omnibox.select())
}

function setupPanels(): void {
  setupPanelModals()

  $('#btn-history').onclick = async () => {
    await renderHistory()
    openModal('history-modal')
  }

  $('#btn-downloads').onclick = async () => {
    await renderDownloads()
    openModal('downloads-modal')
    activeDownloads = 0
    updateDownloadsBadge(0)
  }

  $('#btn-clear-history').onclick = async () => {
    await window.grokBrowser.history.clear()
    await renderHistory()
  }
}

function setupFindBar(): void {
  $('#find-close').onclick = () => hideFindBar()
  $('#find-next').onclick = () => {
    if (findInput.value) window.grokBrowser.find.inPage(findInput.value, { forward: true, findNext: true })
  }
  $('#find-prev').onclick = () => {
    if (findInput.value) window.grokBrowser.find.inPage(findInput.value, { forward: false, findNext: true })
  }
  findInput.addEventListener('input', () => {
    if (findInput.value) window.grokBrowser.find.inPage(findInput.value, { forward: true, findNext: false })
  })
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      window.grokBrowser.find.inPage(findInput.value, { forward: !e.shiftKey, findNext: true })
    }
    if (e.key === 'Escape') hideFindBar()
  })
}

function showFindBar(): void {
  findBar.hidden = false
  findInput.value = ''
  findInput.focus()
}

function hideFindBar(): void {
  findBar.hidden = true
  window.grokBrowser.find.stop()
}

function setupDownloads(): void {
  window.grokBrowser.downloads.onUpdated((items) => {
    const progressing = items.filter((d) => d.state === 'progressing').length
    if (progressing > activeDownloads) activeDownloads = progressing
    updateDownloadsBadge(progressing)
  })

  window.grokBrowser.downloads.onComplete(() => {
    showToast('Download complete', 'success')
  })
}

function renderTabs(tabs: TabInfo[], activeId: string | null): void {
  activeTabId = activeId
  tabsContainer.innerHTML = ''

  for (const tab of tabs) {
    const el = document.createElement('button')
    el.className = `tab${tab.id === activeId ? ' active' : ''}`
    el.innerHTML = `
      ${tab.favicon ? `<img class="tab-favicon" src="${tab.favicon}" alt="" />` : '<span class="tab-favicon">🌐</span>'}
      <span class="tab-title">${escapeHtml(tab.title || 'New Tab')}</span>
      <span class="tab-close">×</span>
    `
    el.onclick = (e) => {
      if ((e.target as HTMLElement).classList.contains('tab-close')) {
        window.grokBrowser.tabs.close(tab.id)
      } else {
        window.grokBrowser.tabs.switch(tab.id)
      }
    }
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault()
        window.grokBrowser.tabs.close(tab.id)
      }
    })
    tabsContainer.appendChild(el)
  }
}

function updateActiveTab(tab: TabInfo): void {
  const isNewTab = tab.url === 'grok-browser://newtab' || tab.url === 'about:blank'
  omnibox.value = isNewTab ? '' : tab.url
  $('#btn-back').toggleAttribute('disabled', !tab.canGoBack)
  $('#btn-forward').toggleAttribute('disabled', !tab.canGoForward)
  loadingIndicator.classList.toggle('active', tab.loading)

  const isSecure = tab.url.startsWith('https://')
  $('#omnibox-icon').textContent = isSecure ? '🔒' : tab.url.startsWith('http://') ? '⚠️' : '🔍'

  $('#btn-bookmark').classList.toggle('active', tab.isBookmarked)
  $('#btn-bookmark').textContent = tab.isBookmarked ? '★' : '☆'
  $('#btn-bookmark').toggleAttribute('disabled', isNewTab)
}

function setupSidebar(): void {
  const toggle = () => {
    sidebarOpen = !sidebarOpen
    window.grokBrowser.sidebar.set(sidebarOpen, sidebarWidth)
    updateSidebarUI()
  }
  $('#btn-grok').onclick = toggle
  $('#btn-sidebar-close').onclick = toggle
  updateSidebarUI()

  const resizeHandle = $('#sidebar-resize')
  let resizing = false
  let startX = 0
  let startWidth = 0

  resizeHandle.addEventListener('mousedown', (e) => {
    resizing = true
    startX = e.clientX
    startWidth = sidebarWidth
    document.body.style.cursor = 'col-resize'
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return
    const delta = startX - e.clientX
    sidebarWidth = Math.max(280, Math.min(600, startWidth + delta))
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
    window.grokBrowser.sidebar.set(sidebarOpen, sidebarWidth)
    reportChromeLayout()
  })

  document.addEventListener('mouseup', () => {
    if (resizing) {
      resizing = false
      document.body.style.cursor = ''
    }
  })
}

function updateSidebarUI(): void {
  grokSidebar.classList.toggle('closed', !sidebarOpen)
  $('#btn-grok').classList.toggle('active', sidebarOpen)
  document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`)
  document.documentElement.style.setProperty('--sidebar-offset', sidebarOpen ? `${sidebarWidth}px` : '0px')
  reportChromeLayout()
}

function setupChat(): void {
  $('#btn-send').onclick = () => sendMessage()
  $('#btn-summarize').onclick = () => summarizePage()
  $('#btn-explain').onclick = () => askWithContext('Explain the main content of this page in simple terms.')
  $('#btn-search-grok').onclick = () => {
    chatInput.value = 'Search the web for: '
    chatInput.focus()
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length)
  }
  $('#btn-research').onclick = () => {
    const topic = prompt('What topic should Grok research?')
    if (topic?.trim()) researchTopic(topic.trim())
  }

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto'
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'
  })

  document.querySelectorAll('.welcome-hints span').forEach((el) => {
    el.addEventListener('click', () => {
      chatInput.value = el.textContent?.replace('Try: ', '') || ''
      sendMessage()
    })
  })
}

async function sendMessage(): Promise<void> {
  const text = chatInput.value.trim()
  if (!text || isStreaming) return

  clearWelcome()
  appendMessage('user', text)
  chatInput.value = ''
  chatInput.style.height = 'auto'
  chatHistory.push({ role: 'user', content: text })

  const usePageContext = shouldUsePageContext(text)
  let channel: string

  if (usePageContext) {
    channel = await window.grokBrowser.grok.askPage(text)
  } else {
    channel = await window.grokBrowser.grok.chat([
      { role: 'system', content: 'You are Grok, an AI assistant built into Grok Browser. Be helpful, concise, and use markdown when appropriate.' },
      ...chatHistory
    ])
  }

  await consumeStream(channel)
}

function shouldUsePageContext(text: string): boolean {
  const pageKeywords = /page|this|article|here|site|website|link|current|above/i
  return pageKeywords.test(text) || text.length < 200
}

async function summarizePage(): Promise<void> {
  if (isStreaming) return
  clearWelcome()
  appendMessage('user', '📄 Summarize this page')
  const channel = await window.grokBrowser.grok.summarizePage()
  await consumeStream(channel)
}

async function askWithContext(query: string): Promise<void> {
  if (isStreaming) return
  clearWelcome()
  appendMessage('user', query)
  const channel = await window.grokBrowser.grok.askPage(query)
  await consumeStream(channel)
}

async function researchTopic(topic: string): Promise<void> {
  if (isStreaming) return
  if (!sidebarOpen) {
    sidebarOpen = true
    window.grokBrowser.sidebar.set(true, sidebarWidth)
    updateSidebarUI()
  }
  clearWelcome()
  appendMessage('user', `🧠 Research: ${topic}`)
  const channel = await window.grokBrowser.grok.research(topic)
  await consumeStream(channel)
}

async function consumeStream(channel: string): Promise<void> {
  isStreaming = true
  $('#btn-send').toggleAttribute('disabled', true)

  const typingEl = showTyping()
  let bubbleEl: HTMLElement | null = null
  let fullContent = ''
  let citations: string[] = []

  const cleanup = window.grokBrowser.grok.onStreamChunk(channel, (chunk: GrokStreamChunk) => {
    if (chunk.type === 'delta' && chunk.content) {
      if (!bubbleEl) {
        typingEl.remove()
        bubbleEl = appendMessage('assistant', '')
      }
      fullContent += chunk.content
      const bubble = bubbleEl.querySelector('.message-bubble')
      if (bubble) bubble.innerHTML = marked.parse(fullContent) as string
      chatMessages.scrollTop = chatMessages.scrollHeight
    }

    if (chunk.type === 'citations' && chunk.citations) citations = chunk.citations

    if (chunk.type === 'error') {
      typingEl.remove()
      showToast(chunk.error || 'Something went wrong', 'error')
      appendMessage('assistant', `⚠️ ${chunk.error}`)
      finishStream()
    }

    if (chunk.type === 'done') {
      typingEl.remove()
      if (bubbleEl && citations.length) appendCitations(bubbleEl, citations)
      if (fullContent) chatHistory.push({ role: 'assistant', content: fullContent })
      finishStream()
    }
  })

  function finishStream(): void {
    isStreaming = false
    $('#btn-send').toggleAttribute('disabled', false)
    cleanup()
  }
}

function clearWelcome(): void {
  chatMessages.querySelector('.welcome-card')?.remove()
}

function appendMessage(role: 'user' | 'assistant', content: string): HTMLElement {
  const el = document.createElement('div')
  el.className = `message ${role}`
  el.innerHTML = `
    <span class="message-label">${role === 'user' ? 'You' : 'Grok'}</span>
    <div class="message-bubble">${role === 'assistant' && content ? marked.parse(content) : escapeHtml(content)}</div>
  `
  chatMessages.appendChild(el)
  chatMessages.scrollTop = chatMessages.scrollHeight
  return el
}

function appendCitations(messageEl: HTMLElement, citations: string[]): void {
  const div = document.createElement('div')
  div.className = 'citations'
  div.innerHTML = `<div class="citations-title">Sources</div>` +
    citations.map((url) => `
      <div class="citation-row">
        <a class="citation-link" href="#" data-url="${escapeHtml(url)}">${escapeHtml(url)}</a>
        <div class="citation-actions">
          <button class="citation-open-tab" data-url="${escapeHtml(url)}">Open in tab</button>
        </div>
      </div>
    `).join('')

  div.querySelectorAll('.citation-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const url = (link as HTMLElement).dataset.url
      if (url) window.grokBrowser.shell.openExternal(url)
    })
  })

  div.querySelectorAll('.citation-open-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = (btn as HTMLElement).dataset.url
      if (url) window.grokBrowser.tabs.create(url)
    })
  })

  messageEl.querySelector('.message-bubble')?.appendChild(div)
}

function showTyping(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'message assistant'
  el.innerHTML = `
    <span class="message-label">Grok</span>
    <div class="message-bubble typing-indicator"><span></span><span></span><span></span></div>
  `
  chatMessages.appendChild(el)
  chatMessages.scrollTop = chatMessages.scrollHeight
  return el
}

function showToast(message: string, type: 'error' | 'success' = 'error'): void {
  const toast = document.createElement('div')
  toast.className = 'error-toast'
  if (type === 'success') {
    toast.style.background = '#065f46'
    toast.style.color = '#a7f3d0'
  }
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}

function setupSettings(): void {
  $('#btn-settings').onclick = () => {
    settingsModal.hidden = false
    loadSettings()
    refreshAccountUI()
  }
  $('#btn-settings-close').onclick = () => { settingsModal.hidden = true }
  $('#btn-save-settings').onclick = saveSettings
  $('#link-console').onclick = (e) => {
    e.preventDefault()
    window.grokBrowser.shell.openExternal('https://console.x.ai')
  }
  settingsModal.onclick = (e) => {
    if (e.target === settingsModal) settingsModal.hidden = true
  }
}

function setupAuth(): void {
  $('#btn-onboarding-sign-in').onclick = () => handleSignIn('onboarding')
  $('#btn-settings-sign-in').onclick = () => handleSignIn('settings')
  $('#btn-onboarding-console').onclick = () => window.grokBrowser.shell.openExternal('https://console.x.ai')
  $('#btn-onboarding-complete').onclick = completeOnboarding

  $('#onboarding-api-key').addEventListener('input', updateOnboardingState)
}

async function checkOnboarding(): Promise<void> {
  const status = await window.grokBrowser.auth.status()
  if (!status.onboardingComplete || !status.linked || !status.hasApiKey) {
    onboardingModal.hidden = false
    updateOnboardingUI(status)
  } else {
    onboardingModal.hidden = true
  }
}

function updateOnboardingUI(status: XAccountInfo): void {
  const step1 = $('#onboarding-step-1')
  const step2 = $('#onboarding-step-2')
  const signinStatus = $('#onboarding-signin-status')
  const completeBtn = $('#btn-onboarding-complete') as HTMLButtonElement
  const signInBtn = $('#btn-onboarding-sign-in') as HTMLButtonElement

  if (status.linked) {
    step1.classList.add('complete')
    signinStatus.textContent = status.username
      ? `Signed in as ${status.username}`
      : 'X account linked'
    signInBtn.textContent = '✓ Linked'
    signInBtn.toggleAttribute('disabled', true)
  } else {
    step1.classList.remove('complete')
    signinStatus.textContent = ''
    signInBtn.innerHTML = '<span>𝕏</span> Sign in with X'
    signInBtn.toggleAttribute('disabled', false)
  }

  if (status.hasApiKey) {
    step2.classList.add('complete')
  } else {
    step2.classList.remove('complete')
  }

  updateOnboardingState()
  completeBtn.toggleAttribute('disabled', !(status.linked && canCompleteOnboarding()))
}

function updateOnboardingState(): void {
  const apiKey = ($('#onboarding-api-key') as HTMLInputElement).value.trim()
  const completeBtn = $('#btn-onboarding-complete') as HTMLButtonElement
  const hasKey = !!apiKey
  if (hasKey) $('#onboarding-step-2').classList.add('complete')
  window.grokBrowser.auth.status().then((status) => {
    completeBtn.toggleAttribute('disabled', !(status.linked && (hasKey || status.hasApiKey)))
  })
}

function canCompleteOnboarding(): boolean {
  const apiKey = ($('#onboarding-api-key') as HTMLInputElement).value.trim()
  return !!apiKey
}

async function handleSignIn(context: 'onboarding' | 'settings'): Promise<void> {
  const btn = context === 'onboarding'
    ? $('#btn-onboarding-sign-in') as HTMLButtonElement
    : $('#btn-settings-sign-in') as HTMLButtonElement

  btn.toggleAttribute('disabled', true)
  btn.textContent = 'Signing in...'

  try {
    const status = await window.grokBrowser.auth.signIn()
    updateOnboardingUI(status)
    refreshAccountUI()
    showToast('X account linked', 'success')
  } catch {
    showToast('Sign-in cancelled or failed')
  } finally {
    if (context === 'onboarding') {
      btn.innerHTML = '<span>𝕏</span> Sign in with X'
    } else {
      btn.textContent = 'Sign in with X'
    }
    const status = await window.grokBrowser.auth.status()
    btn.toggleAttribute('disabled', status.linked)
    if (status.linked && context === 'settings') {
      btn.textContent = 'Sign out'
      btn.onclick = () => handleSignOut()
    }
  }
}

async function handleSignOut(): Promise<void> {
  const status = await window.grokBrowser.auth.signOut()
  refreshAccountUI()
  updateOnboardingUI(status)
  onboardingModal.hidden = false
  showToast('Signed out of X account')
}

async function refreshAccountUI(): Promise<void> {
  const status = await window.grokBrowser.auth.status()
  const nameEl = $('#settings-account-name')
  const statusEl = $('#settings-account-status')
  const btn = $('#btn-settings-sign-in') as HTMLButtonElement

  if (status.linked) {
    nameEl.textContent = status.username || 'X account linked'
    statusEl.textContent = status.linkedAt
      ? `Linked ${new Date(status.linkedAt).toLocaleDateString()}`
      : 'Account linked'
    btn.textContent = 'Sign out'
    btn.onclick = () => handleSignOut()
  } else {
    nameEl.textContent = 'Not linked'
    statusEl.textContent = 'Sign in to link your X account'
    btn.textContent = 'Sign in with X'
    btn.onclick = () => handleSignIn('settings')
  }
}

async function completeOnboarding(): Promise<void> {
  const apiKey = ($('#onboarding-api-key') as HTMLInputElement).value.trim()
  if (apiKey) {
    await window.grokBrowser.settings.set({ apiKey })
  }

  const status = await window.grokBrowser.auth.status()
  if (!status.linked) {
    showToast('Please sign in with your X account first')
    return
  }
  if (!apiKey && !status.hasApiKey) {
    showToast('Please enter your xAI API key')
    return
  }

  await window.grokBrowser.auth.completeOnboarding()
  onboardingModal.hidden = true
  showToast('Welcome to Grok Browser!', 'success')
}

async function loadSettings(): Promise<void> {
  const s = await window.grokBrowser.settings.get()
  ;($('#setting-model') as HTMLSelectElement).value = s.model
  ;($('#setting-search-mode') as HTMLSelectElement).value = s.searchMode
  ;($('#setting-home-page') as HTMLInputElement).value = s.homePage
  ;($('#setting-restore-session') as HTMLInputElement).checked = s.restoreSession
  if (s.hasApiKey) {
    ($('#setting-api-key') as HTMLInputElement).placeholder = '••••••••  (saved — enter new key to replace)'
  }
  sidebarOpen = s.sidebarOpen
  sidebarWidth = s.sidebarWidth
  updateSidebarUI()
}

async function saveSettings(): Promise<void> {
  await window.grokBrowser.settings.set({
    apiKey: ($('#setting-api-key') as HTMLInputElement).value,
    model: ($('#setting-model') as HTMLSelectElement).value,
    searchMode: ($('#setting-search-mode') as HTMLSelectElement).value,
    homePage: ($('#setting-home-page') as HTMLInputElement).value,
    restoreSession: ($('#setting-restore-session') as HTMLInputElement).checked
  })
  settingsModal.hidden = true
  const status = await window.grokBrowser.auth.status()
  if (status.linked && (status.hasApiKey || ($('#setting-api-key') as HTMLInputElement).value)) {
    await window.grokBrowser.auth.completeOnboarding()
  }
  showToast('Settings saved', 'success')
}

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault()
      window.grokBrowser.tabs.create()
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'G' || e.key === 'g')) {
      e.preventDefault()
      sidebarOpen = !sidebarOpen
      window.grokBrowser.sidebar.set(sidebarOpen, sidebarWidth)
      updateSidebarUI()
    }
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      omnibox.focus()
      omnibox.select()
    }
    if (e.ctrlKey && e.key === 'w') {
      e.preventDefault()
      if (activeTabId) window.grokBrowser.tabs.close(activeTabId)
    }
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault()
      $('#btn-bookmark').click()
    }
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault()
      $('#btn-history').click()
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault()
      showFindBar()
    }
    if (e.key === 'Escape' && !findBar.hidden) {
      hideFindBar()
    }
    if (e.ctrlKey && e.key === '=') {
      e.preventDefault()
      window.grokBrowser.zoom.set(0.5)
    }
    if (e.ctrlKey && e.key === '-') {
      e.preventDefault()
      window.grokBrowser.zoom.set(-0.5)
    }
    if (e.ctrlKey && e.key === '0') {
      e.preventDefault()
      window.grokBrowser.zoom.reset()
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault()
      window.grokBrowser.tabs.duplicate()
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'B') {
      e.preventDefault()
      renderBookmarks().then(() => openModal('bookmarks-modal'))
    }
  })
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

init()