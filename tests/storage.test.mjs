import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeMock } from './helpers/mock-chrome.mjs';
import { saveJob, hasJob, getSavedJobs, removeJob, clearSavedJobs, updateJobLock } from '../lib/storage.js';
import { hashText } from '../lib/utils.js';

const SAMPLE = {
  relevant: true, fitScore: 75, title: 'Dev', description: 'job content here',
  location: 'CR', modality: 'remote', englishLevel: null, technologies: ['js'],
  posterName: null, companyName: 'X', applicationEmail: null, applicationLink: null,
};

describe('storage', () => {
  beforeEach(async () => {
    installChromeMock();
    await clearSavedJobs();
  });

  test('saveJob stores a new job and updates the index', async () => {
    const { saved, hash } = await saveJob(SAMPLE);
    assert.equal(saved, true);
    assert.ok(hash && hash.length === 64, 'should return SHA-256 hex hash');
    const all = await getSavedJobs();
    assert.equal(all.length, 1);
    assert.equal(all[0].title, 'Dev');
  });

  test('saveJob is idempotent: second call with same description does not duplicate', async () => {
    const r1 = await saveJob(SAMPLE);
    const r2 = await saveJob({ ...SAMPLE, title: 'Different title' });
    assert.equal(r1.saved, true);
    assert.equal(r2.saved, false, 'second save should be rejected as duplicate');
    const all = await getSavedJobs();
    assert.equal(all.length, 1);
  });

  test('hasJob returns true for saved hash, false for unknown', async () => {
    const { hash } = await saveJob(SAMPLE);
    assert.equal(await hasJob(hash), true);
    assert.equal(await hasJob('nonexistent'), false);
  });

  test('removeJob deletes the job and updates the index', async () => {
    const { hash } = await saveJob(SAMPLE);
    await removeJob(hash);
    assert.equal(await hasJob(hash), false);
    const all = await getSavedJobs();
    assert.equal(all.length, 0);
  });

  test('getSavedJobs preserves insertion order', async () => {
    await saveJob({ ...SAMPLE, description: 'first' });
    await saveJob({ ...SAMPLE, description: 'second' });
    await saveJob({ ...SAMPLE, description: 'third' });
    const all = await getSavedJobs();
    assert.equal(all.length, 3);
    assert.equal(all[0].description, 'first');
    assert.equal(all[1].description, 'second');
    assert.equal(all[2].description, 'third');
  });

  test('clearSavedJobs removes everything', async () => {
    await saveJob({ ...SAMPLE, description: 'a' });
    await saveJob({ ...SAMPLE, description: 'b' });
    await clearSavedJobs();
    const all = await getSavedJobs();
    assert.equal(all.length, 0);
  });

  test('removeJob skips locked jobs', async () => {
    const { hash } = await saveJob(SAMPLE);
    await updateJobLock(hash, true);
    await removeJob(hash);
    assert.equal(await hasJob(hash), true, 'locked job should survive removeJob');
  });

  test('clearSavedJobs preserves locked jobs', async () => {
    const { hash: h1 } = await saveJob({ ...SAMPLE, description: 'locked one' });
    const { hash: h2 } = await saveJob({ ...SAMPLE, description: 'unlocked one' });
    await updateJobLock(h1, true);
    await clearSavedJobs();
    const all = await getSavedJobs();
    assert.equal(all.length, 1);
    assert.equal(all[0].description, 'locked one');
  });

  test('updateJobLock toggles locked state in storage', async () => {
    const { hash } = await saveJob(SAMPLE);
    await updateJobLock(hash, true);
    assert.equal((await getSavedJobs())[0].locked, true);
    await updateJobLock(hash, false);
    assert.equal((await getSavedJobs())[0].locked, false);
  });

  test('hashText is deterministic and produces 64-char hex (SHA-256)', async () => {
    const h1 = await hashText('hello world');
    const h2 = await hashText('hello world');
    assert.equal(h1, h2);
    assert.equal(h1.length, 64);
    assert.match(h1, /^[0-9a-f]{64}$/);
  });
});
