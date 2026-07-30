export const STORAGE_KEYS = {
  JOB_PREFIX: 'job_',
  INDEX_KEY: 'job_index',
  ENABLED_KEY: 'collector_enabled',
  AI_CONFIG_KEY: 'ai_config',
  DISPLAY_CONFIG_KEY: 'display_config',
  NOT_INTERESTED_KEY: 'not_interested_enabled',
  SAVE_MATCHES_KEY: 'save_matches',
  HIDE_NON_RELEVANT_KEY: 'hide_non_relevant',
  BLOCK_MEDIA_KEY: 'block_media',
  AI_PRESETS_KEY: 'ai_presets',
  AI_ACTIVE_PRESET_KEY: 'ai_active_preset',
};

export const DEFAULT_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
export const DEFAULT_MODEL = 'meta/llama-3.1-8b';
export const DEFAULT_AI_TIMEOUT_MS = 15000;
export const AI_TEMPERATURE = 0;
export const MAX_DESCRIPTION_CHARS = 4000;

export const MIN_DESCRIPTION_LENGTH = 100;
export const DESC_COLLAPSE_AT = 200;
export const FIT_HIGH = 70;
export const FIT_MID = 40;
export const FIT_SCORE_MIN = 0;
export const FIT_SCORE_MAX = 100;
export const FIT_SCORE_DEFAULT = 0;
export const MAX_PROCESSED_HASHES = 2000;

export const OBSERVER_DEBOUNCE_MS = 80;
export const INITIAL_SCAN_DELAY_MS = 2000;
export const DEFAULT_HIDE_DELAY_MS = 5000;
export const DISPLAY_DEBOUNCE_MS = 400;
export const AI_DEBOUNCE_MS = 400;
export const FADE_OUT_DURATION_MS = 250;

export const CSS_REJECTED = 'lc-rejected';
export const CSS_PENDING = 'lc-pending';
export const CSS_MATCHED = 'lc-matched';
export const CSS_HIDDEN = 'lc-hidden';
export const CSS_COLLAPSED = 'collapsed';

// ponytail: greedy `[\s\S]*` matches first { to last } — try-catch in parseResponse handles failures
export const REGEX_JSON_EXTRACT = /\{[\s\S]*\}/;
export const REGEX_URLS = /https?:\/\/\S+/g;
export const REGEX_BOILERPLATE = /(equal opportunity employer|affirmative action|eoe m\/f\/v\/d)/gi;
export const REGEX_ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
export const REGEX_CONTROL_CHARS = /[\x00-\x1F\x7F-\x9F]/g;
export const REGEX_WHITESPACE = /\s+/g;
export const REGEX_LINKEDIN_OMIT_LINKS = /linkedin\.com\/safety\//i;

export const NEGATIVE_PATTERNS = [
  /like this post|me gusta esta publicación/i,
  /share if|comparte si/i,
  /follow for more|sígueme/i,
  /comment below|comenta abajo|deja tu comentario/i,
  /what are your thoughts|qué opinas/i,
  /\bpoll\b|encuesta/i,
];

export const VALID_MODALITIES = ['remote', 'hybrid', 'onsite'];
export const HASH_ALGORITHM = 'SHA-256';
export const HEX_RADIX = 16;
export const HEX_BYTE_WIDTH = 2;
export const LOG_PREFIX = '[LinkedIn Collector]';
export const AI_UNAVAILABLE_REASON = 'ai-unavailable';
export const AI_FAILED_REASON = 'ai-failed';
export const EXPORT_FILENAME = 'job_matches.json';
export const EXPORT_MIME_TYPE = 'application/json;charset=utf-8';

export const HEADER_CONTENT_TYPE = 'Content-Type';
export const CONTENT_TYPE_JSON = 'application/json';
export const HEADER_AUTHORIZATION = 'Authorization';
export const AUTH_SCHEME_BEARER = 'Bearer ';
