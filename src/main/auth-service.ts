import { BrowserWindow, session } from 'electron'
import { settingsStore } from './store'

const AUTH_PARTITION = 'persist:grok-x-auth'
const SIGN_IN_URL = 'https://accounts.x.ai/sign-in?redirect=https://grok.com'

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

function parseHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function isSignInPage(url: string): boolean {
  const host = parseHost(url)
  return host === 'accounts.x.ai'
}

function isAuthenticatedDestination(url: string): boolean {
  const host = parseHost(url)
  if (!host || isSignInPage(url)) return false
  if (host === 'grok.com' || host.endsWith('.grok.com')) return true
  if (host === 'console.x.ai') return true
  if (host === 'x.ai' || host.endsWith('.x.ai')) return true
  return false
}

async function hasAuthCookies(): Promise<boolean> {
  const sess = authSession()
  const domains = ['.x.ai', 'x.ai', '.x.com', 'x.com', '.twitter.com', 'twitter.com', '.grok.com', 'grok.com']
  for (const domain of domains) {
    const cookies = await sess.cookies.get({ domain })
    if (
      cookies.some(
        (c) =>
          c.name.toLowerCase().includes('auth') ||
          c.name.toLowerCase().includes('session') ||
          c.name === 'ct0' ||
          c.name === 'auth_token'
      )
    ) {
      return true
    }
  }
  return false
}

async function markAccountLinked(authWindow: BrowserWindow): Promise<void> {
  settingsStore.set('xAccountLinked', true)
  settingsStore.set('xLinkedAt', Date.now())

  try {
    const title = authWindow.webContents.getTitle()
    if (title && !title.toLowerCase().includes('sign') && !title.toLowerCase().includes('log')) {
      settingsStore.set('xUsername', title.split('|')[0].trim())
    }
  } catch {
    // optional
  }
}

export function configureAuthSession(): void {
  const sess = authSession()
  sess.setPermissionRequestHandler((_wc, _permission, callback) => callback(true))
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

export function openXSignIn(_parent: BrowserWindow | null): Promise<XAccountInfo> {
  return new Promise((resolve, reject) => {
    let resolved = false

    const authWindow = new BrowserWindow({
      width: 520,
      height: 720,
      center: true,
      title: 'Sign in with X',
      autoHideMenuBar: true,
      backgroundColor: '#0a0a0f',
      show: false,
      minimizable: true,
      maximizable: false,
      webPreferences: {
        partition: AUTH_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
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

    const checkAuthSuccess = async (url: string) => {
      if (resolved || isSignInPage(url)) return

      const host = parseHost(url)

      // Landed on grok.com after OAuth redirect — definite success
      if (host === 'grok.com' || host.endsWith('.grok.com')) {
        await markAccountLinked(authWindow)
        finish(getXAccountStatus())
        return
      }

      // On other xAI / console pages with session cookies — success
      if (isAuthenticatedDestination(url)) {
        const cookies = await hasAuthCookies()
        if (cookies) {
          await markAccountLinked(authWindow)
          finish(getXAccountStatus())
        }
      }
    }

    authWindow.once('ready-to-show', () => {
      authWindow.show()
      authWindow.focus()
    })

    authWindow.webContents.setWindowOpenHandler(({ url }) => {
      authWindow.webContents.loadURL(url).catch(() => {})
      return { action: 'deny' }
    })

    authWindow.webContents.on('did-navigate', (_, url) => {
      checkAuthSuccess(url).catch(() => {})
    })
    authWindow.webContents.on('did-navigate-in-page', (_, url) => {
      checkAuthSuccess(url).catch(() => {})
    })
    authWindow.webContents.on('did-redirect-navigation', (_, url) => {
      checkAuthSuccess(url).catch(() => {})
    })

    authWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      if (resolved || errorCode === -3) return // aborted navigation
      if (validatedURL.startsWith('https://accounts.x.ai') || validatedURL.startsWith('https://x.com')) {
        fail(`Could not load sign-in page (${errorDescription})`)
      }
    })

    authWindow.on('closed', () => {
      if (!resolved) {
        if (settingsStore.get('xAccountLinked')) {
          finish(getXAccountStatus())
        } else {
          fail('Sign-in was cancelled')
        }
      }
    })

    authWindow.loadURL(SIGN_IN_URL).catch((err) => {
      fail(err instanceof Error ? err.message : 'Could not load sign-in page')
    })
  })
}