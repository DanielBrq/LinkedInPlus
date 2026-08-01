import { extractDescription, extractPosterInfo, extractPosterProfileUrl, extractHashtags, extractLinks, extractPostAge } from './parser.js';
import { saveJob, hasJob } from './storage.js';
import { hashText } from './utils.js';
import { classifyWithAI, clearAICache } from './aiFilter.js';
import { saveEnabled } from './settings.js';
import {
  CSS_REJECTED, CSS_PENDING, CSS_MATCHED, CSS_HIDDEN, MIN_DESCRIPTION_LENGTH,
  MAX_PROCESSED_HASHES, AI_UNAVAILABLE_REASON, AI_FAILED_REASON, REGEX_LINKEDIN_OMIT_LINKS, NEGATIVE_PATTERNS
} from './constants.js';

const POST_CONTAINER_SELECTOR = '[role="listitem"]';
const LOG_PREFIX = '[LinkedIn Collector]';
const ERR_CONTEXT_INVALIDATED = 'Extension context invalidated';
const CONFIRMATION_SELECTOR = '[componentkey^="feed.confirmation"]';
const COLLAPSE_POLL_MS = 50;
const COLLAPSE_POLL_MAX = 20;

export const MSG_CONFIG_UPDATED = 'AI config updated — re-scanning.';
const MSG_AI_UNAVAILABLE = 'AI unavailable — leaving post visible.';
const ERR_AI_CLASSIFICATION = 'AI classification error:';
const ERR_PROCESSING = 'Processing error:';

const processedHashes = new Map();
let processGeneration = 0; // H4: generation counter to prevent race on clearProcessedHashes
// ponytail: global lock, per-account locks if throughput matters
const serialQueue = [];
let serialBusy = false;

function enqueueSerial(fn) {
  return new Promise((resolve, reject) => {
    serialQueue.push({ fn, resolve, reject });
    if (!serialBusy) runSerial();
  });
}

async function runSerial() {
  serialBusy = true;
  while (serialQueue.length) {
    const { fn, resolve, reject } = serialQueue.shift();
    try { resolve(await fn()); } catch (e) { reject(e); }
  }
  serialBusy = false;
}

// Halt all pending processing — called on disable.
// Drops queued containers + queued AI, aborts in-flight via generation bump.
/** @returns {void} */
export function stopProcessing() {
  processGeneration++;
  for (const { resolve } of serialQueue.splice(0)) resolve();
  clearAICache();
}

// Hide post: mark as rejected, then fade out after delay.
// After a "Not interested" click LinkedIn may have replaced the post with its
// confirmation banner; if the original node is gone, hide that instead.
/** @param {Element} container @param {Object} cfg @returns {void} */
function hidePost(container, cfg) {
  let post = container.closest(POST_CONTAINER_SELECTOR) || container;
  if (typeof document !== 'undefined' && !document.contains(post)) {
    const conf = document.querySelector(CONFIRMATION_SELECTOR);
    // ponytail: first-match confirmation; the serial queue makes multiple dismissals rare
    post = conf?.closest(POST_CONTAINER_SELECTOR) || conf || post;
  }
  post.classList.add(CSS_HIDDEN);
  if (cfg.debugMode) {
    post.classList.add(CSS_REJECTED);
    if (cfg.hideDelay > 0) {
      setTimeout(() => { post.style.display = 'none'; }, cfg.hideDelay);
      return;
    }
  }
  post.style.display = 'none';
}

// Click "Not interested" menu item on the post, then wait for LinkedIn to
// collapse it so hidePost runs against the post-collapse DOM.
/** @param {Element|null} post @param {boolean} enabled @returns {Promise<boolean>} */
async function clickNotInterested(post, enabled) {
  if (!post || !enabled) return false;
  const btn = post.querySelector('button[aria-label*="control menu" i], button[aria-label*="menú" i], button[aria-label*="Más opciones"], button[aria-label*="Más acciones"]');
  if (!btn) return false;
  btn.click();
  await new Promise(r => setTimeout(r, 200));
  for (const item of document.querySelectorAll('[role="menuitem"]')) {
    if (/not interested|no me interesa|no es relevante|no tengo interés/i.test(item.textContent)) {
      item.click();
      for (let i = 0; i < COLLAPSE_POLL_MAX; i++) {
        const listitem = post.closest(POST_CONTAINER_SELECTOR) || post;
        if (!document.contains(post) || listitem.querySelector(CONFIRMATION_SELECTOR)) return true;
        await new Promise(r => setTimeout(r, COLLAPSE_POLL_MS));
      }
      return false;
    }
  }
  return false;
}

// Check if extension context is still alive
/** @returns {boolean} */
function isExtensionValid() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

// ── Extracted helpers from processContainerBody (H7: SRP) ──

/** @returns {Promise<boolean>} true if filtered out */
async function applyPreFilters(container, description, notInterestedEnabled, hideNonRelevantEnabled, displayConfig) {
  const post = container.closest(POST_CONTAINER_SELECTOR);
  if (NEGATIVE_PATTERNS.some(re => re.test(description))) {
    if (displayConfig.debugMode) console.log(`${LOG_PREFIX} Pre-filter: negative pattern matched, hiding post`);
    await clickNotInterested(post, notInterestedEnabled);
    if (hideNonRelevantEnabled) hidePost(container, displayConfig);
    return true;
  }
  const postAge = extractPostAge(container);
  if (postAge && /[2-9]\d*mo/u.test(postAge)) {
    if (displayConfig.debugMode) console.log(`${LOG_PREFIX} Pre-filter: post age ${postAge}, hiding post`);
    await clickNotInterested(post, notInterestedEnabled);
    if (hideNonRelevantEnabled) hidePost(container, displayConfig);
    return true;
  }
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    if (displayConfig.debugMode) console.log(`${LOG_PREFIX} Pre-filter: description too short (${description.length} chars), hiding post`);
    await clickNotInterested(post, notInterestedEnabled);
    if (hideNonRelevantEnabled) hidePost(container, displayConfig);
    return true;
  }
  return false;
}

function applyLocationFilter(result, locationFilter) {
  if (!result.relevant || !locationFilter) return;
  const locStr = (result.location || '').toLowerCase();
  const terms = locationFilter.trim().split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  if (terms.length > 0 && !terms.some(t => locStr.includes(t))) {
    result.relevant = false;
  }
}

function applyNegativeFilter(result, description, negativeFilters, debugMode) {
  if (!result.relevant || !negativeFilters) return;
  const rawTerms = negativeFilters.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const negTerms = rawTerms.flatMap(t => t.split(/\s+\bor\b\s+/i)).map(s => s.trim()).filter(Boolean);
  const descLower = description.toLowerCase();
  const NEGATION_RE = /(?:^|(?<=\s))(?:no|sin|without|not|no es|no son)\s+/i;
  const matched = [];
  for (const term of negTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const termRe = new RegExp(escaped, 'gi');
    for (const m of descLower.matchAll(termRe)) {
      if (!NEGATION_RE.test(descLower.slice(0, m.index))) {
        matched.push(term);
        break;
      }
    }
  }
  if (matched.length > 0) {
    const penalty = matched.length * 20;
    result.fitScore = Math.max(0, result.fitScore - penalty);
    if (debugMode) {
      console.log(`${LOG_PREFIX} Negative filter penalty -${penalty} for [${matched.join(', ')}], final score ${result.fitScore}`);
    }
  }
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
  const generation = processGeneration;
  const {
    displayConfig, notInterestedEnabled, saveMatchesEnabled,
    hideNonRelevantEnabled, aiConfig
  } = context;

  try {
    const description = await extractDescription(container);
    if (!description) return;

    const posterName = extractPosterInfo(container) || null;
    const hashtags = extractHashtags(container) || [];
    const links = extractLinks(container) || [];
    const cleanLinks = links.filter(l => !REGEX_LINKEDIN_OMIT_LINKS.test(l));
    const posterProfileUrl = extractPosterProfileUrl(container) || null;
    const hash = await hashText(description);

    // Dedup
    if (processedHashes.has(hash)) return;
    processedHashes.set(hash, true);
    if (processedHashes.size > MAX_PROCESSED_HASHES) {
      const first = processedHashes.keys().next().value;
      processedHashes.delete(first);
    }

    if (!isExtensionValid()) return;
    if (await hasJob(hash)) return;

    if (generation !== processGeneration) return; // H4: disabled → stop dead

    // Pre-filters
    const filtered = await applyPreFilters(container, description, notInterestedEnabled, hideNonRelevantEnabled, displayConfig);
    if (filtered) return;

    // AI Classification
    const post = container.closest(POST_CONTAINER_SELECTOR);
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

    if (generation !== processGeneration) return; // H4: generation changed → abort

    if (result.reason === AI_FAILED_REASON) return;
    if (result.reason === AI_UNAVAILABLE_REASON) {
      console.warn(LOG_PREFIX, MSG_AI_UNAVAILABLE);
      await saveEnabled(false);
      return;
    }

    // Post-processing
    if (result.applicationLink && !cleanLinks.includes(result.applicationLink)) {
      result.applicationLink = null;
    }
    applyLocationFilter(result, aiConfig.locationFilter);
    applyNegativeFilter(result, description, aiConfig.negativeFilters, displayConfig.debugMode);

    if (!result.applicationLink && !result.applicationEmail && posterProfileUrl) {
      result.applicationLink = posterProfileUrl;
    }

    if (!result.relevant) {
      await clickNotInterested(post, notInterestedEnabled);
      if (hideNonRelevantEnabled) hidePost(container, displayConfig);
      return;
    }

    // Relevant match
    if (post) post.classList.add(CSS_MATCHED);
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
  processGeneration++;
  processedHashes.clear();
}
