const INJECTED_STYLES_TMPL = '.lc-fadeout{animation:lc-fade .4s ease forwards}@keyframes lc-fade{to{opacity:0;transform:scale(.97)}}.lc-rejected{outline:2px solid #d32f2f!important;outline-offset:-2px}.lc-pending{outline:2px solid #1976d2!important;outline-offset:-2px;position:relative}.lc-pending::after{content:"__TEXT__";position:absolute;top:6px;right:6px;background:#1976d2;color:#fff;font:600 10px/1 -apple-system,BlinkMacSystemFont,sans-serif;padding:3px 7px;border-radius:10px;z-index:9;pointer-events:none;letter-spacing:.02em}';
const DESCRIPTION_SELECTOR = '[data-testid="expandable-text-box"]';
const LOG_PREFIX = '[LinkedIn Collector]';

// Init: load modules, inject styles, observe DOM
(async function initContentScript() {
  let processContainer, clearProcessedHashes, MSG_CONFIG_UPDATED;
  let getEnabled, getActivePresetConfig, getDisplayConfig, getNotInterestedEnabled, getSaveMatchesEnabled, getHideNonRelevantEnabled, getBlockMediaEnabled;
  let createObserver, INITIAL_SCAN_DELAY_MS;
  let enableMediaBlocking, disableMediaBlocking;

  // Dynamic imports of lib modules
  try {
    const pipeUrl = chrome.runtime.getURL('lib/pipeline.js');
    const settingsUrl = chrome.runtime.getURL('lib/settings.js');
    const observerUrl = chrome.runtime.getURL('lib/observer.js');
    const constantsUrl = chrome.runtime.getURL('lib/constants.js');
    const mediaBlockerUrl = chrome.runtime.getURL('lib/mediaBlocker.js');

    const [pipeModule, settingsModule, observerModule, constantsModule, mediaBlockerModule] = await Promise.all([
      import(pipeUrl), import(settingsUrl), import(observerUrl), import(constantsUrl), import(mediaBlockerUrl)
    ]);

    processContainer = pipeModule.processContainer;
    clearProcessedHashes = pipeModule.clearProcessedHashes;
    MSG_CONFIG_UPDATED = pipeModule.MSG_CONFIG_UPDATED;
    getEnabled = settingsModule.getEnabled;
    getActivePresetConfig = settingsModule.getActivePresetConfig;
    getDisplayConfig = settingsModule.getDisplayConfig;
    getNotInterestedEnabled = settingsModule.getNotInterestedEnabled;
    getSaveMatchesEnabled = settingsModule.getSaveMatchesEnabled;
    getHideNonRelevantEnabled = settingsModule.getHideNonRelevantEnabled;
    getBlockMediaEnabled = settingsModule.getBlockMediaEnabled;
    createObserver = observerModule.createObserver;
    INITIAL_SCAN_DELAY_MS = constantsModule.INITIAL_SCAN_DELAY_MS;
    enableMediaBlocking = mediaBlockerModule.enableMediaBlocking;
    disableMediaBlocking = mediaBlockerModule.disableMediaBlocking;
  } catch (err) {
    console.error(LOG_PREFIX, 'Failed to load extension modules:', err);
    return;
  }

  // Inject CSS for visual feedback (rejected, pending, fadeout)
  const lang = (document.documentElement.lang || 'en').startsWith('es') ? 'es' : 'en';
  const analyzingText = lang === 'es' ? 'Analizando…' : 'Analyzing…';
  const style = document.createElement('style');
  style.textContent = INJECTED_STYLES_TMPL.replace('__TEXT__', analyzingText);
  document.head.appendChild(style);

  // Read initial config from storage
  let enabled = await getEnabled();
  let aiConfig = await getActivePresetConfig();
  let displayConfig = await getDisplayConfig();
  let notInterestedEnabled = await getNotInterestedEnabled();
  let saveMatchesEnabled = await getSaveMatchesEnabled();
  let hideNonRelevantEnabled = await getHideNonRelevantEnabled();
  let blockMediaEnabled = await getBlockMediaEnabled();
  if (blockMediaEnabled) enableMediaBlocking();

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
    console.log(LOG_PREFIX, 'Enabled — AI filter active.');
  } else {
    console.log(LOG_PREFIX, 'Disabled by user.');
  }

  // Listen for config changes from popup
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, namespace) => {
      if (namespace !== 'local') return;
      // AI preset changed → re-scan
      if (changes.ai_active_preset || changes.ai_presets) {
        aiConfig = await getActivePresetConfig();
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
      // Toggle: block media loading
      if (changes.block_media !== undefined) {
        blockMediaEnabled = changes.block_media.newValue === true;
        if (blockMediaEnabled) enableMediaBlocking();
        else disableMediaBlocking();
      }
      // Master toggle enabled/disabled
      if (changes.collector_enabled !== undefined) {
        enabled = changes.collector_enabled.newValue !== false;
        if (enabled) {
          aiConfig = await getActivePresetConfig();
          displayConfig = await getDisplayConfig();
          obs.scan();
          obs.start();
          console.log(LOG_PREFIX, 'Enabled via config change.');
        } else {
          obs.stop();
          console.log(LOG_PREFIX, 'Disabled via config change.');
        }
      }
    });
  }
})();
