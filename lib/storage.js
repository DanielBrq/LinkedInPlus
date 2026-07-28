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

// Remove a single job by hash
/** @param {string} hash */
export async function removeJob(hash) {
  const key = JOB_PREFIX + hash;
  const existing = await storageGet(key);
  if (!existing) return;
  await storageRemove(key);
  const index = await getIndex();
  await storageSet(INDEX_KEY, index.filter(x => x !== hash));
}

// Delete all saved jobs and the index
/** @returns {Promise<void>} */
export async function clearSavedJobs() {
  const index = await getIndex();
  const keys = index.map(h => JOB_PREFIX + h);
  keys.push(INDEX_KEY);
  await storageRemove(keys);
}
