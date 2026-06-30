import { app, BrowserWindow, shell, type Session } from 'electron'
import { join } from 'path'
import { dataStore, type DownloadEntry } from './data-store'

export const windowSessions = new WeakMap<BrowserWindow, { session: Session; isIncognito: boolean }>()
export const incognitoDownloads = new WeakMap<Session, DownloadEntry[]>()
const registeredSessions = new WeakSet<Session>()

export function setupDownloads(window: BrowserWindow, sess: Session, isIncognito: boolean): void {
  // Register the window's session information
  windowSessions.set(window, { session: sess, isIncognito })

  // Send current downloads to the window immediately
  const currentIncognito = isIncognito ? (incognitoDownloads.get(sess) || []) : []
  window.webContents.send('downloads:updated', [...currentIncognito, ...dataStore.getDownloads()])

  if (registeredSessions.has(sess)) return
  registeredSessions.add(sess)

  sess.on('will-download', (_event, item) => {
    const id = crypto.randomUUID()
    const downloadsPath = join(app.getPath('downloads'), item.getFilename())
    item.setSavePath(downloadsPath)

    const entry: DownloadEntry = {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      path: downloadsPath,
      state: 'progressing',
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      startedAt: Date.now()
    }

    const saveDownload = (ent: DownloadEntry) => {
      if (isIncognito) {
        const list = incognitoDownloads.get(sess) || []
        const idx = list.findIndex((d) => d.id === ent.id)
        if (idx >= 0) list[idx] = ent
        else list.unshift(ent)
        incognitoDownloads.set(sess, list.slice(0, 100))
      } else {
        dataStore.upsertDownload(ent)
      }
    }

    const broadcastUpdate = () => {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        const info = windowSessions.get(win)
        if (!info) continue

        if (info.isIncognito) {
          const list = incognitoDownloads.get(info.session) || []
          win.webContents.send('downloads:updated', [...list, ...dataStore.getDownloads()])
        } else {
          win.webContents.send('downloads:updated', dataStore.getDownloads())
        }
      }
    }

    saveDownload(entry)
    broadcastUpdate()

    item.on('updated', (_e, state) => {
      entry.receivedBytes = item.getReceivedBytes()
      entry.totalBytes = item.getTotalBytes()
      entry.state = state === 'interrupted' ? 'interrupted' : 'progressing'
      saveDownload(entry)
      broadcastUpdate()
    })

    item.once('done', (_e, state) => {
      entry.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted'
      entry.receivedBytes = item.getReceivedBytes()
      saveDownload(entry)
      broadcastUpdate()

      // Notify completion
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        win.webContents.send('downloads:complete', entry)
      }
    })
  })
}

export function openDownload(path: string): void {
  shell.showItemInFolder(path)
}