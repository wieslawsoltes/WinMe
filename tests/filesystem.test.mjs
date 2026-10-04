import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  VirtualFileSystem,
  normalizePath,
  dirname,
  extension,
} from '../dist/packages/filesystem/src/index.js';
const root = 'C:\\My Documents';

test('Windows paths resolve drives, separators, dot segments and reserved names', () => {
  assert.equal(normalizePath('../hello.txt', root + '\\Folder'), root + '\\hello.txt');
  assert.equal(normalizePath('c:test.txt', root), root + '\\test.txt');
  assert.equal(normalizePath('c:/Windows/../hello. '), 'C:\\hello');
  assert.equal(dirname('C:\\file.txt'), 'C:\\');
  assert.equal(extension('X.TXT'), 'txt');
  for (const path of ['C:\\NUL.txt', 'C:\\bad?.txt', 'C:\\x:y', '\\\\server\\share'])
    assert.throws(() => normalizePath(path));
});
test('File operations persist, preserve identity, recycle trees and own binary data', async () => {
  const indexedDB = new IDBFactory(),
    fs = new VirtualFileSystem({ indexedDB, name: 'operations' });
  await fs.ready;
  try {
    await fs.mkdir(root + '\\Folder');
    const bytes = new Uint8Array([3, 4, 5]);
    const result = await fs.writeFile(root + '\\Folder\\A.bin', bytes);
    bytes[0] = 99;
    assert.deepEqual([...fs.readFile(root + '\\Folder\\a.BIN', 'bytes')], [3, 4, 5]);
    const clone = fs.readFile(root + '\\Folder\\A.bin', 'bytes');
    clone[1] = 55;
    assert.equal(fs.readFile(root + '\\Folder\\A.bin', 'bytes')[1], 4);
    assert.equal(
      fs.stat(root + '\\Folder\\A.bin').data,
      undefined,
      'stat exposes metadata without copying file buffers',
    );
    await fs.rename(root + '\\Folder\\A.bin', 'a.BIN');
    assert.equal(fs.stat(root + '\\Folder\\a.BIN').id, result.id);
    await fs.copy(root + '\\Folder', root + '\\Copy');
    assert.notEqual(fs.stat(root + '\\Copy\\a.BIN').id, result.id);
    const removed = await fs.remove(root + '\\Folder');
    assert.equal(fs.exists(root + '\\Folder'), false);
    await fs.restore(removed.path);
    assert.equal(fs.exists(root + '\\Folder\\a.BIN'), true);
    const reopened = new VirtualFileSystem({ indexedDB, name: 'operations' });
    await reopened.ready;
    assert.deepEqual([...reopened.readFile(root + '\\Folder\\a.BIN', 'bytes')], [3, 4, 5]);
    reopened.close();
    await assert.rejects(fs.move(root, root + '\\inside'), /system folder/i);
    await fs.setAttributes(root + '\\Folder\\a.BIN', { readonly: true });
    await assert.rejects(fs.writeFile(root + '\\Folder\\a.BIN', 'bad'), /read-only/);
  } finally {
    fs.close();
  }
});
test('Concurrent sessions commit without dropping unrelated files', async () => {
  const indexedDB = new IDBFactory(),
    a = new VirtualFileSystem({ indexedDB, name: 'concurrent' }),
    b = new VirtualFileSystem({ indexedDB, name: 'concurrent' });
  await Promise.all([a.ready, b.ready]);
  try {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 ? a : b).writeFile(root + '\\file-' + i + '.txt', String(i)),
      ),
    );
    const verify = new VirtualFileSystem({ indexedDB, name: 'concurrent' });
    await verify.ready;
    assert.equal(verify.search('file-*.txt', root).length, 12);
    for (let i = 0; i < 12; i++)
      assert.equal(verify.readFile(root + '\\file-' + i + '.txt'), String(i));
    verify.close();
  } finally {
    a.close();
    b.close();
  }
});
test('A rejected commit never publishes uncommitted file state', async () => {
  const fs = new VirtualFileSystem({ indexedDB: new IDBFactory(), name: 'abort' });
  await fs.ready;
  try {
    await fs.writeFile(root + '\\atomic.txt', 'before');
    const transaction = fs.db.transaction.bind(fs.db);
    fs.db.transaction = (...args) => {
      const tx = transaction(...args);
      if (args[1] === 'readwrite') queueMicrotask(() => tx.abort());
      return tx;
    };
    await assert.rejects(fs.writeFile(root + '\\atomic.txt', 'after'));
    assert.equal(fs.readFile(root + '\\atomic.txt'), 'before');
    fs.db.transaction = transaction;
    await fs.writeFile(root + '\\atomic.txt', 'recovered');
    assert.equal(fs.readFile(root + '\\atomic.txt'), 'recovered');
  } finally {
    fs.close();
  }
});
test('Backup validation is atomic and restore points reproduce drive data', async () => {
  const fs = new VirtualFileSystem({ indexedDB: null });
  await fs.ready;
  try {
    await fs.writeFile(root + '\\note.txt', 'original');
    const backup = fs.exportData();
    await fs.saveSnapshot('Checkpoint', { theme: 'standard' });
    await fs.writeFile(root + '\\note.txt', 'edited');
    const bad = structuredClone(backup);
    bad.nodes.push({ ...bad.nodes.at(-1) });
    await assert.rejects(fs.importData(bad), /duplicate/i);
    assert.equal(fs.readFile(root + '\\note.txt'), 'edited');
    await fs.importData((await fs.snapshots())[0].drive);
    assert.equal(fs.readFile(root + '\\note.txt'), 'original');
    const a = new File(['a'], 'same.txt'),
      b = new File(['b'], 'same.txt');
    const paths = await Promise.all([fs.importFiles([a]), fs.importFiles([b])]);
    assert.notEqual(paths[0][0], paths[1][0]);
  } finally {
    fs.close();
  }
});
