export interface MenuItem {
  id: string
  label: string
  shortcut?: string
  action: string
}

export interface MenuCategory {
  id: string
  label: string
  items: MenuItem[]
}

/** Always visible at top — never hidden by scroll */
export const MENU_QUICK_ITEMS: MenuItem[] = [
  { id: 'new-tab', label: 'New tab', shortcut: 'Ctrl+T', action: 'new-tab' },
  { id: 'new-window', label: 'New window', shortcut: 'Ctrl+N', action: 'new-window' },
  { id: 'new-incognito', label: 'New Incognito window', shortcut: 'Ctrl+Shift+N', action: 'new-incognito' }
]

/** Standalone actions below quick items */
export const MENU_STANDALONE_ITEMS: MenuItem[] = [
  { id: 'find-page', label: 'Find in page', shortcut: 'Ctrl+F', action: 'find-in-page' }
]

/** Hover to reveal submenu */
export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'x-signin', label: 'X profile sign-in', action: 'x-signin' },
      { id: 'x-signout', label: 'Sign out of X', action: 'x-signout' },
      { id: 'settings', label: 'Settings', action: 'settings' }
    ]
  },
  {
    id: 'passwords',
    label: 'Passwords and autofill',
    items: [
      { id: 'pw-manager', label: 'Grok Password Manager', action: 'password-manager' },
      { id: 'pw-payments', label: 'Payments', action: 'password-payments' },
      { id: 'pw-contacts', label: 'Contact info', action: 'password-contacts' },
      { id: 'pw-identity', label: 'Identity docs', action: 'password-identity' },
      { id: 'pw-travel', label: 'Travel', action: 'password-travel' }
    ]
  },
  {
    id: 'history',
    label: 'History and bookmarks',
    items: [
      { id: 'history', label: 'History', shortcut: 'Ctrl+H', action: 'history' },
      { id: 'bookmarks', label: 'Bookmarks and lists', shortcut: 'Ctrl+Shift+B', action: 'bookmarks' },
      { id: 'bookmarks-bar', label: 'Show bookmarks bar', action: 'toggle-bookmarks-bar' },
      { id: 'tab-groups', label: 'Tab groups', action: 'tab-groups' },
      { id: 'create-group', label: 'Create new tab group', shortcut: 'Alt+Shift+P', action: 'create-tab-group' },
      { id: 'downloads', label: 'Downloads', shortcut: 'Ctrl+J', action: 'downloads' }
    ]
  },
  {
    id: 'privacy',
    label: 'Privacy',
    items: [
      { id: 'clear-data', label: 'Delete browsing data', shortcut: 'Ctrl+Shift+Del', action: 'clear-data' }
    ]
  },
  {
    id: 'zoom',
    label: 'Zoom',
    items: [
      { id: 'zoom-in', label: 'Zoom in', shortcut: 'Ctrl+=', action: 'zoom-in' },
      { id: 'zoom-out', label: 'Zoom out', shortcut: 'Ctrl+-', action: 'zoom-out' },
      { id: 'zoom-reset', label: 'Reset zoom', shortcut: 'Ctrl+0', action: 'zoom-reset' }
    ]
  },
  {
    id: 'grok',
    label: 'Grok',
    items: [
      { id: 'grok-tab-search', label: 'Search tabs with Grok', action: 'grok-tab-search' },
      { id: 'translate', label: 'Translate page with Grok', action: 'translate' }
    ]
  },
  {
    id: 'find-edit',
    label: 'Find and edit',
    items: [
      { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', action: 'cut' },
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', action: 'copy' },
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', action: 'paste' }
    ]
  },
  {
    id: 'cast-save',
    label: 'Cast, save and share',
    items: [
      { id: 'cast', label: 'Cast…', action: 'cast' },
      { id: 'save-page', label: 'Save page as…', shortcut: 'Ctrl+S', action: 'save-page' },
      { id: 'install-app', label: 'Install page as app', action: 'install-app' },
      { id: 'create-shortcut', label: 'Create shortcut', action: 'create-shortcut' },
      { id: 'copy-link', label: 'Copy link', action: 'copy-link' },
      { id: 'send-devices', label: 'Send to your devices', action: 'send-devices' },
      { id: 'qr-code', label: 'Create QR code', action: 'qr-code' }
    ]
  },
  {
    id: 'more-tools',
    label: 'More tools',
    items: [
      { id: 'tab-search', label: 'Tab search', shortcut: 'Ctrl+Shift+A', action: 'tab-search' },
      { id: 'name-window', label: 'Name window', action: 'name-window' },
      { id: 'customize', label: 'Customize Grok Browser', action: 'settings' },
      { id: 'reading-mode', label: 'Reading mode', action: 'reading-mode' },
      { id: 'performance', label: 'Performance', action: 'task-manager' },
      { id: 'task-manager', label: 'Task manager', action: 'task-manager' },
      { id: 'devtools', label: 'Developer tools', shortcut: 'Ctrl+Shift+I', action: 'devtools' }
    ]
  },
  {
    id: 'extensions',
    label: 'Extensions',
    items: [
      { id: 'manage-ext', label: 'Manage extensions', action: 'extensions' },
      { id: 'chrome-store', label: 'Visit Chrome Web Store', action: 'chrome-store' }
    ]
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { id: 'about', label: 'About Grok Browser', action: 'about' },
      { id: 'whats-new', label: "What's New", action: 'whats-new' },
      { id: 'help-center', label: 'Help Center', action: 'help-center' },
      { id: 'report-issue', label: 'Report an issue', shortcut: 'Alt+Shift+I', action: 'report-issue' }
    ]
  }
]

export const EXTENSIONS_MENU: MenuItem[] = [
  { id: 'ext-manage', label: 'Manage extensions', action: 'extensions' },
  { id: 'ext-store', label: 'Visit Chrome Web Store', action: 'chrome-store' }
]

export const PROFILE_MENU: MenuItem[] = [
  { id: 'prof-signin', label: 'X profile sign-in', action: 'x-signin' },
  { id: 'prof-passwords', label: 'Grok Password Manager', action: 'password-manager' },
  { id: 'prof-settings', label: 'Settings', action: 'settings' },
  { id: 'prof-signout', label: 'Sign out of X', action: 'x-signout' }
]