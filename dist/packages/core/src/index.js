/** Small, DOM-independent primitives shared by every Millennium package. */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const formatBytes = (n) =>
  n < 1024
    ? `${n} bytes`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;

export class EventHub {
  #listeners = new Map();
  on(type, listener, { signal } = {}) {
    if (signal?.aborted) return () => {};
    let listeners = this.#listeners.get(type);
    if (!listeners) this.#listeners.set(type, (listeners = new Set()));
    listeners.add(listener);
    let subscribed = true;
    const off = () => {
      if (!subscribed) return;
      subscribed = false;
      listeners.delete(listener);
      if (!listeners.size && this.#listeners.get(type) === listeners) this.#listeners.delete(type);
      signal?.removeEventListener('abort', off);
    };
    signal?.addEventListener('abort', off, { once: true });
    return off;
  }
  emit(type, value) {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) {
      try {
        listener(value);
      } catch (error) {
        console.error(`Event listener: ${type}`, error);
      }
    }
  }
  clear() {
    this.#listeners.clear();
  }
}

export class History {
  constructor(limit = 50) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }
  push(value) {
    this.past.push(value);
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }
  undo(current) {
    if (!this.past.length) return undefined;
    this.future.push(current);
    return this.past.pop();
  }
  redo(current) {
    if (!this.future.length) return undefined;
    this.past.push(current);
    return this.future.pop();
  }
  clear() {
    this.past.length = this.future.length = 0;
  }
}

export class Settings extends EventHub {
  constructor(storage, key = 'millennium.settings.v1') {
    super();
    if (storage === undefined) {
      try {
        storage = globalThis.localStorage;
      } catch {}
    }
    this.storage = storage;
    this.key = key;
    this.defaults = {
      desktopColor: '#3a6ea5',
      wallpaper: 'none',
      wallpaperStyle: 'stretch',
      theme: 'standard',
      sound: true,
      volume: 65,
      showSeconds: false,
      clock24: false,
      clockOffset: 0,
      iconSize: 32,
      doubleClickSpeed: 420,
      screenSaver: 'none',
      saverMinutes: 5,
      userName: 'User',
      startMenuSmall: false,
      showHidden: false,
      showExtensions: true,
      renderer: 'auto',
      reducedMotion: false,
      dragFullWindows: true,
    };
    try {
      this.values = { ...this.defaults, ...JSON.parse(storage?.getItem(key) ?? '{}') };
    } catch {
      this.values = { ...this.defaults };
    }
  }
  get(key) {
    return this.values[key];
  }
  set(key, value) {
    this.update({ [key]: value });
  }
  update(values) {
    const next = { ...this.values, ...values };
    try {
      this.storage?.setItem(this.key, JSON.stringify(next));
    } catch (error) {
      this.emit('error', error);
      this.persistenceError = error;
    }
    this.values = next;
    this.emit('change', values);
  }
  reset() {
    this.update(this.defaults);
  }
}

export function tokenize(command) {
  const result = [];
  let value = '',
    quoted = false;
  for (const c of command.trim()) {
    if (c === '"') {
      quoted = !quoted;
      continue;
    }
    if (/\s/.test(c) && !quoted) {
      if (value) result.push(value);
      value = '';
    } else value += c;
  }
  if (value) result.push(value);
  return result;
}

export class AppRegistry {
  constructor() {
    this.apps = new Map();
    this.aliases = new Map();
    this.associations = new Map();
  }
  register(app) {
    if (this.apps.has(app.id)) throw new Error(`Application already registered: ${app.id}`);
    this.apps.set(app.id, Object.freeze(app));
    for (const name of [app.id, ...(app.commands ?? [])])
      this.aliases.set(name.toLowerCase().replace(/\.exe$/, ''), app.id);
    for (const ext of app.extensions ?? []) this.associations.set(ext.toLowerCase(), app.id);
  }
  get(id) {
    return this.apps.get(this.aliases.get(id.toLowerCase().replace(/\.exe$/, '')) ?? id);
  }
  forFile(path) {
    return this.associations.get(path.split('.').pop().toLowerCase());
  }
  list(category) {
    return [...this.apps.values()].filter((app) => !category || app.category === category);
  }
}
