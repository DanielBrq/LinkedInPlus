import { describe, expect, it, vi } from 'vitest'

describe('chrome mock', () => {
  it('persists storage values per area', async () => {
    await chrome.storage.local.set({ count: 1 })
    await chrome.storage.sync.set({ theme: 'dark' })

    expect(await chrome.storage.local.get('count')).toEqual({ count: 1 })
    expect(await chrome.storage.local.get(['count', 'theme'])).toEqual({ count: 1 })
    expect(await chrome.storage.local.get({ count: 0, missing: 'default' })).toEqual({
      count: 1,
      missing: 'default',
    })
    expect(await chrome.storage.local.get(null)).toEqual({ count: 1 })
    expect(await chrome.storage.sync.get(null)).toEqual({ theme: 'dark' })

    await chrome.storage.local.remove('count')
    expect(await chrome.storage.local.get(null)).toEqual({})
  })

  it('notifies storage.onChanged listeners', async () => {
    const listener = vi.fn()
    chrome.storage.onChanged.addListener(listener)

    await chrome.storage.session.set({ flag: true })
    expect(listener).toHaveBeenCalledWith({ flag: { oldValue: undefined, newValue: true } }, 'session')

    await chrome.storage.session.remove('flag')
    expect(listener).toHaveBeenLastCalledWith({ flag: { oldValue: true } }, 'session')
  })

  it('stubs runtime messaging and getURL', async () => {
    expect(await chrome.runtime.sendMessage({ type: 'PING' })).toBeUndefined()
    expect(chrome.runtime.getURL('popup.html')).toBe('chrome-extension://test-extension/popup.html')
  })
})
