import { REGEX_CONTROL_CHARS, REGEX_WHITESPACE, REGEX_ZERO_WIDTH } from '@/shared/constants'

export const DESCRIPTION_SELECTOR = '[data-testid="expandable-text-box"]'
const DESCRIPTION_SELECTORS = [
  'span[data-testid="expandable-text-box"]',
  DESCRIPTION_SELECTOR,
  '.jobs-description__content',
  '#job-details',
  '.jobs-search__job-details',
]
const EXPAND_BUTTON_SELECTOR =
  'button[aria-label*="see more" i], button[aria-label*="mostrar más" i], button[aria-label*="ver más" i], .jobs-description__footer-button, .jobs-description-content__footer-button'
const EXPAND_WAIT_MS = 200

export function normalizeText(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(REGEX_ZERO_WIDTH, '')
    .replace(REGEX_CONTROL_CHARS, ' ')
    .replace(REGEX_WHITESPACE, ' ')
    .trim()
}

function findDescriptionElement(root: ParentNode): Element | null {
  for (const selector of DESCRIPTION_SELECTORS) {
    const element = root.querySelector(selector)
    if (element) return element
  }
  return root instanceof Element && root.matches(DESCRIPTION_SELECTORS.join(', ')) ? root : null
}

export async function extractDescription(container: ParentNode): Promise<string | null> {
  const element = findDescriptionElement(container)
  if (!element) return null
  const expandButton = (element.parentElement ?? element).querySelector<HTMLElement>(EXPAND_BUTTON_SELECTOR)
  if ((expandButton?.offsetHeight ?? 0) > 0) {
    try {
      expandButton?.click()
    } catch {
      // A blocked synthetic click must not abort extraction.
    }
    await new Promise((resolve) => setTimeout(resolve, EXPAND_WAIT_MS))
  }
  const rawText = element instanceof HTMLElement ? element.innerText || element.textContent : element.textContent
  return normalizeText(rawText) || null
}
