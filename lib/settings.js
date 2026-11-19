import { storageGet, storageSet, storageRemove } from './utils.js';
import { DEFAULT_MODEL } from './constants.js';

const MIGRATED_KEY = 'classifier_data_migrated';
export const DEFAULT_CLASSIFIER_CONFIG = {
  apiKey: '',
  model: DEFAULT_MODEL,
  filters: '',
  negativeFilters: '',
  threshold: 65,
};

export async function getEnabled() {
  return (await storageGet('collector_enabled')) !== false;
}
export async function saveEnabled(enabled) {
  return storageSet('collector_enabled', Boolean(enabled));
}

async function migrateLegacyData() {
  if (await storageGet(MIGRATED_KEY)) return;

  const all = await new Promise(resolve => chrome.storage.local.get(null, resolve));
  const active = all.ai_presets?.[all.ai_active_preset] || Object.values(all.ai_presets || {})[0];
  const oldConfig = active || all.ai_config || {};
  if (!all.classifier_config) {
    await storageSet('classifier_config', {
      apiKey: oldConfig.apiKey || '',
      model: oldConfig.model || DEFAULT_MODEL,
      filters: [oldConfig.filters, oldConfig.locationFilter && `Location: ${oldConfig.locationFilter}`].filter(Boolean).join('\n'),
      negativeFilters: oldConfig.negativeFilters || '',
      threshold: DEFAULT_CLASSIFIER_CONFIG.threshold,
    });
  }

  const obsoleteKeys = Object.keys(all).filter(key => key.startsWith('job_'));
  obsoleteKeys.push('job_index', 'ai_config', 'ai_presets', 'ai_active_preset', 'save_matches',
    'hide_non_relevant', 'not_interested_enabled', 'display_config', 'block_media');
  await storageRemove(obsoleteKeys);
  await storageSet(MIGRATED_KEY, true);
}

export async function getClassifierConfig() {
  await migrateLegacyData();
  const config = { ...DEFAULT_CLASSIFIER_CONFIG, ...(await storageGet('classifier_config') || {}) };
  config.threshold = Number.isFinite(Number(config.threshold))
    ? Math.max(0, Math.min(100, Number(config.threshold)))
    : DEFAULT_CLASSIFIER_CONFIG.threshold;
  return config;
}
export async function saveClassifierConfig(config) {
  await migrateLegacyData();
  const threshold = Number(config.threshold);
  return storageSet('classifier_config', {
    ...DEFAULT_CLASSIFIER_CONFIG,
    ...config,
    threshold: Number.isFinite(threshold) ? Math.max(0, Math.min(100, threshold)) : DEFAULT_CLASSIFIER_CONFIG.threshold,
  });
}
