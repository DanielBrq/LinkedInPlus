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

// Read API key from storage so content script never has it
async function getApiKey() {
  const { ai_active_preset, ai_presets } = await chrome.storage.local.get(['ai_active_preset', 'ai_presets']);
  if (!ai_presets || !ai_active_preset) return '';
  const preset = ai_presets[ai_active_preset];
  return preset?.apiKey || '';
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AI_FETCH') {
    (async () => {
      try {
        const apiKey = await getApiKey();
        const headers = {
          'Content-Type': 'application/json',
        };
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), message.timeout || 30000);
        const res = await fetch(message.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(message.body),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json().catch(() => null);
        // H9: validate response structure before forwarding
        const valid = data && typeof data === 'object' && Array.isArray(data?.choices) && data.choices.length > 0;
        sendResponse({ ok: res.ok, status: res.status, data: valid ? data : null, error: data ? null : 'Invalid JSON response' });
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
