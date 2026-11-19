import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from './keys'
import { get, getAll, set } from './storage'
import {
  DEFAULT_CLASSIFIER_CONFIG,
  getClassifierConfig,
  getEnabled,
  saveClassifierConfig,
  saveEnabled,
} from './settings'

describe('settings', () => {
  it('defaults to the canonical config', async () => {
    expect(await getClassifierConfig()).toEqual(DEFAULT_CLASSIFIER_CONFIG)
  })

  it('migrates legacy config once and removes obsolete keys', async () => {
    await chrome.storage.local.set({
      ai_config: { apiKey: 'key', model: 'legacy-model', filters: 'f', locationFilter: 'Remote' },
      job_1: { title: 'x' },
      job_index: [],
    })

    expect(await getClassifierConfig()).toMatchObject({
      apiKey: 'key',
      model: 'legacy-model',
      filters: 'f\nLocation: Remote',
      threshold: 65,
    })

    const all = await getAll()
    expect(all['job_1']).toBeUndefined()
    expect(all['ai_config']).toBeUndefined()
    expect(all[STORAGE_KEYS.migrationFlag]).toBe(true)
  })

  it('clamps the threshold on read and write', async () => {
    await set(STORAGE_KEYS.classifierConfig, { ...DEFAULT_CLASSIFIER_CONFIG, threshold: 500 })
    expect((await getClassifierConfig()).threshold).toBe(100)

    await saveClassifierConfig({ threshold: -10, apiKey: 'key' })
    expect(await getClassifierConfig()).toMatchObject({ threshold: 0, apiKey: 'key' })
  })

  it('toggles the collector', async () => {
    expect(await getEnabled()).toBe(true)
    await saveEnabled(false)
    expect(await getEnabled()).toBe(false)
  })
})
