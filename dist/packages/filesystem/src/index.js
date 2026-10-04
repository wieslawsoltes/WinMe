import { EventHub, uid } from '../../core/src/index.js';

export function normalizePath(path, cwd = 'C:\\') {
  if (typeof path !== 'string' || /[\0<>|"?*]/.test(path))
    throw new Error('The filename contains an invalid character.');
  path = path.replaceAll('/', '\\');
  if (path.startsWith('\\\\'))
    throw new Error('Network UNC paths are not mounted in this browser drive.');
  if (/^[a-z]:[^\\]/i.test(path) || /^[a-z]:$/i.test(path))
    path =
      (path.slice(0, 2).toLowerCase() === cwd.slice(0, 2).toLowerCase()
        ? cwd.replace(/\\?$/, '\\')
        : path.slice(0, 2) + '\\') + path.slice(2);
  if (!/^[a-z]:/i.test(path))
    path = path.startsWith('\\') ? cwd.slice(0, 2) + path : cwd.replace(/\\?$/, '\\') + path;
  const drive = path.slice(0, 2).toUpperCase();
  if (!/^[A-Z]:$/.test(drive) || path.slice(2).includes(':'))
    throw new Error('The path is invalid.');
  const parts = [];
  for (const part of path.slice(2).split('\\')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    const clean = part.replace(/[. ]+$/, '');
    if (!clean || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(clean))
      throw new Error('The filename is invalid or reserved.');
    parts.push(clean);
  }
  return drive + '\\' + parts.join('\\');
}
export const pathKey = (path) => normalizePath(path).toLowerCase();
export const basename = (path) =>
  normalizePath(path).split('\\').pop() || normalizePath(path).slice(0, 2);
export function dirname(path) {
  path = normalizePath(path);
  const i = path.lastIndexOf('\\');
  return i <= 2 ? path.slice(0, 3) : path.slice(0, i);
}
export const extension = (path) =>
  basename(path).includes('.') ? basename(path).split('.').pop().toLowerCase() : '';
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
const clone = (value) => structuredClone(value);
const metadata = (node) => {
  const { data, ...entry } = node;
  return clone(entry);
};
const ownedBytes = (value) =>
  value instanceof ArrayBuffer
    ? new Uint8Array(value).slice()
    : ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice()
      : new Uint8Array(value);
const structural = new Set([
  'c:\\recycled',
  'c:\\windows',
  'c:\\windows\\desktop',
  'c:\\my documents',
]);

/** Case-insensitive virtual drive with serialized, atomic IndexedDB commits. */
export class VirtualFileSystem extends EventHub {
  constructor({ name = 'millennium-drive-v1', indexedDB = globalThis.indexedDB, seed = [] } = {}) {
    super();
    this.name = name;
    this.idb = indexedDB;
    this.nodes = new Map();
    this.tail = Promise.resolve();
    this.revision = 0;
    this.persistent = false;
    this.dbRevision = 0;
    this.ready = this.#open(seed);
  }
  async #open(seed) {
    if (this.idb) {
      try {
        this.db = await new Promise((resolve, reject) => {
          const request = this.idb.open(this.name, 1);
          request.onupgradeneeded = () => {
            request.result.createObjectStore('nodes', { keyPath: 'key' });
            request.result.createObjectStore('snapshots', { keyPath: 'id' });
            request.result.createObjectStore('meta');
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          request.onblocked = () =>
            reject(new Error('The drive is open in another incompatible session.'));
        });
        this.db.onversionchange = () => {
          this.db.close();
          this.persistent = false;
          this.emit('warning', 'The drive was upgraded in another tab. Reload to reconnect.');
        };
        await this.#readDB();
        this.persistent = true;
      } catch (error) {
        this.storageError = error;
        this.db = null;
      }
    }
    if (!this.nodes.size) {
      const now = Date.now();
      for (const path of [
        'C:\\',
        'D:\\',
        'C:\\Recycled',
        'C:\\Windows',
        'C:\\Windows\\Desktop',
        'C:\\Windows\\Temp',
        'C:\\Program Files',
        'C:\\My Documents',
        'C:\\My Documents\\My Pictures',
        'C:\\My Documents\\My Music',
        'C:\\My Documents\\My Videos',
      ]) {
        const p = normalizePath(path);
        this.nodes.set(pathKey(p), {
          key: pathKey(p),
          id: uid(),
          path: p,
          name: basename(p),
          kind: 'directory',
          created: now,
          modified: now,
          hidden: p === 'C:\\Recycled',
        });
      }
      for (const item of seed) {
        const p = normalizePath(item.path);
        const data =
          typeof item.data === 'string' || item.data == null
            ? encoder.encode(item.data ?? '')
            : ownedBytes(item.data);
        this.nodes.set(pathKey(p), {
          key: pathKey(p),
          id: uid(),
          path: p,
          name: basename(p),
          kind: 'file',
          data,
          size: data.byteLength,
          mime: item.mime ?? 'text/plain',
          created: now,
          modified: now,
        });
      }
      try {
        await this.#persist(this.nodes, null);
      } catch (error) {
        if (error.code === 'conflict') await this.#readDB();
        else {
          this.storageError = error;
          this.db?.close();
          this.db = null;
          this.persistent = false;
        }
      }
    }
    if (this.db && globalThis.BroadcastChannel) {
      this.channel = new BroadcastChannel(this.name);
      this.channel.onmessage = () => {
        const refresh = async () => {
          await this.#readDB();
          this.revision++;
          this.emit('change', { revision: this.revision, external: true });
        };
        this.tail = this.tail.then(refresh).catch((error) => this.emit('warning', error.message));
      };
    }
    return this;
  }
  #readDB() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['nodes', 'meta']);
      const records = tx.objectStore('nodes').getAll();
      const revision = tx.objectStore('meta').get('revision');
      tx.oncomplete = () => {
        this.nodes = new Map(records.result.map((n) => [n.key, n]));
        this.dbRevision = revision.result ?? 0;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Reading the drive was interrupted.'));
    });
  }
  #persist(next, previous) {
    if (!this.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['nodes', 'meta'], 'readwrite');
      const store = tx.objectStore('nodes');
      let failure;
      const check = tx.objectStore('meta').get('revision');
      const expected = this.dbRevision;
      check.onsuccess = () => {
        if ((check.result ?? 0) !== expected) {
          failure = Object.assign(new Error('The drive changed in another session.'), {
            code: 'conflict',
          });
          tx.abort();
          return;
        }
        try {
          if (!previous) {
            store.clear();
            for (const n of next.values()) store.put(n);
          } else {
            for (const key of previous.keys()) if (!next.has(key)) store.delete(key);
            for (const [key, node] of next) if (node !== previous.get(key)) store.put(node);
          }
          tx.objectStore('meta').put(expected + 1, 'revision');
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        this.dbRevision = expected + 1;
        resolve();
      };
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('The drive could not be saved.'));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Drive transaction aborted.'));
    });
  }
  #mutate(operation) {
    const run = async () => {
      await this.ready;
      for (let attempt = 0; attempt < 8; attempt++) {
        const next = new Map(this.nodes);
        const result = operation(next);
        try {
          await this.#persist(next, this.nodes);
        } catch (error) {
          if (error.code === 'conflict') {
            await this.#readDB();
            continue;
          }
          throw error;
        }
        this.nodes = next;
        this.revision++;
        this.channel?.postMessage(this.dbRevision);
        this.emit('change', { revision: this.revision });
        return clone(result);
      }
      throw new Error('The drive is busy in another tab. Please try again.');
    };
    const task = this.tail.then(run);
    this.tail = task.catch(() => {});
    return task;
  }
  stat(path) {
    const n = this.nodes.get(pathKey(path));
    return n ? metadata(n) : undefined;
  }
  exists(path) {
    try {
      return this.nodes.has(pathKey(path));
    } catch {
      return false;
    }
  }
  list(path, { hidden = false } = {}) {
    const p = pathKey(path);
    const node = this.nodes.get(p);
    if (!node || node.kind !== 'directory') throw new Error('The folder cannot be found.');
    return [...this.nodes.values()]
      .filter((n) => n.key !== p && pathKey(dirname(n.path)) === p && (hidden || !n.hidden))
      .map(metadata)
      .sort(
        (a, b) =>
          (a.kind === b.kind ? 0 : a.kind === 'directory' ? -1 : 1) ||
          a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
  }
  walk(path = 'C:\\') {
    const p = pathKey(path).replace(/\\$/, '') + '\\';
    return [...this.nodes.values()].filter((n) => n.key.startsWith(p)).map(metadata);
  }
  readFile(path, as = 'text') {
    const node = this.nodes.get(pathKey(path));
    if (!node || node.kind !== 'file')
      throw new Error(`Cannot open ${basename(path)}. The file cannot be found.`);
    return as === 'bytes'
      ? new Uint8Array(node.data)
      : as === 'blob'
        ? new Blob([node.data], { type: node.mime })
        : decoder.decode(node.data);
  }
  writeFile(path, content, mime = 'text/plain') {
    path = normalizePath(path);
    const data = typeof content === 'string' ? encoder.encode(content) : ownedBytes(content);
    return this.#mutate((nodes) => {
      const parent = nodes.get(pathKey(dirname(path)));
      if (!parent || parent.kind !== 'directory')
        throw new Error('The destination folder does not exist.');
      const previous = nodes.get(pathKey(path));
      if (previous?.kind === 'directory') throw new Error('A folder already has this name.');
      if (previous?.readonly) throw new Error('This file is read-only.');
      const now = Date.now();
      const node = {
        ...previous,
        key: pathKey(path),
        id: previous?.id ?? uid(),
        path,
        name: basename(path),
        kind: 'file',
        data,
        size: data.byteLength,
        mime,
        created: previous?.created ?? now,
        modified: now,
      };
      nodes.set(node.key, node);
      return node;
    });
  }
  mkdir(path) {
    path = normalizePath(path);
    return this.#mutate((nodes) => {
      if (nodes.has(pathKey(path)))
        throw new Error('A file or folder with that name already exists.');
      if (nodes.get(pathKey(dirname(path)))?.kind !== 'directory')
        throw new Error('The parent folder cannot be found.');
      const node = {
        key: pathKey(path),
        id: uid(),
        path,
        name: basename(path),
        kind: 'directory',
        created: Date.now(),
        modified: Date.now(),
      };
      nodes.set(node.key, node);
      return node;
    });
  }
  #relocate(nodes, source, destination, copying = false) {
    source = normalizePath(source);
    destination = normalizePath(destination);
    const src = pathKey(source),
      dst = pathKey(destination);
    const original = nodes.get(src);
    if (!original) throw new Error('The source cannot be found.');
    if (source.length === 3) throw new Error('A drive cannot be moved or copied.');
    if (structural.has(src) && !copying) throw new Error('This system folder cannot be moved.');
    if (copying && dst === src) throw new Error('The source and destination are the same.');
    if (dst === src && source === destination) return original;
    if (dst.startsWith(src + '\\')) throw new Error('A folder cannot be placed inside itself.');
    if (nodes.has(dst) && dst !== src) throw new Error('The destination already exists.');
    if (nodes.get(pathKey(dirname(destination)))?.kind !== 'directory')
      throw new Error('The destination folder cannot be found.');
    const matches = [...nodes.values()].filter(
      (n) => n.key === src || n.key.startsWith(src + '\\'),
    );
    if (!copying) for (const n of matches) nodes.delete(n.key);
    for (const n of matches) {
      const p = destination + n.path.slice(source.length);
      const next = {
        ...n,
        key: pathKey(p),
        path: p,
        name: basename(p),
        id: copying ? uid() : n.id,
        modified: Date.now(),
      };
      if (copying && n.kind === 'file') next.data = new Uint8Array(n.data);
      nodes.set(next.key, next);
    }
    return nodes.get(dst);
  }
  move(source, destination) {
    return this.#mutate((nodes) => this.#relocate(nodes, source, destination));
  }
  copy(source, destination) {
    return this.#mutate((nodes) => this.#relocate(nodes, source, destination, true));
  }
  rename(path, name) {
    if (!name || /[\\/]/.test(name)) return Promise.reject(new Error('Enter a valid filename.'));
    return this.move(path, dirname(path) + '\\' + name);
  }
  remove(path, { permanent = false } = {}) {
    path = normalizePath(path);
    return this.#mutate((nodes) => {
      const key = pathKey(path);
      const original = nodes.get(key);
      if (!original) throw new Error('The file cannot be found.');
      if (path.length === 3 || structural.has(key))
        throw new Error('This system folder cannot be deleted.');
      if (original.readonly)
        throw new Error(
          'This file is read-only. Clear the read-only attribute before deleting it.',
        );
      if (!permanent && !key.startsWith('c:\\recycled\\')) {
        const destination = 'C:\\Recycled\\' + uid().slice(0, 8) + '-' + original.name;
        const node = this.#relocate(nodes, path, destination);
        nodes.set(node.key, { ...node, originalPath: path, deleted: Date.now() });
        return { originalPath: path, path: destination };
      }
      for (const k of [...nodes.keys()]) if (k === key || k.startsWith(key + '\\')) nodes.delete(k);
      return { path };
    });
  }
  restore(path) {
    return this.#mutate((nodes) => {
      const n = nodes.get(pathKey(path));
      if (!n?.originalPath) throw new Error('This item cannot be restored.');
      const moved = this.#relocate(nodes, n.path, n.originalPath);
      const result = { ...moved };
      delete result.originalPath;
      delete result.deleted;
      nodes.set(result.key, result);
      return result;
    });
  }
  emptyRecycleBin() {
    return this.#mutate((nodes) => {
      for (const k of [...nodes.keys()]) if (k.startsWith('c:\\recycled\\')) nodes.delete(k);
      return true;
    });
  }
  setAttributes(path, attrs) {
    return this.#mutate((nodes) => {
      const k = pathKey(path),
        n = nodes.get(k);
      if (!n) throw new Error('File not found.');
      const next = {
        ...n,
        hidden: attrs.hidden === undefined ? n.hidden : !!attrs.hidden,
        readonly: attrs.readonly === undefined ? n.readonly : !!attrs.readonly,
      };
      nodes.set(k, next);
      return next;
    });
  }
  uniqueName(folder, name) {
    const ext = /\.[^.]+$/.exec(name)?.[0] ?? '';
    const stem = name.slice(0, name.length - ext.length);
    let candidate = name,
      i = 2;
    while (this.exists(folder + '\\' + candidate)) candidate = `${stem} (${i++})${ext}`;
    return candidate;
  }
  search(query, folder = 'C:\\') {
    const escaped = query
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replaceAll('*', '.*')
      .replaceAll('?', '.');
    const regex = new RegExp(
      query.includes('*') || query.includes('?') ? '^' + escaped + '$' : escaped,
      'i',
    );
    return this.walk(folder).filter(
      (n) => !n.key.startsWith('c:\\recycled\\') && regex.test(n.name),
    );
  }
  exportData() {
    return {
      format: 'millennium-drive',
      version: 1,
      created: Date.now(),
      nodes: [...this.nodes.values()].map((n) => ({
        ...n,
        data: n.data ? Array.from(n.data) : undefined,
      })),
    };
  }
  importData(snapshot) {
    if (
      snapshot?.format !== 'millennium-drive' ||
      snapshot.version !== 1 ||
      !Array.isArray(snapshot.nodes) ||
      snapshot.nodes.length > 100000
    )
      return Promise.reject(new Error('This is not a valid Millennium drive backup.'));
    return this.#mutate((nodes) => {
      const next = new Map();
      const ids = new Set();
      let totalBytes = 0;
      for (const raw of snapshot.nodes) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
          throw new Error('Invalid backup entry.');
        const path = normalizePath(raw.path);
        if (!['directory', 'file'].includes(raw.kind)) throw new Error('Invalid backup entry.');
        if (
          raw.kind === 'file' &&
          (!Array.isArray(raw.data) ||
            raw.data.length > 67108864 ||
            raw.data.some((b) => !Number.isInteger(b) || b < 0 || b > 255))
        )
          throw new Error('Invalid or oversized file data.');
        totalBytes += raw.data?.length ?? 0;
        if (totalBytes > 268435456) throw new Error('The backup exceeds 256 MB.');
        if (typeof raw.id !== 'string' || ids.has(raw.id))
          throw new Error('Invalid or duplicate file identity.');
        ids.add(raw.id);
        for (const attr of ['readonly', 'hidden'])
          if (raw[attr] !== undefined && typeof raw[attr] !== 'boolean')
            throw new Error('Invalid file attributes.');
        const data = raw.kind === 'file' ? new Uint8Array(raw.data) : undefined;
        const n = {
          path,
          key: pathKey(path),
          name: basename(path),
          id: raw.id,
          kind: raw.kind,
          data,
          size: data?.length,
          mime: typeof raw.mime === 'string' ? raw.mime : 'application/octet-stream',
          created: Number.isFinite(raw.created) ? raw.created : Date.now(),
          modified: Number.isFinite(raw.modified) ? raw.modified : Date.now(),
          readonly: !!raw.readonly,
          hidden: !!raw.hidden,
        };
        if (raw.originalPath) {
          n.originalPath = normalizePath(raw.originalPath);
          n.deleted = Number(raw.deleted) || Date.now();
        }
        if (next.has(n.key)) throw new Error('Duplicate path in backup.');
        next.set(n.key, n);
      }
      for (const p of ['C:\\', 'D:\\', 'C:\\Recycled', 'C:\\Windows\\Desktop', 'C:\\My Documents'])
        if (next.get(pathKey(p))?.kind !== 'directory')
          throw new Error('The backup is missing a required system folder.');
      for (const n of next.values())
        if (n.path.length > 3 && next.get(pathKey(dirname(n.path)))?.kind !== 'directory')
          throw new Error('The backup contains an orphaned file.');
      nodes.clear();
      for (const [key, n] of next) nodes.set(key, n);
      return true;
    });
  }
  async saveSnapshot(label, settings = {}) {
    await this.ready;
    await this.tail;
    const snapshot = {
      id: uid(),
      label,
      created: Date.now(),
      drive: this.exportData(),
      settings: clone(settings),
    };
    if (!this.db) {
      this.memorySnapshots ??= [];
      this.memorySnapshots.push(snapshot);
      return snapshot.id;
    }
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').put(snapshot);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('The restore point could not be saved.'));
    });
    return snapshot.id;
  }
  async snapshots() {
    await this.ready;
    if (!this.db) return clone(this.memorySnapshots ?? []);
    return new Promise((resolve, reject) => {
      const r = this.db.transaction('snapshots').objectStore('snapshots').getAll();
      r.onsuccess = () => resolve(r.result.sort((a, b) => b.created - a.created));
      r.onerror = () => reject(r.error);
    });
  }
  async importFiles(files, folder = 'C:\\My Documents') {
    const paths = [];
    for (const file of files) {
      const data = new Uint8Array(await file.arrayBuffer());
      const original = file.name.replace(/[<>:"/\\|?*\0]/g, '_');
      const path = await this.#mutate((nodes) => {
        if (nodes.get(pathKey(folder))?.kind !== 'directory')
          throw new Error('The destination folder cannot be found.');
        const ext = /\.[^.]+$/.exec(original)?.[0] ?? '',
          stem = original.slice(0, original.length - ext.length);
        let name = original,
          i = 2;
        while (nodes.has(pathKey(folder + '\\' + name))) name = `${stem} (${i++})${ext}`;
        const p = normalizePath(folder + '\\' + name),
          now = Date.now();
        nodes.set(pathKey(p), {
          key: pathKey(p),
          path: p,
          name,
          id: uid(),
          kind: 'file',
          data,
          size: data.length,
          mime: file.type || 'application/octet-stream',
          created: now,
          modified: now,
        });
        return p;
      });
      paths.push(path);
    }
    return paths;
  }
  close() {
    this.channel?.close();
    this.db?.close();
    this.clear();
  }
}
