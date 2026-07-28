/** @returns {chrome.storage.LocalStorageArea|null} */
function getStorage() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return null;
  return chrome.storage.local;
}

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

/** @param {string[]} keys @returns {Promise<Object<string, *>>} */
export async function storageGetMultiple(keys) {
  const s = getStorage();
  if (!s) return {};
  return new Promise(resolve => s.get(keys, resolve));
}

/** @param {string} key @param {*} val @returns {Promise<void>} */
export async function storageSet(key, val) {
  const s = getStorage();
  if (!s) return;
  return new Promise(resolve => s.set({ [key]: val }, resolve));
}

/** @param {string|string[]} keys @returns {Promise<void>} */
export async function storageRemove(keys) {
  const s = getStorage();
  if (!s) return;
  if (!Array.isArray(keys)) keys = [keys];
  return new Promise(resolve => s.remove(keys, resolve));
}

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

import { HASH_ALGORITHM, HEX_RADIX, HEX_BYTE_WIDTH } from './constants.js';

/** @param {string} text @returns {Promise<string>} */
export async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, '0')).join('');
}
