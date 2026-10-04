import { h, button, field, select, checkbox } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';

export function createNetwork(sys, args = {}) {
  const win = sys.createWindow({
    title: 'My Network Places',
    icon: 'network',
    width: 585,
    height: 405,
  });
  const status = h(
      'footer',
      { class: 'status-bar' },
      h('span', {}, navigator.onLine ? 'Browser is online' : 'Browser is offline'),
    ),
    list = h('div', { class: 'control-grid' });
  const refresh = () => {
    list.replaceChildren(
      button([icon('network', 32), h('span', {}, 'Home Network')], () =>
        sys.dialogs.message(
          `Computer: ${sys.settings.get('computerName') ?? 'MILLENNIUM'}\nWorkgroup: ${sys.settings.get('workgroup') ?? 'MSHOME'}\n\nThis browser desktop uses your existing network connection. Local network discovery, SMB shares, and modem dialing are not exposed to browser applications.`,
          { title: 'Home Network', icon: 'network' },
        ),
      ),
      button([icon('globe', 32), h('span', {}, 'Entire Network')], () =>
        sys.launch('network-wizard'),
      ),
      button(
        [icon('computer', 32), h('span', {}, sys.settings.get('computerName') ?? 'MILLENNIUM')],
        () => sys.launch('explorer', { path: 'computer' }),
      ),
      button([icon('folder', 32), h('span', {}, 'My Documents')], () =>
        sys.launch('explorer', { path: 'C:\\My Documents' }),
      ),
    );
    status.firstChild.textContent = navigator.onLine ? 'Browser is online' : 'Browser is offline';
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New Connection...', action: () => sys.launch('network-wizard') },
        { label: 'Properties', action: () => sys.launch('network-wizard') },
        { label: 'Close', action: () => win.close() },
      ],
    },
    { label: 'View', items: [{ label: 'Refresh', action: refresh }] },
    {
      label: 'Help',
      items: [{ label: 'Network Help', action: () => sys.launch('help', { topic: 'internet' }) }],
    },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'toolbar' },
      button('Add Network Place', () => sys.launch('network-wizard'), { class: 'tool-button' }),
      button('Home Networking Wizard', () => sys.launch('network-wizard'), {
        class: 'tool-button',
      }),
    ),
    list,
    status,
  );
  window.addEventListener('online', refresh, { signal: win.signal });
  window.addEventListener('offline', refresh, { signal: win.signal });
  refresh();
  return win;
}

export function createNetworkWizard(sys) {
  const win = sys.createWindow({
    title: 'Home Networking Wizard',
    icon: 'network',
    width: 510,
    height: 385,
    resizable: false,
    center: true,
  });
  let step = 0;
  const values = {
      computer: sys.settings.get('computerName') ?? 'MILLENNIUM',
      workgroup: sys.settings.get('workgroup') ?? 'MSHOME',
    },
    body = h('div', { class: 'wizard-body' }),
    back = button('< Back', () => {
      step--;
      render();
    }),
    next = button('Next >', () => {
      if (step < 2) {
        step++;
        render();
      } else {
        sys.settings.update({ computerName: values.computer, workgroup: values.workgroup });
        win.close();
      }
    });
  const render = () => {
    back.disabled = step === 0;
    next.textContent = step === 2 ? 'Finish' : 'Next >';
    body.replaceChildren(
      h('aside', { class: 'wizard-banner' }, icon('network', 64)),
      h('section', { class: 'wizard-content' }),
    );
    const page = body.lastChild;
    if (step === 0)
      page.append(
        h('h1', {}, 'Welcome to the Home Networking Wizard'),
        h(
          'p',
          {},
          'Set up the identity of your Millennium desktop and check its Internet connection.',
        ),
        h(
          'p',
          {},
          navigator.onLine
            ? 'Your browser is currently online.'
            : 'Your browser is currently offline.',
        ),
        h('p', {}, 'The browser uses the network connection configured on your device.'),
      );
    if (step === 1)
      page.append(
        h('h1', {}, 'Identify your computer'),
        h('p', {}, 'Type a name for this desktop and its workgroup.'),
        field(
          'Computer:',
          h('input', {
            value: values.computer,
            maxLength: 15,
            oninput: (e) =>
              (values.computer = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')),
          }),
        ),
        field(
          'Workgroup:',
          h('input', {
            value: values.workgroup,
            maxLength: 15,
            oninput: (e) =>
              (values.workgroup = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')),
          }),
        ),
      );
    if (step === 2)
      page.append(
        h('h1', {}, 'Completing the wizard'),
        h('p', {}, `Computer name: ${values.computer}\nWorkgroup: ${values.workgroup}`),
        h(
          'p',
          {},
          'These names are saved in your browser desktop. This does not create a physical network, share files outside this site, or change your device’s network configuration.',
        ),
        button('Open Internet Explorer', () => sys.launch('browser')),
      );
  };
  win.content.append(
    body,
    h(
      'div',
      { class: 'button-row', style: { padding: '10px', borderTop: '2px groove #fff' } },
      back,
      next,
      button('Cancel', () => win.close()),
    ),
  );
  render();
  return win;
}

export function createMessenger(sys) {
  const win = sys.createWindow({
    title: 'MSN Messenger Service',
    icon: 'mail',
    width: 300,
    height: 440,
    minWidth: 250,
    minHeight: 280,
  });
  const page = h(
    'div',
    { class: 'messenger-page' },
    h(
      'div',
      { class: 'messenger-header' },
      h('h1', {}, 'MSN', h('br'), h('small', {}, 'Messenger Service')),
    ),
    h(
      'div',
      { style: { padding: '15px' } },
      h('p', {}, 'You are not signed in.'),
      h(
        'p',
        {},
        'The original MSN Messenger network is no longer connected to this browser edition.',
      ),
      h(
        'p',
        {},
        'Keep your contacts in Address Book or create a local message in Outlook Express.',
      ),
      button('Address Book', () => sys.launch('addressbook')),
      button('Write a Message', () => sys.launch('outlook', { compose: {} }), {
        style: { marginTop: '8px' },
      }),
    ),
  );
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'My Contacts', action: () => sys.launch('addressbook') },
        { label: 'Close', action: () => win.close() },
      ],
    },
    { label: 'Tools', items: [{ label: 'Options', action: () => sys.launch('internet-options') }] },
    {
      label: 'Help',
      items: [{ label: 'Help', action: () => sys.launch('help', { topic: 'internet' }) }],
    },
  ]);
  win.content.append(page);
  return win;
}
