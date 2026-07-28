import { extractDescription, extractPosterInfo, extractPosterProfileUrl, extractHashtags, extractLinks, extractPostAge } from './parser.js';
import { saveJob, hasJob } from './storage.js';
import { hashText } from './utils.js';
import { classifyWithAI } from './aiFilter.js';
import {
  CSS_REJECTED, CSS_PENDING, MIN_DESCRIPTION_LENGTH,
  MAX_PROCESSED_HASHES, AI_UNAVAILABLE_REASON, REGEX_LINKEDIN_SAFETY
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
];

const processedHashes = new Map();
// ponytail: global lock, per-account locks if throughput matters
const serialQueue = [];
let serialBusy = false;

function enqueueSerial(fn) {
  return new Promise((resolve, reject) => {
    serialQueue.push(async () => {
      try { resolve(await fn()); } catch (e) { reject(e); }
    });
    if (!serialBusy) runSerial();
  });
}

async function runSerial() {
  serialBusy = true;
  while (serialQueue.length) {
    await serialQueue.shift()();
  }
  serialBusy = false;
}

// Hide post: mark as rejected, then fade out after delay
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

// Click "Not interested" menu item on the post
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

// Check if extension context is still alive
/** @returns {boolean} */
function isExtensionValid() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

// Main: extract, pre-filter, classify, save or hide
/** @param {Element} container @param {Object} context @returns {Promise<void>} */
export async function processContainer(container, context) {
  if (!container || !isExtensionValid()) return;
  const { saveMatchesEnabled } = context;
  const body = () => processContainerBody(container, context);
  return saveMatchesEnabled ? enqueueSerial(body) : body();
}

async function processContainerBody(container, context) {
  if (!container || !isExtensionValid()) return;
  const {
    displayConfig, notInterestedEnabled, saveMatchesEnabled,
    hideNonRelevantEnabled, aiConfig
  } = context;

  try {
    // Extract & normalize description text
    const description = await extractDescription(container);
    if (!description) return;

    const posterName = extractPosterInfo(container) || null;
    const hashtags = extractHashtags(container) || [];
    const links = extractLinks(container) || [];
    const cleanLinks = links.filter(l => !REGEX_LINKEDIN_SAFETY.test(l));
    const posterProfileUrl = extractPosterProfileUrl(container) || null;
    const hash = await hashText(description);

    // Dedup: skip if already processed
    if (processedHashes.has(hash)) return;
    processedHashes.set(hash, true);
    // Evict oldest if map exceeds limit
    if (processedHashes.size > MAX_PROCESSED_HASHES) {
      const first = processedHashes.keys().next().value;
      processedHashes.delete(first);
    }

    if (!isExtensionValid()) return;
    // Skip if already saved in storage
    const exists = await hasJob(hash);
    if (exists) return;

    const post = container.closest(POST_CONTAINER_SELECTOR);

    // Pre-filter: negative patterns (e.g. #opentowork)
    if (NEGATIVE_PATTERNS.some(re => re.test(description))) {
      await clickNotInterested(post, notInterestedEnabled);
      if (hideNonRelevantEnabled) hidePost(container, displayConfig);
      return;
    }

    // Pre-filter: too old (1+ month, LinkedIn uses 'mo' label)
    const postAge = extractPostAge(container);
    if (postAge && /\d+mo/u.test(postAge)) {
      await clickNotInterested(post, notInterestedEnabled);
      if (hideNonRelevantEnabled) hidePost(container, displayConfig);
      return;
    }

    // Pre-filter: too short to be a real job post
    if (description.length < MIN_DESCRIPTION_LENGTH) {
      await clickNotInterested(post, notInterestedEnabled);
      if (hideNonRelevantEnabled) hidePost(container, displayConfig);
      return;
    }

    // Mark as pending while AI classifies
    if (post) post.classList.add(CSS_PENDING);
    let result;
    try {
      result = await classifyWithAI(description, hash, aiConfig.filters, aiConfig.negativeFilters, aiConfig, cleanLinks);
    } catch (e) {
      console.error(LOG_PREFIX, ERR_AI_CLASSIFICATION, e);
      if (post) post.classList.remove(CSS_PENDING);
      return;
    }
    if (post) post.classList.remove(CSS_PENDING);

    // AI unavailable → leave visible
    if (result.reason === AI_UNAVAILABLE_REASON) {
      console.warn(LOG_PREFIX, MSG_AI_UNAVAILABLE);
      return;
    }

    // Validate applicationLink: discard if AI invented it
    if (result.applicationLink && !cleanLinks.includes(result.applicationLink)) {
      result.applicationLink = null;
    }

    // Validate location against locationFilter (plain text, case-insensitive)
    if (result.relevant && aiConfig.locationFilter) {
      const locFilter = aiConfig.locationFilter.trim();
      const locStr = (result.location || '').toLowerCase();
      const terms = locFilter.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const matches = terms.length === 0 || terms.some(t => locStr.includes(t));
      if (!matches) {
        result.relevant = false;
      }
    }

    // Fallback to poster profile link if no application link/email
    if (!result.applicationLink && !result.applicationEmail && posterProfileUrl) {
      result.applicationLink = posterProfileUrl;
    }

    // Not relevant → hide
    if (!result.relevant) {
      await clickNotInterested(post, notInterestedEnabled);
      if (hideNonRelevantEnabled) hidePost(container, displayConfig);
      return;
    }

    // Relevant match → outline + save
    if (post) post.style.outline = MATCHED_OUTLINE;
    if (saveMatchesEnabled) {
      const saved = await saveJob({ ...result, posterName: posterName || result.posterName || null, posterProfileUrl, hashtags });
      if (saved.saved) {
        console.log(`${LOG_PREFIX} Saved (${result.fitScore}% fit). ${result.reason || ''}`);
      }
    }
  } catch (e) {
    if (String(e.message || e).includes(ERR_CONTEXT_INVALIDATED)) return;
    console.error(LOG_PREFIX, ERR_PROCESSING, e);
  }
}

// Clear session dedup cache
/** @returns {void} */
export function clearProcessedHashes() {
  processedHashes.clear();
}
