import test from 'node:test';
import assert from 'node:assert/strict';
import { environment } from './environment.mjs';
import { Surface } from '../dist/packages/renderer/src/index.js';
import { sanitizeRichText } from '../dist/packages/accessories/src/rich-text.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
test('Integrated desktop boots and every registered application creates and disposes a window', async () => {
  const env = environment();
  let sys;
  try {
    await import('../dist/main.js');
    sys = globalThis.millennium;
    await tick();
    assert.equal(document.documentElement.dataset.ready, 'true');
    assert.equal(document.querySelectorAll('.desktop-icon').length, 11);
    assert.ok(document.querySelector('.start-button'));
    assert.ok(sys.registry.list().length >= 50);
    sys.error = (error) => {
      throw error;
    };
    sys.menus.onError = sys.error;
    for (const win of [...sys.wm.windows.values()]) await sys.wm.close(win.id, { force: true });
    for (const app of sys.registry.list()) {
      const win = await sys.launch(app.id);
      assert.ok(win?.element.isConnected, app.id + ' did not create a window');
      assert.ok(win.title, app.id + ' has no title');
      await env.flushFrame();
      for (const opened of [...sys.wm.windows.values()])
        await sys.wm.close(opened.id, { force: true });
      assert.equal(sys.wm.windows.size, 0, app.id + ' left a window behind');
    }
    assert.deepEqual(env.failures, []);
    assert.equal(sys.surfaces.size, 1, 'Media surfaces must be disposed when windows close');
    console.log(`Application smoke coverage: ${sys.registry.list().length} registered apps.`);
  } finally {
    if (sys) {
      for (const w of [...sys.wm.windows.values()]) await sys.wm.close(w.id, { force: true });
      for (const surface of sys.surfaces) surface.dispose();
      sys.wm.abort.abort();
      sys.fs.close();
    }
    env.close();
    delete globalThis.millennium;
  }
});
test('Renderer handles unsupported GPU, last-backend failure and detached hosts', async () => {
  const env = environment();
  let surface;
  try {
    const canvas = document.querySelector('canvas');
    canvas.getBoundingClientRect = () => ({ width: 320, height: 200 });
    surface = new Surface(canvas);
    await surface.ready;
    assert.equal(surface.backendName, 'Canvas 2D');
    assert.equal(surface.state, 'ready');
    surface.canvas.getBoundingClientRect = () => ({ width: 320, height: 200 });
    await env.flushFrame();
    assert.equal(surface.frameCount, 1);
    surface.backend.draw = () => {
      throw new Error('test draw failure');
    };
    surface.invalidate();
    await env.flushFrame();
    await surface.ready;
    assert.equal(surface.state, 'failed');
    assert.equal(surface.generation, 2, 'No retry loop on the last backend');
    assert.throws(() => new Surface(document.createElement('canvas')), /Attach/);
  } finally {
    surface?.dispose();
    env.close();
  }
});
test('WordPad retains embedded raster images and removes active imported markup', () => {
  const env = environment();
  try {
    const body = sanitizeRichText(
      '<p style="color:red;position:fixed;background-image:url(https://example.test/a)">Text</p><img src="data:image/png;base64,aGVsbG8=" onerror="bad()"><script>bad()</script><iframe src="https://example.test"></iframe>',
    );
    assert.equal(body.querySelector('img').getAttribute('src'), 'data:image/png;base64,aGVsbG8=');
    assert.equal(body.querySelector('img').hasAttribute('onerror'), false);
    assert.equal(body.querySelector('script,iframe'), null);
    assert.equal(body.querySelector('p').style.color, 'red');
    assert.equal(body.querySelector('p').style.position, '');
  } finally {
    env.close();
  }
});

test('Document workflows, window state, file dialogs, terminal and page tools share the same drive', async () => {
  const env = environment();
  let sys;
  const tools = new Map();
  document.modelContext = {
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
  };
  localStorage.setItem('millennium.settings.v1', JSON.stringify({ showWelcome: false }));
  try {
    await import('../dist/main.js?workflow-tests');
    sys = globalThis.millennium;
    await tick();
    sys.error = (error) => {
      throw error;
    };
    sys.menus.onError = sys.error;
    const note = await sys.launch('notepad'),
      editor = note.element.querySelector('textarea');
    editor.value = 'A saved note\n第二行';
    editor.dispatchEvent(new Event('input'));
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    await tick();
    const saveDialog = sys.wm.active;
    assert.equal(saveDialog.title, 'Save As');
    saveDialog.element.querySelector('[aria-label="File name"]').value = 'Regression.txt';
    [...saveDialog.content.querySelectorAll('button')]
      .find((b) => b.textContent === 'Save')
      .click();
    await tick();
    await sys.fs.tail;
    await tick();
    assert.equal(sys.fs.readFile('C:\\My Documents\\Regression.txt'), 'A saved note\r\n第二行');
    assert.equal(note.title, 'Regression.txt - Notepad');
    note.maximize();
    assert.equal(note.state, 'maximized');
    note.minimize();
    note.minimize();
    note.restore();
    assert.equal(note.state, 'maximized');
    note.restore();
    assert.equal(note.state, 'normal');
    editor.value += ' unsaved';
    editor.dispatchEvent(new Event('input'));
    const pending = note.close();
    await tick();
    const prompt = sys.wm.active;
    assert.equal(prompt.options.modal, true);
    [...prompt.content.querySelectorAll('button')].find((b) => b.textContent === 'Cancel').click();
    assert.equal(await pending, false);
    assert.equal(note.closed, false);
    await sys.wm.close(note.id, { force: true });
    const reopened = await sys.open('C:\\My Documents\\Regression.txt');
    assert.equal(reopened.element.querySelector('textarea').value, 'A saved note\n第二行');
    await reopened.close();
    const terminal = await sys.launch('terminal', { path: 'C:\\My Documents' });
    await terminal.execute('MD "Batch Folder"');
    await terminal.execute('ECHO alpha > "Batch Folder\\a.txt"');
    await terminal.execute('ECHO beta >> "Batch Folder\\a.txt"');
    assert.equal(await terminal.execute('TYPE "Batch Folder\\a.txt" | FIND "beta"'), 'beta');
    await terminal.execute('COPY "Batch Folder\\a.txt" "Batch Folder\\b.txt"');
    assert.equal(
      await terminal.execute('FC "Batch Folder\\a.txt" "Batch Folder\\b.txt"'),
      'FC: no differences encountered',
    );
    await sys.fs.writeFile(
      'C:\\My Documents\\test.bat',
      '@echo off\r\necho Hello %1\r\ngoto done\r\necho BAD\r\n:done\r\necho Done',
    );
    assert.equal(await terminal.execute('test.bat Friend'), 'Hello Friend\nDone');
    assert.equal(tools.size, 4);
    assert.ok(
      tools
        .get('list_desktop_applications')
        .execute({})
        .applications.some((a) => a.id === 'paint'),
    );
    await tools
      .get('save_virtual_text_file')
      .execute({ path: 'C:\\My Documents\\Agent.txt', text: 'Same drive' });
    assert.equal(sys.fs.readFile('C:\\My Documents\\Agent.txt'), 'Same drive');
    assert.throws(() => tools.get('list_virtual_files').execute({}), /path/);
    await assert.rejects(
      tools.get('open_desktop_application').execute({ id: 'missing-app' }),
      /Unknown/,
    );
    const result = await tools.get('open_desktop_application').execute({ id: 'calculator' });
    assert.equal(result.opened, true);
    assert.equal(sys.wm.active.title, 'Calculator');
    assert.deepEqual(env.failures, []);
  } finally {
    if (sys) {
      for (const w of [...sys.wm.windows.values()]) await sys.wm.close(w.id, { force: true });
      for (const s of sys.surfaces) s.dispose();
      sys.menus.dispose();
      sys.wm.abort.abort();
      sys.fs.close();
    }
    env.close();
    delete globalThis.millennium;
  }
});
