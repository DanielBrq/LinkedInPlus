export const DEFAULT_MODEL = 'meta/llama-3.1-8b'
export const DEFAULT_AI_TIMEOUT_MS = 15000
export const MAX_DESCRIPTION_CHARS = 6000

export const MIN_DESCRIPTION_LENGTH = 100
export const MAX_PROCESSED_HASHES = 2000
export const REGEX_ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g
export const REGEX_CONTROL_CHARS = /[\x00-\x1F\x7F-\x9F]/g
export const REGEX_WHITESPACE = /\s+/g

export const OBSERVER_DEBOUNCE_MS = 80
export const INITIAL_SCAN_DELAY_MS = 2000
export const CSS_PENDING = 'lc-pending'

export const NEGATIVE_PATTERNS = [
  /#opentowork|looking for new opportunities|busco trabajo/i,
  /\blike this post\b.*\bif\b|\bme gusta esta publicación\b/i,
  /\bpoll\b|encuesta/i,
]

export const HASH_ALGORITHM = 'SHA-256'
export const HEX_RADIX = 16
export const HEX_BYTE_WIDTH = 2
export const AI_UNAVAILABLE_REASON = 'ai-unavailable'
export const AI_FAILED_REASON = 'ai-failed'
