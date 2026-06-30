import { app } from 'electron'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import Store from 'electron-store'

export interface ExtensionInfo {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  path: string
}

interface ExtensionState {
  disabled: string[]
}

const stateStore = new Store<ExtensionState>({
  name: 'grok-extensions',
  defaults: { disabled: [] }
})

function extensionsDir(): string {
  return join(app.getPath('userData'), 'extensions')
}

function loadManifest(extPath: string): Partial<{ name: string; version: string; description: string }> | null {
  const manifestPath = join(extPath, 'manifest.json')
  if (!existsSync(manifestPath)) return null
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8'))
  } catch {
    return null
  }
}

export const extensionsService = {
  list(): ExtensionInfo[] {
    const dir = extensionsDir()
    if (!existsSync(dir)) return []

    const disabled = new Set(stateStore.get('disabled'))
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const extPath = join(dir, d.name)
        const manifest = loadManifest(extPath)
        return {
          id: d.name,
          name: manifest?.name || d.name,
          version: manifest?.version || '1.0',
          description: manifest?.description || 'Local extension',
          enabled: !disabled.has(d.name),
          path: extPath
        }
      })
  },

  setEnabled(id: string, enabled: boolean): void {
    const disabled = new Set(stateStore.get('disabled'))
    if (enabled) disabled.delete(id)
    else disabled.add(id)
    stateStore.set('disabled', [...disabled])
  },

  getExtensionsPath(): string {
    return extensionsDir()
  }
}