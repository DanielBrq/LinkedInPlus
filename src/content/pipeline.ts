import { MIN_DESCRIPTION_LENGTH, MAX_PROCESSED_HASHES, CSS_PENDING } from '@/shared/constants'
import type { ClassifierConfig } from '@/shared/keys'
import { hashText } from './hash'
import { classifyWithAI, clearAICache } from './aiFilter'
import { extractDescription } from './parser'

const POST_CONTAINER_SELECTOR = '[role="listitem"]'
const LOG_PREFIX = '[LinkedIn Collector]'
export const MSG_CONFIG_UPDATED = 'Classification config updated — re-scanning.'

type Context = { aiConfig: ClassifierConfig; notInterestedEnabled?: boolean }
type Job = { run: () => Promise<void>; resolve: () => void }

const processedHashes = new Set<string>()
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
  if (post) post.style.display = 'none'
}

async function clickNotInterested(post: HTMLElement | null, enabled: boolean): Promise<void> {
  if (!post || !enabled) return
  const button = post.querySelector<HTMLButtonElement>(
    'button[aria-label*="control menu" i], button[aria-label*="menú" i], button[aria-label*="Más opciones" i], button[aria-label*="Más acciones" i]',
  )
  if (!button) return
  button.click()
  await new Promise((resolve) => setTimeout(resolve, 200))
  for (const item of document.querySelectorAll<HTMLElement>('div[role="menuitem"]')) {
    if (/not interested|no me interesa|no es relevante|no tengo interés/i.test(item.textContent ?? '')) {
      item.click()
      return
    }
  }
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

    const post = container.closest(POST_CONTAINER_SELECTOR)
    if (description.length < MIN_DESCRIPTION_LENGTH) {
      await clickNotInterested(getPost(container), notInterestedEnabled)
      hidePost(container)
      return
    }

    post?.classList.add(CSS_PENDING)
    const result = await classifyWithAI(description, hash, aiConfig)
    post?.classList.remove(CSS_PENDING)
    if (generation !== processGeneration) return
    if ('reason' in result) return

    if (result.fitScore < aiConfig.threshold) {
      await clickNotInterested(getPost(container), notInterestedEnabled)
      hidePost(container)
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
