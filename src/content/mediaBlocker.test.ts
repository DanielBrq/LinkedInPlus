import { afterEach, describe, expect, it } from 'vitest'
import { setMediaBlocking } from './mediaBlocker'

afterEach(() => {
  setMediaBlocking(false)
  document.getElementById('lc-media-blocker')?.remove()
})

describe('media blocker', () => {
  it('blocks assigned image URLs while enabled and restores them when disabled', () => {
    const image = document.createElement('img')
    setMediaBlocking(true)
    image.src = 'https://example.com/image.jpg'
    expect(image.getAttribute('src')).toBeNull()
    expect(document.getElementById('lc-media-blocker')).not.toBeNull()

    setMediaBlocking(false)
    image.src = 'https://example.com/image.jpg'
    expect(image.getAttribute('src')).toBe('https://example.com/image.jpg')
    expect(document.getElementById('lc-media-blocker')).toBeNull()
  })
})
