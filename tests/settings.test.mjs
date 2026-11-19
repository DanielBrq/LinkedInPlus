import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock } from './helpers/mock-chrome.mjs';

test('migrates active preferences, clears saved posts, and persists threshold safely', async () => {
  const data = installChromeMock({
    ai_active_preset: 'old',
    ai_presets: { old: { apiKey: 'key', model: 'provider/model', filters: 'Angular', negativeFilters: 'No agencies' } },
    job_index: ['abc'],
    job_abc: { description: 'old saved post' },
  });
  const settings = await import('../lib/settings.js?migration-test');
  const config = await settings.getClassifierConfig();
  assert.equal(config.apiKey, 'key');
  assert.equal(config.filters, 'Angular');
  assert.equal(config.negativeFilters, 'No agencies');
  assert.equal(config.threshold, 65);
  assert.equal('job_abc' in data, false);
  assert.equal('ai_presets' in data, false);

  await settings.saveClassifierConfig({ ...config, threshold: 150 });
  assert.equal((await settings.getClassifierConfig()).threshold, 100);
});
