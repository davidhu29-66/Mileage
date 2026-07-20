// Claude's artifact sandbox provides a `window.storage` API (get/set/delete/list)
// that persists data server-side. Outside of Claude that API doesn't exist, so
// this file re-implements the exact same interface using the browser's real
// localStorage. The app component itself never needs to know the difference.
//
// Note: unlike Claude's version, this storage is per-browser/per-device only
// (it won't sync across your phone and laptop) and the "shared" flag is
// ignored since there's no multi-user backend here.

function keyFor(key, shared) {
  return `mileage-app:${shared ? "shared" : "personal"}:${key}`;
}

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key, shared = false) {
      const raw = window.localStorage.getItem(keyFor(key, shared));
      if (raw === null) {
        throw new Error(`Key not found: ${key}`);
      }
      return { key, value: raw, shared };
    },

    async set(key, value, shared = false) {
      window.localStorage.setItem(keyFor(key, shared), value);
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      window.localStorage.removeItem(keyFor(key, shared));
      return { key, deleted: true, shared };
    },

    async list(prefix = "", shared = false) {
      const fullPrefix = keyFor(prefix, shared);
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) {
          keys.push(k.slice(`mileage-app:${shared ? "shared" : "personal"}:`.length));
        }
      }
      return { keys, prefix, shared };
    },
  };
}
