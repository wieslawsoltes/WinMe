import { h, button, field, select, checkbox, download } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';
import { escapeHTML, uid } from '../../core/src/index.js';
import { basename } from '../../filesystem/src/index.js';

export function createBrowser(sys, args = {}) {
  const win = sys.createWindow({
    title: 'Microsoft Internet Explorer',
    icon: 'ie',
    width: 790,
    height: 555,
    minWidth: 380,
    minHeight: 270,
  });
  let current =
      args.url ??
      (args.path ? 'file:///' + args.path : (sys.settings.get('homepage') ?? 'about:home')),
    history = [],
    forward = [],
    sidebarMode = null;
  const address = h('input', { 'aria-label': 'Address', value: current }),
    content = h('div', { class: 'ie-content' }),
    side = h('aside', { class: 'ie-sidebar', hidden: true }),
    status = h('footer', { class: 'status-bar' }, h('span', {}, 'Done'), h('span', {}, 'Internet'));
  const backBtn = button(
    [icon('arrow', 20), 'Back'],
    () => {
      if (history.length) {
        forward.push(current);
        current = history.pop();
        render();
      }
    },
    { class: 'tool-button' },
  );
  backBtn.querySelector('img').style.transform = 'scaleX(-1)';
  const forwardBtn = button(
    icon('arrow', 20),
    () => {
      if (forward.length) {
        history.push(current);
        current = forward.pop();
        render();
      }
    },
    { class: 'tool-button', title: 'Forward' },
  );
  const navigate = (url) => {
    let target = url.trim();
    if (!target) return;
    if (!/^(https?:|about:|file:)/i.test(target))
      target =
        target.includes('.') && !target.includes(' ')
          ? 'https://' + target
          : 'https://www.bing.com/search?q=' + encodeURIComponent(target);
    if (target !== current) {
      history.push(current);
      forward = [];
      current = target;
    }
    render();
  };
  const addFavorite = async () => {
    const name = await sys.dialogs.prompt(
      'Enter a name for this favorite.',
      current.startsWith('about:') ? 'Windows Millennium' : current,
      { title: 'Add Favorite', label: 'Name:' },
    );
    if (name) {
      const all = sys.settings.get('browserFavorites') ?? [];
      all.push({ id: uid(), name, url: current });
      sys.settings.set('browserFavorites', all);
      renderSidebar();
    }
  };
  const external = () => {
    if (/^https?:/i.test(current)) window.open(current, '_blank', 'noopener,noreferrer');
  };
  const renderSidebar = () => {
    side.hidden = !sidebarMode;
    side.replaceChildren();
    if (!sidebarMode) return;
    side.append(
      h(
        'div',
        { class: 'ie-sidebar-title' },
        h('b', {}, sidebarMode),
        button(
          '×',
          () => {
            sidebarMode = null;
            renderSidebar();
          },
          { class: 'tool-button', title: 'Close Explorer Bar' },
        ),
      ),
    );
    if (sidebarMode === 'Search') {
      const search = h('input', { 'aria-label': 'Search the web' });
      side.append(
        h('p', {}, 'Find a web page'),
        search,
        button('Search', () =>
          navigate('https://www.bing.com/search?q=' + encodeURIComponent(search.value)),
        ),
      );
    } else {
      const items =
        sidebarMode === 'Favorites'
          ? (sys.settings.get('browserFavorites') ?? [])
          : (sys.settings.get('browserHistory') ?? [])
              .slice()
              .reverse()
              .map((e) => ({ name: e.url, url: e.url }));
      for (const entry of items)
        side.append(
          button(
            [icon(sidebarMode === 'Favorites' ? 'folder' : 'ie', 16), h('span', {}, entry.name)],
            () => navigate(entry.url),
            { class: 'ie-favorite-item' },
          ),
        );
    }
  };
  const link = (label, url) =>
    h(
      'a',
      {
        href: url,
        onclick: (e) => {
          e.preventDefault();
          navigate(url);
        },
      },
      label,
    );
  function render() {
    address.value = current;
    backBtn.disabled = !history.length;
    forwardBtn.disabled = !forward.length;
    content.replaceChildren();
    status.children[0].textContent = 'Done';
    status.children[1].textContent =
      current.startsWith('about:') || current.startsWith('file:') ? 'My Computer' : 'Internet';
    win.setTitle(
      (current === 'about:home'
        ? 'Welcome to the Web'
        : current === 'about:blank'
          ? 'Blank Page'
          : current) + ' - Microsoft Internet Explorer',
    );
    if (current === 'about:blank') {
      content.append(h('div', { style: { background: '#fff', height: '100%' } }));
      return;
    }
    if (current.startsWith('about:')) {
      if (current === 'about:windowsupdate') {
        content.append(
          h(
            'div',
            { class: 'ie-home' },
            h(
              'div',
              { class: 'ie-web-header' },
              icon('windows', 40),
              h('h1', {}, 'Windows Update'),
            ),
            h('h2', {}, 'Millennium desktop updates'),
            h(
              'p',
              {},
              'This desktop runs the version published at this site. Reload the desktop after a new version is published to receive its changes.',
            ),
            h('p', {}, 'The original Windows Me Update service is not connected.'),
            button('Check This Version', () => sys.launch('about')),
            link('Return to the home page', 'about:home'),
          ),
        );
        return;
      }
      const page = h(
        'div',
        { class: 'ie-home' },
        h(
          'div',
          { class: 'ie-web-header' },
          icon('windows', 48),
          h(
            'div',
            {},
            h('h1', {}, 'Welcome to the Web'),
            h('p', {}, 'Microsoft Internet Explorer'),
          ),
        ),
        h(
          'div',
          { class: 'ie-web-nav' },
          link('Home', 'about:home'),
          link('Microsoft', 'https://www.microsoft.com/'),
          link('Windows Update', 'about:windowsupdate'),
          h(
            'a',
            {
              href: '#',
              onclick: (e) => {
                e.preventDefault();
                sys.launch('help');
              },
            },
            'Help',
          ),
        ),
      );
      const main = h(
        'div',
        { class: 'ie-home-columns' },
        h(
          'article',
          {},
          h('h2', {}, 'Discover the Internet'),
          h(
            'p',
            {},
            'Use the Address bar to visit a website. You can save your favorite places and return to pages in your History.',
          ),
          h('hr'),
          h('h3', {}, 'Your Internet tools'),
          h(
            'p',
            {},
            h(
              'a',
              {
                href: '#',
                onclick: (e) => {
                  e.preventDefault();
                  sys.launch('outlook');
                },
              },
              'Read your mail',
            ),
            h('br'),
            'Manage messages and drafts with Outlook Express.',
          ),
          h(
            'p',
            {},
            h(
              'a',
              {
                href: '#',
                onclick: (e) => {
                  e.preventDefault();
                  sys.launch('media-player');
                },
              },
              'Enjoy music and video',
            ),
            h('br'),
            'Open your media library in Windows Media Player.',
          ),
          h(
            'p',
            {},
            h(
              'a',
              {
                href: '#',
                onclick: (e) => {
                  e.preventDefault();
                  sys.launch('network-wizard');
                },
              },
              'Connect to the Internet',
            ),
            h('br'),
            'Use the connection provided by your browser.',
          ),
        ),
        h(
          'aside',
          {},
          h('h3', {}, 'Favorite places'),
          ...(
            sys.settings.get('browserFavorites') ?? [
              { name: 'Microsoft', url: 'https://www.microsoft.com/' },
              { name: 'Internet Archive', url: 'https://archive.org/' },
              { name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
            ]
          ).map((e) => h('p', {}, link(e.name, e.url))),
          h('hr'),
          h('h3', {}, 'On your computer'),
          h(
            'p',
            {},
            h(
              'a',
              {
                href: '#',
                onclick: (e) => {
                  e.preventDefault();
                  sys.launch('explorer', { path: 'C:\\My Documents' });
                },
              },
              'My Documents',
            ),
          ),
          h(
            'p',
            {},
            h(
              'a',
              {
                href: '#',
                onclick: (e) => {
                  e.preventDefault();
                  sys.launch('internet-options');
                },
              },
              'Internet Options',
            ),
          ),
        ),
      );
      page.append(
        main,
        h(
          'footer',
          { class: 'ie-home-footer' },
          'Internet Explorer 5.5 • Millennium browser edition',
        ),
      );
      content.append(page);
      return;
    }
    if (current.startsWith('file:')) {
      try {
        const path = current.replace(/^file:\/*/, '').replaceAll('/', '\\'),
          node = sys.fs.stat(path);
        if (!node) throw new Error('The file cannot be found.');
        if (node.kind === 'directory') {
          sys.launch('explorer', { path });
          return;
        }
        const html = sys.fs.readFile(path);
        const frame = h('iframe', {
          title: basename(path),
          sandbox: 'allow-scripts',
          srcdoc: html,
          class: 'ie-frame',
        });
        content.append(frame);
        status.children[0].textContent = 'Local document (isolated)';
      } catch (e) {
        content.append(
          h(
            'div',
            { class: 'ie-error' },
            h('h2', {}, 'The page cannot be displayed'),
            h('p', {}, e.message),
          ),
        );
      }
      return;
    }
    try {
      const url = new URL(current);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol.');
      const visited = sys.settings.get('browserHistory') ?? [];
      if (visited.at(-1)?.url !== url.href) {
        visited.push({ url: url.href, time: Date.now() });
        sys.settings.set('browserHistory', visited.slice(-150));
      }
      content.append(
        h(
          'div',
          { class: 'ie-embed-note' },
          h('span', {}, 'Some websites block display inside another page.'),
          button('Open in a new tab', external),
        ),
      );
      const frame = h('iframe', {
        src: url.href,
        title: url.hostname,
        class: 'ie-frame',
        sandbox: 'allow-scripts allow-forms allow-popups allow-downloads',
        referrerPolicy: 'no-referrer',
      });
      content.append(frame);
      status.children[0].textContent = 'Opening ' + url.hostname + '...';
      frame.addEventListener(
        'load',
        () => (status.children[0].textContent = 'Page request finished.'),
      );
      frame.addEventListener(
        'error',
        () => (status.children[0].textContent = 'The page could not be displayed.'),
      );
    } catch (e) {
      content.append(
        h(
          'div',
          { class: 'ie-error' },
          h('h2', {}, 'The page cannot be displayed'),
          h('p', {}, e.message),
        ),
      );
    }
    renderSidebar();
  }
  win.menu([
    {
      label: 'File',
      items: [
        {
          label: 'New Window',
          shortcut: 'Ctrl+N',
          action: () => sys.launch('browser', { url: current }),
        },
        {
          label: 'Open...',
          shortcut: 'Ctrl+O',
          action: async () => {
            const value = await sys.dialogs.prompt('Type an Internet address.', current, {
              title: 'Open',
              label: 'Open:',
            });
            if (value) navigate(value);
          },
        },
        {
          label: 'Open Local File...',
          action: async () => {
            const p = await sys.dialogs.file({
              extensions: ['htm', 'html', 'txt'],
              typeLabel: 'Web Documents',
            });
            if (p) navigate('file:///' + p);
          },
        },
        '-',
        { label: 'Open in a New Tab', action: external },
        { label: 'Close', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        {
          label: 'Copy Address',
          action: () => {
            sys.clipboard.text = current;
            navigator.clipboard?.writeText(current).catch(() => {});
          },
        },
        {
          label: 'Select Address',
          action: () => {
            address.focus();
            address.select();
          },
        },
      ],
    },
    {
      label: 'View',
      items: [
        {
          label: 'Go To',
          children: [
            { label: 'Back', action: () => backBtn.click() },
            { label: 'Forward', action: () => forwardBtn.click() },
            {
              label: 'Home Page',
              action: () => navigate(sys.settings.get('homepage') ?? 'about:home'),
            },
          ],
        },
        { label: 'Refresh', shortcut: 'F5', action: render },
        {
          label: 'Explorer Bar',
          children: ['Search', 'Favorites', 'History'].map((label) => ({
            label,
            action: () => {
              sidebarMode = sidebarMode === label ? null : label;
              renderSidebar();
            },
          })),
        },
      ],
    },
    {
      label: 'Favorites',
      items: () => [
        { label: 'Add to Favorites...', action: addFavorite },
        {
          label: 'Organize Favorites...',
          action: () => {
            sidebarMode = 'Favorites';
            renderSidebar();
          },
        },
        '-',
        ...(sys.settings.get('browserFavorites') ?? []).map((f) => ({
          label: f.name,
          icon: 'ie',
          action: () => navigate(f.url),
        })),
      ],
    },
    {
      label: 'Tools',
      items: [
        {
          label: 'Mail and News',
          children: [
            { label: 'Read Mail', action: () => sys.launch('outlook') },
            { label: 'Address Book', action: () => sys.launch('addressbook') },
          ],
        },
        { label: 'Internet Options...', action: () => sys.launch('internet-options') },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Contents and Index', action: () => sys.launch('help', { topic: 'internet' }) },
        {
          label: 'About Internet Explorer',
          action: () =>
            sys.dialogs.message(
              'Microsoft Internet Explorer 5.5 — browser edition\n\nThe classic interface is recreated in HTML. Web pages run in isolated frames using your modern browser engine, not Trident. Some sites require opening in a separate tab.',
              { title: 'About Internet Explorer', icon: 'ie' },
            ),
        },
      ],
    },
  ]);
  const toolbar = h(
    'div',
    { class: 'toolbar ie-toolbar' },
    backBtn,
    forwardBtn,
    button(
      icon('stop', 20),
      () => {
        const frame = content.querySelector('iframe');
        if (frame) {
          frame.src = 'about:blank';
          status.firstChild.textContent = 'Stopped';
        }
      },
      { class: 'tool-button', title: 'Stop' },
    ),
    button('Refresh', render, { class: 'tool-button' }),
    button([icon('ie', 20), 'Home'], () => navigate(sys.settings.get('homepage') ?? 'about:home'), {
      class: 'tool-button',
    }),
    h('div', { class: 'separator' }),
    ...['Search', 'Favorites', 'History'].map((label) =>
      button(
        [
          icon(label === 'Search' ? 'search' : label === 'Favorites' ? 'folder' : 'clock', 20),
          label,
        ],
        () => {
          sidebarMode = sidebarMode === label ? null : label;
          renderSidebar();
        },
        { class: 'tool-button' },
      ),
    ),
    button(icon('mail', 20), () => sys.launch('outlook'), { class: 'tool-button', title: 'Mail' }),
  );
  win.content.append(
    toolbar,
    h(
      'div',
      { class: 'explorer-address' },
      h('span', {}, 'Address'),
      address,
      button([icon('arrow', 16), 'Go'], () => navigate(address.value), { class: 'tool-button' }),
    ),
    h('div', { class: 'ie-body' }, side, content),
    status,
  );
  address.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigate(address.value);
  });
  win.element.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        render();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        address.focus();
        address.select();
      }
    },
    { signal: win.signal },
  );
  render();
  win.navigate = navigate;
  return win;
}

export function createInternetOptions(sys) {
  const win = sys.createWindow({
    title: 'Internet Properties',
    icon: 'ie',
    width: 405,
    height: 350,
    resizable: false,
    center: true,
  });
  const home = h('input', { value: sys.settings.get('homepage') ?? 'about:home' });
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      h(
        'fieldset',
        {},
        h('legend', {}, 'Home page'),
        h('p', {}, 'You can change which page to use for your home page.'),
        field('Address:', home),
        h(
          'div',
          { class: 'button-row' },
          button('Use Default', () => (home.value = 'about:home')),
          button('Use Blank', () => (home.value = 'about:blank')),
        ),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, 'History'),
        h('p', {}, 'The browser desktop keeps the last 150 visited addresses.'),
        button('Clear History', async () => {
          if (
            await sys.dialogs.confirm('Clear the browser desktop history?', 'Internet Properties')
          )
            sys.settings.set('browserHistory', []);
        }),
      ),
      h(
        'div',
        { class: 'button-row' },
        button('OK', () => {
          const url = home.value.trim();
          if (!/^(https?:|about:)/i.test(url)) {
            sys.dialogs.message('Enter an HTTP, HTTPS or about: address.');
            return;
          }
          sys.settings.set('homepage', url);
          win.close();
        }),
        button('Cancel', () => win.close()),
      ),
    ),
  );
  return win;
}
