import { storageGet, storageGetMultiple, storageSet, storageRemove, hashText } from './utils.js';
import { STORAGE_KEYS } from './constants.js';

const JOB_PREFIX = STORAGE_KEYS.JOB_PREFIX;
const INDEX_KEY = STORAGE_KEYS.INDEX_KEY;

// Read the ordered list of saved job hashes
/** @returns {Promise<string[]>} */
async function getIndex() {
  return (await storageGet(INDEX_KEY)) || [];
}

// Check if a job hash already exists in storage
/** @param {string} hash @returns {Promise<boolean>} */
export async function hasJob(hash) {
  const existing = await storageGet(JOB_PREFIX + hash);
  return Boolean(existing);
}

// Hash description, deduplicate, store job + update index
/** @param {Object} aiResult @returns {Promise<{saved: boolean, hash: string}>} */
export async function saveJob(aiResult) {
  const description = aiResult.description || '';
  const hash = await hashText(description);
  const jobKey = JOB_PREFIX + hash;
  const existing = await storageGet(jobKey);
  if (existing) return { saved: false, hash };
  await storageSet(jobKey, { ...aiResult, _hash: hash });
  const index = await getIndex();
  index.push(hash);
  await storageSet(INDEX_KEY, index);
  return { saved: true, hash };
}

// Fetch all saved jobs from index
/** @returns {Promise<Object[]>} */
export async function getSavedJobs() {
  const index = await getIndex();
  if (index.length === 0) return [];
  const keys = index.map(h => JOB_PREFIX + h);
  const result = await storageGetMultiple(keys);
  return index
    .map(h => result[JOB_PREFIX + h])
    .filter(v => v && typeof v === 'object' && !Array.isArray(v));
}

// Toggle locked state on a saved job
/** @param {string} hash @param {boolean} locked @returns {Promise<void>} */
export async function updateJobLock(hash, locked) {
  const key = JOB_PREFIX + hash;
  const job = await storageGet(key);
  if (!job) return;
  await storageSet(key, { ...job, locked });
}

// Remove a single job by hash (locked jobs are protected)
/** @param {string} hash */
export async function removeJob(hash) {
  const key = JOB_PREFIX + hash;
  const existing = await storageGet(key);
  if (!existing || existing.locked) return;
  await storageRemove(key);
  const index = await getIndex();
  await storageSet(INDEX_KEY, index.filter(x => x !== hash));
}

// Delete all unlocked jobs, preserve locked ones
/** @returns {Promise<void>} */
export async function clearSavedJobs() {
  const jobs = await getSavedJobs();
  const unlocked = jobs.filter(j => !j.locked);
  if (unlocked.length === 0) return;
  const keys = unlocked.map(j => JOB_PREFIX + j._hash);
  await storageRemove(keys);
  const index = await getIndex();
  const unlockedHashes = new Set(unlocked.map(j => j._hash));
  await storageSet(INDEX_KEY, index.filter(h => !unlockedHashes.has(h)));
}
