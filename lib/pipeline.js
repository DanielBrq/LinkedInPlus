import { extractDescription, extractPostAge } from './parser.js';
import { hashText } from './utils.js';
import { classifyWithAI, clearAICache } from './aiFilter.js';
import {
  CSS_PENDING, MIN_DESCRIPTION_LENGTH, MAX_PROCESSED_HASHES,
  AI_UNAVAILABLE_REASON, AI_FAILED_REASON, NEGATIVE_PATTERNS,
} from './constants.js';

const POST_CONTAINER_SELECTOR = '[role="listitem"]';
const LOG_PREFIX = '[LinkedIn Collector]';
export const MSG_CONFIG_UPDATED = 'Classification config updated — re-scanning.';

const processedHashes = new Map();
let processGeneration = 0;
const queue = [];
let busy = false;

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    if (!busy) runQueue();
  });
}
async function runQueue() {
  busy = true;
  while (queue.length) {
    const { fn, resolve, reject } = queue.shift();
    try { resolve(await fn()); } catch (error) { reject(error); }
  }
  busy = false;
}

function hidePost(container) {
  const post = container.closest(POST_CONTAINER_SELECTOR) || container;
  post.style.display = 'none';
}

export function stopProcessing() {
  processGeneration++;
  for (const { resolve } of queue.splice(0)) resolve();
  clearAICache();
}

export function processContainer(container, context) {
  return enqueue(() => processContainerBody(container, context));
}

async function processContainerBody(container, { aiConfig }) {
  if (!container || !chrome.runtime?.id) return;
  const generation = processGeneration;
  try {
    const description = await extractDescription(container);
    if (!description) return;
    const hash = await hashText(description);
    if (processedHashes.has(hash)) return;
    processedHashes.set(hash, true);
    if (processedHashes.size > MAX_PROCESSED_HASHES) {
      processedHashes.delete(processedHashes.keys().next().value);
    }
    if (generation !== processGeneration) return;

    const post = container.closest(POST_CONTAINER_SELECTOR);
    const age = extractPostAge(container);
    if (NEGATIVE_PATTERNS.some(pattern => pattern.test(description)) ||
        (age && /[2-9]\d*mo/u.test(age)) ||
        description.length < MIN_DESCRIPTION_LENGTH) {
      hidePost(container);
      return;
    }

    post?.classList.add(CSS_PENDING);
    const result = await classifyWithAI(
      description, hash, aiConfig.filters, aiConfig.negativeFilters, aiConfig,
    );
    post?.classList.remove(CSS_PENDING);
    if (generation !== processGeneration) return;
    if ([AI_UNAVAILABLE_REASON, AI_FAILED_REASON].includes(result.reason)) return;

    if (result.fitScore < aiConfig.threshold) hidePost(container);
  } catch (error) {
    if (String(error?.message || error).includes('Extension context invalidated')) return;
    console.error(LOG_PREFIX, 'Processing error:', error);
  }
}

export function clearProcessedHashes() {
  processGeneration++;
  processedHashes.clear();
}
