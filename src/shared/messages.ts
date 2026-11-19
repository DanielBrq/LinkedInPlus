export type ClassifyRequest = {
  type: 'AI_CLASSIFY'
  prompt: string
  model: string
  timeout?: number
}

export type ClassifyResponse = { ok: true; score: number } | { ok: false; error: string }

export type RequestMap = {
  AI_CLASSIFY: { request: ClassifyRequest; response: ClassifyResponse }
}

export type Request = RequestMap[keyof RequestMap]['request']
export type ResponseFor<K extends Request['type']> = RequestMap[K]['response']

type MaybePromise<T> = T | Promise<T>

export type MessageHandler<K extends Request['type']> = (
  request: RequestMap[K]['request'],
  sender: chrome.runtime.MessageSender,
) => MaybePromise<ResponseFor<K>>

export type MessageHandlers = { [K in Request['type']]: MessageHandler<K> }

export async function sendMessage<R extends Request>(request: R): Promise<ResponseFor<R['type']>> {
  return chrome.runtime.sendMessage(request) as Promise<ResponseFor<R['type']>>
}

// Record over every request type: adding a message type without a known type fails to compile.
const KNOWN_TYPES: Record<Request['type'], true> = { AI_CLASSIFY: true }

function isRequest(value: unknown): value is Request {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  return typeof value.type === 'string' && Object.hasOwn(KNOWN_TYPES, value.type)
}

/** Returns undefined for malformed or unknown messages so listeners can ignore them. */
export function dispatch(
  handlers: MessageHandlers,
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<ClassifyResponse> | undefined {
  if (!isRequest(message)) return undefined
  return Promise.resolve(handlers[message.type](message, sender))
}
