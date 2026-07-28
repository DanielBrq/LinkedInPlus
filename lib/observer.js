import { OBSERVER_DEBOUNCE_MS } from './constants.js';

export function createObserver(selector, onFound) {
  let observer = null;
  let pending = new Set();
  let timer = null;

  function flush() {
    timer = null;
    for (const el of pending) onFound(el);
    pending.clear();
  }

  function schedule(el) {
    pending.add(el);
    if (!timer) timer = setTimeout(flush, OBSERVER_DEBOUNCE_MS);
  }

  function scan(root) {
    for (const el of (root ?? document).querySelectorAll(selector))
      schedule(el);
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
  }

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