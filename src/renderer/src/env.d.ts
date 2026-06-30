/// <reference types="vite/client" />

import type { GrokBrowserAPI } from '../../preload/index'

declare global {
  interface Window {
    grokBrowser: GrokBrowserAPI
  }
}

export {}