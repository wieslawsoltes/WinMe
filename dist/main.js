import { Settings, AppRegistry, escapeHTML, tokenize } from './packages/core/src/index.js';
import {
  VirtualFileSystem,
  basename,
  dirname,
  extension,
  normalizePath,
} from './packages/filesystem/src/index.js';
import { h, button, download } from './packages/ui/src/dom.js';
import { MenuManager } from './packages/ui/src/menus.js';
import { WindowManager } from './packages/shell/src/windows.js';
import { Dialogs } from './packages/shell/src/dialogs.js';
import { DesktopShell } from './packages/shell/src/desktop.js';
import { createExplorer, showFileProperties } from './packages/shell/src/explorer.js';
import { Surface, SoundEngine } from './packages/renderer/src/index.js';
import { registerAccessories } from './packages/accessories/src/index.js';
import { registerGames } from './packages/games/src/index.js';
import { registerMedia } from './packages/media/src/index.js';
import { makeSampleWav } from './packages/media/src/player.js';
import { registerSystem } from './packages/system/src/index.js';
import { registerInternet } from './packages/internet/src/index.js';

const settings = new Settings();
const fs = new VirtualFileSystem({
  seed: [
    {
      path: 'C:\\My Documents\\Welcome.txt',
      data: 'Welcome to Windows Millennium Edition\r\n\r\nYour desktop is ready.\r\n\r\nTry these things:\r\n  - Open Paint and create a picture.\r\n  - Save a note in My Documents.\r\n  - Play the sample song in Windows Media Player.\r\n  - Find games in Start > Programs > Games.\r\n  - Type HELP in MS-DOS Prompt.\r\n\r\nFiles are saved locally in this browser. Use Backup to export your drive.\r\n\r\nThis is an independent browser reimplementation. It does not run native Windows executables or drivers. Open Help > Compatibility for details.\r\n',
    },
    {
      path: 'C:\\My Documents\\Read Me First.txt',
      data: 'MILLENNIUM DESKTOP\r\n\r\nShortcuts\r\n---------\r\nCtrl+Esc       Open Start menu\r\nAlt+Space      Open window menu\r\nAlt+F4         Close application (when the browser allows it)\r\nCtrl+S         Save document\r\nF2             Rename / new game\r\nF1             Help and Support\r\n\r\nThe browser and host operating system may intercept some shortcuts. All essential actions are available from visible menus.\r\n',
    },
    {
      path: 'C:\\Windows\\win.ini',
      data: '; Millennium browser desktop configuration\r\n[windows]\r\nload=\r\nrun=\r\n[desktop]\r\nWallpaper=(None)\r\n',
    },
    {
      path: 'C:\\AUTOEXEC.BAT',
      data: '@echo off\r\nrem Millennium browser command environment\r\nset PATH=C:\\WINDOWS;C:\\WINDOWS\\COMMAND\r\n',
    },
    {
      path: 'C:\\My Documents\\My Music\\Millennium.wav',
      data: makeSampleWav(),
      mime: 'audio/wav',
    },
  ],
});
await fs.ready;
for (const path of ['C:\\My Briefcase', 'C:\\Windows\\StartUp'])
  if (!fs.exists(path)) await fs.mkdir(path);
const registry = new AppRegistry(),
  menus = new MenuManager(document.querySelector('#menus')),
  wm = new WindowManager(document.querySelector('#windows'), menus, settings),
  dialogs = new Dialogs(wm, fs),
  sound = new SoundEngine(settings);
const sys = {
  fs,
  registry,
  menus,
  wm,
  dialogs,
  settings,
  sound,
  clipboard: { text: '', files: [], cut: false, image: null },
  surfaces: new Set(),
  version: '1.0.0',
};
sys.error = (error) => {
  console.error(error);
  sound.play('error');
  return dialogs.message(error?.message ?? String(error), { title: 'Windows', icon: 'windows' });
};
menus.onError = sys.error;
sys.launch = async (id, args = {}) => {
  try {
    const app = registry.get(id);
    if (!app) throw new Error(`Cannot find the program “${id}”. Check the name and try again.`);
    if ((settings.get('disabledApps') ?? []).includes(app.id)) {
      const choice = await dialogs.message(app.title + ' is not installed in this desktop.', {
        title: 'Program Not Installed',
        buttons: ['Add/Remove Programs', 'Cancel'],
      });
      if (choice === 'Add/Remove Programs') return sys.launch('add-remove');
      return null;
    }
    if (app.singleton) {
      const previous = [...wm.windows.values()].find((w) => w.appId === app.id);
      if (previous) {
        previous.focus();
        await previous.onLaunch?.(args);
        return previous;
      }
    }
    const context = Object.create(sys);
    context.createWindow = (options) =>
      wm.create({ appId: app.id, icon: app.icon, title: app.title, ...options });
    const result = await app.create(context, args);
    document.querySelector('#announcer').textContent = app.title + ' opened.';
    return result;
  } catch (error) {
    await sys.error(error);
    return null;
  }
};
sys.open = async (path) => {
  try {
    if (/^https?:|^about:/i.test(path)) return sys.launch('browser', { url: path });
    const node = fs.stat(path);
    if (!node) throw new Error(`Cannot find “${path}”.`);
    if (node.kind === 'directory') return sys.launch('explorer', { path: node.path });
    const ext = extension(path);
    if (ext === 'lnk') {
      const data = JSON.parse(fs.readFile(path));
      if (data.command) return sys.run(data.command);
      if (data.app) return sys.launch(data.app, data.args ?? {});
      if (data.target) return sys.open(data.target);
      throw new Error('This shortcut has no valid target.');
    }
    if (ext === 'url') {
      const text = fs.readFile(path);
      return sys.launch('browser', { url: /^URL=(.+)$/im.exec(text)?.[1]?.trim() ?? text.trim() });
    }
    if (['exe', 'com', 'dll'].includes(ext)) {
      const app = registry.get(basename(path));
      if (app) return sys.launch(app.id);
      return dialogs.message(
        'This file requires a native Windows runtime.\n\nThis desktop reimplements its registered applications in JavaScript; it does not emulate arbitrary EXE, COM, or DLL binaries.',
        { title: 'Cannot Run Program', icon: 'windows' },
      );
    }
    const recent = settings.get('recentFiles') ?? [];
    settings.set('recentFiles', [...recent.filter((p) => p !== node.path), node.path].slice(-15));
    if (ext === 'bat') {
      const win = await sys.launch('terminal', { path: dirname(path) });
      if (win?.execute) {
        const output = await win.execute('"' + path + '"');
        win.element
          .querySelector('.terminal-output')
          .append(document.createTextNode('\n' + output + '\n'));
      }
      return win;
    }
    if (ext === 'eml') return sys.launch('notepad', { path });
    const app =
      registry.forFile(path) ??
      (node.mime?.startsWith('audio/') || node.mime?.startsWith('video/')
        ? 'media-player'
        : node.mime?.startsWith('image/')
          ? 'paint'
          : 'notepad');
    return sys.launch(app, { path });
  } catch (error) {
    return sys.error(error);
  }
};
sys.run = async (command) => {
  const expanded = command
    .replace(/%windir%/gi, 'C:\\Windows')
    .replace(/%temp%/gi, 'C:\\Windows\\Temp');
  const [name, ...args] = tokenize(expanded);
  if (!name) return;
  if (name.toLowerCase() === 'control' && args.length) return sys.launch(args[0]);
  if (/^https?:|^about:/i.test(name)) return sys.launch('browser', { url: expanded });
  if (name.toLowerCase() === 'shutdown') {
    shell.shutdownDialog(args.includes('-r') ? 'restart' : 'shutdown');
    return;
  }
  if (name.toLowerCase() === 'taskmgr') {
    shell.closeProgram();
    return;
  }
  if (registry.get(name)) {
    let params = { commandArgs: args };
    if (args[0]) {
      try {
        if (fs.exists(args[0])) params.path = normalizePath(args[0]);
        else if (/^https?:/.test(args[0])) params.url = args[0];
      } catch {}
    }
    return sys.launch(name, params);
  }
  try {
    if (fs.exists(expanded)) return sys.open(expanded);
    if (fs.exists(name)) return sys.open(name);
  } catch {}
  return sys.error(
    new Error(
      `Cannot find “${name}” (or one of its components). Make sure the path and filename are correct.`,
    ),
  );
};
sys.properties = (path) => showFileProperties(sys, path);
sys.printHTML = (html, title = 'Document') => {
  const frame = h('iframe', {
    title: 'Print ' + title,
    style: {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '800px',
      height: '1000px',
      border: '0',
    },
    sandbox: 'allow-same-origin allow-modals',
  });
  frame.srcdoc =
    '<!doctype html><html><head><meta charset="utf-8"><title>' +
    escapeHTML(title) +
    '</title><style>body{font:14px Arial,sans-serif;margin:25mm}pre{white-space:pre-wrap;font:12px monospace}img{max-width:100%}@page{margin:20mm}</style></head><body>' +
    html +
    '</body></html>';
  frame.addEventListener('load', () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (e) {
      sys.error(e);
    }
    setTimeout(() => frame.remove(), 30000);
  });
  document.body.append(frame);
};
sys.printText = (text, title) => sys.printHTML('<pre>' + escapeHTML(text) + '</pre>', title);

registry.register({
  id: 'explorer',
  title: 'Windows Explorer',
  icon: 'folder',
  category: 'Accessories',
  commands: ['explorer.exe'],
  create: createExplorer,
});
registry.register({
  id: 'briefcase',
  title: 'My Briefcase',
  icon: 'briefcase',
  create: (context) => {
    const win = createExplorer(context, { path: 'C:\\My Briefcase' });
    win.setTitle('My Briefcase');
    let pairs = settings.get('briefcasePairs') ?? [];
    const add = async () => {
      const p = await dialogs.file();
      if (!p) return;
      try {
        const dest = 'C:\\My Briefcase\\' + fs.uniqueName('C:\\My Briefcase', basename(p));
        await fs.copy(p, dest);
        pairs.push({ source: p, copy: dest, synced: Date.now() });
        settings.set('briefcasePairs', pairs);
      } catch (e) {
        sys.error(e);
      }
    };
    const update = async () => {
      let updated = 0;
      for (const pair of pairs) {
        const a = fs.stat(pair.source),
          b = fs.stat(pair.copy);
        if (!a || !b) continue;
        const sourceChanged = a.modified > pair.synced,
          copyChanged = b.modified > pair.synced;
        if (!sourceChanged && !copyChanged) continue;
        let useSource = sourceChanged;
        if (sourceChanged && copyChanged) {
          const choice = await dialogs.message(
            b.name + ' has changed in both locations. Which version do you want to keep?',
            { title: 'Update Briefcase', buttons: ['Original', 'Briefcase', 'Skip'] },
          );
          if (choice !== 'Original' && choice !== 'Briefcase') continue;
          useSource = choice === 'Original';
        }
        await fs.writeFile(
          useSource ? pair.copy : pair.source,
          fs.readFile(useSource ? pair.source : pair.copy, 'bytes'),
          a.mime,
        );
        pair.synced = Date.now();
        updated++;
      }
      settings.set('briefcasePairs', pairs);
      dialogs.message(updated + ' file(s) updated.', { title: 'Briefcase', icon: 'briefcase' });
    };
    const tools = h(
      'div',
      { class: 'toolbar' },
      button('Add Original File...', add, { class: 'tool-button' }),
      button('Update All', update, { class: 'tool-button' }),
    );
    win.content.insertBefore(tools, win.content.children[1]);
    return win;
  },
});
registerAccessories(registry);
registerGames(registry);
registerMedia(registry);
registerSystem(registry);
registerInternet(registry);

const desktopSurface = new Surface(document.querySelector('#desktop-surface'), {
  color: settings.get('desktopColor'),
  preference: settings.get('renderer'),
});
sys.surfaces.add(desktopSurface);
const wallpaper = h('div', {
  id: 'wallpaper',
  style: { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '0' },
});
document
  .querySelector('#desktop')
  .insertBefore(wallpaper, document.querySelector('#desktop-icons'));
let wallpaperURL;
const applySettings = (changes) => {
  const body = document.body;
  body.className = 'theme-' + settings.get('theme');
  body.style.setProperty('--desktop', settings.get('desktopColor'));
  desktopSurface.setColor(settings.get('desktopColor'));
  if (!changes || changes.wallpaper !== undefined || changes.wallpaperStyle !== undefined) {
    URL.revokeObjectURL(wallpaperURL);
    const chosen = settings.get('wallpaper');
    wallpaper.style.backgroundImage = 'none';
    wallpaper.hidden = chosen === 'none';
    if (chosen === 'rivet') {
      wallpaper.style.backgroundImage = 'radial-gradient(#a1b7c5 1px,transparent 1px)';
      wallpaper.style.backgroundSize = '8px 8px';
      wallpaper.style.backgroundRepeat = 'repeat';
    } else if (chosen && chosen !== 'none' && fs.exists(chosen)) {
      wallpaperURL = URL.createObjectURL(fs.readFile(chosen, 'blob'));
      wallpaper.style.backgroundImage = `url("${wallpaperURL}")`;
      const style = settings.get('wallpaperStyle');
      wallpaper.style.backgroundSize = style === 'stretch' ? '100% 100%' : 'auto';
      wallpaper.style.backgroundRepeat = style === 'tile' ? 'repeat' : 'no-repeat';
      wallpaper.style.backgroundPosition = 'center';
    }
  }
  if (changes?.renderer)
    for (const surface of sys.surfaces) surface.setPreference(settings.get('renderer'));
  const cursor = settings.get('cursor') ?? 'standard';
  const dark = cursor === 'black';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursor === 'large' ? 32 : 24}" height="${cursor === 'large' ? 40 : 30}" viewBox="0 0 24 30"><path d="M1 1v22l6-6 5 11 4-2-5-10h9z" fill="${dark ? 'black' : 'white'}" stroke="${dark ? 'white' : 'black'}" stroke-width="1"/></svg>`;
  body.style.setProperty(
    '--pointer-cursor',
    `url("data:image/svg+xml,${encodeURIComponent(svg)}") 1 1, default`,
  );
};
settings.on('change', applySettings);
applySettings();
const shell = new DesktopShell(sys);
sys.shell = shell;
let lastActivity = Date.now(),
  saver = null;
sys.startSaver = (effect = settings.get('screenSaver')) => {
  if (saver || effect === 'none') return;
  const cover = h('div', {
    class: 'screensaver',
    style: { position: 'fixed', inset: '0', zIndex: '130000', background: '#000', cursor: 'none' },
  });
  document.querySelector('#overlays').append(cover);
  let surface, raf;
  const life = new AbortController();
  if (effect !== 'blank') {
    const canvas = h('canvas', {
      style: { width: '100%', height: '100%' },
      'aria-label': 'Screen saver',
    });
    cover.append(canvas);
    if (effect === 'text') {
      const context = canvas.getContext('2d');
      let x = 100,
        y = 100,
        vx = 1.7,
        vy = 1.1;
      const draw = () => {
        canvas.width = cover.clientWidth;
        canvas.height = cover.clientHeight;
        context.fillStyle = '#000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        const text = settings.get('userName') === 'User' ? 'Windows Me' : settings.get('userName');
        context.font = 'bold 55px Arial';
        const width = context.measureText(text).width;
        x += vx;
        y += vy;
        if (x < 0 || x + width > canvas.width) vx = -vx;
        if (y < 60 || y > canvas.height) vy = -vy;
        context.fillStyle = '#155274';
        for (let i = 9; i > 0; i--) context.fillText(text, x + i, y + i);
        context.fillStyle = '#8dd2ee';
        context.fillText(text, x, y);
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    } else {
      surface = new Surface(canvas, {
        effect,
        animated: !settings.get('reducedMotion'),
        preference: settings.get('renderer'),
      });
      sys.surfaces.add(surface);
    }
  }
  const close = () => {
    life.abort();
    cover.remove();
    surface?.dispose();
    sys.surfaces.delete(surface);
    cancelAnimationFrame(raf);
    saver = null;
    lastActivity = Date.now();
  };
  saver = { cover, close };
  setTimeout(() => {
    if (!cover.isConnected) return;
    document.addEventListener('pointermove', close, { signal: life.signal, once: true });
    document.addEventListener('pointerdown', close, { signal: life.signal, once: true });
    document.addEventListener(
      'keydown',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      },
      { signal: life.signal, once: true, capture: true },
    );
  }, 250);
};
sys.restart = () => {
  const screen = h(
    'div',
    { class: 'boot-screen' },
    h('h1', {}, 'Windows ', h('span', {}, 'Me')),
    h('p', {}, 'Millennium Edition'),
    h('div', { class: 'boot-progress' }),
  );
  document.querySelector('#overlays').append(screen);
  setTimeout(() => {
    screen.remove();
    shell.renderIcons();
    shell.renderTasks();
    sound.play('startup');
    if (settings.get('showWelcome')) sys.launch('welcome');
  }, 1300);
};
document.addEventListener(
  'pointerdown',
  () => {
    lastActivity = Date.now();
    if (!sound.audio) sound.context();
  },
  { capture: true },
);
document.addEventListener('keydown', () => (lastActivity = Date.now()), { capture: true });
document.addEventListener('pointermove', () => (lastActivity = Date.now()), { passive: true });
setInterval(() => {
  if (
    !saver &&
    !document.hidden &&
    settings.get('screenSaver') !== 'none' &&
    Date.now() - lastActivity > (settings.get('saverMinutes') ?? 5) * 60000
  )
    sys.startSaver();
}, 10000);

// The same operations used by the desktop are exposed to supported page agents.
const modelContext = document.modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool) => {
    try {
      Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(
        (error) => console.warn('WebMCP:', error.message),
      );
    } catch (error) {
      console.warn('WebMCP:', error.message);
    }
  };
  register({
    name: 'list_desktop_applications',
    title: 'List desktop applications',
    description: 'List installed applications in this Windows Me browser desktop.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => ({
      applications: registry
        .list()
        .map((a) => ({
          id: a.id,
          title: a.title,
          installed: !(settings.get('disabledApps') ?? []).includes(a.id),
        })),
    }),
  });
  register({
    name: 'open_desktop_application',
    title: 'Open a desktop application',
    description: 'Launch an installed browser desktop application and focus its window.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      if (!input || typeof input.id !== 'string' || !registry.get(input.id))
        throw new Error('Unknown application.');
      const win = await sys.launch(input.id);
      return { opened: !!win, title: win?.title };
    },
  });
  register({
    name: 'list_virtual_files',
    title: 'List virtual files',
    description: 'Read filenames from a folder on this desktop’s virtual drive.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input) => {
      if (!input || typeof input.path !== 'string') throw new Error('A path is required.');
      return {
        files: fs
          .list(input.path)
          .map((n) => ({ path: n.path, name: n.name, kind: n.kind, size: n.size ?? 0 })),
      };
    },
  });
  register({
    name: 'save_virtual_text_file',
    title: 'Save a virtual text file',
    description: 'Create or replace a UTF-8 text file in an existing folder on the virtual drive.',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' }, text: { type: 'string' } },
      required: ['path', 'text'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: async (input) => {
      if (
        !input ||
        typeof input.path !== 'string' ||
        typeof input.text !== 'string' ||
        input.text.length > 1048576
      )
        throw new Error('Provide a path and up to 1 MB of text.');
      const n = await fs.writeFile(input.path, input.text);
      return { path: n.path, bytes: n.size };
    },
  });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}

// Public diagnostic interface and reusable embedding API. No credentials or host files.
globalThis.millennium = sys;
document.documentElement.dataset.ready = 'true';
const params = new URLSearchParams(location.search);
if (params.has('app')) sys.launch(params.get('app'));
else if (settings.get('showWelcome') !== false) {
  settings.set('showWelcome', true);
  sys.launch('welcome');
}
if (!fs.persistent)
  dialogs.message(
    'The browser could not open persistent storage. Files are currently kept in memory. Use Backup to export your work before closing this page.',
    { title: 'Virtual Drive', icon: 'disk' },
  );
if (settings.persistenceError) console.warn('Desktop preferences could not be persisted.');

// Cache static program assets for subsequent offline sessions; user files stay in IndexedDB.
if (
  'serviceWorker' in navigator &&
  location.hostname !== 'terminal.local' &&
  location.port !== '4173'
) {
  const cachePrograms = () =>
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch((error) => console.warn('Offline cache:', error.message));
  if (document.readyState === 'complete') cachePrograms();
  else window.addEventListener('load', cachePrograms, { once: true });
}
