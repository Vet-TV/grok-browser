import Store from 'electron-store'

export interface PasswordEntry {
  id: string
  site: string
  username: string
  password: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface PaymentEntry {
  id: string
  label: string
  cardholder: string
  last4: string
  expiry: string
  createdAt: number
}

export interface ContactEntry {
  id: string
  name: string
  email: string
  phone: string
  address: string
  createdAt: number
}

export interface IdentityEntry {
  id: string
  type: string
  number: string
  issuer: string
  expiry: string
  createdAt: number
}

export interface TravelEntry {
  id: string
  type: string
  number: string
  holder: string
  expiry: string
  createdAt: number
}

interface PasswordStoreSchema {
  passwords: PasswordEntry[]
  payments: PaymentEntry[]
  contacts: ContactEntry[]
  identities: IdentityEntry[]
  travel: TravelEntry[]
}

const store = new Store<PasswordStoreSchema>({
  name: 'grok-password-manager',
  defaults: {
    passwords: [],
    payments: [],
    contacts: [],
    identities: [],
    travel: []
  }
})

export const passwordStore = {
  getAll() {
    return {
      passwords: store.get('passwords'),
      payments: store.get('payments'),
      contacts: store.get('contacts'),
      identities: store.get('identities'),
      travel: store.get('travel')
    }
  },

  addPassword(entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>): PasswordEntry {
    const record: PasswordEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    store.set('passwords', [record, ...store.get('passwords')])
    return record
  },

  removePassword(id: string): void {
    store.set('passwords', store.get('passwords').filter((p) => p.id !== id))
  },

  addPayment(entry: Omit<PaymentEntry, 'id' | 'createdAt'>): PaymentEntry {
    const record: PaymentEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() }
    store.set('payments', [record, ...store.get('payments')])
    return record
  },

  removePayment(id: string): void {
    store.set('payments', store.get('payments').filter((p) => p.id !== id))
  },

  addContact(entry: Omit<ContactEntry, 'id' | 'createdAt'>): ContactEntry {
    const record: ContactEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() }
    store.set('contacts', [record, ...store.get('contacts')])
    return record
  },

  removeContact(id: string): void {
    store.set('contacts', store.get('contacts').filter((c) => c.id !== id))
  },

  addIdentity(entry: Omit<IdentityEntry, 'id' | 'createdAt'>): IdentityEntry {
    const record: IdentityEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() }
    store.set('identities', [record, ...store.get('identities')])
    return record
  },

  removeIdentity(id: string): void {
    store.set('identities', store.get('identities').filter((i) => i.id !== id))
  },

  addTravel(entry: Omit<TravelEntry, 'id' | 'createdAt'>): TravelEntry {
    const record: TravelEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() }
    store.set('travel', [record, ...store.get('travel')])
    return record
  },

  removeTravel(id: string): void {
    store.set('travel', store.get('travel').filter((t) => t.id !== id))
  },

  clearAll(): void {
    store.set('passwords', [])
    store.set('payments', [])
    store.set('contacts', [])
    store.set('identities', [])
    store.set('travel', [])
  }
}