const MEDIA_RULE_ID = 1;
const MEDIA_RULE = {
  id: MEDIA_RULE_ID,
  priority: 1,
  action: { type: 'block' },
  condition: {
    resourceTypes: ['image', 'media'],
    initiatorDomains: ['linkedin.com'],
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AI_FETCH') {
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
  }

  if (message.type === 'MEDIA_BLOCK_ON') {
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [MEDIA_RULE],
      removeRuleIds: [MEDIA_RULE_ID],
    });
    return false;
  }

  if (message.type === 'MEDIA_BLOCK_OFF') {
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [],
      removeRuleIds: [MEDIA_RULE_ID],
    });
    return false;
  }
});
