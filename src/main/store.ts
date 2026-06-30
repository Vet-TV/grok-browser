import Store from 'electron-store'

export interface BrowserSettings {
  apiKey: string
  model: string
  sidebarWidth: number
  sidebarOpen: boolean
  searchMode: 'auto' | 'on' | 'off'
  homePage: string
  restoreSession: boolean
}

const defaults: BrowserSettings = {
  apiKey: '',
  model: 'grok-3-latest',
  sidebarWidth: 380,
  sidebarOpen: true,
  searchMode: 'auto',
  homePage: 'https://x.ai',
  restoreSession: true
}

export const settingsStore = new Store<BrowserSettings>({
  name: 'grok-browser-settings',
  defaults
})