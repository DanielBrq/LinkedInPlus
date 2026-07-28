import { extractDescription, extractPosterInfo, extractHashtags } from './parser.js';
import { saveJob, hasJob } from './storage.js';
import { hashText } from './utils.js';
import { classifyWithAI } from './aiFilter.js';
import {
  CSS_REJECTED, CSS_PENDING, MIN_DESCRIPTION_LENGTH,
  MAX_PROCESSED_HASHES, AI_UNAVAILABLE_REASON
} from './constants.js';

const POST_CONTAINER_SELECTOR = '[role="listitem"]';
const MATCHED_OUTLINE = '2px solid #0a8754';
const LOG_PREFIX = '[LinkedIn Collector]';
const ERR_CONTEXT_INVALIDATED = 'Extension context invalidated';

export const MSG_CONFIG_UPDATED = 'AI config updated — re-scanning.';
const MSG_AI_UNAVAILABLE = 'AI unavailable — leaving post visible.';
const ERR_AI_CLASSIFICATION = 'AI classification error:';
const ERR_PROCESSING = 'Processing error:';

const NEGATIVE_PATTERNS = [
  /#opentowork/i,
  /like this post|me gusta esta publicación/i,
  /share if|comparte si/i,
  /follow for more|sígueme/i,
  /comment below|comenta abajo|deja tu comentario/i,
  /what are your thoughts|qué opinas/i,
  /\bpoll\b|encuesta/i,
  /this is not a job posting|esta no es una oferta/i,
];

const processedHashes = new Map();

/** @param {Element} container @param {Object} cfg @returns {void} */
function hidePost(container, cfg) {
  const post = container.closest(POST_CONTAINER_SELECTOR) || container;
  if (cfg.debugMode) {
    post.classList.add(CSS_REJECTED);
    if (cfg.hideDelay > 0) {
      setTimeout(() => { post.style.display = 'none'; }, cfg.hideDelay);
      return;
    }
  }
  post.style.display = 'none';
}

/** @param {Element|null} post @param {boolean} enabled @returns {Promise<void>} */
async function clickNotInterested(post, enabled) {
  if (!post || !enabled) return;
  const btn = post.querySelector('button[aria-label*="Open control menu"]');
  if (!btn) return;
  btn.click();
  await new Promise(r => setTimeout(r, 200));
  for (const item of document.querySelectorAll('div[role="menuitem"]')) {
    if (/not interested|no me interesa/i.test(item.textContent)) {
      item.click();
      break;
    }
  }
}

/** @returns {boolean} */
function isExtensionValid() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

/** @param {Element} container @param {Object} context @returns {Promise<void>} */
export async function processContainer(container, context) {
  if (!container || !isExtensionValid()) return;
  const {
    displayConfig, notInterestedEnabled, saveMatchesEnabled,
    hideNonRelevantEnabled, aiConfig
  } = context;

  try {
    const description = extractDescription(container);
    if (!description) return;

    const posterName = extractPosterInfo(container) || null;
    const hashtags = extractHashtags(container) || [];
    const hash = await hashText(description);

    if (processedHashes.has(hash)) return;
    processedHashes.set(hash, true);
    if (processedHashes.size > MAX_PROCESSED_HASHES) {
      const first = processedHashes.keys().next().value;
      processedHashes.delete(first);
    }

    if (!isExtensionValid()) return;
    const exists = await hasJob(hash);
    if (exists) return;

    const post = container.closest(POST_CONTAINER_SELECTOR);

    if (NEGATIVE_PATTERNS.some(re => re.test(description))) {
      await clickNotInterested(post, notInterestedEnabled);
      if (hideNonRelevantEnabled) hidePost(container, displayConfig);
      return;
    }

    if (description.length < MIN_DESCRIPTION_LENGTH) {
      await clickNotInterested(post, notInterestedEnabled);
      if (hideNonRelevantEnabled) hidePost(container, displayConfig);
      return;
    }

    if (post) post.classList.add(CSS_PENDING);
    let result;
    try {
      result = await classifyWithAI(description, hash, aiConfig.userProfile, aiConfig);
    } catch (e) {
      console.error(LOG_PREFIX, ERR_AI_CLASSIFICATION, e);
      if (post) post.classList.remove(CSS_PENDING);
      return;
    }
    if (post) post.classList.remove(CSS_PENDING);

    if (result.reason === AI_UNAVAILABLE_REASON) {
      console.warn(LOG_PREFIX, MSG_AI_UNAVAILABLE);
      return;
    }

    if (!result.relevant) {
      await clickNotInterested(post, notInterestedEnabled);
      if (hideNonRelevantEnabled) hidePost(container, displayConfig);
      return;
    }

    if (post) post.style.outline = MATCHED_OUTLINE;
    if (saveMatchesEnabled) {
      const saved = await saveJob({ ...result, posterName: posterName || result.posterName || null, hashtags });
      if (saved.saved) {
        console.log(`${LOG_PREFIX} Saved (${result.fitScore}% fit). ${result.reason || ''}`);
      }
    }
  } catch (e) {
    if (String(e.message || e).includes(ERR_CONTEXT_INVALIDATED)) return;
    console.error(LOG_PREFIX, ERR_PROCESSING, e);
  }
}

/** @returns {void} */
export function clearProcessedHashes() {
  processedHashes.clear();
}
