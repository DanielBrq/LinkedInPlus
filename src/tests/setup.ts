import { beforeEach, vi } from 'vitest'

type Area = 'local' | 'sync' | 'session'
type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void

const stores: Record<Area, Record<string, unknown>> = { local: {}, sync: {}, session: {} }
const changeListeners: ChangeListener[] = []
const messageListeners: ((...args: unknown[]) => void)[] = []

const read = (store: Record<string, unknown>, query: unknown): Record<string, unknown> => {
  if (typeof query === 'string') return query in store ? { [query]: store[query] } : {}
  if (Array.isArray(query)) {
    return Object.fromEntries(query.filter((key) => key in store).map((key) => [key, store[key]]))
  }
  if (query && typeof query === 'object') {
    return Object.fromEntries(Object.entries(query).map(([key, fallback]) => [key, key in store ? store[key] : fallback]))
  }
  return { ...store }
}

const emit = (changes: Record<string, chrome.storage.StorageChange>, area: Area) => {
  if (Object.keys(changes).length === 0) return
  for (const listener of changeListeners) listener(changes, area)
}

const makeArea = (area: Area): chrome.storage.StorageArea => {
  const store = stores[area]
  return {
    get: vi.fn(async (query?: unknown) => read(store, query)),
    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes: Record<string, chrome.storage.StorageChange> = {}
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store[key], newValue: value }
        store[key] = value
      }
      emit(changes, area)
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const changes: Record<string, chrome.storage.StorageChange> = {}
      for (const key of [keys].flat()) {
        if (!(key in store)) continue
        changes[key] = { oldValue: store[key] }
        delete store[key]
      }
      emit(changes, area)
    }),
    clear: vi.fn(async () => {
      const changes = Object.fromEntries(Object.keys(store).map((key) => [key, { oldValue: store[key] }]))
      for (const key of Object.keys(store)) delete store[key]
      emit(changes, area)
    }),
    getBytesInUse: vi.fn(async () => 0),
    setAccessLevel: vi.fn(async () => {}),
  } as unknown as chrome.storage.StorageArea
}

const storage = {
  local: makeArea('local'),
  sync: makeArea('sync'),
  session: makeArea('session'),
  onChanged: {
    addListener: vi.fn((listener: ChangeListener) => changeListeners.push(listener)),
    removeListener: vi.fn((listener: ChangeListener) => {
      const index = changeListeners.indexOf(listener)
      if (index >= 0) changeListeners.splice(index, 1)
    }),
    hasListener: vi.fn((listener: ChangeListener) => changeListeners.includes(listener)),
  },
}

const runtime = {
  id: 'test-extension',
  sendMessage: vi.fn(async () => undefined),
  getURL: vi.fn((path: string) => `chrome-extension://test-extension/${path}`),
  onMessage: {
    addListener: vi.fn((listener: (...args: unknown[]) => void) => messageListeners.push(listener)),
    removeListener: vi.fn(),
    hasListener: vi.fn(),
  },
}

const declarativeNetRequest = {
  updateDynamicRules: vi.fn(async () => {}),
}

globalThis.chrome = { storage, runtime, declarativeNetRequest } as unknown as typeof chrome

beforeEach(() => {
  for (const store of Object.values(stores)) {
    for (const key of Object.keys(store)) delete store[key]
  }
  changeListeners.length = 0
  messageListeners.length = 0
  vi.clearAllMocks()
})
