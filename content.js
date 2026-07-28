const INJECTED_STYLES = '.lc-fadeout{animation:lc-fade .4s ease forwards}@keyframes lc-fade{to{opacity:0;transform:scale(.97)}}.lc-rejected{outline:2px solid #d32f2f!important;outline-offset:-2px}.lc-pending{outline:2px solid #1976d2!important;outline-offset:-2px;position:relative}.lc-pending::after{content:"AI analyzing…";position:absolute;top:6px;right:6px;background:#1976d2;color:#fff;font:600 10px/1 -apple-system,BlinkMacSystemFont,sans-serif;padding:3px 7px;border-radius:10px;z-index:9;pointer-events:none;letter-spacing:.02em}';
const DESCRIPTION_SELECTOR = '[data-testid="expandable-text-box"]';
const LOG_PREFIX = '[LinkedIn Collector]';
const MSG_ENABLED = 'Enabled — AI filter active.';
const MSG_DISABLED = 'Disabled by user.';
const MSG_ENABLED_CHANGE = 'Enabled via config change.';
const MSG_DISABLED_CHANGE = 'Disabled via config change.';

// Init: load modules, inject styles, observe DOM
(async function initContentScript() {
  let processContainer, clearProcessedHashes, MSG_CONFIG_UPDATED;
  let getEnabled, getAIConfig, getDisplayConfig, getNotInterestedEnabled, getSaveMatchesEnabled, getHideNonRelevantEnabled;
  let createObserver, INITIAL_SCAN_DELAY_MS;

  // Dynamic imports of lib modules
  try {
    const pipeUrl = chrome.runtime.getURL('lib/pipeline.js');
    const settingsUrl = chrome.runtime.getURL('lib/settings.js');
    const observerUrl = chrome.runtime.getURL('lib/observer.js');
    const constantsUrl = chrome.runtime.getURL('lib/constants.js');

    const [pipeModule, settingsModule, observerModule, constantsModule] = await Promise.all([
      import(pipeUrl), import(settingsUrl), import(observerUrl), import(constantsUrl)
    ]);

    processContainer = pipeModule.processContainer;
    clearProcessedHashes = pipeModule.clearProcessedHashes;
    MSG_CONFIG_UPDATED = pipeModule.MSG_CONFIG_UPDATED;
    getEnabled = settingsModule.getEnabled;
    getAIConfig = settingsModule.getAIConfig;
    getDisplayConfig = settingsModule.getDisplayConfig;
    getNotInterestedEnabled = settingsModule.getNotInterestedEnabled;
    getSaveMatchesEnabled = settingsModule.getSaveMatchesEnabled;
    getHideNonRelevantEnabled = settingsModule.getHideNonRelevantEnabled;
    createObserver = observerModule.createObserver;
    INITIAL_SCAN_DELAY_MS = constantsModule.INITIAL_SCAN_DELAY_MS;
  } catch (err) {
    console.error(LOG_PREFIX, 'Failed to load extension modules:', err);
    return;
  }

  // Inject CSS for visual feedback (rejected, pending, fadeout)
  const style = document.createElement('style');
  style.textContent = INJECTED_STYLES;
  document.head.appendChild(style);

  // Read initial config from storage
  let enabled = await getEnabled();
  let aiConfig = await getAIConfig();
  let displayConfig = await getDisplayConfig();
  let notInterestedEnabled = await getNotInterestedEnabled();
  let saveMatchesEnabled = await getSaveMatchesEnabled();
  let hideNonRelevantEnabled = await getHideNonRelevantEnabled();

  // Create observer that processes new containers
  const obs = createObserver(DESCRIPTION_SELECTOR, container =>
    processContainer(container, {
      displayConfig, notInterestedEnabled, saveMatchesEnabled, hideNonRelevantEnabled, aiConfig
    })
  );

  // Start or pause based on current enabled state
  if (enabled) {
    setTimeout(() => obs.scan(), INITIAL_SCAN_DELAY_MS);
    obs.start();
    console.log(LOG_PREFIX, MSG_ENABLED);
  } else {
    console.log(LOG_PREFIX, MSG_DISABLED);
  }

  // Listen for config changes from popup
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      if (namespace !== 'local') return;
      // AI config changed → re-scan
      if (changes.ai_config) {
        aiConfig = await getAIConfig();
        clearProcessedHashes();
        obs.scan();
        console.log(LOG_PREFIX, MSG_CONFIG_UPDATED);
      }
      // Display config changed
      if (changes.display_config) {
        displayConfig = await getDisplayConfig();
      }
      // Toggle: not interested auto-click
      if (changes.not_interested_enabled !== undefined) {
        notInterestedEnabled = changes.not_interested_enabled.newValue !== false;
      }
      // Toggle: save matched jobs
      if (changes.save_matches !== undefined) {
        saveMatchesEnabled = changes.save_matches.newValue !== false;
      }
      // Toggle: hide non-relevant posts
      if (changes.hide_non_relevant !== undefined) {
        hideNonRelevantEnabled = changes.hide_non_relevant.newValue !== false;
      }
      // Master toggle enabled/disabled
      if (changes.collector_enabled !== undefined) {
        enabled = changes.collector_enabled.newValue !== false;
        if (enabled) {
          aiConfig = await getAIConfig();
          displayConfig = await getDisplayConfig();
          obs.scan();
          obs.start();
          console.log(LOG_PREFIX, MSG_ENABLED_CHANGE);
        } else {
          obs.stop();
          console.log(LOG_PREFIX, MSG_DISABLED_CHANGE);
        }
      }
    });
  }
})();
