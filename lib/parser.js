import { REGEX_ZERO_WIDTH, REGEX_CONTROL_CHARS, REGEX_WHITESPACE } from './constants.js';

export const DESCRIPTION_SELECTOR = '[data-testid="expandable-text-box"]';
const DESCRIPTION_SELECTORS = [
  'span[data-testid="expandable-text-box"]',
  DESCRIPTION_SELECTOR,
  '.jobs-description__content',
  '#job-details',
  '.jobs-search__job-details',
];
export function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(REGEX_ZERO_WIDTH, '')
    .replace(REGEX_CONTROL_CHARS, ' ')
    .replace(REGEX_WHITESPACE, ' ')
    .trim();
}

function findDescriptionElement(root = document) {
  for (const selector of DESCRIPTION_SELECTORS) {
    const element = root.querySelector(selector);
    if (element) return element;
  }
  return root.matches?.(DESCRIPTION_SELECTORS.join(', ')) ? root : null;
}

export async function extractDescription(container) {
  const element = findDescriptionElement(container);
  if (!element) return null;
  const expandButton = (element.parentElement || element).querySelector(
    'button[aria-label*="see more" i], button[aria-label*="mostrar más" i], button[aria-label*="ver más" i], .jobs-description__footer-button, .jobs-description-content__footer-button',
  );
  if (expandButton?.offsetHeight > 0) {
    try { expandButton.click(); } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const text = normalizeText(element.innerText || element.textContent);
  return text || null;
}
