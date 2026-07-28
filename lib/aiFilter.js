import {
  DEFAULT_GATEWAY_URL, DEFAULT_MODEL, DEFAULT_AI_TIMEOUT_MS,
  AI_TEMPERATURE, MAX_DESCRIPTION_CHARS, LOG_PREFIX,
  REGEX_URLS, REGEX_BOILERPLATE, REGEX_JSON_EXTRACT, REGEX_WHITESPACE,
  VALID_MODALITIES, FIT_SCORE_MIN, FIT_SCORE_MAX, FIT_SCORE_DEFAULT,
  HEADER_CONTENT_TYPE, CONTENT_TYPE_JSON,
  HEADER_AUTHORIZATION, AUTH_SCHEME_BEARER,
  AI_UNAVAILABLE_REASON,
} from './constants.js';

const MAX_CONCURRENT = 1;
const REASON_MAX_LENGTH = 200;
const TIMEOUT_ERROR_MSG = 'AI request timed out';
const MATCHES_PROFILE = 'matches profile';
const DOES_NOT_MATCH_PROFILE = 'does not match profile';

const AI_UNAVAILABLE_RESULT = {
  relevant: true, reason: AI_UNAVAILABLE_REASON, cached: false,
  fitScore: 0, title: null, description: null, location: null, modality: null,
  englishLevel: null, technologies: [], posterName: null, companyName: null,
  applicationEmail: null, applicationLink: null
};

const sessionCache = new Map();
const inflight = new Map();
const queue = [];
let active = 0;

const SYSTEM_PROMPT = `You are a job offer extractor and classifier. Analyze the offer against the user's profile and return ONLY a valid JSON object with this exact structure (no additional text, no markdown, no code blocks).

Classification rules:
- If the post contains "#opentowork" it's a person looking for work, not a job offer → relevant = false.
- If the post is NOT a real job offer (discussion, news, promo, opinion, etc.) → relevant = false.
- If the post is a real job offer, classify according to the user's profile.
- If the job location is NOT in Costa Rica → relevant = false.

{
  "relevant": boolean,
  "fitScore": number (0-100, how well this offer matches the user's profile),
  "title": string | null (job title),
  "description": string (compact description with only relevant info: skills, requirements, responsibilities. Omit generic text),
  "location": string | null (job location),
  "modality": "remote" | "hybrid" | "onsite" | null,
  "englishLevel": string | null (required English level, e.g. "basic", "intermediate", "advanced", "native", or null if not mentioned),
  "technologies": string[] (list of technologies, languages, frameworks mentioned),
  "posterName": string | null (who posted or shared the job on LinkedIn),
  "companyName": string | null (hiring company extracted from the description),
  "applicationEmail": string | null (application email if present),
  "applicationLink": string | null (application link if present)
}

All fields can be null if the information is not available in the offer. technologies must always be an array (can be empty). Do not fabricate URLs or emails. applicationLink and applicationEmail only if they appear verbatim in the post. Respond only with the JSON.`;

// Strip URLs, boilerplate (EEO), collapse whitespace
/** @param {string} text @returns {string} */
function stripBoilerplate(text) {
  return text
    .replace(REGEX_URLS, '')
    .replace(REGEX_BOILERPLATE, '')
    .replace(REGEX_WHITESPACE, ' ')
    .trim();
}

// Build user prompt with profile + truncated description
/** @param {string} profile @param {string} description @returns {string} */
function buildUserPrompt(profile, description) {
  const cleaned = stripBoilerplate(description);
  const truncated = cleaned.length > MAX_DESCRIPTION_CHARS
    ? cleaned.slice(0, MAX_DESCRIPTION_CHARS) + '...'
    : cleaned;
  return `User profile:\n${profile}\n\nJob description:\n${truncated}\n\nExtract and classify the offer. Respond only with JSON.`;
}

// Parse AI JSON response into structured result
/** @param {string} content @returns {Object|null} */
function parseResponse(content) {
  if (!content) return null;
  const trimmed = content.trim();
  const match = trimmed.match(REGEX_JSON_EXTRACT);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.relevant === 'boolean') {
      return {
        relevant: parsed.relevant,
        fitScore: typeof parsed.fitScore === 'number' ? Math.max(FIT_SCORE_MIN, Math.min(FIT_SCORE_MAX, parsed.fitScore)) : FIT_SCORE_DEFAULT,
        title: parsed.title || null,
        description: String(parsed.description || ''),
        location: parsed.location || null,
        modality: VALID_MODALITIES.includes(parsed.modality) ? parsed.modality : null,
        englishLevel: parsed.englishLevel || null,
        technologies: Array.isArray(parsed.technologies) ? parsed.technologies.filter(Boolean) : [],
        posterName: parsed.posterName || null,
        companyName: parsed.companyName || null,
        applicationEmail: parsed.applicationEmail || null,
        applicationLink: parsed.applicationLink || null,
        reason: String(parsed.reason || (parsed.relevant ? MATCHES_PROFILE : DOES_NOT_MATCH_PROFILE)).slice(0, REASON_MAX_LENGTH),
      };
    }
  } catch (e) {}
  return null;
}

// Promise race with timeout
/** @param {Promise} promise @param {number} ms @returns {Promise} */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(TIMEOUT_ERROR_MSG)), ms);
    promise.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

// Call OpenAI-compatible gateway via background worker (avoids mixed-content blocking)
/** @param {string} prompt @param {Object} config @returns {Promise<Object|null>} */
async function callGateway(prompt, config) {
  const url = config.gatewayUrl || DEFAULT_GATEWAY_URL;
  const model = config.model || DEFAULT_MODEL;
  const timeout = config.timeoutMs || DEFAULT_AI_TIMEOUT_MS;

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: AI_TEMPERATURE
  };
  const headers = {
    [HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
    [HEADER_AUTHORIZATION]: `${AUTH_SCHEME_BEARER}${config.apiKey || ''}`
  };

  const response = await withTimeout(new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'AI_FETCH', url, headers, body, timeout }, result => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  }), timeout).catch(err => {
    const msg = err.message;
    const hint = msg.includes('Failed to fetch') || msg.includes('Receiving end does not exist')
      ? 'background worker not ready or server unreachable — check host_permissions in manifest.json'
      : 'check API key & gateway URL';
    console.warn(`${LOG_PREFIX} AI fetch failed — ${hint}: ${msg}`);
    return null;
  });

  if (!response) return null;
  if (!response.ok) {
    console.warn(`${LOG_PREFIX} AI gateway ${response.status}: ${String(response.error || '').slice(0, REASON_MAX_LENGTH)}`);
    return null;
  }

  const data = response.data;
  if (!data) return null;
  const msg = data?.choices?.[0]?.message || {};
  const content = msg.content || msg.reasoning_content || '';
  return parseResponse(content);
}

// Process next queued AI request (max 1 concurrent)
/** @returns {void} */
function runNext() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  const job = queue.shift();
  active++;
  job().finally(() => {
    active--;
    runNext();
  });
}

// Add AI request to FIFO queue
/** @param {Function} fn @returns {Promise} */
function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try { resolve(await fn()); } catch (e) { reject(e); }
    });
    runNext();
  });
}

// Classify: session cache → inflight dedup → queue → gateway call
/** @param {string} description @param {string} hash @param {string} userProfile @param {Object} [config] @returns {Promise<Object>} */
export async function classifyWithAI(description, hash, userProfile, config = {}) {
  // Missing profile → skip AI. API key required only for non-local endpoints.
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(config.gatewayUrl || '');
  if (!description || !userProfile || (!config.apiKey && !isLocal)) {
    console.warn(`${LOG_PREFIX} AI: missing profile or apiKey, skipping AI filter.`);
    return { ...AI_UNAVAILABLE_RESULT, description };
  }

  // Return cached result if already classified
  if (sessionCache.has(hash)) {
    return { ...sessionCache.get(hash), cached: true };
  }

  // Dedup in-flight requests for same hash
  if (inflight.has(hash)) {
    return inflight.get(hash);
  }

  const promise = enqueue(async () => {
    const prompt = buildUserPrompt(userProfile, description);
    const result = await callGateway(prompt, config);
    if (!result) {
      return { ...AI_UNAVAILABLE_RESULT, description };
    }
    result.description = result.description || description;
    sessionCache.set(hash, result);
    return { ...result, cached: false };
  });

  inflight.set(hash, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(hash);
  }
}

// Clear all AI caches and queue
/** @returns {void} */
export function clearAICache() {
  sessionCache.clear();
  inflight.clear();
  queue.length = 0;
}
