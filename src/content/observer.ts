import { OBSERVER_DEBOUNCE_MS } from '@/shared/constants'

export type Observer = {
  scan: (root?: ParentNode) => void
  start: () => void
  stop: () => void
}

// Debounced mutation watcher for DOM elements matching a selector.
export function createObserver(selector: string, onFound: (element: Element) => void): Observer {
  let observer: MutationObserver | null = null
  const pending = new Set<Element>()
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush(): void {
    timer = null
    for (const element of pending) onFound(element)
    pending.clear()
  }

  function schedule(element: Element): void {
    pending.add(element)
    if (!timer) timer = setTimeout(flush, OBSERVER_DEBOUNCE_MS)
  }

  function scan(root: ParentNode = document): void {
    for (const element of root.querySelectorAll(selector)) schedule(element)
  }

  function start(): void {
    if (observer) return
    observer = new MutationObserver(() => scan())
    observer.observe(document.body, { childList: true, subtree: true })
  }

  function stop(): void {
    observer?.disconnect()
    observer = null
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    pending.clear()
  }

  return { scan, start, stop }
}
