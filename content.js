const LOG_PREFIX = '[LinkedIn Collector]';

(async function initContentScript() {
  try {
    const [pipeline, settings, observer, constants, media, parser] = await Promise.all([
      import(chrome.runtime.getURL('lib/pipeline.js')),
      import(chrome.runtime.getURL('lib/settings.js')),
      import(chrome.runtime.getURL('lib/observer.js')),
      import(chrome.runtime.getURL('lib/constants.js')),
      import(chrome.runtime.getURL('lib/parser.js')),
    ]);
    const { processContainer, clearProcessedHashes, stopProcessing, MSG_CONFIG_UPDATED } = pipeline;
    const { getEnabled, getClassifierConfig } = settings;
    const { createObserver } = observer;
    const { INITIAL_SCAN_DELAY_MS } = constants;
    const { DESCRIPTION_SELECTOR } = parser;

    let enabled = await getEnabled();
    let aiConfig = await getClassifierConfig();

    const style = document.createElement('style');
    style.textContent = '.lc-pending{outline:2px solid #1976d2!important;outline-offset:-2px;position:relative}.lc-pending::after{content:"Analyzing…";position:absolute;top:6px;right:6px;background:#1976d2;color:#fff;font:600 10px/1 -apple-system,BlinkMacSystemFont,sans-serif;padding:3px 7px;border-radius:10px;z-index:9;pointer-events:none}';
    (document.head || document.documentElement).appendChild(style);

    const obs = createObserver(DESCRIPTION_SELECTOR, container => processContainer(container, { aiConfig }));
    if (enabled) {
      setTimeout(() => obs.scan(), INITIAL_SCAN_DELAY_MS);
      obs.start();
      console.log(LOG_PREFIX, 'Enabled — AI classification active.');
    }

    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      if (namespace !== 'local') return;
      if (changes.classifier_config) {
        aiConfig = await getClassifierConfig();
        clearProcessedHashes();
        if (enabled) obs.scan();
        console.log(LOG_PREFIX, MSG_CONFIG_UPDATED);
      }
      if (changes.collector_enabled) {
        enabled = changes.collector_enabled.newValue !== false;
        if (enabled) {
          aiConfig = await getClassifierConfig();
          clearProcessedHashes();
          obs.scan();
          obs.start();
        } else {
          obs.stop();
          stopProcessing();
        }
      }
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to initialize extension:', error);
  }
})();
