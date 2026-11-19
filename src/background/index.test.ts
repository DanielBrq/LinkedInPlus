import { describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import type { ClassifyRequest } from '@/shared/messages'
import { STORAGE_KEYS } from '@/shared/keys'
import { DEFAULT_CLASSIFIER_CONFIG } from '@/shared/settings'
import { set } from '@/shared/storage'
import { handlers } from './index'

vi.mock('ai', () => ({
  createGateway: vi.fn(() => (model: string) => ({ modelId: model })),
  generateText: vi.fn(),
  Output: { object: vi.fn((options: unknown) => options) },
}))

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined

const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0]?.[0] as unknown as
  | Listener
  | undefined

const request: ClassifyRequest = { type: 'AI_CLASSIFY', prompt: 'post', model: 'meta/llama-3.1-8b' }
const linkedInSender = { tab: { url: 'https://www.linkedin.com/feed/' } } as chrome.runtime.MessageSender

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>

const seedConfig = () => set(STORAGE_KEYS.classifierConfig, { ...DEFAULT_CLASSIFIER_CONFIG, apiKey: 'key' })
const mockGenerate = (score: number) =>
  vi.mocked(generateText).mockResolvedValueOnce({ output: { score } } as unknown as GenerateTextResult)

describe('background AI_CLASSIFY', () => {
  it('rejects senders that are not LinkedIn tabs', async () => {
    await seedConfig()
    const sender = { tab: { url: 'https://example.com/' } } as chrome.runtime.MessageSender
    expect(await handlers.AI_CLASSIFY(request, sender)).toEqual({
      ok: false,
      error: 'Classification request rejected',
    })
  })

  it('rejects requests without gateway configuration', async () => {
    expect(await handlers.AI_CLASSIFY(request, linkedInSender)).toEqual({
      ok: false,
      error: 'Missing Gateway configuration',
    })
  })

  it('rejects oversized prompts', async () => {
    await seedConfig()
    const oversized = { ...request, prompt: 'x'.repeat(12001) }
    expect(await handlers.AI_CLASSIFY(oversized, linkedInSender)).toEqual({
      ok: false,
      error: 'Missing Gateway configuration',
    })
  })

  it('returns the generated score', async () => {
    await seedConfig()
    mockGenerate(72)
    expect(await handlers.AI_CLASSIFY(request, linkedInSender)).toEqual({ ok: true, score: 72 })
  })

  it('surfaces generation errors', async () => {
    await seedConfig()
    vi.mocked(generateText).mockRejectedValueOnce(new Error('boom'))
    expect(await handlers.AI_CLASSIFY(request, linkedInSender)).toEqual({ ok: false, error: 'boom' })
  })

  it('answers through the runtime listener', async () => {
    await seedConfig()
    mockGenerate(80)
    const sendResponse = vi.fn()

    expect(listener?.(request, linkedInSender, sendResponse)).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true, score: 80 }))
  })

  it('ignores unknown messages', () => {
    expect(listener?.({ type: 'OTHER' }, linkedInSender, vi.fn())).toBeUndefined()
  })
})
