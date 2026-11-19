import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { CSS_ACCEPTED, CSS_PENDING, MIN_DESCRIPTION_LENGTH } from '@/shared/constants'
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

  it('keeps short descriptions because they were not classified', async () => {
    const { post, description } = createPost('x'.repeat(MIN_DESCRIPTION_LENGTH - 1))
    await processContainer(description, { aiConfig: config() })

    expect(post.isConnected).toBe(true)
    expect(send).not.toHaveBeenCalled()
  })

  it('hides posts below the threshold and clears the pending marker', async () => {
    const { post, description } = createPost(longText)
    send.mockResolvedValue({ ok: true, score: 10 })

    await processContainer(description, { aiConfig: config() })

    expect(post.isConnected).toBe(false)
    expect(post.classList.contains(CSS_PENDING)).toBe(false)
  })

  it('discards video posts without classifying them', async () => {
    const { post, description } = createPost(longText)
    const video = document.createElement('video')
    post.appendChild(video)

    await processContainer(video, { aiConfig: config() })

    expect(post.isConnected).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('discards posts containing the celebration image without classifying them', async () => {
    const { post } = createPost(longText)
    const image = document.createElement('img')
    image.alt = 'Ver imagen de celebración'
    post.appendChild(image)

    await processContainer(image, { aiConfig: config() })

    expect(post.isConnected).toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('selects Not interested when enabled for a hidden post', async () => {
    const { post, description } = createPost(longText)
    let connectedWhenSelected = false
    const button = document.createElement('button')
    button.setAttribute('aria-label', 'Open control menu')
    button.addEventListener('click', () => {
      setTimeout(() => {
        const item = document.createElement('div')
        item.setAttribute('role', 'menuitem')
        item.textContent = 'Not interested'
        item.addEventListener('click', () => {
          item.dataset.selected = 'true'
          connectedWhenSelected = post.isConnected
          const feedback = document.createElement('div')
          feedback.id = 'collapsedTestFeedType_MAIN_FEED_RELEVANCE'
          feedback.textContent = 'Publicación oculta en el feed.'
          document.body.appendChild(feedback)
        })
        document.body.appendChild(item)
      }, 350)
    })
    post.appendChild(button)
    send.mockResolvedValue({ ok: true, score: 10 })

    await processContainer(description, { aiConfig: config(), notInterestedEnabled: true })

    expect(document.querySelector('[role="menuitem"]')?.getAttribute('data-selected')).toBe('true')
    expect(connectedWhenSelected).toBe(true)
    expect(document.querySelector('[id$="FeedType_MAIN_FEED_RELEVANCE"]')).toBeNull()
    expect(post.isConnected).toBe(false)
  })

  it('keeps a rejected post if Not interested could not be selected', async () => {
    const { post, description } = createPost(longText)
    send.mockResolvedValue({ ok: true, score: 10 })

    await processContainer(description, { aiConfig: config(), notInterestedEnabled: true })

    expect(post.isConnected).toBe(true)
  })

  it('keeps posts at or above the threshold', async () => {
    const { post, description } = createPost(longText)

    await processContainer(description, { aiConfig: config() })

    expect(post.style.display).not.toBe('none')
    expect(post.classList.contains(CSS_ACCEPTED)).toBe(true)
  })

  it('processes each description hash once', async () => {
    const first = createPost(longText)
    const second = createPost(longText)

    await processContainer(first.description, { aiConfig: config() })
    await processContainer(second.description, { aiConfig: config() })

    expect(send).toHaveBeenCalledTimes(1)
  })
})
