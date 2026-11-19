import { getEnabled, saveEnabled, getClassifierConfig, saveClassifierConfig } from './lib/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const config = await getClassifierConfig();
  $('enableToggle').checked = await getEnabled();
  $('apiKey').value = config.apiKey;
  $('model').value = config.model;
  $('filters').value = config.filters;
  $('negativeFilters').value = config.negativeFilters;
  $('threshold').value = config.threshold;
  $('thresholdValue').textContent = config.threshold;

  $('threshold').addEventListener('input', event => {
    $('thresholdValue').textContent = event.target.value;
  });
  $('enableToggle').addEventListener('change', event => saveEnabled(event.target.checked));
  $('saveConfig').addEventListener('click', async () => {
    await saveClassifierConfig({
      apiKey: $('apiKey').value.trim(),
      model: $('model').value.trim(),
      filters: $('filters').value.trim(),
      negativeFilters: $('negativeFilters').value.trim(),
      threshold: Number($('threshold').value),
    });
    $('status').textContent = 'Configuration saved.';
  });
});
