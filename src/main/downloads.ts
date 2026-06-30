import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'path'
import { dataStore, type DownloadEntry } from './data-store'

export function setupDownloads(window: BrowserWindow): void {
  session.defaultSession.on('will-download', (_event, item) => {
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

    dataStore.upsertDownload(entry)
    window.webContents.send('downloads:updated', dataStore.getDownloads())

    item.on('updated', (_e, state) => {
      entry.receivedBytes = item.getReceivedBytes()
      entry.totalBytes = item.getTotalBytes()
      entry.state = state === 'interrupted' ? 'interrupted' : 'progressing'
      dataStore.upsertDownload(entry)
      window.webContents.send('downloads:updated', dataStore.getDownloads())
    })

    item.once('done', (_e, state) => {
      entry.state = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted'
      entry.receivedBytes = item.getReceivedBytes()
      dataStore.upsertDownload(entry)
      window.webContents.send('downloads:updated', dataStore.getDownloads())
      window.webContents.send('downloads:complete', entry)
    })
  })
}

export function openDownload(path: string): void {
  shell.showItemInFolder(path)
}