chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'AI_FETCH') return;
  (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), message.timeout || 30000);
      const res = await fetch(message.url, {
        method: 'POST',
        headers: message.headers,
        body: JSON.stringify(message.body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json().catch(() => null);
      sendResponse({ ok: res.ok, status: res.status, data, error: data ? null : 'Invalid JSON response' });
    } catch (err) {
      sendResponse({ ok: false, status: 0, data: null, error: err.message });
    }
  })();
  return true;
});
