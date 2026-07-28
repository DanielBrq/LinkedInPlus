import { getSavedJobs, clearSavedJobs } from './lib/storage.js';
import {
  getEnabled, saveEnabled,
  getAIConfig, saveAIConfig,
  getDisplayConfig, saveDisplayConfig,
  getNotInterestedEnabled, saveNotInterestedEnabled,
  getSaveMatchesEnabled, saveSaveMatchesEnabled,
  getHideNonRelevantEnabled, saveHideNonRelevantEnabled,
} from './lib/settings.js';
import {
  DEFAULT_HIDE_DELAY_MS, DISPLAY_DEBOUNCE_MS, AI_DEBOUNCE_MS, DEFAULT_MODEL
} from './lib/constants.js';

const STATUS_ACTIVE = 'Collector active';
const STATUS_PAUSED = 'Collector paused';
const CONFIRM_CLEAR = 'Are you sure you want to delete all saved job descriptions?';
const CLASS_INACTIVE = ' inactive';

// Init popup UI: load configs, bind events
document.addEventListener('DOMContentLoaded', async () => {
  // DOM refs
  const jobCountEl = document.getElementById('jobCount');
  const enableToggle = document.getElementById('enableToggle');
  const debugToggle = document.getElementById('debugToggle');
  const delaySlider = document.getElementById('delaySlider');
  const delayValue = document.getElementById('delayValue');
  const delayRow = document.getElementById('delayRow');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const saveMatchesToggle = document.getElementById('saveMatchesToggle');
  const hideNonRelevantToggle = document.getElementById('hideNonRelevantToggle');
  const notInterestedToggle = document.getElementById('notInterestedToggle');
  const clearJobsBtn = document.getElementById('clearJobsBtn');

  const aiGatewayInput = document.getElementById('aiGatewayInput');
  const aiKeyInput = document.getElementById('aiKeyInput');
  const aiModelInput = document.getElementById('aiModelInput');
  const aiProfileInput = document.getElementById('aiProfileInput');
  const aiNegativeInput = document.getElementById('aiNegativeInput');

  // Show saved job count
  /** @returns {Promise<Object[]>} */
  async function updateJobCount() {
    const jobs = await getSavedJobs();
    jobCountEl.textContent = `${jobs.length} saved`;
    return jobs;
  }

  // Update status dot + text
  /** @param {boolean} enabled @returns {void} */
  function updateStatus(enabled) {
    statusDot.className = 'status-dot' + (enabled ? '' : CLASS_INACTIVE);
    statusText.textContent = enabled ? STATUS_ACTIVE : STATUS_PAUSED;
  }

  // Load persisted settings
  enableToggle.checked = await getEnabled();
  updateStatus(enableToggle.checked);

  const displayConfig = await getDisplayConfig();
  debugToggle.checked = Boolean(displayConfig.debugMode);
  delaySlider.value = displayConfig.hideDelay || DEFAULT_HIDE_DELAY_MS;
  delayValue.textContent = delaySlider.value;
  delayRow.style.display = debugToggle.checked ? '' : 'none';

  const aiConfig = await getAIConfig();
  aiGatewayInput.value = aiConfig.gatewayUrl || '';
  aiKeyInput.value = aiConfig.apiKey || '';
  aiModelInput.value = aiConfig.model || DEFAULT_MODEL;
  aiProfileInput.value = aiConfig.filters || '';
  aiNegativeInput.value = aiConfig.negativeFilters || '';

  // Debug toggle → show/hide delay slider row
  debugToggle.addEventListener('change', () => {
    delayRow.style.display = debugToggle.checked ? '' : 'none';
    autoSaveDisplay();
  });
  delaySlider.addEventListener('input', () => {
    delayValue.textContent = delaySlider.value;
  });
  delaySlider.addEventListener('change', autoSaveDisplay);

  await updateJobCount();

  // Debounced save for display config
  let displayDebounceTimer;
  /** @returns {void} */
  function autoSaveDisplay() {
    clearTimeout(displayDebounceTimer);
    displayDebounceTimer = setTimeout(async () => {
      await saveDisplayConfig({
        debugMode: debugToggle.checked,
        hideDelay: parseInt(delaySlider.value, 10)
      });
    }, DISPLAY_DEBOUNCE_MS);
  }

  // Debounced save for AI config
  let aiDebounceTimer;
  /** @returns {void} */
  function autoSaveAI() {
    clearTimeout(aiDebounceTimer);
    aiDebounceTimer = setTimeout(async () => {
      await saveAIConfig({
        gatewayUrl: aiGatewayInput.value.trim(),
        apiKey: aiKeyInput.value.trim(),
        model: aiModelInput.value.trim() || DEFAULT_MODEL,
        filters: aiProfileInput.value,
        negativeFilters: aiNegativeInput.value
      });
    }, AI_DEBOUNCE_MS);
  }

  // Auto-grow textarea for profile input
  /** @returns {void} */
  function autoResizeTextarea() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
  }

  // Collapsible AI config section
  document.getElementById('aiCollapseToggle').addEventListener('click', () => {
    document.getElementById('aiCollapseWrap').classList.toggle('open');
    document.getElementById('aiCollapseToggle').classList.toggle('open');
  });

  // Auto-save on any AI field change
  aiGatewayInput.addEventListener('input', autoSaveAI);
  aiKeyInput.addEventListener('input', autoSaveAI);
  aiModelInput.addEventListener('input', autoSaveAI);
  aiProfileInput.addEventListener('input', autoSaveAI);
  aiProfileInput.addEventListener('input', autoResizeTextarea);
  autoResizeTextarea.call(aiProfileInput);
  aiNegativeInput.addEventListener('input', autoSaveAI);
  aiNegativeInput.addEventListener('input', autoResizeTextarea);
  autoResizeTextarea.call(aiNegativeInput);

  // Toggle: save matches, hide non-relevant, not interested
  saveMatchesToggle.checked = await getSaveMatchesEnabled();
  hideNonRelevantToggle.checked = await getHideNonRelevantEnabled();
  notInterestedToggle.checked = await getNotInterestedEnabled();

  saveMatchesToggle.addEventListener('change', () => {
    saveSaveMatchesEnabled(saveMatchesToggle.checked);
  });
  hideNonRelevantToggle.addEventListener('change', () => {
    saveHideNonRelevantEnabled(hideNonRelevantToggle.checked);
  });
  notInterestedToggle.addEventListener('change', () => {
    saveNotInterestedEnabled(notInterestedToggle.checked);
  });

  // Master enable/disable toggle
  enableToggle.addEventListener('change', () => {
    saveEnabled(enableToggle.checked);
    updateStatus(enableToggle.checked);
  });

  // Open viewer in new tab
  document.getElementById('openViewerBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer/index.html') });
  });

  // Clear all saved jobs
  clearJobsBtn.addEventListener('click', async () => {
    if (confirm(CONFIRM_CLEAR)) {
      await clearSavedJobs();
      await updateJobCount();
    }
  });
});
