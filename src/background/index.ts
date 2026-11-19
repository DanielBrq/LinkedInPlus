import { createGateway, generateText, Output } from 'ai'
import * as v from 'valibot'
import { DEFAULT_AI_TIMEOUT_MS } from '@/shared/constants'
import { STORAGE_KEYS, type ClassifierConfig } from '@/shared/keys'
import {
  dispatch,
  type ClassifyRequest,
  type ClassifyResponse,
  type MessageHandlers,
} from '@/shared/messages'
import { get } from '@/shared/storage'

const LINKEDIN_URL = /^https:\/\/(www\.)?linkedin\.com\//
const MIN_TIMEOUT_MS = 1000
const MAX_TIMEOUT_MS = 60000
const MAX_PROMPT_CHARS = 12000
const MAX_MODEL_CHARS = 200

const timeoutFor = (value: unknown): number => {
  const timeout = Number(value)
  return Number.isFinite(timeout)
    ? Math.max(MIN_TIMEOUT_MS, Math.min(timeout, MAX_TIMEOUT_MS))
    : DEFAULT_AI_TIMEOUT_MS
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

async function classify(request: ClassifyRequest, sender: chrome.runtime.MessageSender): Promise<ClassifyResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutFor(request.timeout))
  try {
    if (!sender.tab?.url || !LINKEDIN_URL.test(sender.tab.url)) {
      throw new Error('Classification request rejected')
    }
    const config: ClassifierConfig | undefined = await get(STORAGE_KEYS.classifierConfig)
    if (
      !config?.apiKey ||
      typeof request.prompt !== 'string' ||
      request.prompt.length > MAX_PROMPT_CHARS ||
      typeof request.model !== 'string' ||
      !request.model ||
      request.model.length > MAX_MODEL_CHARS
    ) {
      throw new Error('Missing Gateway configuration')
    }
    const gateway = createGateway({ apiKey: config.apiKey })
    const { output } = await generateText({
      model: gateway(request.model),
      output: Output.object({
        schema: v.object({
          score: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)),
        }),
      }),
      prompt: request.prompt,
      abortSignal: controller.signal,
    })
    return { ok: true, ...output }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  } finally {
    clearTimeout(timer)
  }
}

export const handlers: MessageHandlers = { AI_CLASSIFY: classify }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const pending = dispatch(handlers, message, sender)
  if (!pending) return
  pending.then(sendResponse)
  return true
})
