import { h, button, field, select } from '../../ui/src/dom.js';
import { icon, fileIcon } from '../../ui/src/icons.js';
import { basename, dirname, normalizePath } from '../../filesystem/src/index.js';

export class Dialogs {
  constructor(wm, fs) {
    this.wm = wm;
    this.fs = fs;
  }
  message(
    message,
    { title = 'Windows', icon: iconName = 'windows', buttons = ['OK'], width = 380 } = {},
  ) {
    return new Promise((resolve) => {
      let value = null;
      const win = this.wm.create({
        title,
        icon: iconName,
        width,
        height: 160,
        center: true,
        modal: true,
        resizable: false,
      });
      const body = h('div', { class: 'dialog-content' });
      const text = h(
        'div',
        { style: { whiteSpace: 'pre-wrap', flex: '1', userSelect: 'text' } },
        message,
      );
      body.append(
        h('div', { class: 'dialog-message' }, icon(iconName, 32), text),
        h(
          'div',
          { class: 'button-row' },
          buttons.map((label, i) =>
            button(
              label,
              () => {
                value = label;
                win.close();
              },
              { class: i === 0 ? 'default' : '' },
            ),
          ),
        ),
      );
      win.content.append(body);
      win.onDispose(() => resolve(value));
      win.element.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape') win.close();
          if (e.key === 'Enter' && e.target.tagName !== 'BUTTON')
            body.querySelector('button')?.click();
        },
        { signal: win.signal },
      );
      requestAnimationFrame(() => {
        const height = Math.max(145, Math.min(440, body.scrollHeight + 30));
        win.setBounds({ height, y: (this.wm.viewport.height - height) / 2 });
        body.querySelector('button')?.focus();
      });
    });
  }
  async confirm(message, title = 'Windows') {
    return (await this.message(message, { title, buttons: ['Yes', 'No'] })) === 'Yes';
  }
  prompt(message, value = '', { title = 'Windows', label = 'Name:', width = 390 } = {}) {
    return new Promise((resolve) => {
      let result = null;
      const win = this.wm.create({
        title,
        width,
        height: 172,
        center: true,
        modal: true,
        resizable: false,
      });
      const input = h('input', { value, type: 'text', 'aria-label': label });
      const ok = () => {
        result = input.value;
        win.close();
      };
      win.content.append(
        h(
          'div',
          { class: 'dialog-content' },
          h('p', {}, message),
          field(label, input),
          h(
            'div',
            { class: 'button-row' },
            button('OK', ok, { class: 'default' }),
            button('Cancel', () => win.close()),
          ),
        ),
      );
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') ok();
        if (e.key === 'Escape') win.close();
      });
      win.onDispose(() => resolve(result));
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    });
  }
  file({
    mode = 'open',
    path = 'C:\\My Documents',
    filename = '',
    extensions,
    defaultExtension = /\.([a-z0-9]+)$/i.exec(filename)?.[1],
    title,
    typeLabel = 'All Files (*.*)',
  } = {}) {
    return new Promise((resolve) => {
      let result = null;
      let current = this.fs.stat(path)?.kind === 'directory' ? normalizePath(path) : dirname(path);
      let selection;
      const win = this.wm.create({
        title: title ?? (mode === 'save' ? 'Save As' : 'Open'),
        icon: 'folder',
        width: 560,
        height: 355,
        center: true,
        modal: true,
        resizable: true,
        minWidth: 370,
        minHeight: 270,
      });
      const location = h('input', { value: current, 'aria-label': 'Look in' });
      const name = h('input', { value: filename, 'aria-label': 'File name' });
      const list = h('div', {
        class: 'file-dialog-list sunken',
        role: 'listbox',
        'aria-label': 'Files',
      });
      const type = select(
        [
          { value: 'filtered', label: typeLabel },
          { value: 'all', label: 'All Files (*.*)' },
        ],
        'filtered',
        () => render(),
      );
      const submit = async () => {
        try {
          let candidate = normalizePath(name.value || selection || '', current);
          let stat = this.fs.stat(candidate);
          if (stat?.kind === 'directory') {
            current = candidate;
            name.value = '';
            render();
            return;
          }
          if (!name.value.trim() && !selection) return;
          if (mode === 'save' && defaultExtension && !basename(candidate).includes('.')) {
            candidate += '.' + defaultExtension;
            stat = this.fs.stat(candidate);
          }
          if (mode === 'open' && !stat) {
            await this.message('The file cannot be found. Check the file name and try again.', {
              title: 'Open',
            });
            return;
          }
          if (
            mode === 'save' &&
            stat &&
            !(await this.confirm(
              `${basename(candidate)} already exists.\nDo you want to replace it?`,
              'Save As',
            ))
          )
            return;
          result = candidate;
          win.close();
        } catch (e) {
          this.message(e.message, { title: 'File' });
        }
      };
      const nav = h(
        'div',
        { class: 'file-dialog-nav' },
        h('span', {}, mode === 'save' ? 'Save in:' : 'Look in:'),
        location,
        button(
          icon('up', 16),
          () => {
            current = dirname(current);
            render();
          },
          { title: 'Up One Level', class: 'tool-button' },
        ),
        button(
          icon('folder', 16),
          async () => {
            const n = await this.prompt('Create a new folder.', 'New Folder', {
              title: 'New Folder',
            });
            if (n) {
              try {
                await this.fs.mkdir(current + '\\' + n);
                render();
              } catch (e) {
                await this.message(e.message);
              }
            }
          },
          { title: 'Create New Folder', class: 'tool-button' },
        ),
      );
      win.content.append(
        h(
          'div',
          { class: 'dialog-content', style: { padding: '7px', gap: '6px' } },
          nav,
          list,
          h(
            'div',
            { class: 'file-dialog-bottom' },
            h('div', {}, field('File name:', name), field('Files of type:', type)),
            h(
              'div',
              { class: 'file-dialog-buttons' },
              button(mode === 'save' ? 'Save' : 'Open', submit, { class: 'default' }),
              button('Cancel', () => win.close()),
            ),
          ),
        ),
      );
      function render() {
        location.value = current;
        list.replaceChildren();
        selection = null;
        let nodes;
        try {
          nodes = this.fs.list(current);
        } catch {
          return;
        }
        for (const node of nodes) {
          if (
            type.value !== 'all' &&
            extensions?.length &&
            node.kind === 'file' &&
            !extensions.includes(node.name.split('.').pop().toLowerCase())
          )
            continue;
          const row = h(
            'button',
            { type: 'button', class: 'file-dialog-item', role: 'option' },
            icon(fileIcon(node), 16),
            h('span', {}, node.name),
          );
          row.addEventListener('click', () => {
            selection = node.path;
            for (const r of list.children) {
              r.classList.remove('selected');
              r.setAttribute('aria-selected', 'false');
            }
            row.classList.add('selected');
            row.setAttribute('aria-selected', 'true');
            if (node.kind === 'file') name.value = node.name;
          });
          row.addEventListener('dblclick', () => {
            if (node.kind === 'directory') {
              current = node.path;
              name.value = '';
              render.call(this);
            } else {
              name.value = node.name;
              submit();
            }
          });
          list.append(row);
        }
      }
      const renderBound = render.bind(this);
      // Bind the navigation renderer once so both callbacks and nested dialogs share this drive.
      render = renderBound;
      location.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          try {
            const next = normalizePath(location.value, current);
            if (this.fs.stat(next)?.kind !== 'directory')
              throw new Error('The folder cannot be found.');
            current = next;
            render();
          } catch (error) {
            this.message(error.message);
          }
        }
      });
      name.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
      win.element.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape') win.close();
        },
        { signal: win.signal },
      );
      win.onDispose(() => resolve(result));
      render();
      requestAnimationFrame(() => {
        name.focus();
        name.select();
      });
    });
  }
}
