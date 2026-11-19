import { describe, expect, it } from 'vitest'
import { DEFAULT_AI_TIMEOUT_MS, DEFAULT_MODEL } from './constants'
import { STORAGE_KEYS } from './keys'
import { DEFAULT_CLASSIFIER_CONFIG } from './settings'

// Literals copied from migration/INVENTORY.md; renames must fail here first.
describe('MV3 contracts', () => {
  it('keeps storage keys', () => {
    expect(STORAGE_KEYS.classifierConfig).toBe('classifier_config')
    expect(STORAGE_KEYS.collectorEnabled).toBe('collector_enabled')
  })

  it('keeps the classifier_config shape', () => {
    expect(DEFAULT_CLASSIFIER_CONFIG).toMatchObject({
      apiKey: '',
      model: DEFAULT_MODEL,
      threshold: 65,
    })
    expect(DEFAULT_MODEL).toBe('typesafe-ai/jev')
    expect(DEFAULT_AI_TIMEOUT_MS).toBe(15000)
  })
})
