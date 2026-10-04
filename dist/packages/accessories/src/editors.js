import { h, button, field, checkbox, select, download } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';
import { sanitizeRichText } from './rich-text.js';
import { basename, dirname } from '../../filesystem/src/index.js';

const editAction = (sys, editor, action) => {
  editor.focus();
  if (action === 'selectAll') {
    editor.select();
    return;
  }
  if (action === 'copy' || action === 'cut') {
    const text = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    sys.clipboard.text = text;
    navigator.clipboard?.writeText(text).catch(() => {});
    if (action === 'cut') {
      editor.setRangeText('', editor.selectionStart, editor.selectionEnd, 'end');
      editor.dispatchEvent(new Event('input'));
    }
    return;
  }
  if (action === 'paste') {
    const text = sys.clipboard.text ?? '';
    editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input'));
    return;
  }
  if (action === 'delete') {
    editor.setRangeText('', editor.selectionStart, editor.selectionEnd, 'end');
    editor.dispatchEvent(new Event('input'));
    return;
  }
  document.execCommand(action);
};

export function createNotepad(sys, args = {}) {
  let path = args.path ?? null,
    saved = '',
    wrap = sys.settings.get('notepadWrap') ?? false,
    lastFind = '',
    matchCase = false;
  const win = sys.createWindow({
    title: 'Untitled - Notepad',
    icon: 'notepad',
    width: 560,
    height: 405,
    minWidth: 280,
    minHeight: 180,
  });
  const editor = h('textarea', {
    class: 'app-notepad',
    spellcheck: false,
    'aria-label': 'Notepad text',
    wrap: wrap ? 'soft' : 'off',
  });
  const status = h(
    'footer',
    { class: 'status-bar' },
    h('span', {}, 'Ln 1, Col 1'),
    h('span', {}, 'UTF-8'),
  );
  const title = () =>
    win.setTitle(
      `${editor.value !== saved ? '*' : ''}${path ? basename(path) : 'Untitled'} - Notepad`,
    );
  const caret = () => {
    const text = editor.value.slice(0, editor.selectionStart),
      lines = text.split('\n');
    status.children[0].textContent = `Ln ${lines.length}, Col ${lines.at(-1).length + 1}`;
  };
  const load = (p) => {
    path = p;
    saved = sys.fs
      .readFile(p)
      .replace(/^\uFEFF/, '')
      .replaceAll('\r\n', '\n');
    editor.value = saved;
    if (saved.startsWith('.LOG')) editor.value += '\n' + new Date().toLocaleString() + '\n';
    title();
    caret();
  };
  const save = async (as = false) => {
    try {
      let target = path;
      if (as || !target)
        target = await sys.dialogs.file({
          mode: 'save',
          path: path ? dirname(path) : 'C:\\My Documents',
          filename: path ? basename(path) : 'Untitled.txt',
          typeLabel: 'Text Documents (*.txt)',
        });
      if (!target) return false;
      if (!basename(target).includes('.')) target += '.txt';
      await sys.fs.writeFile(target, editor.value.replaceAll('\n', '\r\n'), 'text/plain');
      path = target;
      saved = editor.value;
      title();
      return true;
    } catch (e) {
      await sys.dialogs.message(e.message, { title: 'Notepad' });
      return false;
    }
  };
  const check = async () => {
    if (editor.value === saved) return true;
    const choice = await sys.dialogs.message(
      `The text in the ${path ? basename(path) : 'Untitled'} file has changed.\n\nDo you want to save the changes?`,
      { title: 'Notepad', buttons: ['Yes', 'No', 'Cancel'] },
    );
    return choice === 'Yes' ? save() : choice === 'No';
  };
  const newFile = async () => {
    if (await check()) {
      path = null;
      saved = '';
      editor.value = '';
      title();
      caret();
    }
  };
  const open = async () => {
    if (!(await check())) return;
    const chosen = await sys.dialogs.file({
      extensions: [
        'txt',
        'log',
        'ini',
        'bat',
        'cmd',
        'js',
        'json',
        'md',
        'csv',
        'html',
        'htm',
        'css',
        'xml',
      ],
      typeLabel: 'Text Documents (*.txt)',
    });
    if (chosen) {
      try {
        load(chosen);
      } catch (e) {
        sys.dialogs.message(e.message, { title: 'Notepad' });
      }
    }
  };
  const findNext = (needle = lastFind, backward = false) => {
    if (!needle) return findDialog();
    lastFind = needle;
    const hay = matchCase ? editor.value : editor.value.toLowerCase(),
      n = matchCase ? needle : needle.toLowerCase();
    let index = backward
      ? hay.lastIndexOf(n, Math.max(-1, editor.selectionStart - 1))
      : hay.indexOf(n, editor.selectionEnd);
    if (index < 0) index = backward ? hay.lastIndexOf(n) : hay.indexOf(n);
    if (index < 0) {
      sys.dialogs.message(`Cannot find “${needle}”.`, { title: 'Notepad' });
      return;
    }
    editor.focus();
    editor.setSelectionRange(index, index + needle.length);
    const line = editor.value.slice(0, index).split('\n').length;
    editor.scrollTop = Math.max(0, (line - 3) * 15);
    caret();
  };
  const findDialog = (replace = false) => {
    const dlg = sys.wm.create({
      title: replace ? 'Replace' : 'Find',
      icon: 'search',
      width: 410,
      height: replace ? 204 : 162,
      center: true,
      resizable: false,
      modal: false,
    });
    const input = h('input', { value: lastFind, 'aria-label': 'Find what' }),
      replacement = h('input', { 'aria-label': 'Replace with' });
    let backwards = false;
    const applyFind = () => {
      lastFind = input.value;
      findNext(input.value, backwards);
    };
    const replaceOne = () => {
      if (
        (matchCase
          ? editor.value.slice(editor.selectionStart, editor.selectionEnd)
          : editor.value.slice(editor.selectionStart, editor.selectionEnd).toLowerCase()) ===
        (matchCase ? input.value : input.value.toLowerCase())
      ) {
        editor.setRangeText(replacement.value, editor.selectionStart, editor.selectionEnd, 'end');
        editor.dispatchEvent(new Event('input'));
      }
      applyFind();
    };
    const replaceAll = () => {
      if (!input.value) return;
      const escaped = input.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      editor.value = editor.value.replace(
        new RegExp(escaped, matchCase ? 'g' : 'gi'),
        () => replacement.value,
      );
      editor.dispatchEvent(new Event('input'));
    };
    dlg.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        field('Find what:', input),
        replace ? field('Replace with:', replacement) : null,
        h(
          'div',
          { class: 'field-row' },
          checkbox('Match case', matchCase, (v) => (matchCase = v)),
          !replace ? checkbox('Search up', backwards, (v) => (backwards = v)) : null,
        ),
        h(
          'div',
          { class: 'button-row' },
          button('Find Next', applyFind),
          replace ? button('Replace', replaceOne) : null,
          replace ? button('Replace All', replaceAll) : null,
          button('Cancel', () => dlg.close()),
        ),
      ),
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyFind();
      if (e.key === 'Escape') dlg.close();
    });
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  };
  const fontDialog = () => {
    const dlg = sys.wm.create({
      title: 'Font',
      width: 340,
      height: 230,
      resizable: false,
      center: true,
      modal: true,
    });
    let family = editor.style.fontFamily || 'Courier New',
      size = parseInt(editor.style.fontSize) || 13;
    const familySelect = select(
        ['Courier New', 'Arial', 'Times New Roman', 'MS Sans Serif', 'Georgia', 'monospace'],
        family,
        (v) => (family = v),
      ),
      sizeSelect = select(
        ['11', '12', '13', '14', '16', '18', '20', '24', '32'],
        String(size),
        (v) => (size = +v),
      );
    dlg.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        field('Font:', familySelect),
        field('Size:', sizeSelect),
        h(
          'fieldset',
          {},
          h('legend', {}, 'Sample'),
          h('div', { style: { font: '18px ' + family } }, 'AaBbYyZz'),
        ),
        h(
          'div',
          { class: 'button-row' },
          button('OK', () => {
            editor.style.fontFamily = family;
            editor.style.fontSize = size + 'px';
            dlg.close();
          }),
          button('Cancel', () => dlg.close()),
        ),
      ),
    );
  };
  const print = () => {
    sys.printText(editor.value, path ? basename(path) : 'Untitled');
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New', shortcut: 'Ctrl+N', action: newFile },
        { label: 'Open...', shortcut: 'Ctrl+O', action: open },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => save() },
        { label: 'Save As...', action: () => save(true) },
        '-',
        {
          label: 'Page Setup...',
          action: () =>
            sys.dialogs.message(
              'Page size, margins, headers and footers can be adjusted in the print dialog.',
              { title: 'Page Setup', icon: 'printer' },
            ),
        },
        { label: 'Print...', shortcut: 'Ctrl+P', action: print },
        '-',
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: () => [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => editAction(sys, editor, 'undo') },
        '-',
        ...['Cut', 'Copy', 'Paste', 'Delete'].map((label) => ({
          label,
          action: () => editAction(sys, editor, label.toLowerCase()),
          shortcut: { Cut: 'Ctrl+X', Copy: 'Ctrl+C', Paste: 'Ctrl+V', Delete: 'Del' }[label],
        })),
        '-',
        {
          label: 'Select All',
          shortcut: 'Ctrl+A',
          action: () => editAction(sys, editor, 'selectAll'),
        },
        {
          label: 'Time/Date',
          shortcut: 'F5',
          action: () => {
            editor.setRangeText(
              new Date().toLocaleString(),
              editor.selectionStart,
              editor.selectionEnd,
              'end',
            );
            editor.dispatchEvent(new Event('input'));
          },
        },
      ],
    },
    {
      label: 'Search',
      items: [
        { label: 'Find...', shortcut: 'Ctrl+F', action: () => findDialog() },
        { label: 'Find Next', shortcut: 'F3', action: () => findNext() },
        { label: 'Replace...', shortcut: 'Ctrl+H', action: () => findDialog(true) },
        {
          label: 'Go To...',
          shortcut: 'Ctrl+G',
          action: async () => {
            const line = await sys.dialogs.prompt('Enter a line number.', '1', {
              title: 'Go To Line',
              label: 'Line:',
            });
            if (line) {
              const lines = editor.value.split('\n');
              const index = lines
                .slice(0, Math.max(0, Math.min(lines.length - 1, +line - 1)))
                .reduce((sum, l) => sum + l.length + 1, 0);
              editor.focus();
              editor.setSelectionRange(index, index);
              caret();
            }
          },
        },
      ],
    },
    {
      label: 'Format',
      items: () => [
        {
          label: 'Word Wrap',
          checked: wrap,
          action: () => {
            wrap = !wrap;
            editor.wrap = wrap ? 'soft' : 'off';
            editor.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
            sys.settings.set('notepadWrap', wrap);
          },
        },
        { label: 'Font...', action: fontDialog },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Help Topics', action: () => sys.launch('help', { topic: 'accessories' }) },
        {
          label: 'About Notepad',
          action: () =>
            sys.dialogs.message('Notepad\nText editor\n\nMillennium browser edition.', {
              title: 'About Notepad',
              icon: 'notepad',
            }),
        },
      ],
    },
  ]);
  win.content.append(editor, status);
  editor.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
  editor.addEventListener('input', () => {
    title();
    caret();
  });
  editor.addEventListener('keyup', caret);
  editor.addEventListener('click', caret);
  win.beforeClose = check;
  win.element.addEventListener(
    'keydown',
    (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const actions = {
        s: () => save(e.shiftKey),
        o: open,
        n: newFile,
        f: () => findDialog(),
        h: () => findDialog(true),
        p: print,
      };
      if (ctrl && actions[e.key.toLowerCase()]) {
        e.preventDefault();
        actions[e.key.toLowerCase()]();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        findNext();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        editor.setRangeText(
          new Date().toLocaleString(),
          editor.selectionStart,
          editor.selectionEnd,
          'end',
        );
        editor.dispatchEvent(new Event('input'));
      }
    },
    { signal: win.signal },
  );
  if (path) {
    try {
      load(path);
    } catch (e) {
      sys.dialogs.message(e.message, { title: 'Notepad' });
      path = null;
    }
  } else if (args.text) {
    editor.value = args.text;
    saved = args.text;
    title();
  }
  requestAnimationFrame(() => editor.focus());
  return win;
}

export function createWordPad(sys, args = {}) {
  let path = args.path ?? null,
    saved = '',
    dirty = false;
  const win = sys.createWindow({
    title: 'Document - WordPad',
    icon: 'wordpad',
    width: 690,
    height: 490,
    minWidth: 370,
    minHeight: 250,
  });
  const editor = h('div', {
    class: 'wordpad-editor',
    contentEditable: 'true',
    spellcheck: true,
    role: 'textbox',
    'aria-label': 'WordPad document',
    'aria-multiline': 'true',
  });
  let selectionRange;
  const capture = () => {
    const selection = getSelection();
    if (selection.rangeCount && editor.contains(selection.anchorNode))
      selectionRange = selection.getRangeAt(0).cloneRange();
  };
  document.addEventListener('selectionchange', capture, { signal: win.signal });
  const command = (name, value) => {
    editor.focus();
    if (selectionRange) {
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(selectionRange);
    }
    document.execCommand(name, false, value);
    dirty = true;
    update();
  };
  const update = () => {
    dirty = editor.innerHTML !== saved;
    win.setTitle(`${dirty ? '*' : ''}${path ? basename(path) : 'Document'} - WordPad`);
  };
  const load = (p) => {
    path = p;
    const text = sys.fs.readFile(p);
    if (/\.html?$/i.test(p) || text.startsWith('<!-- Millennium WordPad')) {
      editor.replaceChildren(...sanitizeRichText(text).childNodes);
    } else if (text.startsWith('{\\rtf')) {
      editor.textContent = text
        .replace(/\\par\b/g, '\n')
        .replace(/\\'[0-9a-f]{2}/gi, (hex) => String.fromCharCode(parseInt(hex.slice(2), 16)))
        .replace(/\\[a-z]+-?\d* ?/gi, '')
        .replace(/[{}]/g, '');
    } else editor.textContent = text;
    saved = editor.innerHTML;
    dirty = false;
    update();
  };
  const save = async (as = false) => {
    let target = path;
    if (!target || as)
      target = await sys.dialogs.file({
        mode: 'save',
        path: path ? dirname(path) : 'C:\\My Documents',
        filename: path ? basename(path) : 'Document.html',
        typeLabel: 'Rich Text Documents (*.html)',
      });
    if (!target) return false;
    try {
      if (!basename(target).includes('.')) target += '.html';
      const isText = /\.txt$/i.test(target);
      await sys.fs.writeFile(
        target,
        isText ? editor.innerText : '<!-- Millennium WordPad document -->\n' + editor.innerHTML,
        isText ? 'text/plain' : 'text/html',
      );
      path = target;
      saved = editor.innerHTML;
      update();
      return true;
    } catch (e) {
      await sys.dialogs.message(e.message, { title: 'WordPad' });
      return false;
    }
  };
  const check = async () => {
    if (!dirty) return true;
    const choice = await sys.dialogs.message(
      'Save changes to ' + (path ? basename(path) : 'Document') + '?',
      { title: 'WordPad', buttons: ['Yes', 'No', 'Cancel'] },
    );
    return choice === 'Yes' ? save() : choice === 'No';
  };
  const newFile = async () => {
    if (await check()) {
      path = null;
      editor.innerHTML = '';
      saved = '';
      update();
    }
  };
  const open = async () => {
    if (!(await check())) return;
    const p = await sys.dialogs.file({ typeLabel: 'Documents (*.rtf; *.txt; *.html)' });
    if (p) {
      try {
        load(p);
      } catch (e) {
        sys.dialogs.message(e.message);
      }
    }
  };
  const tools = h(
    'div',
    { class: 'toolbar' },
    button(icon('file', 16), newFile, { class: 'tool-button', title: 'New' }),
    button(icon('folder', 16), open, { class: 'tool-button', title: 'Open' }),
    button(icon('floppy', 16), () => save(), { class: 'tool-button', title: 'Save' }),
    button(
      icon('printer', 16),
      () => sys.printHTML(editor.innerHTML, basename(path ?? 'Document')),
      { class: 'tool-button', title: 'Print' },
    ),
    h('div', { class: 'separator' }),
    button('Cut', () => command('cut'), { class: 'tool-button' }),
    button(
      'Copy',
      () => {
        sys.clipboard.text = getSelection()?.toString() ?? '';
        command('copy');
      },
      { class: 'tool-button' },
    ),
    button('Paste', () => command('insertText', sys.clipboard.text ?? ''), {
      class: 'tool-button',
    }),
    h('div', { class: 'separator' }),
    button('Undo', () => command('undo'), { class: 'tool-button' }),
  );
  const format = h(
    'div',
    { class: 'toolbar' },
    select(
      ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'MS Sans Serif'],
      'Arial',
      (v) => command('fontName', v),
    ),
    select(['8', '10', '12', '14', '18', '24', '36'], '12', (v) =>
      command('fontSize', String({ 8: 1, 10: 2, 12: 3, 14: 4, 18: 5, 24: 6, 36: 7 }[v])),
    ),
  );
  for (const [label, cmd, style] of [
    ['B', 'bold', { fontWeight: 'bold' }],
    ['I', 'italic', { fontStyle: 'italic' }],
    ['U', 'underline', { textDecoration: 'underline' }],
    ['≡', 'justifyLeft', {}],
    ['≡', 'justifyCenter', { textAlign: 'center' }],
    ['≡', 'justifyRight', { textAlign: 'right' }],
    ['•', 'insertUnorderedList', {}],
  ])
    format.append(button(label, () => command(cmd), { class: 'tool-button', title: cmd, style }));
  format.append(
    h('input', {
      type: 'color',
      value: '#000000',
      title: 'Text color',
      style: { width: '27px', height: '22px' },
      oninput: (e) => command('foreColor', e.target.value),
    }),
  );
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New...', shortcut: 'Ctrl+N', action: newFile },
        { label: 'Open...', shortcut: 'Ctrl+O', action: open },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => save() },
        { label: 'Save As...', action: () => save(true) },
        '-',
        {
          label: 'Print...',
          shortcut: 'Ctrl+P',
          action: () => sys.printHTML(editor.innerHTML, path ?? 'Document'),
        },
        '-',
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', action: () => command('undo') },
        { label: 'Redo', action: () => command('redo') },
        '-',
        { label: 'Cut', action: () => command('cut') },
        {
          label: 'Copy',
          action: () => {
            sys.clipboard.text = getSelection()?.toString() ?? '';
            command('copy');
          },
        },
        { label: 'Paste', action: () => command('insertText', sys.clipboard.text ?? '') },
        { label: 'Select All', action: () => command('selectAll') },
        {
          label: 'Find...',
          action: async () => {
            const q = await sys.dialogs.prompt('Find text in this document.', '', {
              title: 'Find',
              label: 'Find what:',
            });
            if (q) {
              editor.focus();
              window.find?.(q);
            }
          },
        },
      ],
    },
    {
      label: 'View',
      items: () => [
        { label: 'Toolbar', checked: !tools.hidden, action: () => (tools.hidden = !tools.hidden) },
        {
          label: 'Format Bar',
          checked: !format.hidden,
          action: () => (format.hidden = !format.hidden),
        },
        { label: 'Ruler', checked: !ruler.hidden, action: () => (ruler.hidden = !ruler.hidden) },
      ],
    },
    {
      label: 'Insert',
      items: [
        {
          label: 'Date and Time...',
          action: () => command('insertText', new Date().toLocaleString()),
        },
        {
          label: 'Picture...',
          action: async () => {
            const p = await sys.dialogs.file({
              extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
              typeLabel: 'Image Files',
            });
            if (p) {
              const blob = sys.fs.readFile(p, 'blob');
              const data = await new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.readAsDataURL(blob);
              });
              command('insertImage', data);
            }
          },
        },
      ],
    },
    {
      label: 'Format',
      items: [
        { label: 'Bold', shortcut: 'Ctrl+B', action: () => command('bold') },
        { label: 'Italic', shortcut: 'Ctrl+I', action: () => command('italic') },
        { label: 'Underline', shortcut: 'Ctrl+U', action: () => command('underline') },
        { label: 'Bullet Style', action: () => command('insertUnorderedList') },
        {
          label: 'Paragraph...',
          action: async () => {
            const value = await sys.dialogs.prompt(
              'Enter paragraph line spacing (for example, 1.5).',
              '1.5',
              { title: 'Paragraph', label: 'Spacing:' },
            );
            if (value && +value >= 0.5 && +value <= 5) editor.style.lineHeight = value;
          },
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'About WordPad',
          action: () =>
            sys.dialogs.message(
              'WordPad\nRich text editing, pictures and print.\n\nFormatting is saved as HTML. RTF import reads basic text; binary DOC files are not supported.',
              { title: 'About WordPad', icon: 'wordpad' },
            ),
        },
      ],
    },
  ]);
  const ruler = h('div', { class: 'wordpad-ruler' });
  win.content.append(tools, format, ruler, editor);
  win.status('For Help, press F1');
  editor.addEventListener('input', update);
  win.beforeClose = check;
  win.element.addEventListener(
    'keydown',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'o', 'n', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        ({
          s: () => save(),
          o: open,
          n: newFile,
          p: () => sys.printHTML(editor.innerHTML, path ?? 'Document'),
        })[e.key.toLowerCase()]();
      }
    },
    { signal: win.signal },
  );
  if (path) {
    try {
      load(path);
    } catch (e) {
      sys.dialogs.message(e.message);
    }
  }
  return win;
}
