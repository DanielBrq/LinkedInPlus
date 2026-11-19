import { describe, expect, it } from 'vitest'
import { DEFAULT_AI_TIMEOUT_MS, DEFAULT_MODEL } from './constants'
import { STORAGE_KEYS } from './keys'
import type { ClassifyRequest, ClassifyResponse } from './messages'
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
    expect(DEFAULT_MODEL).toBe('meta/llama-3.1-8b')
    expect(DEFAULT_AI_TIMEOUT_MS).toBe(15000)
  })

  it('keeps the AI_CLASSIFY payload', () => {
    const request: ClassifyRequest = {
      type: 'AI_CLASSIFY',
      prompt: 'prompt',
      model: 'meta/llama-3.1-8b',
      timeout: 15000,
    }
    const ok: ClassifyResponse = { ok: true, score: 42 }
    const failed: ClassifyResponse = { ok: false, error: 'error' }

    expect(request.type).toBe('AI_CLASSIFY')
    expect(ok).toEqual({ ok: true, score: 42 })
    expect(failed).toEqual({ ok: false, error: 'error' })
  })
})
