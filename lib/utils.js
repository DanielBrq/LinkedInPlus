import { HASH_ALGORITHM, HEX_RADIX, HEX_BYTE_WIDTH } from './constants.js';


// Guard: chrome.storage.local availability check
/** @returns {chrome.storage.LocalStorageArea|null} */
function getStorage() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return null;
  return chrome.storage.local;
}

// Read a single key from chrome.storage.local
/** @param {string} key @param {*} [defaultVal] @returns {Promise<*>} */
export async function storageGet(key, defaultVal = undefined) {
  const s = getStorage();
  if (!s) return defaultVal;
  return new Promise(resolve => {
    s.get([key], result => {
      resolve(result[key] !== undefined ? result[key] : defaultVal);
    });
  });
}

// Read multiple keys at once
/** @param {string[]} keys @returns {Promise<Object<string, *>>} */
export async function storageGetMultiple(keys) {
  const s = getStorage();
  if (!s) return {};
  return new Promise(resolve => s.get(keys, resolve));
}

// Write a key to chrome.storage.local
/** @param {string} key @param {*} val @returns {Promise<void>} */
export async function storageSet(key, val) {
  const s = getStorage();
  if (!s) return;
  return new Promise(resolve => s.set({ [key]: val }, resolve));
}

// Remove one or more keys
/** @param {string|string[]} keys @returns {Promise<void>} */
export async function storageRemove(keys) {
  const s = getStorage();
  if (!s) return;
  if (!Array.isArray(keys)) keys = [keys];
  return new Promise(resolve => s.remove(keys, resolve));
}

// Trigger file download via blob + anchor click
/** @param {string} content @param {string} filename @param {string} mimeType @returns {void} */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// SHA-256 hash of a string
/** @param {string} text @returns {Promise<string>} */
export async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0')).join('');
}
