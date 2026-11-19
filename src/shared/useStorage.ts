import { onScopeDispose, ref, type Ref } from 'vue'
import type { StorageKey, StorageSchema } from './keys'
import { get, onChange } from './storage'

export function useStorage<K extends StorageKey>(key: K, fallback: StorageSchema[K]): Ref<StorageSchema[K]> {
  const value = ref(fallback) as Ref<StorageSchema[K]>
  void get(key).then((stored) => {
    if (stored !== undefined) value.value = stored
  })
  const stop = onChange(key, (next) => {
    if (next !== undefined) value.value = next
  })
  onScopeDispose(stop)
  return value
}
