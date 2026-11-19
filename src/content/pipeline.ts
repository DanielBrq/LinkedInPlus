import { MIN_DESCRIPTION_LENGTH, MAX_PROCESSED_HASHES, CSS_ACCEPTED, CSS_PENDING } from '@/shared/constants'
import type { ClassifierConfig } from '@/shared/keys'
import { hashText } from './hash'
import { classifyWithAI, clearAICache } from './aiFilter'
import { extractDescription } from './parser'

const POST_CONTAINER_SELECTOR = '[role="listitem"]'
const DISCARD_MEDIA_SELECTOR = 'video, img[alt="Ver imagen de celebración"]'
const FEEDBACK_SELECTOR = 'div[id^="collapsed"][id$="FeedType_MAIN_FEED_RELEVANCE"]'
const LOG_PREFIX = '[LinkedIn Collector]'
const NOT_INTERESTED_MENU_TIMEOUT_MS = 2000
const NOT_INTERESTED_FEEDBACK_TIMEOUT_MS = 10000
export const MSG_CONFIG_UPDATED = 'Classification config updated — re-scanning.'

type Context = { aiConfig: ClassifierConfig; notInterestedEnabled?: boolean }
type Job = { run: () => Promise<void>; resolve: () => void }

const processedHashes = new Set<string>()
const processedVideoPosts = new WeakSet<HTMLElement>()
let processGeneration = 0
const queue: Job[] = []
let busy = false

function enqueue(run: () => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    queue.push({ run, resolve })
    if (!busy) void runQueue()
  })
}

async function runQueue(): Promise<void> {
  busy = true
  while (queue.length) {
    const job = queue.shift()
    if (!job) break
    try {
      await job.run()
    } finally {
      job.resolve()
    }
  }
  busy = false
}

function getPost(container: Element): HTMLElement | null {
  return (
    container.closest<HTMLElement>(POST_CONTAINER_SELECTOR) ??
    (container instanceof HTMLElement ? container : null)
  )
}

function hidePost(container: Element): void {
  const post = getPost(container)
  post?.remove()
}

function findNotInterestedItem(): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('div[role="menuitem"]')).find((item) =>
      /not interested|no me interesa|no es relevante|no tengo interés/i.test(item.textContent ?? ''),
    ) ?? null
  )
}

function waitForNotInterestedItem(): Promise<HTMLElement | null> {
  const existing = findNotInterestedItem()
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const item = findNotInterestedItem()
      if (item) finish(item)
    })
    const timer = setTimeout(() => finish(null), NOT_INTERESTED_MENU_TIMEOUT_MS)
    const finish = (item: HTMLElement | null): void => {
      clearTimeout(timer)
      observer.disconnect()
      resolve(item)
    }
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  })
}

function hideNotInterestedFeedback(): Promise<void> {
  return new Promise((resolve) => {
    const hide = (): boolean => {
      const feedback = document.querySelector<HTMLElement>(FEEDBACK_SELECTOR)
      if (!feedback) return false
      feedback.remove()
      return true
    }
    if (hide()) {
      resolve()
      return
    }

    let timer: ReturnType<typeof setTimeout>
    const finish = (): void => {
      clearTimeout(timer)
      observer.disconnect()
      resolve()
    }
    const observer = new MutationObserver(() => {
      if (hide()) finish()
    })
    timer = setTimeout(finish, NOT_INTERESTED_FEEDBACK_TIMEOUT_MS)
    observer.observe(document.documentElement, { childList: true, subtree: true })
  })
}

async function clickNotInterested(post: HTMLElement | null): Promise<boolean> {
  if (!post) return false
  const button = post.querySelector<HTMLButtonElement>(
    'button[aria-label*="control menu" i], button[aria-label*="menú" i], button[aria-label*="Más opciones" i], button[aria-label*="Más acciones" i]',
  )
  if (!button) return false
  button.click()
  const item = await waitForNotInterestedItem()
  if (!item) return false
  item.click()
  await hideNotInterestedFeedback()
  return true
}

export function stopProcessing(): void {
  processGeneration++
  for (const { resolve } of queue.splice(0)) resolve()
  clearAICache()
}

export function processContainer(container: Element, context: Context): Promise<void> {
  return enqueue(() => processContainerBody(container, context))
}

async function processContainerBody(container: Element, { aiConfig, notInterestedEnabled = false }: Context): Promise<void> {
  if (!chrome.runtime?.id) return
  const generation = processGeneration
  try {
    const post = getPost(container)
    if (post?.querySelector(DISCARD_MEDIA_SELECTOR)) {
      if (processedVideoPosts.has(post)) return
      processedVideoPosts.add(post)
      if (notInterestedEnabled && !(await clickNotInterested(post))) return
      hidePost(post)
      return
    }

    const description = await extractDescription(container)
    if (!description) return
    const hash = await hashText(description)
    if (processedHashes.has(hash)) return
    processedHashes.add(hash)
    if (processedHashes.size > MAX_PROCESSED_HASHES) {
      const oldest = processedHashes.values().next().value
      if (oldest !== undefined) processedHashes.delete(oldest)
    }
    if (generation !== processGeneration) return

    if (description.length < MIN_DESCRIPTION_LENGTH) return

    post?.classList.add(CSS_PENDING)
    const result = await classifyWithAI(description, hash, aiConfig)
    post?.classList.remove(CSS_PENDING)
    if (generation !== processGeneration) return
    if ('reason' in result) return

    if (result.fitScore < aiConfig.threshold) {
      if (notInterestedEnabled && !(await clickNotInterested(getPost(container)))) return
      hidePost(container)
    } else {
      post?.classList.add(CSS_ACCEPTED)
    }
  } catch (error) {
    if (String(error instanceof Error ? error.message : error).includes('Extension context invalidated')) return
    console.error(LOG_PREFIX, 'Processing error:', error)
  }
}

export function clearProcessedHashes(): void {
  processGeneration++
  processedHashes.clear()
  clearAICache()
}
