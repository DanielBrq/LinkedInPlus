import { MIN_DESCRIPTION_LENGTH, MAX_PROCESSED_HASHES, CSS_PENDING } from '@/shared/constants'
import type { ClassifierConfig } from '@/shared/keys'
import { hashText } from '@/shared/utils'
import { classifyWithAI, clearAICache } from './aiFilter'
import { extractDescription } from './parser'

const POST_CONTAINER_SELECTOR = '[role="listitem"]'
const LOG_PREFIX = '[LinkedIn Collector]'
export const MSG_CONFIG_UPDATED = 'Classification config updated — re-scanning.'

type Context = { aiConfig: ClassifierConfig }
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

function hidePost(container: Element): void {
  const post =
    container.closest<HTMLElement>(POST_CONTAINER_SELECTOR) ??
    (container instanceof HTMLElement ? container : null)
  if (post) post.style.display = 'none'
}

export function stopProcessing(): void {
  processGeneration++
  for (const { resolve } of queue.splice(0)) resolve()
  clearAICache()
}

export function processContainer(container: Element, context: Context): Promise<void> {
  return enqueue(() => processContainerBody(container, context))
}

async function processContainerBody(container: Element, { aiConfig }: Context): Promise<void> {
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
      hidePost(container)
      return
    }

    post?.classList.add(CSS_PENDING)
    const result = await classifyWithAI(description, hash, aiConfig)
    post?.classList.remove(CSS_PENDING)
    if (generation !== processGeneration) return
    if ('reason' in result) return

    if (result.fitScore < aiConfig.threshold) hidePost(container)
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
