import { BrowserWindow, session } from 'electron'
import { settingsStore } from './store'

const AUTH_PARTITION = 'persist:grok-x-auth'
const SIGN_IN_URL = 'https://accounts.x.ai/sign-in?redirect=https://grok.com'
const API_KEYS_URL = 'https://console.x.ai/team/default/api-keys'

export interface XAccountInfo {
  linked: boolean
  username: string
  email: string
  linkedAt: number | null
  hasApiKey: boolean
  onboardingComplete: boolean
}

function authSession() {
  return session.fromPartition(AUTH_PARTITION)
}

async function hasAuthCookies(): Promise<boolean> {
  const sess = authSession()
  const domains = ['.x.ai', 'x.ai', '.x.com', 'x.com', '.twitter.com']
  for (const domain of domains) {
    const cookies = await sess.cookies.get({ domain })
    if (cookies.some((c) => c.name.toLowerCase().includes('auth') || c.name.toLowerCase().includes('session') || c.name === 'ct0')) {
      return true
    }
  }
  return false
}

export function getXAccountStatus(): XAccountInfo {
  return {
    linked: settingsStore.get('xAccountLinked') ?? false,
    username: settingsStore.get('xUsername') ?? '',
    email: settingsStore.get('xEmail') ?? '',
    linkedAt: settingsStore.get('xLinkedAt') ?? null,
    hasApiKey: !!settingsStore.get('apiKey'),
    onboardingComplete: settingsStore.get('onboardingComplete') ?? false
  }
}

export function markOnboardingComplete(): void {
  settingsStore.set('onboardingComplete', true)
}

export function signOutXAccount(): void {
  settingsStore.set('xAccountLinked', false)
  settingsStore.set('xUsername', '')
  settingsStore.set('xEmail', '')
  settingsStore.set('xLinkedAt', null)
  settingsStore.set('onboardingComplete', false)
  authSession().clearStorageData()
}

export function openXSignIn(parent: BrowserWindow | null): Promise<XAccountInfo> {
  return new Promise((resolve, reject) => {
    let resolved = false
    let step: 'signin' | 'apikey' = 'signin'

    const authWindow = new BrowserWindow({
      width: 500,
      height: 760,
      parent: parent ?? undefined,
      modal: !!parent,
      title: 'Sign in with X',
      autoHideMenuBar: true,
      backgroundColor: '#0a0a0f',
      webPreferences: {
        partition: AUTH_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    const finish = (info: XAccountInfo) => {
      if (resolved) return
      resolved = true
      if (!authWindow.isDestroyed()) authWindow.close()
      resolve(info)
    }

    const fail = (message: string) => {
      if (resolved) return
      resolved = true
      if (!authWindow.isDestroyed()) authWindow.close()
      reject(new Error(message))
    }

    const handleNavigation = async (url: string) => {
      if (resolved) return

      const onGrok = url.includes('grok.com') || url.includes('x.ai')
      const onConsole = url.includes('console.x.ai')

      if (step === 'signin' && onGrok) {
        const hasCookies = await hasAuthCookies()
        if (hasCookies || url.includes('grok.com')) {
          settingsStore.set('xAccountLinked', true)
          settingsStore.set('xLinkedAt', Date.now())

          try {
            const title = authWindow.webContents.getTitle()
            if (title && !title.includes('Sign')) {
              settingsStore.set('xUsername', title.split('|')[0].trim())
            }
          } catch {
            // optional
          }

          step = 'apikey'
          authWindow.loadURL(API_KEYS_URL).catch(() => {
            finish(getXAccountStatus())
          })
        }
      }

      if (step === 'apikey' && onConsole) {
        if (settingsStore.get('apiKey')) {
          settingsStore.set('onboardingComplete', true)
          finish(getXAccountStatus())
        }
      }
    }

    authWindow.webContents.on('did-navigate', (_, url) => handleNavigation(url))
    authWindow.webContents.on('did-navigate-in-page', (_, url) => handleNavigation(url))

    authWindow.on('closed', () => {
      if (!resolved) {
        if (settingsStore.get('xAccountLinked')) {
          finish(getXAccountStatus())
        } else {
          fail('Sign-in window closed')
        }
      }
    })

    authWindow.loadURL(SIGN_IN_URL).catch(() => fail('Could not load sign-in page'))
  })
}