import { storageGet, storageSet, storageRemove } from './utils.js';
import {
  STORAGE_KEYS, DEFAULT_GATEWAY_URL, DEFAULT_MODEL, DEFAULT_HIDE_DELAY_MS
} from './constants.js';

const ENABLED_KEY = STORAGE_KEYS.ENABLED_KEY;
const AI_CONFIG_KEY = STORAGE_KEYS.AI_CONFIG_KEY;
const DISPLAY_CONFIG_KEY = STORAGE_KEYS.DISPLAY_CONFIG_KEY;
const AI_PRESETS_KEY = STORAGE_KEYS.AI_PRESETS_KEY;
const AI_ACTIVE_PRESET_KEY = STORAGE_KEYS.AI_ACTIVE_PRESET_KEY;

export const DEFAULT_PRESET_CONFIG = {
  name: '',
  gatewayUrl: DEFAULT_GATEWAY_URL,
  apiKey: '',
  model: DEFAULT_MODEL,
  filters: '',
  negativeFilters: '',
  locationFilter: ''
};

export const DEFAULT_DISPLAY_CONFIG = {
  debugMode: true,
  hideDelay: DEFAULT_HIDE_DELAY_MS,
};

// Master toggle
/** @returns {Promise<boolean>} */
export async function getEnabled() {
  const val = await storageGet(ENABLED_KEY);
  return val !== false;
}
/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveEnabled(enabled) {
  return storageSet(ENABLED_KEY, Boolean(enabled));
}

// Display config (debug mode, hide delay)
/** @returns {Promise<Object>} */
export async function getDisplayConfig() {
  const saved = await storageGet(DISPLAY_CONFIG_KEY);
  return { ...DEFAULT_DISPLAY_CONFIG, ...(saved || {}) };
}
/** @param {Object} cfg @returns {Promise<void>} */
export async function saveDisplayConfig(cfg) {
  return storageSet(DISPLAY_CONFIG_KEY, { ...DEFAULT_DISPLAY_CONFIG, ...(cfg || {}) });
}

// "Not interested" auto-click toggle
/** @returns {Promise<boolean>} */
export async function getNotInterestedEnabled() {
  const val = await storageGet(STORAGE_KEYS.NOT_INTERESTED_KEY);
  return val !== false;
}
/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveNotInterestedEnabled(enabled) {
  return storageSet(STORAGE_KEYS.NOT_INTERESTED_KEY, Boolean(enabled));
}

// Save matched jobs toggle
/** @returns {Promise<boolean>} */
export async function getSaveMatchesEnabled() {
  const val = await storageGet(STORAGE_KEYS.SAVE_MATCHES_KEY);
  return val !== false;
}
/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveSaveMatchesEnabled(enabled) {
  return storageSet(STORAGE_KEYS.SAVE_MATCHES_KEY, Boolean(enabled));
}

// Hide non-relevant posts toggle
/** @returns {Promise<boolean>} */
export async function getHideNonRelevantEnabled() {
  const val = await storageGet(STORAGE_KEYS.HIDE_NON_RELEVANT_KEY);
  return val !== false;
}
/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveHideNonRelevantEnabled(enabled) {
  return storageSet(STORAGE_KEYS.HIDE_NON_RELEVANT_KEY, Boolean(enabled));
}

// Block media (images/videos) toggle — prevents network load via prototype override
/** @returns {Promise<boolean>} */
export async function getBlockMediaEnabled() {
  const val = await storageGet(STORAGE_KEYS.BLOCK_MEDIA_KEY);
  return val === true;
}
/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveBlockMediaEnabled(enabled) {
  return storageSet(STORAGE_KEYS.BLOCK_MEDIA_KEY, Boolean(enabled));
}

// ─── AI Presets ──────────────────────────────────────────────

let migrateDone = false;

// Migrate legacy ai_config → ai_presets (one-time)
async function migrateLegacyIfNeeded() {
  if (migrateDone) return;
  const presets = await storageGet(AI_PRESETS_KEY);
  if (presets && Object.keys(presets).length > 0) { migrateDone = true; return; }
  const legacy = await storageGet(AI_CONFIG_KEY);
  if (!legacy) { migrateDone = true; return; }
  const preset = { ...DEFAULT_PRESET_CONFIG, ...legacy, name: 'default' };
  await storageSet(AI_PRESETS_KEY, { default: preset });
  await storageSet(AI_ACTIVE_PRESET_KEY, 'default');
  await storageRemove(AI_CONFIG_KEY);
  migrateDone = true;
}

/** @returns {Promise<Object>} name → preset object */
export async function getPresets() {
  await migrateLegacyIfNeeded();
  const saved = await storageGet(AI_PRESETS_KEY);
  return saved && typeof saved === 'object' ? saved : {};
}

/** @param {Object} presets @returns {Promise<void>} */
export async function savePresets(presets) {
  const existing = await storageGet(AI_PRESETS_KEY);
  return storageSet(AI_PRESETS_KEY, { ...existing, ...presets });
}

/** @returns {Promise<string>} */
export async function getActivePresetName() {
  const name = await storageGet(AI_ACTIVE_PRESET_KEY);
  return typeof name === 'string' && name ? name : 'default';
}

/** @param {string} name @returns {Promise<void>} */
export async function setActivePresetName(name) {
  return storageSet(AI_ACTIVE_PRESET_KEY, name);
}

/** @returns {Promise<Object>} full config of the active preset */
export async function getActivePresetConfig() {
  const presets = await getPresets();
  const name = await getActivePresetName();
  const preset = presets[name];
  if (preset) return { ...DEFAULT_PRESET_CONFIG, ...preset };
  const keys = Object.keys(presets);
  if (keys.length > 0) return { ...DEFAULT_PRESET_CONFIG, ...presets[keys[0]] };
  return { ...DEFAULT_PRESET_CONFIG, name: 'default' };
}

/** @param {Object} config — partial update for the active preset @returns {Promise<void>} */
export async function saveActivePresetConfig(config) {
  const presets = await getPresets();
  const name = await getActivePresetName();
  const merged = { ...DEFAULT_PRESET_CONFIG, ...(presets[name] || {}), ...config, name };
  presets[name] = merged;
  return storageSet(AI_PRESETS_KEY, presets);
}

/** @param {string} name @returns {Promise<void>} */
export async function deletePreset(name) {
  const presets = await getPresets();
  if (!presets[name]) return;
  delete presets[name];
  const activeName = await getActivePresetName();
  if (activeName === name) {
    const remaining = Object.keys(presets);
    if (remaining.length > 0) {
      await setActivePresetName(remaining[0]);
    } else {
      presets['default'] = { ...DEFAULT_PRESET_CONFIG, name: 'default' };
      await setActivePresetName('default');
    }
  }
  return storageSet(AI_PRESETS_KEY, presets);
}

/** @param {string} oldName @param {string} newName @returns {Promise<void>} */
export async function renamePreset(oldName, newName) {
  const presets = await getPresets();
  if (!presets[oldName] || presets[newName] || oldName === newName) return;
  const preset = { ...presets[oldName], name: newName };
  delete presets[oldName];
  presets[newName] = preset;
  const activeName = await getActivePresetName();
  if (activeName === oldName) await setActivePresetName(newName);
  return storageSet(AI_PRESETS_KEY, presets);
}


