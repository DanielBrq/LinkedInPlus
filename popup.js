import { getSavedJobs, clearSavedJobs } from './lib/storage.js';
import {
  getEnabled, saveEnabled,
  getPresets, getActivePresetName, setActivePresetName,
  getDisplayConfig, saveDisplayConfig,
  getNotInterestedEnabled, saveNotInterestedEnabled,
  getSaveMatchesEnabled, saveSaveMatchesEnabled,
  getHideNonRelevantEnabled, saveHideNonRelevantEnabled,
  getBlockMediaEnabled, saveBlockMediaEnabled,
} from './lib/settings.js';
import {
  DEFAULT_HIDE_DELAY_MS, DISPLAY_DEBOUNCE_MS
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
  const blockMediaToggle = document.getElementById('blockMediaToggle');
  const clearJobsBtn = document.getElementById('clearJobsBtn');
  const presetSelect = document.getElementById('presetSelect');
  const managePresetsBtn = document.getElementById('managePresetsBtn');

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

  // Load presets and populate selector
  const presets = await getPresets();
  const activeName = await getActivePresetName();
  function populatePresetSelect() {
    presetSelect.innerHTML = '';
    for (const name of Object.keys(presets)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === activeName) opt.selected = true;
      presetSelect.appendChild(opt);
    }
  }
  populatePresetSelect();

  // Switch active preset
  presetSelect.addEventListener('change', async () => {
    await setActivePresetName(presetSelect.value);
  });

  // Manage presets → open page in new tab
  managePresetsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('presets/index.html') });
  });

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
  blockMediaToggle.checked = await getBlockMediaEnabled();
  blockMediaToggle.addEventListener('change', () => {
    saveBlockMediaEnabled(blockMediaToggle.checked);
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
