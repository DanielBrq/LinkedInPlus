// In-memory mock of chrome.storage.local (callback-based API).
// Usage: installChromeMock({ 'key': value }) before importing the module under test.
export function installChromeMock(initial = {}) {
  const data = { ...initial };
  const store = {
    get(keys, cb) {
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) {
        if (k in data) out[k] = data[k];
      }
      cb(out);
    },
    set(items, cb) {
      Object.assign(data, items);
      if (cb) cb();
    },
    remove(keys, cb) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) delete data[k];
      if (cb) cb();
    },
  };
  globalThis.chrome = { storage: { local: store }, runtime: { id: 'test-runtime-id', sendMessage: () => {} } };
  return data;
}
