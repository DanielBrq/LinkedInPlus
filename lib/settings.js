import { storageGet, storageSet } from './utils.js';
import {
  STORAGE_KEYS, DEFAULT_GATEWAY_URL, DEFAULT_MODEL, DEFAULT_HIDE_DELAY_MS
} from './constants.js';

const ENABLED_KEY = STORAGE_KEYS.ENABLED_KEY;
const AI_CONFIG_KEY = STORAGE_KEYS.AI_CONFIG_KEY;
const DISPLAY_CONFIG_KEY = STORAGE_KEYS.DISPLAY_CONFIG_KEY;

export const DEFAULT_AI_CONFIG = {
  gatewayUrl: DEFAULT_GATEWAY_URL,
  apiKey: '',
  model: DEFAULT_MODEL,
  userProfile: ''
};

export const DEFAULT_DISPLAY_CONFIG = {
  debugMode: true,
  hideDelay: DEFAULT_HIDE_DELAY_MS,
};

/** @returns {Promise<boolean>} */
export async function getEnabled() {
  const val = await storageGet(ENABLED_KEY);
  return val !== false;
}

/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveEnabled(enabled) {
  return storageSet(ENABLED_KEY, Boolean(enabled));
}

/** @returns {Promise<Object>} */
export async function getAIConfig() {
  const saved = await storageGet(AI_CONFIG_KEY);
  return { ...DEFAULT_AI_CONFIG, ...(saved || {}) };
}

/** @param {Object} config @returns {Promise<void>} */
export async function saveAIConfig(config) {
  const merged = { ...DEFAULT_AI_CONFIG, ...(config || {}) };
  return storageSet(AI_CONFIG_KEY, merged);
}

/** @returns {Promise<Object>} */
export async function getDisplayConfig() {
  const saved = await storageGet(DISPLAY_CONFIG_KEY);
  return { ...DEFAULT_DISPLAY_CONFIG, ...(saved || {}) };
}

/** @param {Object} cfg @returns {Promise<void>} */
export async function saveDisplayConfig(cfg) {
  return storageSet(DISPLAY_CONFIG_KEY, { ...DEFAULT_DISPLAY_CONFIG, ...(cfg || {}) });
}

/** @returns {Promise<boolean>} */
export async function getNotInterestedEnabled() {
  const val = await storageGet(STORAGE_KEYS.NOT_INTERESTED_KEY);
  return val !== false;
}

/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveNotInterestedEnabled(enabled) {
  return storageSet(STORAGE_KEYS.NOT_INTERESTED_KEY, Boolean(enabled));
}

/** @returns {Promise<boolean>} */
export async function getSaveMatchesEnabled() {
  const val = await storageGet(STORAGE_KEYS.SAVE_MATCHES_KEY);
  return val !== false;
}

/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveSaveMatchesEnabled(enabled) {
  return storageSet(STORAGE_KEYS.SAVE_MATCHES_KEY, Boolean(enabled));
}

/** @returns {Promise<boolean>} */
export async function getHideNonRelevantEnabled() {
  const val = await storageGet(STORAGE_KEYS.HIDE_NON_RELEVANT_KEY);
  return val !== false;
}

/** @param {boolean} enabled @returns {Promise<void>} */
export async function saveHideNonRelevantEnabled(enabled) {
  return storageSet(STORAGE_KEYS.HIDE_NON_RELEVANT_KEY, Boolean(enabled));
}
