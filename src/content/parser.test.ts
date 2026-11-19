import { describe, expect, it } from 'vitest'
import { extractDescription } from './parser'

describe('extractDescription', () => {
  it('returns null when the container has no description node', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>unrelated</p>'
    expect(await extractDescription(container)).toBeNull()
  })

  it('normalizes the matched description text', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<span data-testid="expandable-text-box">  Hello\u200B\nWorld  </span>'
    expect(await extractDescription(container)).toBe('hello world')
  })

  it('uses the container itself when it matches a description selector', async () => {
    const container = document.createElement('span')
    container.setAttribute('data-testid', 'expandable-text-box')
    container.textContent = 'Direct match'
    expect(await extractDescription(container)).toBe('direct match')
  })
})
