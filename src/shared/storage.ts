import type { StorageKey, StorageSchema } from './keys'

type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void

const local = (): chrome.storage.StorageArea | null =>
  typeof chrome === 'undefined' || !chrome.storage?.local ? null : chrome.storage.local

export async function get<K extends StorageKey>(key: K): Promise<StorageSchema[K] | undefined> {
  const area = local()
  if (!area) return undefined
  const result = await area.get(key)
  return result[key] as StorageSchema[K] | undefined
}

export async function set<K extends StorageKey>(key: K, value: StorageSchema[K]): Promise<void> {
  const area = local()
  if (!area) return
  await area.set({ [key]: value })
}

export async function remove(keys: string | string[]): Promise<void> {
  const area = local()
  if (!area) return
  await area.remove(keys)
}

export async function getAll(): Promise<Record<string, unknown>> {
  const area = local()
  if (!area) return {}
  return (await area.get(null)) as Record<string, unknown>
}

export function onChange<K extends StorageKey>(
  key: K,
  listener: (value: StorageSchema[K] | undefined, oldValue: StorageSchema[K] | undefined) => void,
): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => {}
  const wrapped: ChangeListener = (changes) => {
    const change = changes[key]
    if (!change) return
    listener(change.newValue as StorageSchema[K] | undefined, change.oldValue as StorageSchema[K] | undefined)
  }
  chrome.storage.onChanged.addListener(wrapped)
  return () => chrome.storage.onChanged.removeListener(wrapped)
}
