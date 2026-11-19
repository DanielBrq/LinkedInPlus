import { describe, expect, it, vi } from 'vitest'
import {
  dispatch,
  sendMessage,
  type ClassifyResponse,
  type MessageHandlers,
} from './messages'

const sender = { tab: { url: 'https://www.linkedin.com/feed/' } } as chrome.runtime.MessageSender

describe('messages', () => {
  it('dispatches a valid request to its handler', async () => {
    const handler = vi.fn(async (): Promise<ClassifyResponse> => ({ ok: true, score: 50 }))
    const handlers: MessageHandlers = { AI_CLASSIFY: handler }
    const request = { type: 'AI_CLASSIFY', prompt: 'p', model: 'm' } as const

    await expect(dispatch(handlers, request, sender)).resolves.toEqual({ ok: true, score: 50 })
    expect(handler).toHaveBeenCalledWith(request, sender)
  })

  it('ignores malformed or unknown messages', () => {
    const handlers: MessageHandlers = {
      AI_CLASSIFY: async () => ({ ok: true, score: 0 }),
    }

    expect(dispatch(handlers, null, sender)).toBeUndefined()
    expect(dispatch(handlers, 'AI_CLASSIFY', sender)).toBeUndefined()
    expect(dispatch(handlers, { type: 'UNKNOWN' }, sender)).toBeUndefined()
  })

  it('forwards sendMessage to the runtime', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: true, score: 1 } as never)
    const response = await sendMessage({ type: 'AI_CLASSIFY', prompt: 'p', model: 'm' })

    expect(response).toEqual({ ok: true, score: 1 })
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'AI_CLASSIFY',
      prompt: 'p',
      model: 'm',
    })
  })
})
