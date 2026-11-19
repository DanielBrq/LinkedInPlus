import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { AI_FAILED_REASON, AI_UNAVAILABLE_REASON, DEFAULT_AI_TIMEOUT_MS, MAX_AI_CACHE_ENTRIES } from '@/shared/constants'
import type { ClassifierConfig } from '@/shared/keys'
import { classifyWithAI, clearAICache } from './aiFilter'

const config: ClassifierConfig = {
  apiKey: 'key',
  model: 'typesafe-ai/jev',
  filters: 'remote typescript',
  negativeFilters: 'unpaid',
  threshold: 65,
}

const send = chrome.runtime.sendMessage as unknown as Mock

describe('classifyWithAI', () => {
  beforeEach(() => {
    clearAICache()
    send.mockReset()
    send.mockResolvedValue({ ok: true, score: 50 })
  })

  it('sends the bounded prompt with the stored config', async () => {
    expect(await classifyWithAI('post text', 'hash', config)).toEqual({ fitScore: 50, cached: false })

    expect(send).toHaveBeenCalledWith({
      type: 'AI_CLASSIFY',
      model: 'typesafe-ai/jev',
      timeout: DEFAULT_AI_TIMEOUT_MS,
      prompt: expect.stringContaining('Post:\npost text'),
    })
    expect(send.mock.calls[0]?.[0].prompt).toContain('Negative preferences (what to avoid):\nunpaid')
  })

  it('clamps the returned score to 0..100', async () => {
    send.mockResolvedValue({ ok: true, score: 150 })
    expect(await classifyWithAI('post', 'high', config)).toEqual({ fitScore: 100, cached: false })

    send.mockResolvedValue({ ok: true, score: -5 })
    expect(await classifyWithAI('other', 'low', config)).toEqual({ fitScore: 0, cached: false })
  })

  it('skips work without gateway configuration', async () => {
    expect(await classifyWithAI('post', 'hash', { ...config, apiKey: '' })).toEqual({
      reason: AI_UNAVAILABLE_REASON,
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('caches successful results per hash', async () => {
    await classifyWithAI('post', 'hash', config)
    expect(await classifyWithAI('post', 'hash', config)).toEqual({ fitScore: 50, cached: true })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('evicts old entries when the successful-result cache reaches its limit', async () => {
    for (let index = 0; index <= MAX_AI_CACHE_ENTRIES; index++) {
      await classifyWithAI(`post-${index}`, `hash-${index}`, config)
    }
    await classifyWithAI('post-0', 'hash-0', config)
    expect(send).toHaveBeenCalledTimes(MAX_AI_CACHE_ENTRIES + 2)
  })

  it('reports failures as a reason', async () => {
    send.mockResolvedValue({ ok: false, error: 'boom' })
    expect(await classifyWithAI('post', 'hash', config)).toEqual({ reason: AI_FAILED_REASON })
  })

  it('resolves queued work when the cache is cleared', async () => {
    const resolvers: ((value: unknown) => void)[] = []
    send.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)))

    const first = classifyWithAI('first', 'hash-1', config)
    const second = classifyWithAI('second', 'hash-2', config)
    clearAICache()

    await expect(second).resolves.toEqual({ reason: AI_FAILED_REASON })
    resolvers[0]?.({ ok: true, score: 40 })
    await expect(first).resolves.toEqual({ fitScore: 40, cached: false })
  })
})
