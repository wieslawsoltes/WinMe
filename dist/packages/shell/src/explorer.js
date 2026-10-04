import { h, button, field, checkbox, download, pickFiles } from '../../ui/src/dom.js';
import { icon, fileIcon } from '../../ui/src/icons.js';
import { basename, dirname, extension, normalizePath } from '../../filesystem/src/index.js';
import { formatBytes } from '../../core/src/index.js';

export function createExplorer(sys, args = {}) {
  let current = args.path ?? 'computer',
    back = [],
    forward = [],
    selected = new Set(),
    view = args.view ?? 'icons',
    folders = !!args.folders,
    sortBy = 'name',
    descending = false;
  const win = sys.createWindow({
    title: 'My Computer',
    icon: 'computer',
    width: 655,
    height: 440,
    minWidth: 340,
    minHeight: 240,
  });
  const address = h('input', { 'aria-label': 'Address', value: '' });
  const body = h('div', { class: 'explorer-body' }),
    side = h('aside', { class: 'explorer-web-panel' }),
    tree = h('aside', { class: 'explorer-tree' }),
    content = h('div', { class: 'explorer-view', tabIndex: 0, 'aria-label': 'Folder contents' });
  const status = h('footer', { class: 'status-bar' }, h('span'), h('span'));
  const guard = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      await sys.dialogs.message(e.message, { title: 'Windows Explorer' });
    }
  };
  const directory = () =>
    current === 'recycle' ? 'C:\\Recycled' : current === 'computer' ? 'C:\\' : current;
  const nodes = () =>
    current === 'computer'
      ? [
          { path: 'C:\\', name: 'Local Disk (C:)', kind: 'directory', icon: 'disk' },
          { path: 'D:\\', name: 'CD-ROM (D:)', kind: 'directory', icon: 'cd' },
          { path: 'control', name: 'Control Panel', kind: 'app', icon: 'control' },
          { path: 'documents', name: 'My Documents', kind: 'app', icon: 'documents' },
          { path: 'network', name: 'My Network Places', kind: 'app', icon: 'network' },
        ]
      : sys.fs.list(directory(), {
          hidden: sys.settings.get('showHidden') || current === 'recycle',
        });
  const go = (path) =>
    guard(async () => {
      if (path === 'control') {
        sys.launch('control');
        return;
      }
      if (path === 'network') {
        sys.launch('network');
        return;
      }
      if (path === 'documents') path = 'C:\\My Documents';
      if (path !== 'computer' && path !== 'recycle') {
        path = normalizePath(path, directory());
        if (sys.fs.stat(path)?.kind !== 'directory') {
          await sys.open(path);
          return;
        }
      }
      if (current !== path) {
        back.push(current);
        forward = [];
        current = path;
      }
      selected.clear();
      render();
    });
  const openSelected = () => {
    for (const path of selected) {
      const n = nodes().find((n) => n.path === path);
      if (n?.kind === 'directory' || n?.kind === 'app') go(path);
      else sys.open(path);
    }
  };
  const rename = async () => {
    const path = [...selected][0];
    if (!path || current === 'computer') return;
    const result = await sys.dialogs.prompt('Type a new name for this item.', basename(path), {
      title: 'Rename',
    });
    if (result) await guard(() => sys.fs.rename(path, result));
  };
  const copy = (cut) => {
    if (!selected.size || current === 'computer') return;
    sys.clipboard.files = [...selected];
    sys.clipboard.cut = cut;
    render();
  };
  const paste = () =>
    guard(async () => {
      if (current === 'computer' || current === 'recycle') return;
      const paths = sys.clipboard.files ?? [];
      for (const path of paths) {
        const dest = directory() + '\\' + sys.fs.uniqueName(directory(), basename(path));
        await (cutMode() ? sys.fs.move(path, dest) : sys.fs.copy(path, dest));
      }
      if (cutMode()) sys.clipboard.files = [];
      render();
    });
  const cutMode = () => !!sys.clipboard.cut;
  const remove = async (permanent = false) => {
    if (!selected.size || current === 'computer') return;
    const list = [...selected];
    if (
      !(await sys.dialogs.confirm(
        `Are you sure you want to ${permanent || current === 'recycle' ? 'permanently delete' : 'send to the Recycle Bin'} ${list.length === 1 ? '“' + basename(list[0]) + '”' : list.length + ' items'}?`,
        'Confirm File Delete',
      ))
    )
      return;
    await guard(async () => {
      for (const path of list)
        await sys.fs.remove(path, { permanent: permanent || current === 'recycle' });
      selected.clear();
    });
  };
  const newItem = async (type) => {
    if (current === 'computer' || current === 'recycle') return;
    const initial = sys.fs.uniqueName(
      directory(),
      type === 'folder' ? 'New Folder' : 'New Text Document.txt',
    );
    const name = await sys.dialogs.prompt(
      `Enter a name for the new ${type === 'folder' ? 'folder' : 'text document'}.`,
      initial,
      { title: type === 'folder' ? 'New Folder' : 'New Text Document' },
    );
    if (name)
      await guard(() =>
        type === 'folder'
          ? sys.fs.mkdir(directory() + '\\' + name)
          : sys.fs.writeFile(directory() + '\\' + name, ''),
      );
  };
  const imports = () =>
    guard(async () => {
      const files = await pickFiles({ multiple: true });
      if (files.length) await sys.fs.importFiles(files, directory());
    });
  const properties = () => {
    const path = [...selected][0];
    if (path) sys.properties(path);
    else if (current === 'computer') sys.launch('system');
    else sys.properties(directory());
  };
  const setView = (mode) => {
    view = mode;
    render();
  };
  const changeSort = (key) => {
    if (sortBy === key) descending = !descending;
    else {
      sortBy = key;
      descending = false;
    }
    render();
  };
  const editMenu = () => [
    {
      label: 'Cut',
      shortcut: 'Ctrl+X',
      action: () => copy(true),
      disabled: !selected.size || current === 'computer',
    },
    {
      label: 'Copy',
      shortcut: 'Ctrl+C',
      action: () => copy(false),
      disabled: !selected.size || current === 'computer',
    },
    {
      label: 'Paste',
      shortcut: 'Ctrl+V',
      action: paste,
      disabled: !sys.clipboard.files?.length || current === 'computer' || current === 'recycle',
    },
    '-',
    {
      label: 'Select All',
      shortcut: 'Ctrl+A',
      action: () => {
        selected = new Set(nodes().map((n) => n.path));
        render();
      },
    },
    {
      label: 'Invert Selection',
      action: () => {
        const all = nodes();
        selected = new Set(all.filter((n) => !selected.has(n.path)).map((n) => n.path));
        render();
      },
    },
  ];
  const viewMenu = () => [
    {
      label: 'Toolbars',
      children: [
        {
          label: 'Standard Buttons',
          checked: !tools.hidden,
          action: () => (tools.hidden = !tools.hidden),
        },
        {
          label: 'Address Bar',
          checked: !addressRow.hidden,
          action: () => (addressRow.hidden = !addressRow.hidden),
        },
      ],
    },
    {
      label: 'Status Bar',
      checked: !status.hidden,
      action: () => (status.hidden = !status.hidden),
    },
    '-',
    ...['icons', 'list', 'details'].map((mode) => ({
      label: { icons: 'Large Icons', list: 'List', details: 'Details' }[mode],
      checked: view === mode,
      action: () => setView(mode),
    })),
    '-',
    {
      label: 'Explorer Bar',
      children: [
        {
          label: 'Folders',
          checked: folders,
          action: () => {
            folders = !folders;
            render();
          },
        },
        { label: 'Search', action: () => sys.launch('search', { folder: directory() }) },
      ],
    },
    {
      label: 'Arrange Icons',
      children: [
        { label: 'by Name', action: () => changeSort('name') },
        { label: 'by Type', action: () => changeSort('type') },
        { label: 'by Size', action: () => changeSort('size') },
        { label: 'by Date', action: () => changeSort('modified') },
      ],
    },
    { label: 'Refresh', shortcut: 'F5', action: render },
  ];
  const itemMenu = () => [
    { label: 'Open', action: openSelected },
    '-',
    ...(current === 'recycle'
      ? [
          {
            label: 'Restore',
            action: () =>
              guard(async () => {
                for (const path of selected) await sys.fs.restore(path);
              }),
          },
        ]
      : editMenu().slice(0, 3)),
    '-',
    { label: 'Delete', shortcut: 'Del', action: () => remove() },
    {
      label: 'Rename',
      shortcut: 'F2',
      action: rename,
      disabled: selected.size !== 1 || current === 'recycle',
    },
    {
      label: 'Export to this device...',
      action: () =>
        guard(async () => {
          for (const p of selected) {
            const n = sys.fs.stat(p);
            if (n?.kind === 'file') download(sys.fs.readFile(p, 'blob'), n.name);
          }
        }),
      disabled: current === 'computer',
    },
    '-',
    { label: 'Properties', shortcut: 'Alt+Enter', action: properties },
  ];
  const context = (e) => {
    e.preventDefault();
    sys.menus.show(
      e.clientX,
      e.clientY,
      selected.size
        ? itemMenu()
        : [
            { label: 'View', children: viewMenu().slice(3, 6) },
            { label: 'Refresh', action: render },
            '-',
            {
              label: 'Paste',
              action: paste,
              disabled: !sys.clipboard.files?.length || current === 'computer',
            },
            {
              label: 'New',
              children: [
                { label: 'Folder', icon: 'folder', action: () => newItem('folder') },
                { label: 'Text Document', icon: 'notepad', action: () => newItem('text') },
              ],
            },
            { label: 'Import Files...', action: imports },
            '-',
            { label: 'Properties', action: properties },
          ],
    );
  };
  const backBtn = button(
    [icon('arrow', 20), h('span', {}, 'Back')],
    () => {
      if (back.length) {
        forward.push(current);
        current = back.pop();
        selected.clear();
        render();
      }
    },
    { class: 'tool-button', title: 'Back' },
  );
  backBtn.querySelector('img').style.transform = 'scaleX(-1)';
  const forwardBtn = button(
    icon('arrow', 20),
    () => {
      if (forward.length) {
        back.push(current);
        current = forward.pop();
        selected.clear();
        render();
      }
    },
    { class: 'tool-button', title: 'Forward' },
  );
  const tools = h(
    'div',
    { class: 'toolbar' },
    backBtn,
    forwardBtn,
    button(
      icon('up', 20),
      () =>
        go(
          current === 'computer'
            ? 'computer'
            : directory().length === 3
              ? 'computer'
              : dirname(directory()),
        ),
      { class: 'tool-button', title: 'Up' },
    ),
    h('div', { class: 'separator' }),
    button(
      [icon('search', 20), h('span', {}, 'Search')],
      () => sys.launch('search', { folder: directory() }),
      { class: 'tool-button' },
    ),
    button(
      [icon('folder', 20), h('span', {}, 'Folders')],
      () => {
        folders = !folders;
        render();
      },
      { class: 'tool-button' },
    ),
    h('div', { class: 'separator' }),
    button(
      icon('control', 20),
      (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        sys.menus.show(r.left, r.bottom, viewMenu());
      },
      { class: 'tool-button', title: 'Views' },
    ),
  );
  const addressRow = h(
    'div',
    { class: 'explorer-address' },
    h('span', {}, 'Address'),
    icon('computer', 16),
    address,
    button('Go', () => go(address.value)),
  );
  win.menu([
    {
      label: 'File',
      items: () => [
        {
          label: 'New',
          children: [
            { label: 'Folder', icon: 'folder', action: () => newItem('folder') },
            { label: 'Text Document', icon: 'notepad', action: () => newItem('text') },
          ],
        },
        { label: 'Open', action: openSelected, disabled: !selected.size },
        { label: 'Import Files...', action: imports },
        '-',
        {
          label: 'Create Shortcut',
          action: () =>
            guard(async () => {
              for (const path of selected)
                await sys.fs.writeFile(
                  'C:\\Windows\\Desktop\\' +
                    sys.fs.uniqueName('C:\\Windows\\Desktop', basename(path) + '.lnk'),
                  JSON.stringify({ target: path }),
                  'application/x-millennium-shortcut',
                );
            }),
        },
        { label: 'Delete', action: () => remove(), disabled: !selected.size },
        { label: 'Rename', action: rename, disabled: selected.size !== 1 },
        { label: 'Properties', action: properties },
        '-',
        { label: 'Close', action: () => win.close() },
      ],
    },
    { label: 'Edit', items: editMenu },
    { label: 'View', items: viewMenu },
    {
      label: 'Favorites',
      items: () => [
        {
          label: 'Add to Favorites...',
          action: () => {
            const favorites = sys.settings.get('folderFavorites') ?? [];
            sys.settings.set('folderFavorites', [...new Set([...favorites, current])]);
          },
        },
        { label: 'My Documents', icon: 'documents', action: () => go('C:\\My Documents') },
        ...(sys.settings.get('folderFavorites') ?? []).map((path) => ({
          label: path,
          icon: 'folder',
          action: () => go(path),
        })),
      ],
    },
    {
      label: 'Tools',
      items: [
        {
          label: 'Find Files or Folders...',
          action: () => sys.launch('search', { folder: directory() }),
        },
        { label: 'Folder Options...', action: () => sys.launch('folder-options') },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Help Topics', action: () => sys.launch('help', { topic: 'files' }) },
        '-',
        { label: 'About Windows', action: () => sys.launch('about') },
      ],
    },
  ]);
  win.content.append(tools, addressRow, body, status);
  body.append(side, tree, content);
  function updateStatus() {
    const entries = nodes(),
      chosen = entries.filter((n) => selected.has(n.path));
    status.children[0].textContent = selected.size
      ? `${selected.size} object(s) selected`
      : `${entries.length} object(s)`;
    status.children[1].textContent = formatBytes(
      (chosen.length ? chosen : entries).reduce((sum, n) => sum + (n.size ?? 0), 0),
    );
  }
  function render() {
    if (win.closed) return;
    const name =
      current === 'computer'
        ? 'My Computer'
        : current === 'recycle'
          ? 'Recycle Bin'
          : current.length === 3
            ? `Local Disk (${current.slice(0, 2)})`
            : basename(current);
    win.setTitle(name);
    address.value =
      current === 'computer' ? 'My Computer' : current === 'recycle' ? 'Recycle Bin' : current;
    backBtn.disabled = !back.length;
    forwardBtn.disabled = !forward.length;
    const mainIcon =
      current === 'computer'
        ? 'computer'
        : current === 'recycle'
          ? 'recycle'
          : current === 'C:\\My Documents'
            ? 'documents'
            : 'folder';
    side.hidden = folders;
    tree.hidden = !folders;
    side.replaceChildren(
      icon(mainIcon, 32),
      h('h2', {}, name),
      h('hr'),
      h(
        'p',
        {},
        current === 'computer'
          ? 'Select an item to view its description.'
          : current === 'recycle'
            ? 'The Recycle Bin contains files and folders that you have deleted.'
            : 'Select an item to view its description.',
      ),
      h('p', {}, 'To open an item, double-click its icon.'),
    );
    if (current === 'recycle') {
      side.append(
        button(
          'Empty Recycle Bin',
          () =>
            guard(async () => {
              if (
                await sys.dialogs.confirm(
                  'Are you sure you want to permanently delete all items in the Recycle Bin?',
                  'Confirm Delete',
                )
              )
                await sys.fs.emptyRecycleBin();
            }),
          { style: { minWidth: '0', width: '100%' } },
        ),
      );
    } else {
      side.append(
        h('hr'),
        h('b', {}, 'See also'),
        h(
          'a',
          {
            href: '#',
            onclick: (e) => {
              e.preventDefault();
              go('C:\\My Documents');
            },
          },
          'My Documents',
        ),
        h(
          'a',
          {
            href: '#',
            onclick: (e) => {
              e.preventDefault();
              sys.launch('control');
            },
          },
          'Control Panel',
        ),
        h(
          'a',
          {
            href: '#',
            onclick: (e) => {
              e.preventDefault();
              imports();
            },
          },
          'Import files',
        ),
      );
    }
    tree.replaceChildren(
      h('b', { style: { display: 'block', padding: '2px 5px 8px' } }, 'Folders'),
    );
    const treeNodes = [
      { label: 'Desktop', path: 'computer', icon: 'windows', indent: 0 },
      { label: 'My Documents', path: 'C:\\My Documents', icon: 'documents', indent: 12 },
      { label: 'My Computer', path: 'computer', icon: 'computer', indent: 12 },
      { label: 'Local Disk (C:)', path: 'C:\\', icon: 'disk', indent: 24 },
    ];
    for (const n of sys.fs.list('C:\\'))
      if (n.kind === 'directory' && !n.hidden)
        treeNodes.push({ label: n.name, path: n.path, icon: 'folder', indent: 38 });
    treeNodes.push({ label: 'Recycle Bin', path: 'recycle', icon: 'recycle', indent: 12 });
    for (const n of treeNodes)
      tree.append(
        button([icon(n.icon, 16), n.label], () => go(n.path), {
          class: 'tree-item' + (current === n.path ? ' selected' : ''),
          style: { paddingLeft: n.indent + 'px' },
        }),
      );
    content.className = 'explorer-view ' + view;
    content.replaceChildren();
    let entries;
    try {
      entries = nodes();
    } catch {
      current = 'computer';
      render();
      return;
    }
    selected = new Set([...selected].filter((p) => entries.some((n) => n.path === p)));
    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      let result =
        sortBy === 'size'
          ? (a.size ?? 0) - (b.size ?? 0)
          : sortBy === 'modified'
            ? (a.modified ?? 0) - (b.modified ?? 0)
            : sortBy === 'type'
              ? extension(a.path).localeCompare(extension(b.path))
              : a.name.localeCompare(b.name, undefined, { numeric: true });
      return descending ? -result : result;
    });
    const container = view === 'details' ? h('tbody') : h('div', { class: 'explorer-icons' });
    if (view === 'details') {
      const headings = [
        ['Name', 'name'],
        ['Size', 'size'],
        ['Type', 'type'],
        ['Modified', 'modified'],
      ];
      content.append(
        h(
          'table',
          { class: 'classic-table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              headings.map(([label, key]) =>
                h(
                  'th',
                  { onclick: () => changeSort(key) },
                  label,
                  sortBy === key ? (descending ? ' ▾' : ' ▴') : '',
                ),
              ),
            ),
          ),
          container,
        ),
      );
    } else content.append(container);
    for (const entry of entries) {
      const itemIcon = entry.icon ?? fileIcon(entry);
      let label = current === 'recycle' ? basename(entry.originalPath ?? entry.path) : entry.name;
      if (!sys.settings.get('showExtensions') && entry.kind === 'file')
        label = label.replace(/\.[^.]+$/, '');
      const item =
        view === 'details'
          ? h(
              'tr',
              { tabIndex: 0, role: 'row' },
              h('td', {}, icon(itemIcon, 16), ' ', label),
              h('td', {}, entry.kind === 'file' ? formatBytes(entry.size ?? 0) : ''),
              h(
                'td',
                {},
                entry.kind === 'directory'
                  ? 'File Folder'
                  : entry.kind === 'app'
                    ? 'System Folder'
                    : extension(entry.path).toUpperCase() + ' File',
              ),
              h('td', {}, entry.modified ? new Date(entry.modified).toLocaleDateString() : ''),
            )
          : h(
              'button',
              { type: 'button', class: 'file-item', role: 'option' },
              icon(itemIcon, view === 'list' ? 16 : 32),
              h('span', { class: 'filename' }, label),
            );
      item.dataset.path = entry.path;
      item.classList.toggle('selected', selected.has(entry.path));
      item.setAttribute('aria-selected', String(selected.has(entry.path)));
      item.draggable = current !== 'computer' && current !== 'recycle';
      if (sys.clipboard.cut && sys.clipboard.files?.includes(entry.path))
        item.style.opacity = '.55';
      item.addEventListener('click', (e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) selected.clear();
        if ((e.ctrlKey || e.metaKey) && selected.has(entry.path)) selected.delete(entry.path);
        else selected.add(entry.path);
        for (const row of container.children) {
          row.classList.toggle('selected', selected.has(row.dataset.path));
          row.setAttribute('aria-selected', String(selected.has(row.dataset.path)));
        }
        updateStatus();
        if (sys.settings.get('singleClick') && !e.ctrlKey && !e.metaKey && !e.shiftKey)
          entry.kind === 'directory' || entry.kind === 'app'
            ? go(entry.path)
            : current === 'recycle'
              ? sys.properties(entry.path)
              : sys.open(entry.path);
      });
      item.addEventListener(
        'dblclick',
        () =>
          !sys.settings.get('singleClick') &&
          (entry.kind === 'directory' || entry.kind === 'app'
            ? go(entry.path)
            : current === 'recycle'
              ? sys.properties(entry.path)
              : sys.open(entry.path)),
      );
      item.addEventListener('contextmenu', (e) => {
        if (!selected.has(entry.path)) {
          selected.clear();
          selected.add(entry.path);
          render();
        }
        context(e);
        e.stopPropagation();
      });
      item.addEventListener('dragstart', (e) => {
        if (!selected.has(entry.path)) {
          selected.clear();
          selected.add(entry.path);
        }
        e.dataTransfer.setData('application/x-millennium-files', JSON.stringify([...selected]));
        e.dataTransfer.effectAllowed = 'copyMove';
      });
      if (entry.kind === 'directory') {
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          item.classList.add('selected');
        });
        item.addEventListener('dragleave', () =>
          item.classList.toggle('selected', selected.has(entry.path)),
        );
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          drop(e, entry.path);
        });
      }
      container.append(item);
    }
    if (!entries.length)
      content.append(
        h(
          'div',
          { class: 'empty-message' },
          current === 'recycle' ? 'The Recycle Bin is empty.' : 'This folder is empty.',
        ),
      );
    updateStatus();
  }
  const drop = (e, target) =>
    guard(async () => {
      if (e.dataTransfer.files.length) {
        await sys.fs.importFiles([...e.dataTransfer.files], target);
        return;
      }
      const data = e.dataTransfer.getData('application/x-millennium-files');
      if (data) {
        const paths = JSON.parse(data);
        for (const path of paths) {
          const dest = target + '\\' + sys.fs.uniqueName(target, basename(path));
          await (e.ctrlKey ? sys.fs.copy(path, dest) : sys.fs.move(path, dest));
        }
      }
    });
  content.addEventListener('dragover', (e) => {
    if (current !== 'computer' && current !== 'recycle') e.preventDefault();
  });
  content.addEventListener('drop', (e) => {
    e.preventDefault();
    drop(e, directory());
  });
  content.addEventListener('contextmenu', context);
  content.addEventListener('click', (e) => {
    if (e.target === content || e.target.classList.contains('explorer-icons')) {
      selected.clear();
      render();
    }
  });
  address.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go(address.value === 'My Computer' ? 'computer' : address.value);
  });
  win.element.addEventListener(
    'keydown',
    (e) => {
      if (e.target.tagName === 'INPUT') return;
      const ctrl = e.ctrlKey || e.metaKey;
      const handlers = {
        Delete: () => remove(e.shiftKey),
        F2: rename,
        F5: render,
        Enter: openSelected,
        Backspace: () => go(directory().length === 3 ? 'computer' : dirname(directory())),
      };
      if (ctrl) {
        const map = {
          a: () => {
            selected = new Set(nodes().map((n) => n.path));
            render();
          },
          c: () => copy(false),
          x: () => copy(true),
          v: paste,
          n: () => sys.launch('explorer', { path: current }),
        };
        if (map[e.key.toLowerCase()]) {
          e.preventDefault();
          map[e.key.toLowerCase()]();
        }
      } else if (handlers[e.key]) {
        e.preventDefault();
        handlers[e.key]();
      }
    },
    { signal: win.signal },
  );
  sys.fs.on('change', render, { signal: win.signal });
  sys.settings.on('change', render, { signal: win.signal });
  render();
  win.navigate = go;
  return win;
}

export function showFileProperties(sys, path) {
  let node;
  try {
    node = sys.fs.stat(path);
  } catch {}
  if (!node) return sys.dialogs.message('The item cannot be found.');
  const size =
    node.kind === 'file' ? node.size : sys.fs.walk(path).reduce((n, f) => n + (f.size ?? 0), 0);
  const win = sys.wm.create({
    title: node.name + ' Properties',
    icon: fileIcon(node),
    width: 360,
    height: 395,
    center: true,
    modal: true,
    resizable: false,
  });
  let readonly = !!node.readonly,
    hidden = !!node.hidden;
  const rows = [
    [
      'Type:',
      node.kind === 'directory'
        ? 'File Folder'
        : (extension(path).toUpperCase() || 'Unknown') + ' File',
    ],
    ['Location:', dirname(path)],
    ['Size:', formatBytes(size) + ' (' + size.toLocaleString() + ' bytes)'],
    ['Created:', new Date(node.created).toLocaleString()],
    ['Modified:', new Date(node.modified).toLocaleString()],
  ];
  const body = h(
    'div',
    { class: 'dialog-content' },
    h(
      'div',
      { class: 'tab-bar' },
      button('General', () => {}, { class: 'selected' }),
    ),
    h(
      'div',
      { class: 'tab-body' },
      h(
        'div',
        { style: { display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '15px' } },
        icon(fileIcon(node), 32),
        h('strong', {}, node.originalPath ? basename(node.originalPath) : node.name),
      ),
      h('hr'),
      h(
        'div',
        {
          class: 'form-grid',
          style: { gridTemplateColumns: '65px 1fr', gap: '10px 7px', marginTop: '13px' },
        },
        rows.map(([label, value]) => [
          h('span', {}, label),
          h('span', { class: 'text-selectable', style: { overflowWrap: 'anywhere' } }, value),
        ]),
      ),
      h('hr'),
      h(
        'div',
        { class: 'field-row' },
        h('span', {}, 'Attributes:'),
        checkbox('Read-only', readonly, (v) => (readonly = v)),
        checkbox('Hidden', hidden, (v) => (hidden = v)),
      ),
    ),
    h(
      'div',
      { class: 'button-row' },
      button(
        'OK',
        async () => {
          try {
            await sys.fs.setAttributes(path, { readonly, hidden });
            win.close();
          } catch (e) {
            sys.dialogs.message(e.message);
          }
        },
        { class: 'default' },
      ),
      button('Cancel', () => win.close()),
    ),
  );
  win.content.append(body);
  return win;
}
