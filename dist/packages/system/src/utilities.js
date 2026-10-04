import { h, button, field, checkbox, select, download, pickFiles } from '../../ui/src/dom.js';
import { icon, fileIcon } from '../../ui/src/icons.js';
import { formatBytes, uid } from '../../core/src/index.js';
import { basename, dirname, pathKey } from '../../filesystem/src/index.js';

export function createSearch(sys, args = {}) {
  const win = sys.createWindow({
    title: 'Search Results',
    icon: 'search',
    width: 690,
    height: 440,
    minWidth: 400,
    minHeight: 280,
  });
  const query = h('input', {
      'aria-label': 'Search for files or folders named',
      value: args.query ?? '',
    }),
    look = select(
      [
        { value: 'C:\\', label: 'Local Disk (C:)' },
        { value: 'C:\\My Documents', label: 'My Documents' },
        { value: 'C:\\Windows\\Desktop', label: 'Desktop' },
      ],
      args.folder ?? 'C:\\',
    ),
    contains = h('input', { 'aria-label': 'Containing text' }),
    results = h('tbody'),
    status = h(
      'footer',
      { class: 'status-bar' },
      h('span', {}, 'Enter a name or part of a name to find files.'),
    );
  const search = () => {
    try {
      let found = sys.fs.search(query.value || '*', look.value);
      if (contains.value) {
        const needle = contains.value.toLowerCase();
        found = found.filter(
          (n) =>
            n.kind === 'file' &&
            (n.mime?.startsWith('text/') || /\.(txt|json|js|xml|csv|ini|md)$/i.test(n.path)) &&
            sys.fs.readFile(n.path).toLowerCase().includes(needle),
        );
      }
      results.replaceChildren();
      for (const n of found) {
        const tr = h(
          'tr',
          { tabIndex: 0 },
          h('td', {}, icon(fileIcon(n), 16), ' ', n.name),
          h('td', {}, dirname(n.path)),
          h('td', {}, n.kind === 'file' ? formatBytes(n.size) : ''),
        );
        tr.addEventListener('dblclick', () => sys.open(n.path));
        tr.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          sys.menus.show(e.clientX, e.clientY, [
            { label: 'Open', action: () => sys.open(n.path) },
            {
              label: 'Open Containing Folder',
              action: () => sys.launch('explorer', { path: dirname(n.path) }),
            },
            { label: 'Properties', action: () => sys.properties(n.path) },
          ]);
        });
        tr.addEventListener('click', () => {
          for (const r of results.children) r.classList.remove('selected');
          tr.classList.add('selected');
        });
        results.append(tr);
      }
      status.children[0].textContent = `${found.length} object(s) found`;
    } catch (e) {
      sys.dialogs.message(e.message, { title: 'Search' });
    }
  };
  win.menu([
    { label: 'File', items: [{ label: 'Close', action: () => win.close() }] },
    { label: 'Edit', items: [{ label: 'Search', action: search }] },
    {
      label: 'Help',
      items: [
        {
          label: 'Search Help',
          action: () =>
            sys.dialogs.message(
              'Search by filename, wildcard pattern or text content. Double-click a result to open it. Right-click for folder and file properties.',
              { title: 'Search Help', icon: 'search' },
            ),
        },
      ],
    },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'search-layout' },
      h(
        'aside',
        { class: 'search-sidebar' },
        icon('search', 32),
        h('h2', {}, 'Search for Files or Folders'),
        h('p', {}, 'Search for files or folders named:'),
        query,
        h('p', {}, 'Containing text:'),
        contains,
        h('p', {}, 'Look in:'),
        look,
        button('Search Now', search, { class: 'default' }),
      ),
      h(
        'div',
        { class: 'app-scroll sunken' },
        h(
          'table',
          { class: 'classic-table' },
          h(
            'thead',
            {},
            h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'In Folder'), h('th', {}, 'Size')),
          ),
          results,
        ),
      ),
    ),
    status,
  );
  query.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') search();
  });
  if (args.query) search();
  requestAnimationFrame(() => query.focus());
  return win;
}

export function createRestore(sys) {
  const win = sys.createWindow({
    title: 'System Restore',
    icon: 'control',
    width: 625,
    height: 430,
    resizable: false,
  });
  const page = h('div', { class: 'restore-page' }),
    list = h('div', { class: 'restore-points sunken' }),
    message = h('p');
  let selected = null,
    points = [];
  const refresh = async () => {
    points = await sys.fs.snapshots();
    list.replaceChildren();
    for (const p of points) {
      const item = button(
        h('div', {}, h('strong', {}, p.label), h('br'), new Date(p.created).toLocaleString()),
        () => {
          selected = p;
          for (const c of list.children) c.classList.remove('selected');
          item.classList.add('selected');
        },
        { class: 'restore-point' },
      );
      list.append(item);
    }
    if (!points.length)
      list.append(h('div', { class: 'empty-message' }, 'No restore points have been created.'));
  };
  const create = async () => {
    const label = await sys.dialogs.prompt(
      'Type a description for this restore point.',
      'Before changes',
      { title: 'Create a Restore Point', label: 'Description:' },
    );
    if (!label) return;
    message.textContent = 'Creating restore point...';
    try {
      await sys.fs.saveSnapshot(label, sys.settings.values);
      message.textContent = 'Restore point created successfully.';
      await refresh();
    } catch (e) {
      message.textContent = e.message;
    }
  };
  const restore = async () => {
    if (!selected) {
      message.textContent = 'Select a restore point first.';
      return;
    }
    if (
      !(await sys.dialogs.confirm(
        `Restore “${selected.label}”?\n\nThis replaces all files and settings in the browser desktop with the saved snapshot. Save open documents before continuing.`,
        'Confirm Restore',
      ))
    )
      return;
    for (const w of [...sys.wm.windows.values()])
      if (w.id !== win.id && !w.options.modal) {
        if (!(await w.close())) {
          message.textContent = 'Restore canceled because an application remained open.';
          return;
        }
      }
    try {
      await sys.fs.importData(selected.drive);
      sys.settings.update(selected.settings);
      message.textContent = 'Restoration complete.';
      sys.sound.play('startup');
    } catch (e) {
      message.textContent = 'Restore failed: ' + e.message;
    }
  };
  page.append(
    h(
      'div',
      { class: 'restore-heading' },
      icon('control', 40),
      h('h1', {}, 'Welcome to System Restore'),
    ),
    h(
      'p',
      {},
      'Restore your browser desktop to an earlier state, or create a restore point before making changes.',
    ),
    h(
      'p',
      { class: 'muted' },
      'Restore points include all virtual-drive files and desktop settings.',
    ),
    list,
    message,
    h(
      'div',
      { class: 'button-row' },
      button('Create Restore Point...', create),
      button('Restore Selected', restore),
      button('Close', () => win.close()),
    ),
  );
  win.content.append(page);
  refresh();
  return win;
}

export function createBackup(sys) {
  const win = sys.createWindow({
    title: 'Backup',
    icon: 'floppy',
    width: 455,
    height: 290,
    resizable: false,
  });
  const message = h('p');
  const backup = () => {
    const data = sys.fs.exportData();
    download(
      new Blob([JSON.stringify(data)], { type: 'application/json' }),
      'Millennium-Backup-' + new Date().toISOString().slice(0, 10) + '.json',
    );
    message.textContent = 'Backup exported to your device.';
  };
  const restore = async () => {
    const files = await pickFiles({ accept: '.json' });
    if (!files.length) return;
    try {
      if (files[0].size > 350000000) throw new Error('This backup is too large.');
      const data = JSON.parse(await files[0].text());
      if (
        !(await sys.dialogs.confirm(
          'Replace the virtual drive with the selected backup?',
          'Restore Backup',
        ))
      )
        return;
      await sys.fs.importData(data);
      message.textContent = 'Backup restored.';
    } catch (e) {
      sys.dialogs.message(e.message, { title: 'Backup' });
    }
  };
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      h(
        'div',
        { class: 'dialog-message' },
        icon('floppy', 32),
        h('p', {}, 'Back up your complete virtual drive to a file, or restore a previous backup.'),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, 'Backup and Restore'),
        button('Back Up Now...', backup),
        button('Restore Backup...', restore, { style: { marginLeft: '8px' } }),
      ),
      message,
      h(
        'div',
        { class: 'button-row' },
        button('Close', () => win.close()),
      ),
    ),
  );
  return win;
}

export function createDiskCleanup(sys) {
  const win = sys.createWindow({
    title: 'Disk Cleanup for (C:)',
    icon: 'disk',
    width: 420,
    height: 375,
    resizable: false,
  });
  let temp = true,
    recycle = false;
  const recycled = () => sys.fs.walk('C:\\Recycled'),
    temporary = () => sys.fs.walk('C:\\Windows\\Temp');
  const total = (nodes) => nodes.reduce((sum, n) => sum + (n.size ?? 0), 0),
    message = h('p');
  const options = h(
    'div',
    { class: 'sunken', style: { padding: '10px' } },
    checkbox('Temporary files — ' + formatBytes(total(temporary())), temp, (v) => (temp = v)),
    checkbox('Recycle Bin — ' + formatBytes(total(recycled())), recycle, (v) => (recycle = v)),
  );
  const cleanup = async () => {
    if (!(await sys.dialogs.confirm('Permanently delete the selected files?', 'Disk Cleanup')))
      return;
    let bytes = 0;
    try {
      if (temp) {
        const items = sys.fs.list('C:\\Windows\\Temp', { hidden: true });
        bytes += total(temporary());
        for (const n of items) await sys.fs.remove(n.path, { permanent: true });
      }
      if (recycle) {
        bytes += total(recycled());
        await sys.fs.emptyRecycleBin();
      }
      message.textContent = `Disk cleanup completed. ${formatBytes(bytes)} removed.`;
    } catch (e) {
      message.textContent = e.message;
    }
  };
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      h(
        'div',
        { class: 'dialog-message' },
        icon('disk', 32),
        h('p', {}, 'Disk Cleanup can remove unnecessary files from your virtual drive.'),
      ),
      h('p', {}, 'Files to delete:'),
      options,
      h(
        'fieldset',
        {},
        h('legend', {}, 'Description'),
        h(
          'p',
          {},
          'Temporary files and items in the Recycle Bin can be deleted permanently. Your other documents remain on the drive.',
        ),
      ),
      message,
      h(
        'div',
        { class: 'button-row' },
        button('OK', cleanup),
        button('Cancel', () => win.close()),
      ),
    ),
  );
  return win;
}

export function createScanDisk(sys, args = {}) {
  const defrag = !!args.defrag,
    title = defrag ? 'Disk Defragmenter' : 'ScanDisk';
  const win = sys.createWindow({ title, icon: 'disk', width: 470, height: 390, resizable: false });
  const map = h('div', { class: 'disk-map' }),
    message = h(
      'p',
      {},
      defrag
        ? 'The virtual drive uses IndexedDB and does not expose physical disk sectors.'
        : 'Check the virtual drive for invalid paths, missing folders and duplicate file identities.',
    ),
    progress = h(
      'div',
      { class: 'progress' },
      h('div', { class: 'progress-fill', style: { width: '0%' } }),
    ),
    result = h('div', {
      class: 'sunken text-selectable',
      style: { padding: '8px', height: '74px', overflow: 'auto', whiteSpace: 'pre-wrap' },
    });
  const run = () => {
    const nodes = [...sys.fs.nodes.values()],
      ids = new Set(),
      errors = [];
    map.replaceChildren();
    nodes.forEach((n, i) => {
      const good = n.path.length === 3 || sys.fs.stat(dirname(n.path))?.kind === 'directory';
      if (!good) errors.push('Missing parent: ' + n.path);
      if (ids.has(n.id)) errors.push('Duplicate identity: ' + n.path);
      ids.add(n.id);
      map.append(
        h('span', {
          style: { background: good ? (n.kind === 'directory' ? '#184b9c' : '#54a4d5') : '#c22' },
          title: n.path,
        }),
      );
    });
    progress.firstChild.style.width = '100%';
    result.textContent = errors.length
      ? errors.join('\n')
      : `${nodes.length} entries checked.\nNo filesystem errors found.\n${formatBytes(nodes.reduce((sum, n) => sum + (n.size ?? 0), 0))} file data.`;
    message.textContent = defrag
      ? 'Analysis complete. IndexedDB manages storage placement; physical defragmentation is not applicable.'
      : 'ScanDisk has finished checking your virtual drive.';
  };
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      h('div', { class: 'dialog-message' }, icon('disk', 32), h('strong', {}, 'Local Disk (C:)')),
      message,
      map,
      progress,
      result,
      h(
        'div',
        { class: 'button-row' },
        button(defrag ? 'Analyze' : 'Start', run),
        button('Close', () => win.close()),
      ),
    ),
  );
  return win;
}

export function createSysInfo(sys) {
  const win = sys.createWindow({
    title: 'Microsoft System Information',
    icon: 'computer',
    width: 690,
    height: 440,
  });
  const output = h('div', { class: 'sysinfo-view text-selectable' });
  const data = () => ({
    'System Summary': [
      ['Operating environment', 'Millennium browser reimplementation'],
      ['Version', '1.0.0'],
      ['Platform', navigator.platform],
      ['User agent', navigator.userAgent],
      ['Logical processors', navigator.hardwareConcurrency ?? 'Unavailable'],
      ['Device memory', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'Not reported'],
      ['Display', `${innerWidth} × ${innerHeight} (${devicePixelRatio} device pixel ratio)`],
      ['Online', navigator.onLine ? 'Yes' : 'No'],
      ['Time zone', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ],
    Graphics: [...sys.surfaces].flatMap((s, i) =>
      Object.entries(s.diagnostics()).map(([key, value]) => [
        'Surface ' + i + ' / ' + key,
        typeof value === 'object' ? JSON.stringify(value) : String(value),
      ]),
    ),
    Storage: [
      ['Persistent', sys.fs.persistent ? 'Yes — IndexedDB' : 'No — memory fallback'],
      ['Entries', sys.fs.nodes.size],
      [
        'Data size',
        formatBytes([...sys.fs.nodes.values()].reduce((sum, n) => sum + (n.size ?? 0), 0)),
      ],
      ['Revision', sys.fs.revision],
    ],
    'Running Tasks': [...sys.wm.windows.values()].map((w) => [w.title, w.state]),
  });
  let section = 'System Summary';
  const render = () => {
    output.replaceChildren(
      h('h2', {}, section),
      h(
        'table',
        { class: 'classic-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', {}, 'Value'))),
        h(
          'tbody',
          {},
          data()[section].map(([k, v]) =>
            h(
              'tr',
              {},
              h('td', {}, k),
              h('td', { style: { whiteSpace: 'normal', overflowWrap: 'anywhere' } }, String(v)),
            ),
          ),
        ),
      ),
    );
  };
  const save = () => {
    download(
      new Blob([JSON.stringify(data(), null, 2)], { type: 'application/json' }),
      'System-Information.json',
    );
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'Export...', action: save },
        { label: 'Exit', action: () => win.close() },
      ],
    },
    { label: 'View', items: [{ label: 'Refresh', action: render }] },
    {
      label: 'Tools',
      items: [
        { label: 'System Restore', action: () => sys.launch('restore') },
        { label: 'ScanDisk', action: () => sys.launch('scandisk') },
      ],
    },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'help-layout' },
      h(
        'aside',
        { class: 'help-nav' },
        Object.keys(data()).map((name) =>
          button(name, () => {
            section = name;
            render();
          }),
        ),
      ),
      output,
    ),
  );
  render();
  return win;
}

export function createRegistryEditor(sys) {
  const win = sys.createWindow({
    title: 'Registry Editor',
    icon: 'registry',
    width: 690,
    height: 445,
  });
  let values = sys.settings.get('registry') ?? {},
    selected = 'HKEY_CURRENT_USER\\Control Panel\\Desktop';
  const roots = [
      'HKEY_CLASSES_ROOT',
      'HKEY_CURRENT_USER',
      'HKEY_LOCAL_MACHINE',
      'HKEY_USERS',
      'HKEY_CURRENT_CONFIG',
      'HKEY_DYN_DATA',
    ],
    defaults = {
      'HKEY_CURRENT_USER\\Control Panel\\Desktop': {
        Wallpaper: sys.settings.get('wallpaper'),
        Background: sys.settings.get('desktopColor'),
        ScreenSaveActive: sys.settings.get('screenSaver') !== 'none' ? '1' : '0',
      },
      'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion': {
        Version: 'Windows Me',
        VersionNumber: '4.90.3000',
        RegisteredOwner: sys.settings.get('userName'),
      },
      'HKEY_CURRENT_USER\\Software\\Millennium': { Renderer: sys.settings.get('renderer') },
    };
  const tree = h('div', { class: 'registry-tree' }),
    table = h('tbody'),
    status = h('footer', { class: 'status-bar' }, h('span'));
  const save = () => {
    sys.settings.set('registry', values);
    const d = values['HKEY_CURRENT_USER\\Control Panel\\Desktop'];
    if (d) {
      if (/^#[0-9a-f]{6}$/i.test(d.Background ?? ''))
        sys.settings.set('desktopColor', d.Background);
      if (d.Wallpaper) sys.settings.set('wallpaper', d.Wallpaper);
    }
    const o =
      values['HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion']?.RegisteredOwner;
    if (o) sys.settings.set('userName', String(o));
    const r = values['HKEY_CURRENT_USER\\Software\\Millennium']?.Renderer;
    if (['auto', 'webgl', 'canvas'].includes(r)) sys.settings.set('renderer', r);
  };
  const edit = async (name) => {
    const raw = (values[selected] ?? defaults[selected] ?? {})[name] ?? '';
    const text = await sys.dialogs.prompt('Value data:', String(raw), {
      title: 'Edit String — ' + name,
      label: 'Value data:',
    });
    if (text !== null) {
      values[selected] = { ...(values[selected] ?? defaults[selected] ?? {}), [name]: text };
      save();
      render();
    }
  };
  const render = () => {
    tree.replaceChildren(
      button(
        [icon('computer', 16), 'My Computer'],
        () => {
          selected = 'HKEY_CURRENT_USER\\Control Panel\\Desktop';
          render();
        },
        { class: 'tree-item' },
      ),
    );
    for (const root of roots) {
      tree.append(
        button(
          [icon('folder', 16), root],
          () => {
            selected = root;
            render();
          },
          { class: 'tree-item' },
        ),
      );
      for (const key of [...new Set([...Object.keys(defaults), ...Object.keys(values)])].filter(
        (k) => k.startsWith(root + '\\'),
      ))
        tree.append(
          button(
            [icon('folder', 16), key.slice(root.length + 1)],
            () => {
              selected = key;
              render();
            },
            {
              class: 'tree-item' + (key === selected ? ' selected' : ''),
              style: { paddingLeft: '18px' },
            },
          ),
        );
    }
    table.replaceChildren();
    for (const [name, data] of Object.entries(
      values[selected] ?? defaults[selected] ?? { '(Default)': '(value not set)' },
    )) {
      const row = h(
        'tr',
        { tabIndex: 0 },
        h('td', {}, 'ab ', name),
        h('td', {}, 'REG_SZ'),
        h('td', {}, String(data)),
      );
      row.addEventListener('dblclick', () => edit(name));
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        sys.menus.show(e.clientX, e.clientY, [
          { label: 'Modify', action: () => edit(name) },
          {
            label: 'Delete',
            action: async () => {
              if (await sys.dialogs.confirm('Delete this registry value?', 'Registry Editor')) {
                values[selected] = { ...(values[selected] ?? defaults[selected] ?? {}) };
                delete values[selected][name];
                save();
                render();
              }
            },
          },
        ]);
      });
      table.append(row);
    }
    status.firstChild.textContent = 'My Computer\\' + selected;
  };
  const exportReg = () => {
    const all = { ...defaults, ...values };
    let text = 'REGEDIT4\r\n\r\n';
    for (const [key, entries] of Object.entries(all)) {
      text += '[' + key + ']\r\n';
      for (const [name, v] of Object.entries(entries))
        text += JSON.stringify(name) + '=' + JSON.stringify(String(v)) + '\r\n';
      text += '\r\n';
    }
    download(new Blob([text], { type: 'text/plain' }), 'Millennium.reg');
  };
  const importReg = async () => {
    const files = await pickFiles({ accept: '.reg' });
    if (!files[0]) return;
    try {
      const text = await files[0].text();
      if (!/^REGEDIT4|^Windows Registry Editor Version 5.00/.test(text))
        throw new Error('Unrecognized registry file.');
      let key;
      const next = structuredClone(values);
      for (const line of text.split(/\r?\n/)) {
        if (/^\[.*\]$/.test(line)) {
          key = line.slice(1, -1);
          if (!roots.some((r) => key === r || key.startsWith(r + '\\')))
            throw new Error('Invalid root key.');
          next[key] = { ...(next[key] ?? defaults[key] ?? {}) };
        } else if (key && /^"/.test(line)) {
          const match = line.match(/^("(?:[^"\\]|\\.)*")=("(?:[^"\\]|\\.)*")$/);
          if (match) next[key][JSON.parse(match[1])] = JSON.parse(match[2]);
        }
      }
      values = next;
      save();
      render();
    } catch (e) {
      sys.dialogs.message(e.message, { title: 'Registry Editor' });
    }
  };
  win.menu([
    {
      label: 'Registry',
      items: [
        { label: 'Import Registry File...', action: importReg },
        { label: 'Export Registry File...', action: exportReg },
        '-',
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        {
          label: 'New Key...',
          action: async () => {
            const name = await sys.dialogs.prompt('Enter the new key name.', 'New Key', {
              title: 'New Key',
            });
            if (name) {
              selected += '\\' + name;
              values[selected] = {};
              save();
              render();
            }
          },
        },
        {
          label: 'New String Value...',
          action: async () => {
            const name = await sys.dialogs.prompt('Enter the new value name.', 'New Value', {
              title: 'New String Value',
            });
            if (name) await edit(name);
          },
        },
        {
          label: 'Find...',
          action: async () => {
            const q = await sys.dialogs.prompt('Search registry key names.', '', {
              title: 'Find',
              label: 'Find what:',
            });
            if (q) {
              const key = [...Object.keys(defaults), ...Object.keys(values)].find((k) =>
                k.toLowerCase().includes(q.toLowerCase()),
              );
              if (key) {
                selected = key;
                render();
              } else
                sys.dialogs.message('Finished searching the registry. No matching key was found.');
            }
          },
        },
      ],
    },
    { label: 'View', items: [{ label: 'Refresh', action: render }] },
    {
      label: 'Help',
      items: [
        {
          label: 'About Registry Editor',
          action: () =>
            sys.dialogs.message(
              'Registry Editor\n\nEdit and export the browser desktop registry. Display color, wallpaper, registered owner and renderer values are connected to desktop settings. Other values are stored for this desktop only. The host Windows registry is not accessed.',
              { title: 'Registry Editor', icon: 'registry' },
            ),
        },
      ],
    },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'registry-layout' },
      tree,
      h(
        'div',
        { class: 'app-scroll sunken' },
        h(
          'table',
          { class: 'classic-table' },
          h(
            'thead',
            {},
            h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Type'), h('th', {}, 'Data')),
          ),
          table,
        ),
      ),
    ),
    status,
  );
  render();
  return win;
}

export function createOnScreenKeyboard(sys) {
  const win = sys.createWindow({
    title: 'On-Screen Keyboard',
    icon: 'keyboard',
    width: 650,
    height: 240,
    minWidth: 420,
    minHeight: 210,
    resizable: false,
  });
  let shift = false,
    lastTarget = null;
  const rows = [
    ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Back'],
    ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
    ['Caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
    ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift'],
    ['Space', '←', '→'],
  ];
  const grid = h('div', { class: 'osk' });
  const focus = (e) => {
    if (
      !win.element.contains(e.target) &&
      (e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target.isContentEditable)
    )
      lastTarget = e.target;
  };
  document.addEventListener('focusin', focus, { signal: win.signal });
  const press = (key) => {
    if (key === 'Shift' || key === 'Caps') {
      shift = !shift;
      render();
      return;
    }
    if (key === 'Esc') {
      sys.menus.close();
      return;
    }
    const target = lastTarget;
    if (!target?.isConnected) return;
    target.focus();
    if (target.isContentEditable) {
      if (key === 'Back') document.execCommand('delete');
      else
        document.execCommand(
          'insertText',
          false,
          key === 'Space'
            ? ' '
            : key === 'Enter'
              ? '\n'
              : key === 'Tab'
                ? '\t'
                : shift
                  ? key.toUpperCase()
                  : key,
        );
      return;
    }
    if (typeof target.selectionStart !== 'number') return;
    let start = target.selectionStart,
      end = target.selectionEnd;
    if (key === '←' || key === '→') {
      const at = Math.max(0, Math.min(target.value.length, start + (key === '←' ? -1 : 1)));
      target.setSelectionRange(at, at);
      return;
    }
    const text =
      key === 'Back'
        ? ''
        : key === 'Space'
          ? ' '
          : key === 'Enter'
            ? '\n'
            : key === 'Tab'
              ? '\t'
              : shift
                ? key.toUpperCase()
                : key;
    if (key === 'Back' && start === end) start = Math.max(0, start - 1);
    target.setRangeText(text, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const render = () => {
    grid.replaceChildren();
    for (const row of rows)
      grid.append(
        h(
          'div',
          { class: 'osk-row' },
          row.map((key) =>
            button(shift && key.length === 1 ? key.toUpperCase() : key, () => press(key), {
              class: key.length > 1 ? 'wide' + (key === 'Space' ? ' space' : '') : '',
              onpointerdown: (e) => e.preventDefault(),
            }),
          ),
        ),
      );
  };
  win.content.append(
    h(
      'p',
      { style: { margin: '10px' } },
      'Click in a text field, then type using the keyboard below.',
    ),
    grid,
  );
  render();
  return win;
}

export function createAddRemove(sys) {
  const win = sys.createWindow({
    title: 'Add/Remove Programs Properties',
    icon: 'control',
    width: 470,
    height: 380,
    resizable: false,
  });
  let selected = null;
  const list = h('div', {
      class: 'classic-list sunken',
      style: { flex: '1', minHeight: '190px', overflow: 'auto' },
    }),
    description = h('p');
  const render = () => {
    list.replaceChildren();
    for (const app of sys.registry
      .list()
      .filter((a) =>
        ['Accessories', 'Games', 'Programs', 'Entertainment', 'Internet'].includes(a.category),
      )) {
      const disabled = (sys.settings.get('disabledApps') ?? []).includes(app.id);
      const row = button(
        [icon(app.icon, 16), app.title, disabled ? ' (not installed)' : ''],
        () => {
          selected = app;
          for (const c of list.children) c.classList.remove('selected');
          row.classList.add('selected');
          description.textContent =
            app.title + (disabled ? ' can be reinstalled.' : ' is installed.');
        },
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: 'transparent',
            boxShadow: 'none',
            width: '100%',
            textAlign: 'left',
            padding: '4px',
          },
        },
      );
      list.append(row);
    }
  };
  const toggle = async () => {
    if (!selected) return;
    const disabled = sys.settings.get('disabledApps') ?? [];
    if (disabled.includes(selected.id))
      sys.settings.set(
        'disabledApps',
        disabled.filter((id) => id !== selected.id),
      );
    else {
      if (
        !(await sys.dialogs.confirm(
          `Remove ${selected.title} from the Start menu and disable launching it?\n\nYour documents will be kept. You can reinstall it here.`,
          'Remove Program',
        ))
      )
        return;
      for (const w of [...sys.wm.windows.values()].filter((w) => w.appId === selected.id))
        if (!(await w.close())) return;
      sys.settings.set('disabledApps', [...disabled, selected.id]);
    }
    render();
  };
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      h('p', {}, 'Select a program to install or remove from this desktop.'),
      list,
      description,
      h(
        'div',
        { class: 'button-row' },
        button('Add/Remove...', toggle),
        button('Close', () => win.close()),
      ),
    ),
  );
  render();
  return win;
}

export function createScheduledTasks(sys) {
  const win = sys.createWindow({
    title: 'Scheduled Tasks',
    icon: 'clock',
    width: 570,
    height: 360,
  });
  const body = h('div', { class: 'app-scroll sunken' });
  const render = () => {
    const tasks = sys.settings.get('tasks') ?? [];
    body.replaceChildren(
      h(
        'table',
        { class: 'classic-table' },
        h(
          'thead',
          {},
          h('tr', {}, h('th', {}, 'Task'), h('th', {}, 'Next Run'), h('th', {}, 'Status')),
        ),
        h(
          'tbody',
          {},
          tasks.map((task) => {
            const row = h(
              'tr',
              {},
              h('td', {}, task.name),
              h('td', {}, new Date(task.next).toLocaleString()),
              h('td', {}, task.enabled ? 'Enabled' : 'Disabled'),
            );
            row.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              sys.menus.show(e.clientX, e.clientY, [
                { label: 'Run', action: () => sys.launch(task.app) },
                {
                  label: task.enabled ? 'Disable' : 'Enable',
                  action: () => {
                    sys.settings.set(
                      'tasks',
                      tasks.map((t) => (t.id === task.id ? { ...t, enabled: !t.enabled } : t)),
                    );
                    render();
                  },
                },
                {
                  label: 'Delete',
                  action: () => {
                    sys.settings.set(
                      'tasks',
                      tasks.filter((t) => t.id !== task.id),
                    );
                    render();
                  },
                },
              ]);
            });
            return row;
          }),
        ),
      ),
    );
  };
  const add = () => {
    const dlg = sys.wm.create({
      title: 'Scheduled Task Wizard',
      width: 410,
      height: 285,
      center: true,
      modal: true,
      resizable: false,
    });
    let app = 'notepad';
    const name = h('input', { value: 'New Task' }),
      date = h('input', {
        type: 'datetime-local',
        value: new Date(Date.now() + 60000 - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16),
      }),
      repeat = select(
        [
          { value: 'once', label: 'One time only' },
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
        ],
        'once',
      );
    dlg.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        field('Name:', name),
        field(
          'Program:',
          select(
            sys.registry
              .list()
              .filter((a) => a.category)
              .map((a) => ({ value: a.id, label: a.title })),
            app,
            (v) => (app = v),
          ),
        ),
        field('Start:', date),
        field('Perform task:', repeat),
        h('p', {}, 'Tasks run only while this desktop is open.'),
        h(
          'div',
          { class: 'button-row' },
          button('Finish', () => {
            const next = new Date(date.value).getTime();
            if (!Number.isFinite(next)) {
              sys.dialogs.message('Enter a valid start time.');
              return;
            }
            sys.settings.set('tasks', [
              ...(sys.settings.get('tasks') ?? []),
              {
                id: uid(),
                name: name.value || 'Task',
                app,
                next,
                repeat: repeat.value,
                enabled: true,
              },
            ]);
            dlg.close();
            render();
          }),
          button('Cancel', () => dlg.close()),
        ),
      ),
    );
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New Scheduled Task', action: add },
        { label: 'Close', action: () => win.close() },
      ],
    },
    { label: 'View', items: [{ label: 'Refresh', action: render }] },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'toolbar' },
      button([icon('clock', 16), 'Add Scheduled Task'], add, { class: 'tool-button' }),
    ),
    body,
  );
  win.status('Tasks run while this desktop is open. Right-click a task for options.');
  sys.settings.on(
    'change',
    (v) => {
      if (v.tasks) render();
    },
    { signal: win.signal },
  );
  render();
  return win;
}
