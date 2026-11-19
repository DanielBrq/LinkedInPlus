import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OBSERVER_DEBOUNCE_MS } from '@/shared/constants'
import { createObserver } from './observer'

describe('createObserver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div class="target">a</div><div class="target">b</div>'
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('flushes each match once after the debounce window', () => {
    const found: Element[] = []
    const observer = createObserver('.target', (element) => found.push(element))

    observer.scan()
    observer.scan()
    expect(found).toHaveLength(0)

    vi.advanceTimersByTime(OBSERVER_DEBOUNCE_MS)
    expect(found).toHaveLength(2)
  })

  it('drops pending matches on stop', () => {
    const found: Element[] = []
    const observer = createObserver('.target', (element) => found.push(element))

    observer.scan()
    observer.stop()
    vi.advanceTimersByTime(OBSERVER_DEBOUNCE_MS)

    expect(found).toHaveLength(0)
  })
})
