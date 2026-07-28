import { OBSERVER_DEBOUNCE_MS } from './constants.js';

// Observer: debounced mutation watcher for DOM elements matching a selector
export function createObserver(selector, onFound) {
  let observer = null;
  let pending = new Set();
  let timer = null;

  // Process all pending elements at once
  function flush() {
    timer = null;
    for (const el of pending) onFound(el);
    pending.clear();
  }

  // Add element to pending batch
  function schedule(el) {
    pending.add(el);
    if (!timer) timer = setTimeout(flush, OBSERVER_DEBOUNCE_MS);
  }

  // Scan existing DOM for matching elements
  function scan(root) {
    for (const el of (root ?? document).querySelectorAll(selector))
      schedule(el);
  }

  // Start observing DOM mutations
  function start() {
    if (observer) return;
    observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Stop observing and clear pending
  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending.clear();
  }

  return { scan, start, stop };
}