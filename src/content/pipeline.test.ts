import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { CSS_PENDING, MIN_DESCRIPTION_LENGTH } from '@/shared/constants'
import type { ClassifierConfig } from '@/shared/keys'
import { DEFAULT_CLASSIFIER_CONFIG } from '@/shared/settings'
import { clearProcessedHashes, processContainer } from './pipeline'

const config = (overrides: Partial<ClassifierConfig> = {}): ClassifierConfig => ({
  ...DEFAULT_CLASSIFIER_CONFIG,
  apiKey: 'key',
  filters: 'remote typescript',
  ...overrides,
})

const send = chrome.runtime.sendMessage as unknown as Mock

const createPost = (text: string) => {
  const post = document.createElement('article')
  post.setAttribute('role', 'listitem')
  const description = document.createElement('span')
  description.setAttribute('data-testid', 'expandable-text-box')
  description.textContent = text
  post.appendChild(description)
  document.body.appendChild(post)
  return { post, description }
}

const longText = 'remote typescript role with product team '.repeat(4)

describe('processContainer', () => {
  beforeEach(() => {
    clearProcessedHashes()
    document.body.innerHTML = ''
    send.mockReset()
    send.mockResolvedValue({ ok: true, score: 90 })
  })

  it('hides short descriptions without calling the classifier', async () => {
    const { post, description } = createPost('x'.repeat(MIN_DESCRIPTION_LENGTH - 1))
    await processContainer(description, { aiConfig: config() })

    expect(post.style.display).toBe('none')
    expect(send).not.toHaveBeenCalled()
  })

  it('hides posts below the threshold and clears the pending marker', async () => {
    const { post, description } = createPost(longText)
    send.mockResolvedValue({ ok: true, score: 10 })

    await processContainer(description, { aiConfig: config() })

    expect(post.style.display).toBe('none')
    expect(post.classList.contains(CSS_PENDING)).toBe(false)
  })

  it('keeps posts at or above the threshold', async () => {
    const { post, description } = createPost(longText)

    await processContainer(description, { aiConfig: config() })

    expect(post.style.display).not.toBe('none')
  })

  it('processes each description hash once', async () => {
    const first = createPost(longText)
    const second = createPost(longText)

    await processContainer(first.description, { aiConfig: config() })
    await processContainer(second.description, { aiConfig: config() })

    expect(send).toHaveBeenCalledTimes(1)
  })
})
