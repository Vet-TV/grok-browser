import Store from 'electron-store'

export interface BrowserSettings {
  apiKey: string
  model: string
  sidebarWidth: number
  sidebarOpen: boolean
  searchMode: 'auto' | 'on' | 'off'
  homePage: string
  restoreSession: boolean
  xAccountLinked: boolean
  xUsername: string
  xEmail: string
  xLinkedAt: number | null
  onboardingComplete: boolean
  showBookmarksBar: boolean
}

const defaults: BrowserSettings = {
  apiKey: '',
  model: 'grok-3-latest',
  sidebarWidth: 380,
  sidebarOpen: true,
  searchMode: 'auto',
  homePage: 'https://x.ai',
  restoreSession: true,
  xAccountLinked: false,
  xUsername: '',
  xEmail: '',
  xLinkedAt: null,
  onboardingComplete: false,
  showBookmarksBar: false
}

export const settingsStore = new Store<BrowserSettings>({
  name: 'grok-browser-settings',
  defaults
})