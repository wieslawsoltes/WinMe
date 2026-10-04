import { h, button, field, checkbox, select, tabs, pickFiles } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';
import { basename } from '../../filesystem/src/index.js';

export const applets = [
  ['accessibility', 'Accessibility Options', 'accessibility'],
  ['add-remove', 'Add/Remove Programs', 'control'],
  ['date-time', 'Date/Time', 'clock'],
  ['display', 'Display', 'display'],
  ['folder-options', 'Folder Options', 'folder'],
  ['fonts', 'Fonts', 'wordpad'],
  ['game-controllers', 'Gaming Options', 'game'],
  ['internet-options', 'Internet Options', 'ie'],
  ['keyboard', 'Keyboard', 'keyboard'],
  ['mouse', 'Mouse', 'mouse'],
  ['network', 'Network', 'network'],
  ['passwords', 'Passwords', 'logoff'],
  ['power', 'Power Options', 'control'],
  ['printers', 'Printers', 'printer'],
  ['regional', 'Regional Settings', 'globe'],
  ['sound-properties', 'Sounds and Multimedia', 'sound'],
  ['system', 'System', 'computer'],
];

export function createControlPanel(sys) {
  const win = sys.createWindow({
    title: 'Control Panel',
    icon: 'control',
    width: 610,
    height: 420,
    minWidth: 300,
    minHeight: 240,
  });
  win.menu([
    { label: 'File', items: [{ label: 'Close', action: () => win.close() }] },
    {
      label: 'View',
      items: [
        {
          label: 'Refresh',
          action: () => {
            grid.replaceChildren(
              ...applets.map(([id, title, ico]) =>
                button([icon(ico, 32), h('span', {}, title)], () => sys.launch(id), { title }),
              ),
            );
          },
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'About Control Panel',
          action: () =>
            sys.dialogs.message(
              'Use Control Panel to customize your Millennium desktop and view system information.',
              { title: 'Control Panel', icon: 'control' },
            ),
        },
      ],
    },
  ]);
  const grid = h('div', { class: 'control-grid' });
  for (const [id, title, ico] of applets)
    grid.append(button([icon(ico, 32), h('span', {}, title)], () => sys.launch(id), { title }));
  win.content.append(grid);
  win.status(applets.length + ' object(s)');
  return win;
}

function propertyWindow(sys, title, iconName, width = 405, height = 430) {
  return sys.createWindow({ title, icon: iconName, width, height, resizable: false, center: true });
}
function applyButtons(win, apply) {
  return h(
    'div',
    { class: 'button-row' },
    button(
      'OK',
      async () => {
        if ((await apply()) !== false) win.close();
      },
      { class: 'default' },
    ),
    button('Cancel', () => win.close()),
    button('Apply', apply),
  );
}

export function createDisplay(sys) {
  const win = propertyWindow(sys, 'Display Properties', 'display', 408, 460);
  let values = { ...sys.settings.values };
  const screens = [];
  const monitor = () => {
    const screen = h('div', { class: 'mini-screen' }, h('div', { class: 'mini-taskbar' }));
    screens.push(screen);
    return h('div', { class: 'property-preview' }, h('div', { class: 'mini-monitor' }, screen));
  };
  const preview = () => {
    for (const s of screens) {
      s.style.backgroundColor = values.desktopColor;
      s.style.backgroundImage =
        values.wallpaper === 'rivet' ? 'radial-gradient(#ffffff44 1px,transparent 1px)' : 'none';
      s.style.backgroundSize = values.wallpaper === 'rivet' ? '5px 5px' : 'cover';
    }
  };
  const choices = [
    { value: 'none', label: '(None)' },
    { value: 'rivet', label: 'Blue Rivets' },
    ...sys.fs
      .walk('C:\\My Documents')
      .filter((n) => n.kind === 'file' && /\.(bmp|png|jpe?g|webp|gif)$/i.test(n.path))
      .map((n) => ({ value: n.path, label: n.name })),
  ];
  const wallpaper = select(choices, values.wallpaper, (v) => {
    values.wallpaper = v;
    preview();
  });
  const background = h(
    'div',
    {},
    monitor(),
    h('p', {}, 'Select a background picture as wallpaper.'),
    h(
      'div',
      { style: { display: 'flex', gap: '9px' } },
      h(
        'div',
        { style: { flex: '1' } },
        field('Wallpaper:', wallpaper),
        field(
          'Display:',
          select(
            [
              { value: 'center', label: 'Center' },
              { value: 'tile', label: 'Tile' },
              { value: 'stretch', label: 'Stretch' },
            ],
            values.wallpaperStyle,
            (v) => (values.wallpaperStyle = v),
          ),
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '9px', paddingTop: '8px' } },
        button('Browse...', async () => {
          const p = await sys.dialogs.file({
            extensions: ['bmp', 'png', 'jpg', 'jpeg', 'gif', 'webp'],
            typeLabel: 'Picture Files',
          });
          if (p) {
            values.wallpaper = p;
            wallpaper.append(h('option', { value: p }, basename(p)));
            wallpaper.value = p;
            preview();
          }
        }),
        h('input', {
          type: 'color',
          value: values.desktopColor,
          title: 'Desktop color',
          oninput: (e) => {
            values.desktopColor = e.target.value;
            preview();
          },
        }),
      ),
    ),
  );
  const saver = h(
    'div',
    {},
    monitor(),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Screen saver'),
      select(
        [
          { value: 'none', label: '(None)' },
          { value: 'stars', label: 'Starfield' },
          { value: 'plasma', label: 'Mystify' },
          { value: 'blank', label: 'Blank Screen' },
          { value: 'text', label: '3D Text' },
        ],
        values.screenSaver,
        (v) => (values.screenSaver = v),
      ),
      h(
        'div',
        { class: 'field-row' },
        h('span', {}, 'Wait:'),
        h('input', {
          type: 'number',
          min: 1,
          max: 120,
          value: values.saverMinutes,
          style: { width: '50px' },
          oninput: (e) => (values.saverMinutes = Math.max(1, Math.min(120, +e.target.value))),
        }),
        h('span', {}, 'minutes'),
        button('Preview', () => sys.startSaver(values.screenSaver)),
      ),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Energy saving features of monitor'),
      h('p', {}, 'Set idle behavior for this desktop.'),
      button('Settings...', () => sys.launch('power')),
    ),
  );
  const sample = h(
    'div',
    {
      class: 'appearance-sample',
      style: {
        background: values.desktopColor,
        padding: '15px 20px',
        height: '145px',
        position: 'relative',
      },
    },
    h(
      'div',
      { class: 'raised', style: { padding: '3px', marginTop: '10px' } },
      h(
        'div',
        {
          class: 'title-bar',
          style: { background: 'linear-gradient(90deg,#0a246a,#a6caf0)', color: '#fff' },
        },
        'Active Window',
      ),
      h(
        'div',
        { style: { padding: '11px' } },
        'Window Text',
        h('br'),
        button('OK', () => {}, { style: { marginTop: '8px' } }),
      ),
    ),
  );
  const appearance = h(
    'div',
    {},
    sample,
    field(
      'Scheme:',
      select(
        [
          { value: 'standard', label: 'Windows Standard' },
          { value: 'highcontrast', label: 'High Contrast' },
          { value: 'desert', label: 'Desert' },
          { value: 'lilac', label: 'Lilac' },
          { value: 'spruce', label: 'Spruce' },
        ],
        values.theme,
        (v) => {
          values.theme = v;
          sample.className = 'appearance-sample theme-' + v;
        },
      ),
    ),
    h('p', {}, 'The scheme changes window, menu, and dialog colors.'),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Effects'),
      checkbox(
        'Show window contents while dragging',
        values.dragFullWindows !== false,
        (v) => (values.dragFullWindows = v),
      ),
      checkbox('Reduce animations', values.reducedMotion, (v) => (values.reducedMotion = v)),
    ),
  );
  const settings = h(
    'div',
    {},
    monitor(),
    h('p', {}, 'Display:'),
    h('p', {}, 'Browser Display Adapter'),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Screen area'),
      h('p', {}, `${innerWidth} by ${innerHeight} pixels`),
      h('p', {}, `${screen.colorDepth}-bit color`),
      button('Use Full Screen', () =>
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement
              .requestFullscreen()
              .catch((e) => sys.dialogs.message(e.message)),
      ),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Graphics acceleration'),
      select(
        [
          { value: 'auto', label: 'Automatic (WebGPU → WebGL 2 → Canvas 2D)' },
          { value: 'webgl', label: 'WebGL 2 (with Canvas 2D fallback)' },
          { value: 'canvas', label: 'Canvas 2D' },
        ],
        values.renderer,
        (v) => (values.renderer = v),
      ),
    ),
  );
  win.content.append(
    h(
      'div',
      { class: 'dialog-content', style: { padding: '8px' } },
      tabs([
        { label: 'Background', content: background },
        { label: 'Screen Saver', content: saver },
        { label: 'Appearance', content: appearance },
        { label: 'Settings', content: settings },
      ]),
      applyButtons(win, () => {
        sys.settings.update(values);
      }),
    ),
  );
  preview();
  return win;
}

export function createDateTime(sys) {
  const win = propertyWindow(sys, 'Date/Time Properties', 'clock', 410, 382);
  let chosen = new Date(Date.now() + sys.settings.get('clockOffset')),
    zone = sys.settings.get('timezone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const calendar = h('div', { class: 'calendar-grid' }),
    clock = h('canvas', { width: 120, height: 120 }),
    time = h('input', { type: 'time', step: 1, value: chosen.toTimeString().slice(0, 8) });
  const month = select(
      Array.from({ length: 12 }, (_, i) => ({
        value: String(i),
        label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
      })),
      String(chosen.getMonth()),
      (v) => {
        chosen.setMonth(+v);
        render();
      },
    ),
    year = h('input', {
      type: 'number',
      min: 1980,
      max: 2099,
      value: chosen.getFullYear(),
      style: { width: '64px' },
      onchange: (e) => {
        chosen.setFullYear(+e.target.value);
        render();
      },
    });
  const render = () => {
    calendar.replaceChildren();
    for (const day of ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
      calendar.append(h('span', { class: 'day-heading' }, day));
    const first = new Date(chosen.getFullYear(), chosen.getMonth(), 1).getDay(),
      days = new Date(chosen.getFullYear(), chosen.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) calendar.append(h('span'));
    for (let d = 1; d <= days; d++)
      calendar.append(
        button(
          String(d),
          () => {
            chosen.setDate(d);
            render();
          },
          { class: d === chosen.getDate() ? 'today' : '' },
        ),
      );
    drawClock();
  };
  const drawClock = () => {
    const ctx = clock.getContext('2d'),
      now = new Date(Date.now() + sys.settings.get('clockOffset'));
    ctx.clearRect(0, 0, 120, 120);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(60, 60, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.fillStyle = '#000';
      ctx.fillRect(60 + Math.sin(a) * 46 - 1, 60 - Math.cos(a) * 46 - 1, 3, 3);
    }
    const hand = (a, l, w, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(60, 60);
      ctx.lineTo(60 + Math.sin(a) * l, 60 - Math.cos(a) * l);
      ctx.stroke();
    };
    hand((((now.getHours() % 12) + now.getMinutes() / 60) * Math.PI) / 6, 27, 4, '#000');
    hand((now.getMinutes() * Math.PI) / 30, 40, 2, '#000');
    hand((now.getSeconds() * Math.PI) / 30, 43, 1, '#a00');
  };
  const dates = h(
    'div',
    { style: { display: 'grid', gridTemplateColumns: '190px 1fr', gap: '14px' } },
    h(
      'fieldset',
      {},
      h('legend', {}, 'Date'),
      h('div', { style: { display: 'flex', gap: '5px', marginBottom: '10px' } }, month, year),
      calendar,
    ),
    h('fieldset', {}, h('legend', {}, 'Time'), clock, time),
  );
  const zones = [
    ...new Set([
      zone,
      'UTC',
      'Europe/Warsaw',
      'Europe/London',
      'Europe/Berlin',
      'America/New_York',
      'America/Los_Angeles',
      'Asia/Tokyo',
      'Australia/Sydney',
    ]),
  ];
  const timezone = h(
    'div',
    {},
    h('p', {}, 'Select the time zone for the desktop clock.'),
    select(zones, zone, (v) => (zone = v)),
    h(
      'p',
      { style: { marginTop: '15px' } },
      'Daylight saving time follows the selected time zone. Changes apply to this browser desktop.',
    ),
  );
  win.content.append(
    h(
      'div',
      { class: 'dialog-content', style: { padding: '8px' } },
      tabs([
        { label: 'Date & Time', content: dates },
        { label: 'Time Zone', content: timezone },
      ]),
      applyButtons(win, () => {
        const [h, m, s] = time.value.split(':').map(Number);
        chosen.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
        sys.settings.update({ clockOffset: chosen.getTime() - Date.now(), timezone: zone });
      }),
    ),
  );
  const timer = setInterval(drawClock, 1000);
  win.onDispose(() => clearInterval(timer));
  render();
  return win;
}

export function createSystemProperties(sys) {
  const win = propertyWindow(sys, 'System Properties', 'computer', 435, 440);
  const cpu = navigator.hardwareConcurrency ?? 'Unavailable',
    deviceMemory = navigator.deviceMemory;
  const general = h(
    'div',
    { style: { display: 'flex', gap: '22px', padding: '9px' } },
    h(
      'div',
      {},
      icon('windows', 64),
      h(
        'div',
        { style: { marginTop: '13px', font: 'bold 20px Arial', color: '#35557a' } },
        'Windows',
        h('br'),
        h('span', { style: { color: '#7ca542', fontSize: '34px' } }, 'Me'),
      ),
    ),
    h(
      'div',
      { class: 'text-selectable' },
      h('p', {}, 'System:'),
      h(
        'p',
        {},
        'Microsoft Windows Me',
        h('br'),
        'Millennium Edition',
        h('br'),
        'Browser reimplementation',
      ),
      h('p', {}, 'Registered to:'),
      h('p', {}, sys.settings.get('userName'), h('br'), 'Millennium desktop'),
      h('p', {}, 'Computer:'),
      h(
        'p',
        {},
        `${cpu} logical processors`,
        h('br'),
        deviceMemory ? `${deviceMemory} GB reported device memory` : 'Device memory not reported',
        h('br'),
        `${sys.fs.persistent ? 'IndexedDB persistent' : 'Memory-only'} virtual drive`,
      ),
    ),
  );
  const devices = h(
    'div',
    {},
    h('p', {}, 'Browser devices and capabilities'),
    h(
      'ul',
      { class: 'classic-list sunken', style: { padding: '12px', lineHeight: '2.2' } },
      [
        `${navigator.gpu ? '✓' : '—'} WebGPU adapter API`,
        `${document.createElement('canvas').getContext('webgl2') ? '✓' : '—'} WebGL 2 renderer`,
        `${navigator.mediaDevices ? '✓' : '—'} Audio and video capture API`,
        `${globalThis.MediaRecorder ? '✓' : '—'} Media recording API`,
        `${navigator.getGamepads ? '✓' : '—'} Game controller API`,
        `${document.fullscreenEnabled ? '✓' : '—'} Full-screen API`,
      ].map((s) => h('li', {}, s)),
    ),
    h(
      'p',
      { style: { marginTop: '15px' } },
      'Physical devices and drivers are managed by the host operating system.',
    ),
  );
  const performance = h(
    'div',
    {},
    h('p', {}, 'Graphics surfaces'),
    h(
      'div',
      {
        class: 'sunken',
        style: {
          padding: '10px',
          whiteSpace: 'pre-wrap',
          font: '11px monospace',
          lineHeight: '1.7',
        },
      },
      [...sys.surfaces]
        .map((s) => {
          const d = s.diagnostics();
          return `${d.backend}: ${d.state}\n${d.resolution.join(' × ')} • ${d.frames} frames • ${d.computeDispatches} compute dispatches`;
        })
        .join('\n\n'),
    ),
    h(
      'p',
      { style: { marginTop: '13px' } },
      `${sys.wm.windows.size} open windows. ${sys.fs.nodes.size} filesystem entries.`,
    ),
    button('System Information...', () => sys.launch('sysinfo')),
  );
  win.content.append(
    h(
      'div',
      { class: 'dialog-content', style: { padding: '8px' } },
      tabs([
        { label: 'General', content: general },
        { label: 'Device Manager', content: devices },
        { label: 'Performance', content: performance },
      ]),
      h(
        'div',
        { class: 'button-row' },
        button('OK', () => win.close(), { class: 'default' }),
      ),
    ),
  );
  return win;
}

export function createSoundProperties(sys, args = {}) {
  const volumeControl = args.volumeOnly;
  const win = propertyWindow(
    sys,
    volumeControl ? 'Volume Control' : 'Sounds and Multimedia Properties',
    'sound',
    volumeControl ? 400 : 420,
    volumeControl ? 275 : 370,
  );
  let volume = sys.settings.get('volume'),
    enabled = sys.settings.get('sound');
  const slider = h('input', {
    type: 'range',
    min: 0,
    max: 100,
    value: volume,
    'aria-label': 'Master volume',
    oninput: (e) => {
      volume = +e.target.value;
      if (volumeControl) sys.settings.set('volume', volume);
    },
  });
  const sounds = h(
    'div',
    {},
    field(
      'Scheme:',
      select(
        [
          { value: 'enabled', label: 'Windows Default' },
          { value: 'disabled', label: 'No Sounds' },
        ],
        enabled ? 'enabled' : 'disabled',
        (v) => (enabled = v === 'enabled'),
      ),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Sound events'),
      h(
        'div',
        { class: 'classic-list sunken' },
        ['Start Windows', 'Exclamation', 'Default Beep', 'Game Win'].map((label, i) =>
          button(label, () => sys.sound.play(['startup', 'error', 'click', 'win'][i]), {
            style: {
              display: 'block',
              width: '100%',
              boxShadow: 'none',
              background: '#fff',
              textAlign: 'left',
            },
          }),
        ),
      ),
    ),
    h('p', {}, 'Click a sound event to preview its browser edition sound.'),
  );
  const audio = h(
    'div',
    {},
    h(
      'fieldset',
      {},
      h('legend', {}, 'Sound playback'),
      h('p', {}, 'Preferred device: Browser default audio output'),
      field('Volume:', slider),
      checkbox('Mute', !enabled, (v) => {
        enabled = !v;
        if (volumeControl) sys.settings.set('sound', enabled);
      }),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Sound recording'),
      h('p', {}, 'Recording devices are selected by your browser.'),
      button('Sound Recorder...', () => sys.launch('sound-recorder')),
    ),
  );
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      volumeControl
        ? audio
        : tabs([
            { label: 'Sounds', content: sounds },
            { label: 'Audio', content: audio },
          ]),
      applyButtons(win, () => sys.settings.update({ volume, sound: enabled })),
    ),
  );
  return win;
}

export function createFolderOptions(sys) {
  const win = propertyWindow(sys, 'Folder Options', 'folder', 385, 330);
  let hidden = sys.settings.get('showHidden'),
    extensions = sys.settings.get('showExtensions'),
    single = sys.settings.get('singleClick') ?? false;
  const general = h(
    'div',
    {},
    h(
      'fieldset',
      {},
      h('legend', {}, 'Click items as follows'),
      checkbox('Single-click to open an item', single, (v) => (single = v)),
      h('p', {}, 'When turned off, double-click desktop and folder icons to open them.'),
    ),
  );
  const view = h(
    'div',
    {},
    h(
      'fieldset',
      {},
      h('legend', {}, 'Files and Folders'),
      checkbox('Show hidden files and folders', hidden, (v) => (hidden = v)),
      checkbox('Hide file extensions for known file types', !extensions, (v) => (extensions = !v)),
    ),
  );
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      tabs([
        { label: 'General', content: general },
        { label: 'View', content: view },
      ]),
      applyButtons(win, () =>
        sys.settings.update({
          showHidden: hidden,
          showExtensions: extensions,
          singleClick: single,
        }),
      ),
    ),
  );
  return win;
}

export function createSimpleApplet(sys, args = {}) {
  const id = args.id,
    title = applets.find((a) => a[0] === id)?.[1] ?? 'Properties',
    ico = applets.find((a) => a[0] === id)?.[2] ?? 'control';
  const win = propertyWindow(sys, title + ' Properties', ico, 410, 355);
  let values = { ...sys.settings.values };
  const content = h('div', { style: { overflow: 'auto', flex: '1' } });
  const row = (label, key, input) => content.append(field(label, input));
  if (id === 'mouse') {
    content.append(
      h(
        'fieldset',
        {},
        h('legend', {}, 'Double-click speed'),
        h('p', {}, 'Use this setting for desktop icons.'),
        h(
          'div',
          { class: 'field-row' },
          'Slow',
          h('input', {
            type: 'range',
            min: 150,
            max: 900,
            value: 1050 - values.doubleClickSpeed,
            oninput: (e) => (values.doubleClickSpeed = 1050 - +e.target.value),
          }),
          'Fast',
        ),
      ),
      field(
        'Pointer:',
        select(
          [
            { value: 'standard', label: 'Windows Standard' },
            { value: 'black', label: 'Windows Black' },
            { value: 'large', label: 'Windows Large' },
          ],
          values.cursor ?? 'standard',
          (v) => (values.cursor = v),
        ),
      ),
      h('p', {}, 'Pointer changes apply inside this desktop.'),
    );
  } else if (id === 'keyboard') {
    content.append(
      h('p', {}, 'Use your physical keyboard, or open the on-screen keyboard.'),
      field(
        'Language:',
        select(
          ['English (United States)', 'Polish', 'German', 'French'],
          values.keyboardLanguage ?? 'English (United States)',
          (v) => (values.keyboardLanguage = v),
        ),
      ),
      h('p', {}, 'The physical keyboard layout is controlled by your host system.'),
      button('On-Screen Keyboard', () => sys.launch('osk')),
      h(
        'fieldset',
        {},
        h('legend', {}, 'Test area'),
        h('input', {
          type: 'text',
          placeholder: 'Type here to test your keyboard',
          style: { width: '100%' },
        }),
      ),
    );
  } else if (id === 'regional') {
    content.append(
      field(
        'Locale:',
        select(
          ['en-US', 'pl-PL', 'de-DE', 'fr-FR', 'en-GB', 'ja-JP'],
          values.locale ?? 'en-US',
          (v) => (values.locale = v),
        ),
      ),
      checkbox('Use a 24-hour clock', values.clock24, (v) => (values.clock24 = v)),
      checkbox(
        'Display seconds in taskbar clock',
        values.showSeconds,
        (v) => (values.showSeconds = v),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, 'Samples'),
        h('p', {}, new Date().toLocaleDateString(values.locale ?? 'en-US')),
        h('p', {}, (1234567.89).toLocaleString(values.locale ?? 'en-US')),
      ),
    );
  } else if (id === 'accessibility') {
    content.append(
      h(
        'fieldset',
        {},
        h('legend', {}, 'Display'),
        checkbox(
          'Use High Contrast',
          values.theme === 'highcontrast',
          (v) => (values.theme = v ? 'highcontrast' : 'standard'),
        ),
        checkbox('Reduce motion', values.reducedMotion, (v) => (values.reducedMotion = v)),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, 'Keyboard'),
        button('On-Screen Keyboard', () => sys.launch('osk')),
      ),
      h(
        'p',
        {},
        'Menus, dialogs, text fields and games support keyboard navigation. Use Tab to move between controls and Enter to activate them.',
      ),
    );
  } else if (id === 'power') {
    content.append(
      field(
        'Power scheme:',
        select(
          ['Home/Office Desk', 'Portable/Laptop', 'Always On'],
          'Home/Office Desk',
          (v) => (values.powerScheme = v),
        ),
      ),
      h(
        'fieldset',
        {},
        h('legend', {}, 'When idle'),
        field(
          'Screen saver:',
          select(
            [
              { value: 'none', label: 'Never' },
              { value: 'blank', label: 'Blank Screen' },
              { value: 'stars', label: 'Starfield' },
            ],
            values.screenSaver,
            (v) => (values.screenSaver = v),
          ),
        ),
        field(
          'Wait (min):',
          h('input', {
            type: 'number',
            min: 1,
            max: 120,
            value: values.saverMinutes,
            oninput: (e) => (values.saverMinutes = Math.max(1, Math.min(120, +e.target.value))),
          }),
        ),
      ),
      h(
        'p',
        {},
        'These settings control the browser desktop. Host sleep, battery and hardware power remain controlled by your operating system.',
      ),
    );
  } else if (id === 'passwords') {
    content.append(
      icon('logoff', 32),
      field(
        'User name:',
        h('input', {
          value: values.userName,
          maxLength: 40,
          oninput: (e) => (values.userName = e.target.value.trim() || 'User'),
        }),
      ),
      h(
        'p',
        {},
        'Your name appears in the Start menu, games and document details. The site’s sign-in controls access; this local profile does not add a separate password.',
      ),
    );
  } else if (id === 'fonts') {
    content.append(
      h('p', {}, 'Installed browser font families'),
      h(
        'div',
        { class: 'classic-list sunken' },
        ['MS Sans Serif', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'].map(
          (f) =>
            h(
              'div',
              { style: { padding: '6px', fontFamily: f, fontSize: '15px' } },
              f + ' — AaBbYyZz',
            ),
        ),
      ),
      h(
        'p',
        { style: { marginTop: '12px' } },
        'The shell includes regular and bold bitmap-style MS Sans Serif. Other fonts use available system fonts.',
      ),
    );
  } else if (id === 'game-controllers') {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    content.append(
      h('p', {}, 'Connected game controllers'),
      h(
        'div',
        { class: 'inset-panel', style: { minHeight: '120px' } },
        pads.length
          ? pads.map((p) =>
              h('p', {}, p.id + ` (${p.buttons.length} buttons, ${p.axes.length} axes)`),
            )
          : 'No controllers detected. Press a button on a connected controller, then reopen this panel.',
      ),
      h(
        'p',
        {},
        'Games in this edition use keyboard, mouse, and touch controls. Controller button mapping is not implemented.',
      ),
    );
  } else if (id === 'printers') {
    content.append(
      icon('printer', 32),
      h('h3', { style: { marginTop: '12px' } }, 'Browser Print Service'),
      h(
        'p',
        {},
        'Use File > Print in Notepad, WordPad, Paint or Imaging to print through your browser.',
      ),
      button('Print Test Page', () =>
        sys.printText(
          'Windows Millennium Edition\n\nPrinter Test Page\n\n' + new Date().toLocaleString(),
          'Printer Test Page',
        ),
      ),
      h(
        'p',
        { style: { marginTop: '18px' } },
        'Printer drivers and queues are provided by your host operating system.',
      ),
    );
  }
  win.content.append(
    h(
      'div',
      { class: 'dialog-content' },
      content,
      applyButtons(win, () => sys.settings.update(values)),
    ),
  );
  return win;
}
