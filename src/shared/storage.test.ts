import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from './keys'
import { onChange, set } from './storage'
import { DEFAULT_CLASSIFIER_CONFIG } from './settings'

describe('storage', () => {
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
