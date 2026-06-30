# Grok Browser

An open-source, Chromium-based web browser with **Grok AI baked in** — inspired by [Perplexity Comet](https://www.perplexity.ai/comet).

Grok Browser wraps the Chromium engine (via Electron) in a modern shell with a persistent AI assistant sidebar. Ask questions about the page you're viewing, get instant summaries, or search the web with Grok's real-time knowledge.

![Grok Browser](resources/screenshot.png)

## Features

- **Chromium rendering** — full modern web compatibility via Electron's Blink engine
- **Grok AI sidebar** — persistent assistant panel, Comet-style
- **Page-aware intelligence** — Grok reads the current page and answers in context
- **One-click summarize** — instant TL;DR of any article or page
- **Research mode** — Grok researches topics with live web search and source links
- **Live web search** — Grok searches the web and X in real time (configurable)
- **Custom new tab page** — quick links, search, and keyboard shortcut hints
- **Bookmarks** — save pages with Ctrl+D, manage from bookmarks panel
- **History** — full browsing history with Ctrl+H
- **Downloads** — built-in download manager with progress tracking
- **Find in page** — Ctrl+F search within any page
- **Session restore** — reopens your tabs after restart
- **Zoom controls** — Ctrl+/Ctrl-/Ctrl+0
- **Multi-tab browsing** — tabs, back/forward, omnibox, keyboard shortcuts
- **Fully open source** — MIT licensed, no telemetry, your API key stays local

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- An [xAI API key](https://console.x.ai) (free tier available)

### Install & Run

```bash
git clone https://github.com/Vet-TV/grok-browser.git
cd grok-browser
npm install
npm run dev
```

On first launch, open **Settings (⚙)** and paste your xAI API key.

### Build for Production

```bash
npm run build        # compile
npm run dist:win     # Windows installer
npm run dist:mac     # macOS DMG
npm run dist:linux   # Linux AppImage/deb
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+L` | Focus address bar |
| `Ctrl+Shift+G` | Toggle Grok sidebar |
| `Ctrl+D` | Bookmark page |
| `Ctrl+H` | History |
| `Ctrl+Shift+B` | Bookmarks panel |
| `Ctrl+F` | Find in page |
| `Ctrl+Shift+D` | Duplicate tab |
| `Ctrl+Plus/Minus/0` | Zoom in/out/reset |
| `Enter` | Send chat message |

## Settings

| Setting | Description |
|---------|-------------|
| **API Key** | Your xAI API key from [console.x.ai](https://console.x.ai) |
| **Model** | Grok model (`grok-3-latest`, `grok-4-0709`, etc.) |
| **Search Mode** | `auto` / `on` / `off` — controls live web+X search |
| **Home Page** | URL opened in new tabs |

## Architecture

```
grok-browser/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Window, IPC handlers
│   │   ├── tab-manager.ts  # BrowserView tab management
│   │   ├── grok-service.ts # xAI API streaming client
│   │   └── store.ts    # Persistent settings (electron-store)
│   ├── preload/        # Secure IPC bridge
│   └── renderer/       # Browser chrome UI + Grok sidebar
```

- **Main process** manages `BrowserView` instances for each tab (Chromium rendering)
- **Renderer** draws the custom chrome (tabs, toolbar, Grok sidebar)
- **Preload** exposes a typed, sandboxed API to the UI
- **Grok service** streams chat completions from `api.x.ai` with optional live search

## Comet-like AI Features

| Comet | Grok Browser |
|-------|--------------|
| AI sidebar assistant | ✅ Grok sidebar with streaming chat |
| Page summaries | ✅ One-click "Summarize page" |
| Context-aware Q&A | ✅ Auto-injects current page content |
| Live web search | ✅ Via xAI `search_parameters` |
| Chromium engine | ✅ Electron / Blink |
| Open source base | ✅ MIT licensed |

## Privacy

- API keys are stored locally via `electron-store` on your machine
- No analytics or telemetry
- Page content is only sent to xAI when you interact with Grok
- You control search mode (can disable live search entirely)

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

This is an independent open-source project. It is not affiliated with or endorsed by xAI or Perplexity AI. "Grok" is a trademark of xAI. Use your own API key and comply with [xAI's terms of service](https://x.ai/legal/terms-of-service).