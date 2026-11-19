import { createGateway, generateText, Output } from 'ai';
import { z } from 'zod';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AI_CLASSIFY') {
    (async () => {
      const controller = new AbortController();
      const timeout = Number(message.timeout);
      const timer = setTimeout(() => controller.abort(), Number.isFinite(timeout) ? Math.max(1000, Math.min(timeout, 60000)) : 15000);
      try {
        if (!sender.tab?.url || !/^https:\/\/(www\.)?linkedin\.com\//.test(sender.tab.url)) {
          throw new Error('Classification request rejected');
        }
        const { classifier_config: config } = await chrome.storage.local.get('classifier_config');
        if (!config?.apiKey || typeof message.prompt !== 'string' || message.prompt.length > 12000 ||
            typeof message.model !== 'string' || !message.model || message.model.length > 200) {
          throw new Error('Missing Gateway configuration');
        }
        const gateway = createGateway({ apiKey: config.apiKey });
        const { output } = await generateText({
          model: gateway(message.model),
          output: Output.object({
            schema: z.object({
              score: z.number().int().min(0).max(100),
            }),
          }),
          prompt: message.prompt,
          abortSignal: controller.signal,
        });
        sendResponse({ ok: true, ...output });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      } finally {
        clearTimeout(timer);
      }
    })();
    return true;
  }
});
