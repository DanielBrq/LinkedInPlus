import {
  DEFAULT_GATEWAY_URL, DEFAULT_MODEL, DEFAULT_AI_TIMEOUT_MS,
  AI_TEMPERATURE, MAX_DESCRIPTION_CHARS, LOG_PREFIX,
  REGEX_BOILERPLATE, REGEX_JSON_EXTRACT, REGEX_WHITESPACE, REGEX_URLS,
  VALID_MODALITIES, FIT_SCORE_MIN, FIT_SCORE_MAX, FIT_SCORE_DEFAULT,
  AI_UNAVAILABLE_REASON, AI_FAILED_REASON, REGEX_ZERO_WIDTH, REGEX_CONTROL_CHARS,
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
const AI_FAILED_RESULT = { ...AI_UNAVAILABLE_RESULT, reason: AI_FAILED_REASON };

const sessionCache = new Map();
const inflight = new Map();
const queue = [];
let active = 0;

const SYSTEM_PROMPT = `You are a job-post classifier. Output ONLY valid JSON. No explanation, no markdown, no reasoning, no extra words.

Be maximally terse. Short phrases only. No full sentences. No filler words (very, really, that, which, in order to). 
Every field value should be as few words as possible while staying accurate.

ZERO FABRICATION RULE — Every extracted field (title, location, modality, technologies, companyName, etc.) MUST come exclusively from the job description text below. NEVER use the user preferences section as a data source. If a field is not mentioned in the job description, return null (or empty array for technologies). Never assume, infer, or copy values from the user preferences. Only include items that are explicitly stated in the job description.

Rules (apply in order):
1. Person seeking work (not hiring) -> relevant=false
2. Not a job offer (news/opinion/ad/networking) -> relevant=false
3. General career advice or tips -> relevant=false
4. LinkedIn engagement bait (like, share, comment) -> relevant=false
5. If the job description REQUIRES (mandatory, not optional/nice-to-have) a technology from the Negative preferences list, subtract 20 from fitScore per such technology (minimum 0). Do NOT change relevant — only penalize fitScore. If a negative technology is listed as "nice to have", "plus", "optional", or "desirable", ignore it and continue scoring.
6. Score fit 0-100 based on how well the job matches the User preferences: technology overlap, role/seniority level, modality, and location.
7. relevant=true if fitScore>=50 AND the post is clearly a job offer.

{
  "relevant": boolean,
  "fitScore": number (0-100),
  "title": string | null (job title, extracted from description),
  "location": string | null (job location, extracted ONLY from description. null if not mentioned. Do NOT infer from user preferences),
  "modality": "remote" | "hybrid" | "onsite" | null,
  "englishLevel": string | null,
  "technologies": string[] (technologies, languages, frameworks mentioned ONLY in the job description text. NEVER from user preferences. Empty array [] if none mentioned),
  "posterName": string | null (who posted or shared the job on LinkedIn),
  "companyName": string | null (hiring company extracted from the description),
  "applicationEmail": string | null (application email if present),
  "applicationLink": string | null (application link if present)
}

All fields can be null if the information is not available in the offer. technologies must always be an array (can be empty). For applicationLink and applicationEmail, pick from the links listed below the description if any match, otherwise null. Do not invent URLs or emails. Respond only with the JSON.`;

// Strip boilerplate (EEO), collapse whitespace
/** @param {string} text @returns {string} */
function stripBoilerplate(text) {
  return text
    .replace(REGEX_URLS, '')
    .replace(REGEX_BOILERPLATE, '')
    .replace(REGEX_WHITESPACE, ' ')
    .trim();
}

// Build user prompt with filters, negative filters, post links + truncated description
/** @param {string} filters @param {string} negativeFilters @param {string} description @param {string[]} [postLinks] @returns {string} */
function buildUserPrompt(filters, negativeFilters, description, postLinks = []) {
  const cleaned = stripBoilerplate(description);
  const TAIL_KEEP = 2000;
  const truncated = cleaned.length > MAX_DESCRIPTION_CHARS
    ? cleaned.slice(0, MAX_DESCRIPTION_CHARS - TAIL_KEEP) + '\n...[truncated]...\n' + cleaned.slice(-TAIL_KEEP)
    : cleaned;
  let prompt = `User preferences (for relevance scoring only — do NOT extract data from this section):\n${filters}\n`;
  if (negativeFilters) {
    prompt += `\nNegative preferences (for relevance scoring only):\n${negativeFilters}\n`;
  }
  prompt += `\nJob description (extract ALL field values from this section ONLY):\n${truncated}\n`;
  if (postLinks.length > 0) {
    prompt += `\nLinks found in this post:\n${postLinks.join('\n')}\n`;
  }
  prompt += `\nClassify the job offer above. All extracted fields must come from the job description only. Respond only with JSON.`;
  return prompt;
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
      const rawScore = parsed.fitScore;
      const numScore = rawScore == null ? NaN : Number(rawScore);
      const fitScore = !isNaN(numScore) ? Math.max(FIT_SCORE_MIN, Math.min(FIT_SCORE_MAX, numScore)) : FIT_SCORE_DEFAULT;
      return {
        relevant: parsed.relevant === true,
        fitScore,
        title: parsed.title || null,
        location: parsed.location || null,
        modality: VALID_MODALITIES.includes(parsed.modality) ? parsed.modality : null,
        englishLevel: parsed.englishLevel || null,
        technologies: Array.isArray(parsed.technologies) ? parsed.technologies.filter(Boolean) : [],
        posterName: parsed.posterName || null,
        companyName: parsed.companyName || null,
        applicationEmail: parsed.applicationEmail || null,
        applicationLink: parsed.applicationLink || null,
        reason: String(parsed.reason || (fitScore >= 50 ? MATCHES_PROFILE : DOES_NOT_MATCH_PROFILE)).slice(0, REASON_MAX_LENGTH),
      };
    }
  } catch (e) { }
  return null;
}

// Call OpenAI-compatible gateway via background worker (avoids mixed-content blocking)
/** @param {string} prompt @param {Object} config @returns {Promise<Object|null>} */
async function callGateway(prompt, config) {
  const url = config.gatewayUrl || DEFAULT_GATEWAY_URL;
  const model = config.model || DEFAULT_MODEL;
  const timeout = Number(config.timeoutMs) || DEFAULT_AI_TIMEOUT_MS;

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: AI_TEMPERATURE
  };

  const response = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(TIMEOUT_ERROR_MSG)), timeout);
    chrome.runtime.sendMessage({ type: 'AI_FETCH', url, body, timeout }, result => {
      clearTimeout(t);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  }).catch(err => {
    const msg = err.message;
    const hint = msg.includes('Failed to fetch') || msg.includes('Receiving end does not exist')
      ? 'background worker not ready or server unreachable — check host_permissions in manifest.json'
      : 'check API key & gateway URL';
    console.warn(`${LOG_PREFIX} AI fetch failed — ${hint}: ${msg}`);
    return null;
  });

  if (!response) return null;
  if (!response.ok) {
    const errMsg = String(response.error || '').slice(0, REASON_MAX_LENGTH);
    console.warn(`${LOG_PREFIX} AI gateway ${response.status}: ${errMsg}`);
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

// Strip technologies not present in the description text — returns new object, no mutation
/** @param {Object} result @param {string} description @returns {Object} */
function sanitizeResult(result, description) {
  if (!result || !description) return result;
  const descLower = description.toLowerCase();
  const out = { ...result };
  // Filter technologies: keep only those explicitly mentioned in the description
  if (Array.isArray(out.technologies)) {
    out.technologies = out.technologies.filter(tech =>
      descLower.includes(String(tech).toLowerCase())
    );
  }
  // Nullify location if not mentioned in the description
  if (out.location) {
    const locLower = String(out.location).toLowerCase();
    if (!descLower.includes(locLower)) {
      out.location = null;
    }
  }
  return out;
}

// Classify: session cache → inflight dedup → queue → gateway call
/** @param {string} description @param {string} hash @param {string} filters @param {string} negativeFilters @param {Object} [config] @param {string[]} [postLinks] @returns {Promise<Object>} */
export async function classifyWithAI(description, hash, filters, negativeFilters = '', config = {}, postLinks = []) {
  // Missing filters → skip AI. API key required only for non-local endpoints.
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(config.gatewayUrl || '');
  if (!description || !filters || (!config.apiKey && !isLocal)) {
    console.warn(`${LOG_PREFIX} AI: missing filters or apiKey, skipping AI filter.`);
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
    const prompt = buildUserPrompt(filters, negativeFilters, description, postLinks);
    const result = await callGateway(prompt, config);
    if (!result) {
return { ...AI_FAILED_RESULT, description };
    }
    // Normalize description directly from input (AI never returns description)
    const normalizedDesc = description
      .replace(REGEX_ZERO_WIDTH, '')
      .replace(REGEX_CONTROL_CHARS, ' ')
      .replace(REGEX_WHITESPACE, ' ')
      .trim();
    result.description = normalizedDesc;
    const sanitized = sanitizeResult(result, normalizedDesc);
    sessionCache.set(hash, { ...sanitized });
    return { ...sanitized, cached: false };
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
