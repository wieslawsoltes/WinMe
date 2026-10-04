import { h, button, field, checkbox, select, pickFiles } from '../../ui/src/dom.js';
import { icon, fileIcon } from '../../ui/src/icons.js';
import { basename } from '../../filesystem/src/index.js';
import { clamp } from '../../core/src/index.js';

export class DesktopShell {
  constructor(sys) {
    this.sys = sys;
    this.desktop = document.querySelector('#desktop');
    this.icons = document.querySelector('#desktop-icons');
    this.taskbar = document.querySelector('#taskbar');
    this.selected = new Set();
    this.positions = sys.settings.get('desktopPositions') ?? {};
    this.lastClick = {};
    this.initialIcons = [
      {
        id: 'documents',
        label: 'My Documents',
        icon: 'documents',
        app: 'explorer',
        args: { path: 'C:\\My Documents' },
        column: 0,
        row: 0,
      },
      {
        id: 'computer',
        label: 'My Computer',
        icon: 'computer',
        app: 'explorer',
        args: { path: 'computer' },
        column: 0,
        row: 1,
      },
      {
        id: 'network',
        label: 'My Network\nPlaces',
        icon: 'network',
        app: 'network',
        column: 0,
        row: 2,
      },
      {
        id: 'recycle',
        label: 'Recycle Bin',
        icon: 'recycle',
        app: 'explorer',
        args: { path: 'recycle' },
        column: 0,
        row: 3,
      },
      { id: 'browser', label: 'Internet\nExplorer', icon: 'ie', app: 'browser', column: 0, row: 4 },
      {
        id: 'msn',
        label: 'Setup MSN\nInternet Access',
        icon: 'globe',
        app: 'network-wizard',
        column: 0,
        row: 5,
        shortcut: true,
      },
      {
        id: 'briefcase',
        label: 'My Briefcase',
        icon: 'briefcase',
        app: 'briefcase',
        column: 0,
        row: 6,
      },
      {
        id: 'online',
        label: 'Online\nServices',
        icon: 'folder',
        app: 'browser',
        args: { url: 'about:home' },
        column: 1,
        row: 0,
      },
      {
        id: 'outlook',
        label: 'Outlook\nExpress',
        icon: 'mail',
        app: 'outlook',
        column: 1,
        row: 1,
        shortcut: true,
      },
      {
        id: 'media',
        label: 'Windows\nMedia Player',
        icon: 'media',
        app: 'media-player',
        column: 1,
        row: 2,
        shortcut: true,
      },
      {
        id: 'connect',
        label: 'Connect to the\nInternet',
        icon: 'globe',
        app: 'network-wizard',
        column: 1,
        row: 3,
        shortcut: true,
      },
    ];
    this.buildTaskbar();
    this.bind();
    this.renderIcons();
    this.renderTasks();
    this.updateClock();
  }
  entries() {
    const files = this.sys.fs
      .list('C:\\Windows\\Desktop', { hidden: this.sys.settings.get('showHidden') })
      .map((n, i) => ({
        id: n.id,
        label: /\.lnk$/i.test(n.name) ? n.name.replace(/\.lnk$/i, '') : n.name,
        icon: fileIcon(n),
        path: n.path,
        column: 2 + Math.floor(i / this.rows),
        row: i % this.rows,
        shortcut: /\.lnk$/i.test(n.name),
      }));
    return [
      ...this.initialIcons.filter(
        (n) => !(this.sys.settings.get('disabledApps') ?? []).includes(n.app),
      ),
      ...files,
    ];
  }
  get rows() {
    return Math.max(1, Math.floor((this.desktop.clientHeight - 3) / 75));
  }
  position(entry) {
    if (this.positions[entry.id]) return this.positions[entry.id];
    return {
      x: (entry.column + Math.floor(entry.row / this.rows)) * 75,
      y: (entry.row % this.rows) * 75,
    };
  }
  open(entry) {
    if (entry.path) this.sys.open(entry.path);
    else this.sys.launch(entry.app, entry.args ?? {});
  }
  renderIcons() {
    this.icons.replaceChildren();
    const entries = this.entries();
    this.selected = new Set([...this.selected].filter((id) => entries.some((e) => e.id === id)));
    for (const entry of entries) {
      const p = this.position(entry);
      const node = button(
        [icon(entry.icon, 32), h('span', { class: 'icon-label' }, entry.label)],
        (e) => {
          if (this.suppressClick) {
            this.suppressClick = false;
            return;
          }
          if (e.ctrlKey || e.metaKey) {
            if (this.selected.has(entry.id)) this.selected.delete(entry.id);
            else this.selected.add(entry.id);
          } else {
            this.selected = new Set([entry.id]);
          }
          this.paintSelection();
          const now = performance.now();
          if (
            this.sys.settings.get('singleClick') ||
            (this.lastClick.id === entry.id &&
              now - this.lastClick.time < this.sys.settings.get('doubleClickSpeed'))
          ) {
            this.open(entry);
            this.lastClick = {};
          } else this.lastClick = { id: entry.id, time: now };
        },
        {
          class:
            'desktop-icon' +
            (entry.shortcut ? ' shortcut' : '') +
            (this.selected.has(entry.id) ? ' selected' : ''),
          title: entry.label.replaceAll('\n', ' '),
          draggable: true,
          dataset: { id: entry.id },
          style: {
            left: clamp(p.x, 0, Math.max(0, this.desktop.clientWidth - 74)) + 'px',
            top: clamp(p.y, 0, Math.max(0, this.desktop.clientHeight - 72)) + 'px',
          },
        },
      );
      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selected = new Set([entry.id]);
        this.paintSelection();
        this.iconMenu(entry, e.clientX, e.clientY);
      });
      node.addEventListener('dragstart', (e) => {
        this.selected = new Set([entry.id]);
        this.paintSelection();
        const r = node.getBoundingClientRect();
        e.dataTransfer.setData(
          'application/x-millennium-desktop',
          JSON.stringify({ id: entry.id, offsetX: e.clientX - r.left, offsetY: e.clientY - r.top }),
        );
        if (entry.path)
          e.dataTransfer.setData('application/x-millennium-files', JSON.stringify([entry.path]));
        e.dataTransfer.effectAllowed = 'copyMove';
        this.suppressClick = true;
      });
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.open(entry);
        }
        if (e.key === 'F2' && entry.path) {
          e.preventDefault();
          this.rename(entry);
        }
        if (e.key === 'Delete' && entry.path) {
          e.preventDefault();
          this.deleteSelected(e.shiftKey);
        }
        const change = { ArrowDown: 1, ArrowUp: -1, ArrowRight: this.rows, ArrowLeft: -this.rows }[
          e.key
        ];
        if (change !== undefined) {
          e.preventDefault();
          const i = entries.indexOf(entry);
          this.icons.children[clamp(i + change, 0, entries.length - 1)]?.focus();
        }
      });
      if (entry.id === 'recycle') {
        node.addEventListener('dragover', (e) => {
          if (e.dataTransfer.types.includes('application/x-millennium-files')) {
            e.preventDefault();
            node.classList.add('drag-target');
          }
        });
        node.addEventListener('dragleave', () => node.classList.remove('drag-target'));
        node.addEventListener('drop', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          node.classList.remove('drag-target');
          try {
            const paths = JSON.parse(
              e.dataTransfer.getData('application/x-millennium-files') || '[]',
            );
            for (const p of paths) await this.sys.fs.remove(p);
          } catch (error) {
            this.sys.error(error);
          }
        });
      }
      this.icons.append(node);
    }
  }
  paintSelection() {
    for (const node of this.icons.children)
      node.classList.toggle('selected', this.selected.has(node.dataset.id));
  }
  async rename(entry) {
    const name = await this.sys.dialogs.prompt('Enter a new name.', basename(entry.path), {
      title: 'Rename',
    });
    if (name) {
      try {
        await this.sys.fs.rename(entry.path, name);
      } catch (e) {
        this.sys.error(e);
      }
    }
  }
  async deleteSelected(permanent = false) {
    const entries = this.entries().filter((e) => this.selected.has(e.id) && e.path);
    if (!entries.length) return;
    if (
      !(await this.sys.dialogs.confirm(
        `Delete ${entries.length === 1 ? '“' + entries[0].label + '”' : entries.length + ' items'}${permanent ? ' permanently' : ''}?`,
        'Confirm File Delete',
      ))
    )
      return;
    for (const e of entries) {
      try {
        await this.sys.fs.remove(e.path, { permanent });
      } catch (error) {
        this.sys.error(error);
      }
    }
  }
  async newItem(type) {
    const folder = 'C:\\Windows\\Desktop';
    const name = await this.sys.dialogs.prompt(
      'Enter a name.',
      this.sys.fs.uniqueName(folder, type === 'folder' ? 'New Folder' : 'New Text Document.txt'),
      { title: type === 'folder' ? 'New Folder' : 'New Text Document' },
    );
    if (name) {
      try {
        if (type === 'folder') await this.sys.fs.mkdir(folder + '\\' + name);
        else await this.sys.fs.writeFile(folder + '\\' + name, '');
      } catch (e) {
        this.sys.error(e);
      }
    }
  }
  async paste() {
    const folder = 'C:\\Windows\\Desktop';
    for (const path of this.sys.clipboard.files ?? []) {
      try {
        const dest = folder + '\\' + this.sys.fs.uniqueName(folder, basename(path));
        await (this.sys.clipboard.cut
          ? this.sys.fs.move(path, dest)
          : this.sys.fs.copy(path, dest));
      } catch (e) {
        this.sys.error(e);
      }
    }
    if (this.sys.clipboard.cut) this.sys.clipboard.files = [];
  }
  iconMenu(entry, x, y) {
    const items = [{ label: 'Open', action: () => this.open(entry) }];
    if (entry.path)
      items.push(
        '-',
        {
          label: 'Cut',
          action: () => {
            this.sys.clipboard.files = [entry.path];
            this.sys.clipboard.cut = true;
          },
        },
        {
          label: 'Copy',
          action: () => {
            this.sys.clipboard.files = [entry.path];
            this.sys.clipboard.cut = false;
          },
        },
        { label: 'Rename', action: () => this.rename(entry) },
        { label: 'Delete', action: () => this.deleteSelected() },
        '-',
        { label: 'Properties', action: () => this.sys.properties(entry.path) },
      );
    else if (entry.id === 'recycle')
      items.push(
        {
          label: 'Empty Recycle Bin',
          action: async () => {
            if (
              await this.sys.dialogs.confirm(
                'Permanently delete all items in the Recycle Bin?',
                'Recycle Bin',
              )
            )
              await this.sys.fs.emptyRecycleBin();
          },
        },
        '-',
        {
          label: 'Properties',
          action: () =>
            this.sys.dialogs.message(
              'Deleted files are stored in the virtual Recycle Bin until you restore or permanently delete them.',
              { title: 'Recycle Bin Properties', icon: 'recycle' },
            ),
        },
      );
    else
      items.push('-', {
        label: 'Properties',
        action: () =>
          this.sys.launch(
            entry.id === 'computer'
              ? 'system'
              : entry.id === 'network'
                ? 'network-wizard'
                : entry.id === 'browser'
                  ? 'internet-options'
                  : 'about',
          ),
      });
    this.sys.menus.show(x, y, items);
  }
  backgroundMenu(x, y) {
    this.sys.menus.show(x, y, [
      {
        label: 'Arrange Icons',
        children: [
          { label: 'by Name', action: () => this.arrange('name') },
          { label: 'by Type', action: () => this.arrange('type') },
          { label: 'Auto Arrange', action: () => this.arrange('default') },
        ],
      },
      { label: 'Line Up Icons', action: () => this.arrange('default') },
      { label: 'Refresh', action: () => this.renderIcons() },
      '-',
      { label: 'Paste', action: () => this.paste(), disabled: !this.sys.clipboard.files?.length },
      {
        label: 'New',
        children: [
          { label: 'Folder', icon: 'folder', action: () => this.newItem('folder') },
          { label: 'Text Document', icon: 'notepad', action: () => this.newItem('text') },
          { label: 'Shortcut...', icon: 'windows', action: () => this.createShortcut() },
        ],
      },
      '-',
      { label: 'Properties', action: () => this.sys.launch('display') },
    ]);
  }
  async createShortcut() {
    const target = await this.sys.dialogs.prompt('Type the location of the item.', 'notepad', {
      title: 'Create Shortcut',
      label: 'Command:',
    });
    if (!target) return;
    const name = await this.sys.dialogs.prompt('Select a name for the shortcut.', target, {
      title: 'Create Shortcut',
    });
    if (name) {
      try {
        await this.sys.fs.writeFile(
          'C:\\Windows\\Desktop\\' + this.sys.fs.uniqueName('C:\\Windows\\Desktop', name + '.lnk'),
          JSON.stringify({ command: target }),
          'application/x-millennium-shortcut',
        );
      } catch (e) {
        this.sys.error(e);
      }
    }
  }
  arrange(order) {
    if (order === 'default') {
      this.positions = {};
    } else {
      const list = this.entries().sort((a, b) =>
        order === 'type'
          ? a.icon.localeCompare(b.icon) || a.label.localeCompare(b.label)
          : a.label.localeCompare(b.label),
      );
      this.positions = Object.fromEntries(
        list.map((e, i) => [e.id, { x: Math.floor(i / this.rows) * 75, y: (i % this.rows) * 75 }]),
      );
    }
    this.sys.settings.set('desktopPositions', this.positions);
    this.renderIcons();
  }
  appItem(id, label) {
    const app = this.sys.registry.get(id);
    return {
      label: label ?? app?.title ?? id,
      icon: app?.icon ?? 'windows',
      disabled: (this.sys.settings.get('disabledApps') ?? []).includes(id),
      action: () => this.sys.launch(id),
    };
  }
  startItems() {
    const app = (id) => this.appItem(id);
    const category = (category) =>
      this.sys.registry
        .list(category)
        .filter((a) => !(this.sys.settings.get('disabledApps') ?? []).includes(a.id))
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((a) => app(a.id));
    const accessories = [
      {
        label: 'Accessibility',
        icon: 'folder',
        children: [app('osk'), this.appItem('accessibility', 'Accessibility Options')],
      },
      {
        label: 'Communications',
        icon: 'folder',
        children: [app('network-wizard'), app('outlook')],
      },
      {
        label: 'Entertainment',
        icon: 'folder',
        children: [app('media-player'), app('sound-recorder'), app('volume')],
      },
      { label: 'System Tools', icon: 'folder', children: category('System Tools') },
      app('addressbook'),
      ...category('Accessories'),
    ];
    const recent = (this.sys.settings.get('recentFiles') ?? [])
      .filter((p) => this.sys.fs.exists(p))
      .slice(-10)
      .reverse()
      .map((path) => ({
        label: basename(path),
        icon: fileIcon(this.sys.fs.stat(path)),
        action: () => this.sys.open(path),
      }));
    return [
      {
        label: 'Windows Update',
        icon: 'windows',
        action: () => this.sys.launch('browser', { url: 'about:windowsupdate' }),
      },
      '-',
      {
        label: 'Programs',
        icon: 'folder',
        children: [
          { label: 'Accessories', icon: 'folder', children: accessories },
          { label: 'Games', icon: 'folder', children: category('Games') },
          {
            label: 'Online Services',
            icon: 'folder',
            children: [app('browser'), app('messenger')],
          },
          {
            label: 'StartUp',
            icon: 'folder',
            children: [
              {
                label: 'Open Startup Folder',
                icon: 'folder',
                action: () => this.sys.launch('explorer', { path: 'C:\\Windows\\StartUp' }),
              },
            ],
          },
          '-',
          app('browser'),
          app('outlook'),
          app('media-player'),
        ],
      },
      {
        label: 'Documents',
        icon: 'documents',
        children: [
          {
            label: 'My Documents',
            icon: 'documents',
            action: () => this.sys.launch('explorer', { path: 'C:\\My Documents' }),
          },
          '-',
          ...(recent.length ? recent : [{ label: '(Empty)', disabled: true }]),
        ],
      },
      {
        label: 'Settings',
        icon: 'control',
        children: [
          app('control'),
          { label: 'Printers', icon: 'printer', action: () => this.sys.launch('printers') },
          {
            label: 'Taskbar & Start Menu...',
            icon: 'windows',
            action: () => this.taskbarProperties(),
          },
          app('network-wizard'),
        ],
      },
      {
        label: 'Search',
        icon: 'search',
        children: [
          {
            label: 'For Files or Folders...',
            icon: 'search',
            action: () => this.sys.launch('search'),
          },
          { label: 'On the Internet...', icon: 'ie', action: () => this.sys.launch('browser') },
          { label: 'For People...', icon: 'mail', action: () => this.sys.launch('addressbook') },
        ],
      },
      { label: 'Help', icon: 'help', action: () => this.sys.launch('help') },
      { label: 'Run...', icon: 'run', action: () => this.runDialog() },
      '-',
      {
        label: 'Log Off ' + this.sys.settings.get('userName') + '...',
        icon: 'logoff',
        action: () => this.shutdownDialog('logoff'),
      },
      { label: 'Shut Down...', icon: 'shutdown', action: () => this.shutdownDialog() },
    ];
  }
  toggleStart() {
    if (this.startButton.classList.contains('pressed')) {
      this.sys.menus.close();
      return;
    }
    const menu = this.sys.menus.show(2, innerHeight - 28, this.startItems(), {
      className: 'start-root',
    });
    const r = menu.getBoundingClientRect();
    menu.style.top = Math.max(0, innerHeight - 28 - r.height) + 'px';
    this.startButton.classList.add('pressed');
    this.sys.menus.closeHooks.add(() => this.startButton.classList.remove('pressed'));
  }
  buildTaskbar() {
    this.startButton = button(
      [icon('windows', 18), h('span', {}, 'Start')],
      () => this.toggleStart(),
      { class: 'start-button', 'aria-label': 'Start', 'aria-haspopup': 'menu' },
    );
    const quick = h(
      'div',
      { class: 'quick-launch' },
      button(icon('display', 16), () => this.sys.wm.showDesktop(), {
        title: 'Show Desktop',
        'aria-label': 'Show Desktop',
      }),
      button(icon('ie', 16), () => this.sys.launch('browser'), {
        title: 'Launch Internet Explorer',
        'aria-label': 'Launch Internet Explorer',
      }),
      button(icon('mail', 16), () => this.sys.launch('outlook'), {
        title: 'Outlook Express',
        'aria-label': 'Outlook Express',
      }),
      button(icon('media', 16), () => this.sys.launch('media-player'), {
        title: 'Windows Media Player',
        'aria-label': 'Windows Media Player',
      }),
    );
    quick.hidden = this.sys.settings.get('quickLaunch') === false;
    this.tasks = h('div', { class: 'task-list', 'aria-label': 'Running programs' });
    this.clock = button('', () => {}, {
      class: 'clock-text',
      title: 'Date and time',
      'aria-label': 'Date and time',
    });
    this.clock.addEventListener('dblclick', () => this.sys.launch('date-time'));
    this.clock.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.sys.menus.show(e.clientX, e.clientY, [
        { label: 'Adjust Date/Time', action: () => this.sys.launch('date-time') },
      ]);
    });
    this.networkIcon = button(icon('network', 16), () => this.sys.launch('network'), {
      title: 'Local Area Connection',
      'aria-label': 'Network connection',
    });
    const tray = h(
      'div',
      { class: 'system-tray' },
      button(icon('sound', 16), () => this.volumePopup(), {
        title: 'Volume',
        'aria-label': 'Volume',
      }),
      this.networkIcon,
      this.clock,
    );
    this.taskbar.append(
      this.startButton,
      h('div', { class: 'taskbar-divider' }),
      quick,
      h('div', { class: 'taskbar-divider' }),
      this.tasks,
      tray,
    );
  }
  renderTasks() {
    this.tasks.replaceChildren();
    for (const win of this.sys.wm.windows.values()) {
      if (win.options.modal) continue;
      const node = button(
        [icon(win.icon, 16), h('span', {}, win.title)],
        () => {
          if (this.sys.wm.activeId === win.id && win.state !== 'minimized') win.minimize();
          else win.focus();
        },
        {
          class: 'task-button' + (this.sys.wm.activeId === win.id ? ' active' : ''),
          title: win.title,
        },
      );
      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.sys.wm.systemMenu(win, e.clientX, innerHeight - 200);
      });
      this.tasks.append(node);
    }
  }
  updateClock() {
    const s = this.sys.settings;
    let date;
    try {
      date = new Date(Date.now() + s.get('clockOffset'));
      this.clock.textContent = date.toLocaleTimeString(s.get('locale') ?? 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: s.get('showSeconds') ? '2-digit' : undefined,
        hour12: !s.get('clock24'),
        timeZone: s.get('timezone') ?? undefined,
      });
      this.clock.title = date.toLocaleDateString(s.get('locale') ?? 'en-US', {
        dateStyle: 'full',
        timeZone: s.get('timezone') ?? undefined,
      });
    } catch {
      this.clock.textContent = new Date().toLocaleTimeString();
    }
    this.networkIcon.title = navigator.onLine
      ? 'Local Area Connection — Connected'
      : 'Local Area Connection — Offline';
  }
  volumePopup() {
    this.sys.menus.close();
    document.querySelector('.tray-volume')?.remove();
    const input = h('input', {
      type: 'range',
      min: 0,
      max: 100,
      value: this.sys.settings.get('volume'),
      'aria-label': 'Volume',
      oninput: (e) => this.sys.settings.set('volume', +e.target.value),
    });
    const popup = h(
      'div',
      { class: 'tray-volume raised' },
      h('span', {}, 'Volume'),
      input,
      checkbox('Mute', !this.sys.settings.get('sound'), (v) => this.sys.settings.set('sound', !v)),
      button(
        'Mixer...',
        () => {
          popup.remove();
          this.sys.launch('volume');
        },
        { style: { minWidth: '0' } },
      ),
    );
    document.querySelector('#overlays').append(popup);
    const close = (e) => {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('pointerdown', close);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', close), 0);
  }
  taskbarProperties() {
    const win = this.sys.wm.create({
      title: 'Taskbar and Start Menu Properties',
      icon: 'windows',
      width: 390,
      height: 285,
      center: true,
      resizable: false,
    });
    let quick = this.sys.settings.get('quickLaunch') !== false;
    win.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        h(
          'fieldset',
          {},
          h('legend', {}, 'Taskbar'),
          checkbox('Show Quick Launch', quick, (v) => (quick = v)),
          checkbox('Show seconds in the clock', this.sys.settings.get('showSeconds'), (v) =>
            this.sys.settings.set('showSeconds', v),
          ),
        ),
        h(
          'fieldset',
          {},
          h('legend', {}, 'Documents menu'),
          h('p', {}, 'Clear the list of recently opened documents.'),
          button('Clear', () => this.sys.settings.set('recentFiles', [])),
        ),
        h(
          'div',
          { class: 'button-row' },
          button('OK', () => {
            this.sys.settings.set('quickLaunch', quick);
            this.taskbar.querySelector('.quick-launch').hidden = !quick;
            win.close();
          }),
          button('Cancel', () => win.close()),
        ),
      ),
    );
  }
  runDialog() {
    const previous = [...this.sys.wm.windows.values()].find((w) => w.appId === 'run');
    if (previous) {
      previous.focus();
      return;
    }
    const win = this.sys.wm.create({
      title: 'Run',
      icon: 'run',
      width: 400,
      height: 180,
      center: true,
      resizable: false,
      modal: true,
      appId: 'run',
    });
    const input = h('input', { 'aria-label': 'Open', value: '', list: 'run-history' }),
      list = h(
        'datalist',
        { id: 'run-history' },
        (this.sys.settings.get('runHistory') ?? []).map((command) =>
          h('option', { value: command }),
        ),
      );
    const run = async () => {
      const command = input.value.trim();
      if (!command) return;
      const history = this.sys.settings.get('runHistory') ?? [];
      this.sys.settings.set(
        'runHistory',
        [command, ...history.filter((s) => s !== command)].slice(0, 15),
      );
      await win.close();
      this.sys.run(command);
    };
    win.content.append(
      h(
        'div',
        { class: 'run-body' },
        h(
          'div',
          { class: 'run-top' },
          icon('run', 32),
          h(
            'p',
            {},
            'Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.',
          ),
        ),
        h('div', { class: 'run-field' }, h('span', {}, 'Open:'), input, list),
        h(
          'div',
          { class: 'button-row' },
          button('OK', run, { class: 'default' }),
          button('Cancel', () => win.close()),
          button('Browse...', async () => {
            const p = await this.sys.dialogs.file();
            if (p) input.value = '"' + p + '"';
          }),
        ),
      ),
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') run();
      if (e.key === 'Escape') win.close();
    });
    requestAnimationFrame(() => input.focus());
  }
  closeProgram() {
    const win = this.sys.wm.create({
      title: 'Close Program',
      icon: 'windows',
      width: 355,
      height: 330,
      center: true,
      resizable: false,
      modal: true,
    });
    let selected = null;
    const list = h('div', { class: 'task-dialog-list sunken' });
    for (const app of this.sys.wm.windows.values()) {
      if (app.id === win.id || app.options.modal) continue;
      const row = button([icon(app.icon, 16), app.title], () => {
        selected = app;
        for (const c of list.children) c.classList.remove('selected');
        row.classList.add('selected');
      });
      list.append(row);
    }
    win.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        list,
        h(
          'p',
          { style: { marginTop: '12px' } },
          'End Task closes a program without saving its unsaved changes.',
        ),
        h(
          'div',
          { class: 'button-row' },
          button('End Task', async () => {
            if (selected) await this.sys.wm.close(selected.id, { force: true });
            win.close();
          }),
          button('Shut Down...', () => {
            win.close();
            this.shutdownDialog();
          }),
          button('Cancel', () => win.close()),
        ),
      ),
    );
  }
  shutdownDialog(initial = 'shutdown') {
    const shade = h('div', { class: 'shutdown-cover' });
    document.querySelector('#overlays').append(shade);
    const win = this.sys.wm.create({
      title: initial === 'logoff' ? 'Log Off Windows' : 'Shut Down Windows',
      icon: 'windows',
      width: 345,
      height: 220,
      center: true,
      resizable: false,
      modal: true,
    });
    win.element.style.position = 'fixed';
    win.element.style.zIndex = '100001';
    document.querySelector('#overlays').append(win.element);
    let mode = initial;
    const choices = select(
      [
        { value: 'shutdown', label: 'Shut down' },
        { value: 'restart', label: 'Restart' },
        { value: 'standby', label: 'Stand by' },
        { value: 'logoff', label: 'Log off ' + this.sys.settings.get('userName') },
      ],
      mode,
      (v) => (mode = v),
    );
    win.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        h(
          'div',
          { class: 'dialog-message' },
          icon('windows', 40),
          h('div', {}, h('p', {}, 'What do you want the computer to do?'), choices),
        ),
        h(
          'div',
          { class: 'button-row' },
          button(
            'OK',
            async () => {
              await win.close();
              if (mode === 'standby') {
                this.sys.startSaver('blank');
                return;
              }
              for (const app of [...this.sys.wm.windows.values()]) if (!(await app.close())) return;
              await this.sys.fs.tail;
              if (mode === 'restart') this.sys.restart();
              else if (mode === 'logoff') this.logon();
              else this.powerOff();
            },
            { class: 'default' },
          ),
          button('Cancel', () => win.close()),
          button('Help', () =>
            this.sys.dialogs.message(
              'Shut down closes this browser desktop. Restart restarts the desktop shell. Stand by blanks the desktop until you move the pointer or press a key.',
              { title: 'Shut Down Help' },
            ),
          ),
        ),
      ),
    );
    win.onDispose(() => shade.remove());
  }
  powerOff() {
    const screen = h(
      'div',
      { class: 'shutdown-screen' },
      h('span', {}, 'It’s now safe to turn off your computer.'),
      button('Restart Windows', () => {
        screen.remove();
        this.sys.restart();
      }),
    );
    document.querySelector('#overlays').append(screen);
  }
  logon() {
    const screen = h('div', { class: 'boot-screen' }),
      input = h('input', { value: this.sys.settings.get('userName'), 'aria-label': 'User name' }),
      form = h('div', { class: 'raised', style: { padding: '3px', width: '360px' } });
    const finish = () => {
      this.sys.settings.set('userName', input.value.trim() || 'User');
      screen.remove();
      this.sys.sound.play('startup');
    };
    form.append(
      h(
        'div',
        {
          class: 'title-bar',
          style: { color: '#fff', background: 'linear-gradient(90deg,#0a246a,#a6caf0)' },
        },
        'Log On to Windows',
      ),
      h(
        'div',
        { class: 'dialog-content' },
        h('p', {}, 'Enter a name for your local desktop profile.'),
        field('User name:', input),
        h(
          'div',
          { class: 'button-row' },
          button('OK', finish),
          button('Cancel', () => screen.remove()),
        ),
      ),
    );
    screen.append(form);
    document.querySelector('#overlays').append(screen);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish();
    });
    input.focus();
    input.select();
  }
  bind() {
    const sys = this.sys;
    sys.fs.on('change', () => this.renderIcons());
    sys.wm.on('change', () => this.renderTasks());
    sys.settings.on('change', (values) => {
      if (values.desktopPositions) this.positions = values.desktopPositions;
      if (values.desktopPositions || values.showHidden !== undefined || values.disabledApps)
        this.renderIcons();
      this.updateClock();
    });
    this.icons.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.desktop-icon')) return;
      e.preventDefault();
      this.selected.clear();
      this.paintSelection();
      this.backgroundMenu(e.clientX, e.clientY);
    });
    this.icons.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.desktop-icon')) return;
      sys.menus.close();
      this.selected.clear();
      this.paintSelection();
      const box = document.querySelector('#selection-box'),
        start = { x: e.clientX, y: e.clientY };
      this.icons.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const x = Math.min(start.x, ev.clientX),
          y = Math.min(start.y, ev.clientY),
          w = Math.abs(ev.clientX - start.x),
          height = Math.abs(ev.clientY - start.y);
        Object.assign(box.style, {
          left: x + 'px',
          top: y + 'px',
          width: w + 'px',
          height: height + 'px',
        });
        box.hidden = false;
        this.selected.clear();
        for (const node of this.icons.children) {
          const r = node.getBoundingClientRect();
          if (r.left < x + w && r.right > x && r.top < y + height && r.bottom > y)
            this.selected.add(node.dataset.id);
        }
        this.paintSelection();
      };
      const end = () => {
        box.hidden = true;
        this.icons.removeEventListener('pointermove', move);
        this.icons.removeEventListener('pointerup', end);
        this.icons.removeEventListener('pointercancel', end);
      };
      this.icons.addEventListener('pointermove', move);
      this.icons.addEventListener('pointerup', end, { once: true });
      this.icons.addEventListener('pointercancel', end, { once: true });
    });
    this.icons.addEventListener('dragover', (e) => e.preventDefault());
    this.icons.addEventListener('drop', async (e) => {
      e.preventDefault();
      try {
        if (e.dataTransfer.files.length) {
          await sys.fs.importFiles([...e.dataTransfer.files], 'C:\\Windows\\Desktop');
          return;
        }
        const desktop = e.dataTransfer.getData('application/x-millennium-desktop');
        if (desktop) {
          const data = JSON.parse(desktop);
          this.positions[data.id] = {
            x: clamp(e.clientX - data.offsetX, 0, this.desktop.clientWidth - 74),
            y: clamp(e.clientY - data.offsetY, 0, this.desktop.clientHeight - 72),
          };
          sys.settings.set('desktopPositions', this.positions);
          this.renderIcons();
        } else {
          const data = e.dataTransfer.getData('application/x-millennium-files');
          if (data) {
            for (const path of JSON.parse(data)) {
              const dest =
                'C:\\Windows\\Desktop\\' +
                sys.fs.uniqueName('C:\\Windows\\Desktop', basename(path));
              await (e.ctrlKey ? sys.fs.copy(path, dest) : sys.fs.move(path, dest));
            }
          }
        }
      } catch (error) {
        sys.error(error);
      }
    });
    this.taskbar.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.task-button,.clock-text')) return;
      e.preventDefault();
      sys.menus.show(e.clientX, e.clientY, [
        { label: 'Cascade Windows', action: () => sys.wm.arrange('cascade') },
        { label: 'Tile Windows Horizontally', action: () => sys.wm.arrange('horizontal') },
        { label: 'Tile Windows Vertically', action: () => sys.wm.arrange('vertical') },
        { label: 'Minimize All Windows', action: () => sys.wm.showDesktop() },
        '-',
        { label: 'Close Program...', action: () => this.closeProgram() },
        '-',
        { label: 'Properties', action: () => this.taskbarProperties() },
      ]);
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === 'Escape') || (e.key === 'Meta' && !e.ctrlKey)) {
        e.preventDefault();
        this.toggleStart();
      }
      if (e.metaKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        this.runDialog();
      }
      if (e.metaKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        sys.wm.showDesktop();
      }
      if (e.ctrlKey && e.altKey && (e.key === 'Delete' || e.key === 'End')) {
        e.preventDefault();
        this.closeProgram();
      }
      if (e.key === 'F1') {
        e.preventDefault();
        sys.launch('help');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !e.target.closest('.window')) {
        e.preventDefault();
        this.paste();
      }
    });
    this.clockTimer = setInterval(() => {
      this.updateClock();
      this.checkTasks();
    }, 1000);
    window.addEventListener('resize', () => this.renderIcons());
    window.addEventListener('online', () => this.updateClock());
    window.addEventListener('offline', () => this.updateClock());
  }
  checkTasks() {
    const tasks = this.sys.settings.get('tasks') ?? [];
    const now = Date.now();
    let changed = false;
    for (const task of tasks)
      if (task.enabled && task.next <= now) {
        changed = true;
        this.sys.launch(task.app);
        if (task.repeat === 'daily') task.next = now + 86400000;
        else if (task.repeat === 'weekly') task.next = now + 7 * 86400000;
        else task.enabled = false;
        task.lastRun = now;
      }
    if (changed) this.sys.settings.set('tasks', tasks);
  }
}
