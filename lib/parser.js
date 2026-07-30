import {
  REGEX_ZERO_WIDTH, REGEX_CONTROL_CHARS, REGEX_WHITESPACE
} from './constants.js';

const EXPAND_BUTTON_SELECTORS = [
  'button[aria-label*="see more" i]',
  'button[aria-label*="mostrar más" i]',
  'button[aria-label*="ver más" i]',
  '.jobs-description__footer-button',
  '.jobs-description-content__footer-button',
  '[data-testid="expandable-text-box"] button',
].join(', ');

const DESCRIPTION_SELECTORS = [
  'span[data-testid="expandable-text-box"]',
  '[data-testid="expandable-text-box"]',
  '.jobs-description__content',
  '#job-details',
  '.jobs-search__job-details'
];

const POSTER_CONTAINER_SELECTORS = [
  '[role="listitem"]',
  'article',
  '.job-card-container',
  '.jobs-unified-top-card',
].join(', ');

const POSTER_INFO_SELECTORS = [
  '.update-components-actor__name',
  '.feed-shared-actor__name',
  '.feed-shared-actor__title',
  '.update-components-actor__sub-description',
  '.job-card-list__company-name',
  '.job-card-container__company-name',
  '.job-card-container__primary-description',
  '.jobs-unified-top-card__company-name',
  '.jobs-unified-top-card__subtitle-primary-grouping',
  '.jobs-company__company-name',
  '.artdeco-entity-lockup__title',
  '.t-14.t-bold',
  '.feed-shared-update-v2__actor-content .t-14',
  '[data-anonymize="company-name"]',
  '[data-anonymize="person-name"]',
];

// Normalize: lowercase, strip zero-width / control chars, collapse whitespace
/** @param {string} rawText @returns {string} */
export function normalizeText(rawText) {
  if (!rawText) return '';
  return rawText
    .toLowerCase()
    .replace(REGEX_ZERO_WIDTH, '')
    .replace(REGEX_CONTROL_CHARS, ' ')
    .replace(REGEX_WHITESPACE, ' ')
    .trim();
}

// Click "See more" button if description is truncated, then wait for React re-render
/** @param {Element} [container] @returns {Promise<void>} */
export async function expandDescription(container = document) {
  const btn = container.querySelector(EXPAND_BUTTON_SELECTORS);
  if (btn && btn.offsetHeight > 0) {
    try { btn.click(); } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
}

function findDescriptionElement(root) {
  root = root || document;
  for (const selector of DESCRIPTION_SELECTORS) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  if (root.matches && DESCRIPTION_SELECTORS.some(s => root.matches(s))) return root;
  return null;
}

// Find description element by selectors, expand, extract, normalize
/** @param {Element} [targetContainer] @returns {Promise<string|null>} */
export async function extractDescription(targetContainer) {
  const element = findDescriptionElement(targetContainer);
  if (!element) return null;

  await expandDescription(element.parentElement || element);

  const rawText = element.innerText || element.textContent || '';
  const normalized = normalizeText(rawText);

  return normalized.length > 0 ? normalized : null;
}

// Extract unique hashtags from description
/** @param {Element} [targetContainer] @returns {string[]} */
export function extractHashtags(targetContainer) {
  const element = findDescriptionElement(targetContainer);
  if (!element) return [];
  const rawText = element.innerText || element.textContent || '';
  const tags = rawText.match(/#\w+/g) || [];
  return [...new Set(tags)];
}

// Extract href links from <a> tags inside the description element
/** @param {Element} [targetContainer] @returns {string[]} */
export function extractLinks(targetContainer) {
  const element = findDescriptionElement(targetContainer);
  if (!element || typeof element.querySelectorAll !== 'function') return [];
  const urls = [];
  for (const a of element.querySelectorAll('a[href]')) {
    try {
      const href = a.href;
      if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
        urls.push(href);
      }
    } catch (e) { /* ignore cross-origin or invalid href */ }
  }
  return [...new Set(urls)];
}

// Find poster/company name near the container
/** @param {Element} container @returns {string|null} */
export function extractPosterInfo(container) {
  const post = container.closest(POSTER_CONTAINER_SELECTORS);
  if (!post) return null;

  for (const selector of POSTER_INFO_SELECTORS) {
    const el = post.querySelector(selector);
    if (el && el.textContent.trim().length > 1) {
      return el.textContent.trim();
    }
  }

  return null;
}

// Extract post age from LinkedIn timestamp <span> (e.g. '1mo', '2w', '1 mes', '2 meses')
/** @param {Element} container @returns {string|null} */
export function extractPostAge(container) {
  const post = container.closest(POSTER_CONTAINER_SELECTORS);
  if (!post) return null;

  // ponytail: scan short-text elements for LinkedIn age label, no fragile class selectors
  for (const el of post.querySelectorAll('span, time')) {
    const text = el.textContent.trim().toLowerCase();
    if (text.length > 0 && text.length < 16) {
      const match = text.match(/\d+\s*(mo|mes|meses|w|sem|semanas?|d|días?|dias?|h|horas?)\b/);
      if (match) {
        const num = parseInt(match[0], 10);
        const unit = match[1];
        if (/^mes/.test(unit)) return `${num}mo`;
        if (/^sem/.test(unit)) return `${num}w`;
        if (/^d/.test(unit)) return `${num}d`;
        if (/^h/.test(unit)) return `${num}h`;
        return match[0];
      }
    }
  }

  return null;
}

// Find poster's LinkedIn profile URL near the container
/** @param {Element} container @returns {string|null} */
export function extractPosterProfileUrl(container) {
  const post = container.closest(POSTER_CONTAINER_SELECTORS);
  if (!post) return null;

  const selectors = [
    'a[href*="/in/"][href^="https://www.linkedin.com"]',
    '.update-components-actor a[href*="/in/"]',
    '.feed-shared-actor a[href*="/in/"]',
    'a[href*="/company/"][href^="https://www.linkedin.com"]',
  ];
  for (const selector of selectors) {
    const el = post.querySelector(selector);
    if (el && el.href) return el.href;
  }
  return null;
}
