import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from './keys'
import { get, getAll, onChange, remove, set } from './storage'
import { DEFAULT_CLASSIFIER_CONFIG } from './settings'

describe('storage', () => {
  it('round-trips a typed value', async () => {
    await set(STORAGE_KEYS.collectorEnabled, true)
    expect(await get(STORAGE_KEYS.collectorEnabled)).toBe(true)
  })

  it('returns undefined for a missing key', async () => {
    expect(await get(STORAGE_KEYS.collectorEnabled)).toBeUndefined()
  })

  it('removes keys and lists everything', async () => {
    await set(STORAGE_KEYS.collectorEnabled, false)
    await set(STORAGE_KEYS.classifierConfig, DEFAULT_CLASSIFIER_CONFIG)
    await remove([STORAGE_KEYS.collectorEnabled])
    expect(await getAll()).toEqual({ classifier_config: DEFAULT_CLASSIFIER_CONFIG })
  })

  it('notifies only for the watched key and unsubscribes', async () => {
    const listener = vi.fn()
    const off = onChange(STORAGE_KEYS.collectorEnabled, listener)

    await set(STORAGE_KEYS.classifierConfig, DEFAULT_CLASSIFIER_CONFIG)
    expect(listener).not.toHaveBeenCalled()

    await set(STORAGE_KEYS.collectorEnabled, false)
    expect(listener).toHaveBeenCalledWith(false, undefined)

    off()
    await set(STORAGE_KEYS.collectorEnabled, true)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
