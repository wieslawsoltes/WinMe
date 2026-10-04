import { h, button, checkbox } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';

export const helpArticles = {
  welcome: {
    title: 'Welcome to Windows Millennium Edition',
    sections: [
      [
        'Getting started',
        'This browser desktop recreates the classic Windows Me environment. Open programs from the Start menu, double-click desktop icons, or use Start > Run. Drag a window by its title bar and resize it from its edges.',
      ],
      [
        'Your files',
        'Documents live in the virtual C: drive. They are saved locally in this browser with IndexedDB. Use Backup to download a complete copy, or export individual files from Explorer. Clearing browser site data removes this desktop’s saved files.',
      ],
      [
        'Quick things to try',
        'Create a note in Notepad and save it in My Documents. Draw a picture in Paint, then set it as your wallpaper. Play the sample audio in Media Player. Open Solitaire or Minesweeper from Start > Programs > Games.',
      ],
    ],
  },
  files: {
    title: 'Working with files and folders',
    sections: [
      [
        'Windows Explorer',
        'Double-click My Computer or My Documents. Use the Address bar to enter a path such as C:\\My Documents. Back, Forward and Up navigate folders. Choose Large Icons, List or Details from View.',
      ],
      [
        'Manage files',
        'Select one or more items with Ctrl-click. Use Cut, Copy and Paste, or drag files between Explorer windows. Hold Ctrl while dropping to copy. Press F2 to rename, Delete to recycle, and Shift+Delete to delete permanently. Right-click an item for export and properties.',
      ],
      [
        'Import and export',
        'Drag files from your device into an Explorer folder, or choose File > Import Files. Export a file with its context menu. Folder backup and full drive export are available in Backup.',
      ],
      [
        'Recycle Bin',
        'Deleted items appear in the Recycle Bin. Select an item and choose Restore to return it to its original folder. Empty Recycle Bin deletes the stored items permanently.',
      ],
    ],
  },
  accessories: {
    title: 'Accessories',
    sections: [
      [
        'Notepad',
        'Notepad edits plain text. Open and save through the shared file dialog. Ctrl+F finds text, Ctrl+H replaces text, Ctrl+G goes to a line, and F5 inserts the date and time.',
      ],
      [
        'WordPad',
        'WordPad supports formatted text, alignment, lists, pictures and printing. Formatting is saved as HTML. Basic RTF import extracts text; binary Microsoft Word documents are not decoded.',
      ],
      [
        'Calculator',
        'Standard mode evaluates operations sequentially. Scientific mode adds trigonometry, powers, logarithms and factorials. Memory survives Clear until you choose MC.',
      ],
      [
        'MS-DOS Prompt',
        'The command interpreter operates on the virtual drive. Type HELP for commands. It supports directories, file commands, environment variables, redirection, pipes and simple batch files. It does not emulate an x86 processor.',
      ],
    ],
  },
  paint: {
    title: 'Paint',
    sections: [
      [
        'Drawing',
        'Choose a tool and click a palette color. Right-click a color to set the background color. Pencil, Brush, Eraser, Fill, Airbrush, Text, Line, Curve, Rectangle, Ellipse, Rounded Rectangle and Polygon operate on the bitmap.',
      ],
      [
        'Selections',
        'Drag a rectangle to select an area, then drag the selection to move it. Copy, cut and paste image data between Paint windows. Ctrl+Z undoes and Ctrl+Y redoes.',
      ],
      [
        'Shapes',
        'Choose Outline, Fill or Both in the tool options. For a curve, draw the initial line and click a control point. For polygons, click successive points and double-click to close the shape.',
      ],
      [
        'Images',
        'Open common image formats. Paint saves PNG files. Use Image to resize, rotate, flip, invert colors or clear the picture. Save a drawing and choose File > Set As Wallpaper to use it on your desktop.',
      ],
    ],
  },
  media: {
    title: 'Music, sound and movies',
    sections: [
      [
        'Windows Media Player',
        'Add files from your device or open files from the virtual drive. Playback supports browser codecs, playlists, volume, seek, repeat and shuffle. Visualizations use WebGPU compute where available, with WebGL 2 and Canvas 2D fallbacks.',
      ],
      [
        'Sound Recorder',
        'Choose Record and allow microphone access when your browser asks. Stop, play and save the recording to My Music. Your browser selects an available audio recording codec.',
      ],
      [
        'Windows Movie Maker',
        'Import images and videos into Collections, then add them to the storyboard. Reorder clips, set trim points, add captions or create title cards. Save an editable project, or record the edited movie to WebM or MP4 in real time.',
      ],
      [
        'Compatibility',
        'Media Player uses modern browser codecs rather than the original Windows Media codecs. The original media guide, radio directory, audio CD ripping and portable-device synchronization services are not connected.',
      ],
    ],
  },
  games: {
    title: 'Games',
    sections: [
      [
        'Classic games',
        'Minesweeper, Solitaire, FreeCell, Spider Solitaire, Hearts and Pinball are available under Programs > Games. Each has its own Game and Help menus.',
      ],
      [
        'Internet games',
        'Reversi, Checkers, Backgammon, Hearts and Spades use local computer opponents. Their original online matchmaking service is not connected.',
      ],
      [
        'Card controls',
        'Drag cards between piles, or click a source card followed by its destination. In Solitaire and FreeCell, double-click sends a card to a legal foundation. F2 deals a new game, Ctrl+Z undoes and H shows a hint where available.',
      ],
      [
        'Pinball',
        'Use Space to launch, Z and / or the arrow keys for flippers, and X to nudge. Touch the left or right half of the table for flippers. This edition implements its own table, physics and mission rules.',
      ],
    ],
  },
  minesweeper: {
    title: 'Playing Minesweeper',
    sections: [
      [
        'Object of the game',
        'Reveal every safe square without opening a mine. A number tells you how many of its eight neighbors contain mines. The first click and its adjacent squares are safe.',
      ],
      [
        'Controls',
        'Left-click to reveal. Right-click or press F to cycle a flag, question mark and unmarked square. Double-click an exposed number to open neighboring squares when it has the correct count of flags.',
      ],
      [
        'Difficulty',
        'Beginner uses 8 × 8 squares and 10 mines. Intermediate uses 16 × 16 and 40 mines. Expert uses 30 × 16 and 99 mines. Choose Custom for another supported size.',
      ],
    ],
  },
  internet: {
    title: 'Internet and communications',
    sections: [
      [
        'Internet Explorer',
        'Use the Address bar, history and favorites. External websites run in isolated frames under your modern browser engine. Some sites block embedding; use Open in a New Tab when needed. Local HTML files run in isolated frames too.',
      ],
      [
        'Outlook Express',
        'Messages, drafts and folders are local. Send places a message in Outbox and offers to open your email application or export EML. It does not deliver email directly or connect to POP, IMAP or SMTP.',
      ],
      [
        'Networks',
        'My Network Places reflects the browser’s connection status. The Home Networking Wizard saves desktop identity. It does not configure physical adapters, modems, SMB shares or your host network.',
      ],
    ],
  },
  system: {
    title: 'System tools and recovery',
    sections: [
      [
        'Control Panel',
        'Customize the desktop color, wallpaper, appearance, screensaver, sound, clock, and local profile. Settings apply to this browser desktop.',
      ],
      [
        'System Restore',
        'A restore point records the entire virtual drive and desktop settings. Restoring replaces that local state. Save your work before restoring.',
      ],
      [
        'Backup and cleanup',
        'Backup exports and imports the drive as a portable JSON file. Disk Cleanup deletes selected temporary files and recycled items. ScanDisk checks virtual filesystem structure. Physical disk defragmentation is not applicable to IndexedDB.',
      ],
      [
        'Registry and tasks',
        'Registry Editor stores local keys and connects selected values to desktop settings. Scheduled Tasks launch chosen programs while this desktop remains open.',
      ],
    ],
  },
  keyboard: {
    title: 'Keyboard shortcuts',
    sections: [
      [
        'Desktop and windows',
        'Ctrl+Esc: Start menu. Alt+Tab: next window when the browser allows it. Alt+F4: close the active app when the browser delivers the shortcut. Alt+Space: window menu. Win+D: show desktop when available. Win+R: Run when available.',
      ],
      [
        'Files',
        'Ctrl+C / Ctrl+X / Ctrl+V: copy, cut and paste. Ctrl+A: select all. F2: rename. Delete: recycle. Shift+Delete: permanent deletion. F5: refresh.',
      ],
      [
        'Editors',
        'Ctrl+N: new. Ctrl+O: open. Ctrl+S: save. Ctrl+P: print. Ctrl+F: find. Escape: close menus or cancel an operation.',
      ],
      [
        'Browser conflicts',
        'Your host operating system or browser can intercept some system shortcuts. All main actions are also available through visible menus and buttons.',
      ],
    ],
  },
  compatibility: {
    title: 'Compatibility and implementation',
    sections: [
      [
        'What this environment is',
        'A JavaScript reimplementation of the Windows Me desktop and application workflows. It uses original interface code, recreated pixel icons and a licensed bitmap-style font. It is not a Microsoft Windows installation or an x86 machine emulator.',
      ],
      [
        'Rendering',
        'Classic windows and controls use the DOM. The desktop and media visualizations use a shared WebGPU compute renderer, with WebGL 2 and Canvas 2D fallbacks. Paint, Movie Maker preview, analog clocks, and Pinball use Canvas 2D.',
      ],
      [
        'Native software and hardware',
        'Native EXE, DLL, COM binaries, Win32 APIs, kernel drivers, DOS interrupts, hardware I/O, DirectX compatibility, physical networking and printer drivers are not implemented. Supplied Windows installation media and a separate full machine emulator would be required for original binary compatibility.',
      ],
      [
        'File formats and fidelity',
        'PNG/text/HTML/audio/video workflows use modern browser formats. Movie Maker projects use this application’s documented JSON format, not binary Microsoft MSWMM. The UI follows original Me measurements, but no claim of exhaustive pixel-by-pixel or feature parity is made.',
      ],
      [
        'Storage',
        'Your virtual drive is local to the browser and site origin. IndexedDB transactions commit before changes are announced. A revision check coordinates writes across tabs. Backups provide a portable copy.',
      ],
    ],
  },
};

export function createHelp(sys, args = {}) {
  const win = sys.createWindow({
    title: 'Help and Support',
    icon: 'help',
    width: 720,
    height: 505,
    minWidth: 430,
    minHeight: 300,
  });
  let topic = args.topic && helpArticles[args.topic] ? args.topic : 'welcome';
  const nav = h('aside', { class: 'help-nav' }),
    article = h('article', { class: 'help-article' }),
    search = h('input', { 'aria-label': 'Search Help', placeholder: 'Search Help' });
  const render = () => {
    const data = helpArticles[topic];
    article.replaceChildren(
      h('h1', {}, data.title),
      ...data.sections.map(([heading, text]) =>
        h('section', {}, h('h2', {}, heading), h('p', {}, text)),
      ),
    );
    for (const b of nav.querySelectorAll('button'))
      b.classList.toggle('selected', b.dataset.topic === topic);
  };
  const searchHelp = () => {
    const needle = search.value.toLowerCase();
    if (!needle) return;
    const found = Object.entries(helpArticles).find(([, data]) =>
      (data.title + ' ' + data.sections.flat().join(' ')).toLowerCase().includes(needle),
    );
    if (found) {
      topic = found[0];
      render();
    } else
      article.replaceChildren(
        h('h1', {}, 'No topics found'),
        h('p', {}, 'Try a different word or choose a topic from Contents.'),
      );
  };
  nav.append(h('b', { style: { display: 'block', marginBottom: '10px' } }, 'Contents'));
  for (const [key, data] of Object.entries(helpArticles))
    nav.append(
      button(
        data.title,
        () => {
          topic = key;
          render();
        },
        { dataset: { topic: key } },
      ),
    );
  win.menu([
    {
      label: 'File',
      items: [
        {
          label: 'Print Topic...',
          action: () =>
            sys.printText(
              helpArticles[topic].sections.map((s) => s.join('\n')).join('\n\n'),
              helpArticles[topic].title,
            ),
        },
        { label: 'Close', action: () => win.close() },
      ],
    },
    { label: 'Help', items: [{ label: 'About Windows', action: () => sys.launch('about') }] },
  ]);
  win.content.append(
    h(
      'div',
      { class: 'toolbar' },
      button(
        [icon('help', 20), 'Home'],
        () => {
          topic = 'welcome';
          render();
        },
        { class: 'tool-button' },
      ),
      search,
      button('Search', searchHelp, { class: 'tool-button' }),
    ),
    h('div', { class: 'help-layout' }, nav, article),
  );
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchHelp();
  });
  render();
  win.onLaunch = (args) => {
    if (args.topic && helpArticles[args.topic]) {
      topic = args.topic;
      render();
    }
  };
  return win;
}

export function createWelcome(sys) {
  const win = sys.createWindow({
    title: 'Welcome to Windows Me',
    icon: 'windows',
    width: 600,
    height: 435,
    center: true,
    resizable: false,
  });
  let show = sys.settings.get('showWelcome') ?? true;
  const side = h(
    'aside',
    { class: 'welcome-side' },
    icon('windows', 54),
    h(
      'div',
      { class: 'welcome-wordmark' },
      'Microsoft',
      h('br'),
      'Windows',
      h('span', { class: 'welcome-me' }, 'Me'),
    ),
    h('p', { style: { font: '10px Arial', marginTop: '5px' } }, 'Millennium Edition'),
  );
  const main = h(
    'div',
    { class: 'welcome-main' },
    h('h1', {}, 'Welcome'),
    h('p', {}, 'Discover what you can do with Windows Millennium Edition.'),
    button([icon('computer', 32), 'Explore your computer'], () => sys.launch('explorer'), {
      class: 'welcome-link',
    }),
    button([icon('media', 32), 'Enjoy music and video'], () => sys.launch('media-player'), {
      class: 'welcome-link',
    }),
    button([icon('movie', 32), 'Make your own movies'], () => sys.launch('moviemaker'), {
      class: 'welcome-link',
    }),
    button([icon('help', 32), 'Take a tour of Windows'], () => sys.launch('help'), {
      class: 'welcome-link',
    }),
    h(
      'div',
      { style: { marginTop: '16px' } },
      checkbox('Show this screen at startup', show, (v) => {
        show = v;
        sys.settings.set('showWelcome', v);
      }),
    ),
    h(
      'div',
      { class: 'button-row' },
      button('Close', () => win.close(), { class: 'default' }),
    ),
  );
  win.content.append(h('div', { class: 'welcome-body' }, side, main));
  return win;
}

export function createAbout(sys) {
  const win = sys.createWindow({
    title: 'About Windows',
    icon: 'windows',
    width: 430,
    height: 315,
    center: true,
    modal: true,
    resizable: false,
  });
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '5px 5px 16px' } },
        icon('windows', 56),
        h(
          'div',
          {},
          h(
            'span',
            { style: { font: 'bold 24px Arial' } },
            'Microsoft Windows ',
            h('span', { style: { color: '#739f3f' } }, 'Me'),
          ),
          h('div', { style: { font: '12px Arial', marginTop: '4px' } }, 'Millennium Edition'),
        ),
      ),
      h('hr'),
      h(
        'p',
        { style: { marginTop: '10px' } },
        'Millennium browser desktop',
        h('br'),
        'Version 1.0.0',
      ),
      h('p', {}, 'Registered to: ' + sys.settings.get('userName')),
      h(
        'p',
        {},
        'Independent JavaScript reimplementation. Native Windows binary and hardware compatibility is not provided.',
      ),
      h(
        'div',
        { class: 'button-row' },
        button('Compatibility...', async () => {
          await win.close();
          sys.launch('help', { topic: 'compatibility' });
        }),
        button('OK', () => win.close(), { class: 'default' }),
      ),
    ),
  );
  return win;
}
