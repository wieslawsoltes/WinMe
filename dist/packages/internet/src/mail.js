import { h, button, field, download, pickFiles } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';
import { uid } from '../../core/src/index.js';
import { encodeMessage, decodeMessage } from './mime.js';

const mailboxPath = 'C:\\Windows\\Mailbox.json';
const contactsPath = 'C:\\My Documents\\Address Book.wab.json';
const initialMail = () => [
  {
    id: uid(),
    folder: 'Inbox',
    from: 'Millennium Desktop',
    to: 'You',
    subject: 'Welcome to Outlook Express',
    body: 'Welcome to Outlook Express.\n\nUse this mailbox to write messages, save drafts, organize folders and keep your contacts.\n\nThis browser edition stores mail locally. To deliver a message, open it in your email application or export it as an .eml file. It does not connect to a mail server.\n\nYour drafts and saved messages stay in the virtual drive.',
    date: Date.now(),
    read: false,
    attachments: [],
  },
];
const readMailbox = (sys) => {
  try {
    return JSON.parse(sys.fs.readFile(mailboxPath));
  } catch {
    return initialMail();
  }
};
const eml = (message, sys) =>
  encodeMessage(message, (attachment) => ({
    bytes: sys.fs.readFile(attachment.path, 'bytes'),
    mime: sys.fs.stat(attachment.path)?.mime,
  }));

export function createOutlook(sys, args = {}) {
  const win = sys.createWindow({
    title: 'Outlook Express',
    icon: 'mail',
    width: 800,
    height: 520,
    minWidth: 430,
    minHeight: 320,
  });
  let mailbox = readMailbox(sys),
    folder = 'Inbox',
    selected = null;
  const folders = ['Inbox', 'Outbox', 'Sent Items', 'Deleted Items', 'Drafts'],
    tree = h('aside', { class: 'mail-folders' }),
    rows = h('tbody'),
    preview = h('section', { class: 'mail-preview' }),
    status = h('footer', { class: 'status-bar' }, h('span'), h('span', {}, 'Working locally'));
  const save = () => sys.fs.writeFile(mailboxPath, JSON.stringify(mailbox), 'application/json');
  const current = () => mailbox.find((m) => m.id === selected);
  const openMessage = (message) => {
    selected = message.id;
    message.read = true;
    save().catch(() => {});
    render();
  };
  const remove = async () => {
    const m = current();
    if (!m) return;
    if (m.folder === 'Deleted Items') {
      if (!(await sys.dialogs.confirm('Permanently delete this message?', 'Outlook Express')))
        return;
      mailbox = mailbox.filter((x) => x.id !== m.id);
    } else m.folder = 'Deleted Items';
    selected = null;
    await save();
    render();
  };
  const compose = (message) =>
    createCompose(sys, message, async (m) => {
      const i = mailbox.findIndex((x) => x.id === m.id);
      if (i >= 0) mailbox[i] = m;
      else mailbox.push(m);
      await save();
      folder = m.folder;
      selected = m.id;
      render();
    });
  const reply = (all) => {
    const m = current();
    if (!m) return;
    compose({
      to:
        all === true
          ? [
              ...new Set(
                [m.from, ...m.to.split(/[,;]/)]
                  .map((s) => s.trim())
                  .filter((s) => s && s !== sys.settings.get('userName')),
              ),
            ].join(', ')
          : m.from,
      subject: /^Re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject,
      body:
        '\n\n----- Original Message -----\nFrom: ' +
        m.from +
        '\nSubject: ' +
        m.subject +
        '\n\n' +
        m.body,
    });
  };
  const forward = () => {
    const m = current();
    if (m)
      compose({ subject: 'Fw: ' + m.subject, body: '\n\n----- Original Message -----\n' + m.body });
  };
  const exportMessage = () => {
    const m = current();
    if (m)
      download(
        new Blob([eml(m, sys)], { type: 'message/rfc822' }),
        (m.subject || 'Message').replace(/[\\/:*?"<>|]/g, '_') + '.eml',
      );
  };
  const importMessage = async () => {
    const files = await pickFiles({ accept: '.eml,.txt', multiple: true });
    for (const file of files) {
      const parsed = decodeMessage(await file.text()),
        attachments = [];
      for (const attachment of parsed.attachments) {
        const name =
          attachment.name.replace(/[\\/:*?"<>|]/g, '_').replace(/^[. ]+|[. ]+$/g, '') ||
          'Attachment';
        const dest = 'C:\\My Documents\\' + sys.fs.uniqueName('C:\\My Documents', name);
        await sys.fs.writeFile(dest, attachment.bytes, attachment.mime);
        attachments.push({ name: attachment.name, path: dest });
      }
      mailbox.push({
        ...parsed,
        id: uid(),
        folder: 'Inbox',
        from: parsed.from || 'Imported message',
        subject: parsed.subject || file.name,
        read: false,
        attachments,
      });
    }
    await save();
    render();
  };
  function render() {
    const heading = win.content.querySelector('.mail-folder-heading');
    if (heading) heading.textContent = folder;
    tree.replaceChildren(
      h('h3', {}, 'Folders'),
      button(
        [icon('computer', 16), 'Outlook Express'],
        () => {
          folder = 'Inbox';
          selected = null;
          render();
        },
        { class: 'tree-item' },
      ),
      h('b', { style: { display: 'block', padding: '8px 3px' } }, 'Local Folders'),
    );
    for (const name of folders) {
      const unread = mailbox.filter((m) => m.folder === name && !m.read).length;
      tree.append(
        button(
          [
            icon(name === 'Deleted Items' ? 'recycle' : name === 'Inbox' ? 'mail' : 'folder', 16),
            name + (unread ? ' (' + unread + ')' : ''),
          ],
          () => {
            folder = name;
            selected = null;
            render();
          },
          { class: 'tree-item' + (folder === name ? ' selected' : '') },
        ),
      );
    }
    rows.replaceChildren();
    const messages = mailbox.filter((m) => m.folder === folder).sort((a, b) => b.date - a.date);
    for (const m of messages) {
      const row = h(
        'tr',
        { tabIndex: 0, class: m.id === selected ? 'selected' : '' },
        h('td', {}, icon(m.read ? 'file' : 'mail', 16)),
        h('td', { style: { fontWeight: m.read ? 'normal' : 'bold' } }, m.from),
        h('td', { style: { fontWeight: m.read ? 'normal' : 'bold' } }, m.subject),
        h('td', {}, new Date(m.date).toLocaleDateString()),
      );
      row.addEventListener('click', () => openMessage(m));
      row.addEventListener('dblclick', () =>
        m.folder === 'Drafts' || m.folder === 'Outbox' ? compose(m) : openMessage(m),
      );
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selected = m.id;
        sys.menus.show(e.clientX, e.clientY, [
          { label: 'Reply', action: reply },
          { label: 'Forward', action: forward },
          { label: 'Delete', action: remove },
          { label: 'Export...', action: exportMessage },
        ]);
      });
      rows.append(row);
    }
    preview.replaceChildren();
    const m = current();
    if (m)
      preview.append(
        h(
          'div',
          { class: 'mail-message-header' },
          h('div', {}, h('b', {}, 'From: '), m.from),
          h('div', {}, h('b', {}, 'To: '), m.to),
          h('div', {}, h('b', {}, 'Sent: '), new Date(m.date).toLocaleString()),
          h('div', {}, h('b', {}, 'Subject: '), m.subject),
        ),
        h('div', { class: 'mail-message-body' }, m.body),
      );
    else
      preview.append(
        h(
          'div',
          { class: 'empty-message' },
          messages.length
            ? 'Select a message to read it.'
            : 'There are no messages in this folder.',
        ),
      );
    status.firstChild.textContent = `${messages.length} message(s), ${messages.filter((m) => !m.read).length} unread`;
    win.setTitle(folder + ' - Outlook Express');
  }
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New Mail Message', shortcut: 'Ctrl+N', action: () => compose({}) },
        { label: 'Import Messages...', action: importMessage },
        { label: 'Export Message...', action: exportMessage },
        { label: 'Save As...', action: exportMessage },
        '-',
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Delete', shortcut: 'Del', action: remove },
        {
          label: 'Mark All Read',
          action: async () => {
            for (const m of mailbox) if (m.folder === folder) m.read = true;
            await save();
            render();
          },
        },
        {
          label: 'Find...',
          action: async () => {
            const q = await sys.dialogs.prompt('Find a message by subject.', '', {
              title: 'Find Message',
              label: 'Subject:',
            });
            if (q) {
              const m = mailbox.find((m) => m.subject.toLowerCase().includes(q.toLowerCase()));
              if (m) {
                folder = m.folder;
                openMessage(m);
              } else sys.dialogs.message('No matching message was found.');
            }
          },
        },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Refresh', action: render },
        { label: 'Folders', checked: true, action: () => (tree.hidden = !tree.hidden) },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Address Book...', action: () => sys.launch('addressbook') },
        {
          label: 'Accounts...',
          action: () =>
            sys.dialogs.message(
              'Mail is stored locally in this browser desktop.\n\nTo send a message, use Compose > Send to hand it to your email application or export an .eml file. No POP, IMAP, or SMTP account is connected.',
              { title: 'Internet Accounts', icon: 'mail' },
            ),
        },
      ],
    },
    {
      label: 'Message',
      items: [
        { label: 'New Message', action: () => compose({}) },
        { label: 'Reply', action: reply },
        { label: 'Reply to All', action: () => reply(true) },
        { label: 'Forward', action: forward },
        {
          label: 'Move to Folder...',
          action: async () => {
            const m = current();
            if (!m) return;
            const target = await sys.dialogs.message('Move message to:', {
              title: 'Move Message',
              buttons: folders,
            });
            if (target) {
              m.folder = target;
              await save();
              render();
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'About Outlook Express',
          action: () =>
            sys.dialogs.message(
              'Outlook Express 5.5 — browser edition\n\nLocal folders, messages, drafts, contacts and EML export. External mail delivery uses your email application.',
              { title: 'About Outlook Express', icon: 'mail' },
            ),
        },
      ],
    },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'toolbar mail-toolbar' },
      button([icon('mail', 22), 'New Mail'], () => compose({}), { class: 'tool-button' }),
      button('Reply', reply, { class: 'tool-button' }),
      button('Reply All', () => reply(true), { class: 'tool-button' }),
      button('Forward', forward, { class: 'tool-button' }),
      button([icon('recycle', 20), 'Delete'], remove, { class: 'tool-button' }),
      h('div', { class: 'separator' }),
      button(
        'Send/Recv',
        () =>
          sys.dialogs.message(
            'No mail server is connected. Messages are kept in local folders.\n\nOpen a draft and choose Send to export it or open your email application.',
            { title: 'Send and Receive', icon: 'mail' },
          ),
        { class: 'tool-button' },
      ),
      button('Addresses', () => sys.launch('addressbook'), { class: 'tool-button' }),
    ),
    h(
      'div',
      { class: 'mail-layout' },
      tree,
      h(
        'div',
        { class: 'mail-right' },
        h('div', { class: 'mail-folder-heading' }, folder),
        h(
          'div',
          { class: 'mail-message-list sunken' },
          h(
            'table',
            { class: 'classic-table' },
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                h('th', {}, ''),
                h('th', {}, 'From'),
                h('th', {}, 'Subject'),
                h('th', {}, 'Received'),
              ),
            ),
            rows,
          ),
        ),
        preview,
      ),
    ),
    status,
  );
  if (!sys.fs.exists(mailboxPath)) save().catch(() => {});
  render();
  win.onLaunch = (next) => {
    if (next.compose) compose(next.compose);
  };
  if (args.compose) compose(args.compose);
  return win;
}

function createCompose(sys, initial = {}, onSave) {
  const win = sys.wm.create({
    title: (initial.subject || 'New Message') + ' - Message',
    icon: 'mail',
    width: 645,
    height: 450,
    appId: 'compose',
  });
  let message = {
      id: uid(),
      folder: 'Drafts',
      from: sys.settings.get('userName'),
      to: '',
      subject: '',
      body: '',
      date: Date.now(),
      read: true,
      attachments: [],
      ...structuredClone(initial),
    },
    saved = JSON.stringify({ ...message, date: 0 });
  const to = h('input', { value: message.to, 'aria-label': 'To' }),
    subject = h('input', { value: message.subject, 'aria-label': 'Subject' }),
    body = h('textarea', {
      value: message.body,
      class: 'mail-compose-body',
      'aria-label': 'Message body',
    }),
    attachmentList = h('div', { class: 'mail-attachments' });
  const collect = () => ({
    ...message,
    to: to.value,
    subject: subject.value,
    body: body.value,
    date: Date.now(),
  });
  const save = async (folder = 'Drafts') => {
    message = { ...collect(), folder };
    await onSave(message);
    saved = JSON.stringify({ ...message, date: 0 });
    return true;
  };
  const send = async () => {
    if (!to.value.trim()) {
      sys.dialogs.message('Enter a recipient in the To field.', { title: 'Outlook Express' });
      return;
    }
    await save('Outbox');
    const action = await sys.dialogs.message(
      'The message is ready in your Outbox. Choose how to send it.\n\nThis browser desktop does not deliver email directly. Attachments are not included in a mailto handoff.',
      {
        title: 'Send Message',
        buttons: ['Open Mail App', 'Export Message', 'Keep in Outbox'],
        icon: 'mail',
      },
    );
    if (action === 'Open Mail App') {
      const url =
        'mailto:' +
        encodeURIComponent(message.to) +
        '?subject=' +
        encodeURIComponent(message.subject) +
        '&body=' +
        encodeURIComponent(message.body);
      window.location.href = url;
    } else if (action === 'Export Message') {
      download(new Blob([eml(message, sys)], { type: 'message/rfc822' }), 'Message.eml');
    }
    win.close();
  };
  const attach = async () => {
    const files = await pickFiles({ multiple: true });
    for (const file of files) {
      const paths = await sys.fs.importFiles([file], 'C:\\My Documents');
      message.attachments.push({ name: file.name, path: paths[0] });
    }
    attachmentList.replaceChildren(
      ...message.attachments.map((a) => h('span', {}, icon('file', 16), ' ' + a.name)),
    );
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'Send Message...', action: send },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => save() },
        { label: 'Close', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        {
          label: 'Select All',
          action: () => {
            body.focus();
            body.select();
          },
        },
        {
          label: 'Paste',
          action: () => {
            body.setRangeText(
              sys.clipboard.text ?? '',
              body.selectionStart,
              body.selectionEnd,
              'end',
            );
          },
        },
      ],
    },
    { label: 'Insert', items: [{ label: 'File Attachment...', action: attach }] },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'toolbar' },
      button([icon('mail', 20), 'Send'], send, { class: 'tool-button' }),
      button([icon('floppy', 20), 'Save'], () => save(), { class: 'tool-button' }),
      button('Attach', attach, { class: 'tool-button' }),
      button('Address Book', () => sys.launch('addressbook'), { class: 'tool-button' }),
    ),
    h('div', { class: 'mail-compose-fields' }, field('To:', to), field('Subject:', subject)),
    attachmentList,
    body,
  );
  attachmentList.replaceChildren(
    ...message.attachments.map((a) => h('span', {}, icon('file', 16), ' ' + a.name)),
  );
  win.beforeClose = async () => {
    if (JSON.stringify({ ...collect(), date: 0 }) === saved) return true;
    const c = await sys.dialogs.message('Do you want to save this message?', {
      title: 'Outlook Express',
      buttons: ['Yes', 'No', 'Cancel'],
    });
    return c === 'Yes' ? save() : c === 'No';
  };
  return win;
}

export function createAddressBook(sys) {
  const win = sys.createWindow({
    title: 'Address Book - Main Identity',
    icon: 'mail',
    width: 610,
    height: 390,
  });
  let contacts;
  try {
    contacts = JSON.parse(sys.fs.readFile(contactsPath));
  } catch {
    contacts = [];
  }
  let selected = null;
  const rows = h('tbody'),
    filter = h('input', { 'aria-label': 'Type name or select from list' });
  const save = () => sys.fs.writeFile(contactsPath, JSON.stringify(contacts), 'application/json');
  const edit = (contact) => {
    const dlg = sys.wm.create({
      title: contact ? 'Contact Properties' : 'New Contact',
      icon: 'mail',
      width: 380,
      height: 260,
      center: true,
      modal: true,
      resizable: false,
    });
    const name = h('input', { value: contact?.name ?? '' }),
      email = h('input', { type: 'email', value: contact?.email ?? '' }),
      phone = h('input', { value: contact?.phone ?? '' }),
      company = h('input', { value: contact?.company ?? '' });
    dlg.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        field('Name:', name),
        field('E-mail:', email),
        field('Phone:', phone),
        field('Company:', company),
        h(
          'div',
          { class: 'button-row' },
          button('OK', async () => {
            if (!name.value.trim()) {
              sys.dialogs.message('Enter a name.');
              return;
            }
            const next = {
              id: contact?.id ?? uid(),
              name: name.value,
              email: email.value,
              phone: phone.value,
              company: company.value,
            };
            contacts = contacts.filter((c) => c.id !== next.id);
            contacts.push(next);
            await save();
            render();
            dlg.close();
          }),
          button('Cancel', () => dlg.close()),
        ),
      ),
    );
  };
  const render = () => {
    rows.replaceChildren();
    for (const c of contacts
      .filter((c) => (c.name + ' ' + c.email).toLowerCase().includes(filter.value.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const row = h(
        'tr',
        { class: selected === c.id ? 'selected' : '' },
        h('td', {}, icon('logoff', 16), ' ', c.name),
        h('td', {}, c.email),
        h('td', {}, c.phone),
      );
      row.addEventListener('click', () => {
        selected = c.id;
        render();
      });
      row.addEventListener('dblclick', () => edit(c));
      rows.append(row);
    }
  };
  const remove = async () => {
    if (selected && (await sys.dialogs.confirm('Delete this contact?', 'Address Book'))) {
      contacts = contacts.filter((c) => c.id !== selected);
      await save();
      render();
    }
  };
  const exportContacts = () => {
    const quote = (s) => '"' + String(s ?? '').replaceAll('"', '""') + '"';
    const csv =
      'Name,Email,Phone,Company\r\n' +
      contacts.map((c) => [c.name, c.email, c.phone, c.company].map(quote).join(',')).join('\r\n');
    download(new Blob([csv], { type: 'text/csv' }), 'Address-Book.csv');
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New Contact...', action: () => edit() },
        { label: 'Export...', action: exportContacts },
        { label: 'Close', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Properties', action: () => edit(contacts.find((c) => c.id === selected)) },
        { label: 'Delete', action: remove },
      ],
    },
    {
      label: 'Tools',
      items: [
        {
          label: 'Send Mail',
          action: () => {
            const c = contacts.find((c) => c.id === selected);
            if (c) sys.launch('outlook', { compose: { to: c.email } });
          },
        },
      ],
    },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'toolbar' },
      button([icon('logoff', 20), 'New'], () => edit(), { class: 'tool-button' }),
      button(
        'Properties',
        () => {
          const c = contacts.find((c) => c.id === selected);
          if (c) edit(c);
        },
        { class: 'tool-button' },
      ),
      button('Delete', remove, { class: 'tool-button' }),
      button('Export', exportContacts, { class: 'tool-button' }),
    ),
    h('div', { style: { padding: '8px' } }, field('Type name or select from list:', filter)),
    h(
      'div',
      { class: 'app-scroll sunken' },
      h(
        'table',
        { class: 'classic-table' },
        h(
          'thead',
          {},
          h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'E-mail Address'), h('th', {}, 'Phone')),
        ),
        rows,
      ),
    ),
  );
  win.status('Local address book');
  filter.addEventListener('input', render);
  render();
  return win;
}
