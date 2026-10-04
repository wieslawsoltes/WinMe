import { h, button, field, select, download } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';
import { basename } from '../../filesystem/src/index.js';
import { createNotepad, createWordPad } from './editors.js';
import { createCalculator } from './calculator.js';
import { createPaint } from './paint.js';
import { createTerminal } from './terminal.js';

function createCharacterMap(sys) {
  const win = sys.createWindow({
    title: 'Character Map',
    icon: 'keyboard',
    width: 480,
    height: 350,
    resizable: false,
  });
  let chosen = '';
  const grid = h('div', { class: 'character-grid' }),
    output = h('input', { value: '', 'aria-label': 'Characters to copy' }),
    font = select(
      ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'],
      'Arial',
      (v) => (grid.style.fontFamily = v),
    ),
    status = h('span', {}, 'Select a character.');
  for (let i = 32; i < 256; i++) {
    if (i === 127) i = 160;
    const c = String.fromCharCode(i);
    const b = button(
      c,
      () => {
        chosen = c;
        for (const n of grid.children) n.classList.remove('selected');
        b.classList.add('selected');
        status.textContent = 'U+' + i.toString(16).toUpperCase().padStart(4, '0') + '  ' + c;
      },
      { title: 'U+' + i.toString(16).toUpperCase().padStart(4, '0') },
    );
    b.addEventListener('dblclick', () => (output.value += c));
    grid.append(b);
  }
  win.content.append(
    h(
      'div',
      { class: 'dialog-content', style: { gap: '7px' } },
      field('Font:', font),
      h('div', { class: 'app-scroll' }, grid),
      field('Characters to copy:', output),
      h(
        'div',
        { class: 'button-row' },
        button('Select', () => (output.value += chosen)),
        button('Copy', () => {
          sys.clipboard.text = output.value;
          navigator.clipboard?.writeText(output.value).catch(() => {});
        }),
        button('Close', () => win.close()),
      ),
      status,
    ),
  );
  return win;
}

function createImaging(sys, args = {}) {
  const win = sys.createWindow({ title: 'Imaging', icon: 'paint', width: 640, height: 460 });
  let path = args.path,
    zoom = 1,
    rotation = 0,
    url;
  const viewport = h('div', {
      class: 'app-scroll',
      style: { background: '#808080', display: 'grid', placeItems: 'center' },
    }),
    image = h('img', {
      style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
      alt: 'Image',
    });
  viewport.append(image);
  const status = h('footer', { class: 'status-bar' }, h('span', {}, 'Open an image to begin.'));
  const load = async (p) => {
    URL.revokeObjectURL(url);
    url = URL.createObjectURL(sys.fs.readFile(p, 'blob'));
    image.src = url;
    path = p;
    zoom = 1;
    rotation = 0;
    update();
    win.setTitle(basename(p) + ' - Imaging');
    status.children[0].textContent = p;
  };
  const open = async () => {
    const p = await sys.dialogs.file({
      extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'],
      typeLabel: 'Image Files',
    });
    if (p) load(p);
  };
  const update = () => {
    image.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'Open...', action: open },
        {
          label: 'Save Copy...',
          action: () => {
            if (path) download(sys.fs.readFile(path, 'blob'), basename(path));
          },
        },
        {
          label: 'Print...',
          action: () => {
            if (path) sys.printHTML(`<img src="${url}" style="max-width:100%">`, basename(path));
          },
        },
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [{ label: 'Edit in Paint', action: () => path && sys.launch('paint', { path }) }],
    },
    {
      label: 'View',
      items: [
        {
          label: 'Zoom In',
          action: () => {
            zoom = Math.min(8, zoom * 1.25);
            update();
          },
        },
        {
          label: 'Zoom Out',
          action: () => {
            zoom = Math.max(0.1, zoom / 1.25);
            update();
          },
        },
        {
          label: 'Actual Size',
          action: () => {
            zoom = 1;
            update();
          },
        },
        {
          label: 'Rotate Right',
          action: () => {
            rotation += 90;
            update();
          },
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'About Imaging',
          action: () =>
            sys.dialogs.message('Imaging\nView pictures, rotate, zoom, export and print.', {
              title: 'About Imaging',
              icon: 'paint',
            }),
        },
      ],
    },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'toolbar' },
      button([icon('folder', 16), 'Open'], open, { class: 'tool-button' }),
      button(
        '+',
        () => {
          zoom = Math.min(8, zoom * 1.25);
          update();
        },
        { class: 'tool-button', title: 'Zoom In' },
      ),
      button(
        '−',
        () => {
          zoom = Math.max(0.1, zoom / 1.25);
          update();
        },
        { class: 'tool-button', title: 'Zoom Out' },
      ),
      button(
        'Rotate',
        () => {
          rotation += 90;
          update();
        },
        { class: 'tool-button' },
      ),
      button('Edit', () => path && sys.launch('paint', { path }), { class: 'tool-button' }),
    ),
    viewport,
    status,
  );
  win.onDispose(() => URL.revokeObjectURL(url));
  if (path) load(path);
  return win;
}

export function registerAccessories(registry) {
  for (const app of [
    {
      id: 'notepad',
      title: 'Notepad',
      icon: 'notepad',
      commands: ['notepad.exe'],
      extensions: ['txt', 'log', 'ini', 'json', 'js', 'css', 'xml', 'md', 'csv', 'bat'],
      create: createNotepad,
    },
    {
      id: 'wordpad',
      title: 'WordPad',
      icon: 'wordpad',
      commands: ['wordpad.exe', 'write', 'write.exe'],
      extensions: ['rtf', 'doc'],
      create: createWordPad,
    },
    {
      id: 'paint',
      title: 'Paint',
      icon: 'paint',
      commands: ['mspaint', 'mspaint.exe', 'pbrush'],
      extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'],
      create: createPaint,
    },
    {
      id: 'calculator',
      title: 'Calculator',
      icon: 'calculator',
      commands: ['calc', 'calc.exe'],
      singleton: true,
      create: createCalculator,
    },
    {
      id: 'terminal',
      title: 'MS-DOS Prompt',
      icon: 'cmd',
      commands: ['command', 'command.com', 'cmd', 'cmd.exe'],
      create: createTerminal,
    },
    {
      id: 'charmap',
      title: 'Character Map',
      icon: 'keyboard',
      commands: ['charmap.exe'],
      create: createCharacterMap,
    },
    {
      id: 'imaging',
      title: 'Imaging',
      icon: 'paint',
      commands: ['wangimg', 'imaging.exe'],
      create: createImaging,
    },
  ])
    registry.register({ ...app, category: 'Accessories' });
}
