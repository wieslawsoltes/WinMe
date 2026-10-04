import { h, button, select, pickFiles, download } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';
import { basename, extension } from '../../filesystem/src/index.js';
import { Surface } from '../../renderer/src/index.js';

const timeLabel = (n) =>
  Number.isFinite(n)
    ? Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0')
    : '0:00';

export function createMediaPlayer(sys, args = {}) {
  const win = sys.createWindow({
    title: 'Windows Media Player',
    icon: 'media',
    width: 680,
    height: 475,
    minWidth: 450,
    minHeight: 300,
  });
  let files = [],
    index = 0,
    mode = 'Now Playing',
    visual = 'plasma',
    shuffle = false,
    repeat = false,
    compact = false,
    urls = [],
    analyser,
    source,
    raf,
    analyzerData;
  const media = h('video', { preload: 'metadata', playsInline: true, class: 'wmp-video' }),
    canvas = h('canvas', { class: 'wmp-canvas', 'aria-label': 'Music visualization' }),
    surfaceHost = h('div', { class: 'wmp-display' }, canvas, media);
  let surface;
  const nav = h('nav', { class: 'wmp-nav', 'aria-label': 'Media Player sections' }),
    screen = h('div', { class: 'wmp-screen' }),
    playlist = h('div', { class: 'wmp-playlist' }),
    library = h('div', { class: 'wmp-library', hidden: true }),
    metadata = h(
      'div',
      { class: 'wmp-metadata' },
      h('span', {}, 'Windows Media Player'),
      h('span', {}, '0:00'),
    );
  const seek = h('input', {
      type: 'range',
      min: 0,
      max: 1000,
      value: 0,
      'aria-label': 'Seek',
      oninput: (e) => {
        if (Number.isFinite(media.duration))
          media.currentTime = (+e.target.value / 1000) * media.duration;
      },
    }),
    volume = h('input', {
      type: 'range',
      min: 0,
      max: 100,
      value: sys.settings.get('volume'),
      'aria-label': 'Volume',
      oninput: (e) => {
        media.volume = +e.target.value / 100;
      },
    });
  const playButton = button('▶', () => toggle(), {
      class: 'wmp-play',
      title: 'Play',
      'aria-label': 'Play',
    }),
    stopButton = button(
      '■',
      () => {
        media.pause();
        media.currentTime = 0;
      },
      { class: 'wmp-stop', title: 'Stop' },
    );
  const status = h('footer', { class: 'status-bar' }, h('span', {}, 'Ready'), h('span', {}, ''));
  const refreshLibrary = () => {
    files = sys.fs
      .walk('C:\\My Documents')
      .filter((n) => /^(mp3|wav|ogg|m4a|aac|flac|mp4|webm|ogv)$/i.test(extension(n.path)));
    renderPlaylist();
  };
  const renderPlaylist = () => {
    playlist.replaceChildren(h('div', { class: 'wmp-playlist-title' }, 'Playlist'));
    for (const [i, file] of files.entries()) {
      const row = button(file.name.replace(/\.[^.]+$/, ''), () => load(i, true), {
        class: 'wmp-track' + (i === index ? ' selected' : ''),
      });
      playlist.append(row);
    }
    if (!files.length)
      playlist.append(
        h(
          'div',
          { style: { padding: '10px', lineHeight: '1.7' } },
          'Add music or video files to your library.',
        ),
      );
  };
  const announce = (text) => (status.children[0].textContent = text);
  const connectAudio = () => {
    if (source) return;
    try {
      const context = sys.sound.context();
      if (!context) return;
      source = context.createMediaElementSource(media);
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(context.destination);
      analyzerData = new Uint8Array(analyser.frequencyBinCount);
    } catch {}
  };
  const play = async () => {
    if (!media.src) {
      if (files.length) await load(index, false);
      else {
        await addFiles();
        return;
      }
    }
    connectAudio();
    try {
      await media.play();
      announce('Playing');
    } catch (e) {
      announce(e.message || 'This file cannot be played in this browser.');
    }
  };
  const toggle = () => (media.paused ? play() : media.pause());
  const load = async (i, autoplay = false) => {
    if (!files[i]) return;
    index = i;
    media.pause();
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    const url = URL.createObjectURL(sys.fs.readFile(files[i].path, 'blob'));
    urls.push(url);
    media.src = url;
    const video = /^(mp4|webm|ogv)$/i.test(extension(files[i].path));
    media.hidden = !video;
    surface?.pause(video);
    if (surface) surface.canvas.hidden = video;
    metadata.children[0].textContent = files[i].name.replace(/\.[^.]+$/, '');
    win.setTitle('Windows Media Player');
    renderPlaylist();
    announce('Ready');
    if (autoplay) await play();
  };
  const next = (direction = 1) => {
    if (!files.length) return;
    const at = shuffle
      ? Math.floor(Math.random() * files.length)
      : (index + direction + files.length) % files.length;
    load(at, true);
  };
  const addFiles = async () => {
    const imported = await pickFiles({ accept: 'audio/*,video/*', multiple: true });
    if (!imported.length) return;
    try {
      const paths = await sys.fs.importFiles(imported, 'C:\\My Documents\\My Music');
      refreshLibrary();
      index = files.findIndex((f) => f.path === paths[0]);
      await load(index, true);
    } catch (e) {
      sys.dialogs.message(e.message, { title: 'Windows Media Player' });
    }
  };
  const open = async () => {
    const path = await sys.dialogs.file({
      extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'mp4', 'webm'],
      typeLabel: 'Media Files',
    });
    if (path) {
      refreshLibrary();
      let i = files.findIndex((f) => f.path === path);
      if (i < 0) {
        files.push(sys.fs.stat(path));
        i = files.length - 1;
      }
      load(i, true);
    }
  };
  const openUrl = async () => {
    const url = await sys.dialogs.prompt(
      'Enter the address of an audio or video stream.',
      'https://',
      { title: 'Open URL', label: 'Open:' },
    );
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol))
        throw new Error('Use an HTTP or HTTPS media URL.');
      announce('Remote streams require CORS permission when audio visualization is active.');
      media.crossOrigin = 'anonymous';
      media.src = parsed.href;
      metadata.children[0].textContent = parsed.hostname;
      await play();
    } catch (e) {
      sys.dialogs.message(e.message, { title: 'Open URL' });
    }
  };
  const selectMode = (value) => {
    mode = value;
    for (const b of nav.children) b.classList.toggle('selected', b.textContent === value);
    const showing = value === 'Now Playing';
    surfaceHost.hidden = !showing;
    playlist.hidden = !showing;
    library.hidden = showing;
    if (showing) {
      surface?.invalidate();
      return;
    }
    library.replaceChildren();
    if (value === 'Media Library') {
      library.append(
        h('h2', {}, 'Media Library'),
        h('p', {}, `${files.length} media files`),
        button('Add to Library...', addFiles),
        h('hr'),
      );
      for (const [i, file] of files.entries())
        library.append(
          button(
            [icon('media', 16), file.name],
            () => {
              load(i, true);
              selectMode('Now Playing');
            },
            { class: 'wmp-library-track' },
          ),
        );
    } else if (value === 'Skin Chooser') {
      library.append(
        h('h2', {}, 'Skin Chooser'),
        h('p', {}, 'Choose a player view.'),
        button('Full Mode', () => {
          compact = false;
          chrome.classList.remove('compact');
          win.setBounds({ width: 680, height: 475 });
          selectMode('Now Playing');
        }),
        button('Compact Mode', () => {
          compact = true;
          chrome.classList.add('compact');
          win.setBounds({ width: 400, height: 245 });
          selectMode('Now Playing');
        }),
      );
    } else if (value === 'Radio Tuner') {
      library.append(
        h('h2', {}, 'Radio Tuner'),
        h('p', {}, 'Play an audio stream by entering its direct media address.'),
        button('Open Stream...', openUrl),
        h(
          'p',
          { class: 'wmp-subtle' },
          'The original station directory is not connected. Stream availability and playback formats depend on the provider and browser.',
        ),
      );
    } else if (value === 'CD Audio') {
      library.append(
        h('h2', {}, 'CD Audio'),
        h('p', {}, 'Add audio files from a disc or your computer to play them in Media Player.'),
        button('Add Audio Files...', addFiles),
        h(
          'p',
          { class: 'wmp-subtle' },
          'The browser does not provide direct audio-CD playback or ripping.',
        ),
      );
    } else if (value === 'Portable Device') {
      library.append(
        h('h2', {}, 'Portable Device'),
        h('p', {}, 'Export a media file to your computer, then copy it to your device.'),
        button(
          'Export Selected Track...',
          () => {
            if (files[index])
              download(sys.fs.readFile(files[index].path, 'blob'), files[index].name);
          },
          { disabled: !files[index] },
        ),
      );
    } else {
      library.append(
        h('h2', {}, 'Windows Media Guide'),
        h('p', {}, 'Your music, your movies, your player.'),
        h('hr'),
        button([icon('media', 32), 'Play your media'], () => selectMode('Media Library'), {
          class: 'wmp-guide-link',
        }),
        button([icon('folder', 32), 'Add music and video'], addFiles, { class: 'wmp-guide-link' }),
        button([icon('movie', 32), 'Make a movie'], () => sys.launch('moviemaker'), {
          class: 'wmp-guide-link',
        }),
      );
    }
  };
  for (const label of [
    'Now Playing',
    'Media Guide',
    'CD Audio',
    'Media Library',
    'Radio Tuner',
    'Portable Device',
    'Skin Chooser',
  ])
    nav.append(button(label, () => selectMode(label)));
  screen.append(surfaceHost, playlist, library);
  const controls = h(
    'div',
    { class: 'wmp-controls' },
    playButton,
    stopButton,
    h(
      'div',
      { class: 'wmp-transport' },
      seek,
      h(
        'div',
        { class: 'wmp-secondary-controls' },
        button('◀|', () => next(-1), { title: 'Previous' }),
        button(
          '◀',
          () => {
            media.currentTime = Math.max(0, media.currentTime - 5);
          },
          { title: 'Rewind' },
        ),
        button(
          '▶',
          () => {
            if (Number.isFinite(media.duration))
              media.currentTime = Math.min(media.duration, media.currentTime + 5);
          },
          { title: 'Fast Forward' },
        ),
        button('|▶', () => next(1), { title: 'Next' }),
        button(icon('sound', 16), () => (media.muted = !media.muted), { title: 'Mute' }),
        volume,
      ),
    ),
    button(
      '▧',
      () => {
        compact = !compact;
        chrome.classList.toggle('compact', compact);
        win.setBounds({ width: compact ? 400 : 680, height: compact ? 245 : 475 });
      },
      { class: 'wmp-skin-switch', title: 'Switch Mode' },
    ),
  );
  const chrome = h(
    'div',
    { class: 'wmp-chrome' },
    h(
      'div',
      { class: 'wmp-topline' },
      h('span', {}, 'WINDOWS MEDIA'),
      select(
        [
          { value: 'plasma', label: 'Ambience: Waves' },
          { value: 'spectrum', label: 'Bars and Waves' },
          { value: 'stars', label: 'Starfield' },
        ],
        visual,
        (v) => {
          visual = v;
          surface?.setEffect(v);
        },
      ),
      button('Playlist', () => (playlist.hidden = !playlist.hidden), { class: 'wmp-small-button' }),
    ),
    h('div', { class: 'wmp-center' }, nav, screen),
    metadata,
    controls,
  );
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'Open...', shortcut: 'Ctrl+O', action: open },
        { label: 'Open URL...', action: openUrl },
        { label: 'Add to Library...', action: addFiles },
        '-',
        {
          label: 'Export Track...',
          action: () => {
            if (files[index])
              download(sys.fs.readFile(files[index].path, 'blob'), files[index].name);
          },
        },
        { label: 'Close', action: () => win.close() },
      ],
    },
    {
      label: 'View',
      items: () => [
        {
          label: 'Full Mode',
          checked: !compact,
          action: () => {
            compact = false;
            chrome.classList.remove('compact');
            win.setBounds({ width: 680, height: 475 });
          },
        },
        {
          label: 'Compact Mode',
          checked: compact,
          action: () => {
            compact = true;
            chrome.classList.add('compact');
            win.setBounds({ width: 400, height: 245 });
          },
        },
        '-',
        {
          label: 'Visualizations',
          children: [
            { label: 'Ambience: Waves', action: () => surface?.setEffect('plasma') },
            { label: 'Bars and Waves', action: () => surface?.setEffect('spectrum') },
            { label: 'Starfield', action: () => surface?.setEffect('stars') },
          ],
        },
      ],
    },
    {
      label: 'Play',
      items: () => [
        { label: media.paused ? 'Play' : 'Pause', shortcut: 'Ctrl+P', action: toggle },
        {
          label: 'Stop',
          action: () => {
            media.pause();
            media.currentTime = 0;
          },
        },
        { label: 'Previous', action: () => next(-1) },
        { label: 'Next', action: () => next(1) },
        '-',
        { label: 'Shuffle', checked: shuffle, action: () => (shuffle = !shuffle) },
        { label: 'Repeat', checked: repeat, action: () => (repeat = !repeat) },
      ],
    },
    {
      label: 'Tools',
      items: [{ label: 'Options...', action: () => sys.launch('sound-properties') }],
    },
    {
      label: 'Help',
      items: [
        { label: 'Help Topics', action: () => sys.launch('help', { topic: 'media' }) },
        {
          label: 'About Windows Media Player',
          action: () =>
            sys.dialogs.message(
              'Windows Media Player 7 — browser edition\n\nLocal audio/video playback, playlists, library, visualizations and stream URLs. Codec support is supplied by your browser.\n\nGraphics: ' +
                (surface?.backendName ?? 'Initializing'),
              { title: 'About Windows Media Player', icon: 'media' },
            ),
        },
      ],
    },
  ]);
  win.content.append(chrome, status);
  surface = new Surface(canvas, {
    effect: visual,
    animated: true,
    preference: sys.settings.get('renderer'),
  });
  sys.surfaces.add(surface);
  surface.on('backend', (name) => (status.children[1].textContent = name));
  media.volume = sys.settings.get('volume') / 100;
  media.muted = !sys.settings.get('sound');
  media.hidden = true;
  sys.settings.on(
    'change',
    (values) => {
      if (values.volume !== undefined) {
        media.volume = values.volume / 100;
        volume.value = String(values.volume);
      }
      if (values.sound !== undefined) media.muted = !values.sound;
    },
    { signal: win.signal },
  );
  media.addEventListener('loadedmetadata', () => {
    const hasVideo = media.videoWidth > 0;
    media.hidden = !hasVideo;
    surface.canvas.hidden = hasVideo;
  });
  media.addEventListener('play', () => {
    playButton.textContent = 'Ⅱ';
    playButton.title = 'Pause';
    playButton.setAttribute('aria-label', 'Pause');
    announce('Playing');
  });
  media.addEventListener('pause', () => {
    playButton.textContent = '▶';
    playButton.title = 'Play';
    playButton.setAttribute('aria-label', 'Play');
    announce('Paused');
  });
  media.addEventListener('error', () =>
    announce('The media file could not be played. Check the format or stream address.'),
  );
  media.addEventListener('timeupdate', () => {
    seek.value =
      Number.isFinite(media.duration) && media.duration > 0
        ? String((media.currentTime / media.duration) * 1000)
        : '0';
    metadata.children[1].textContent = timeLabel(media.currentTime);
  });
  media.addEventListener('ended', () => {
    if (repeat) {
      media.currentTime = 0;
      play();
    } else if (index < files.length - 1 || shuffle) next();
  });
  const animate = () => {
    if (win.closed) return;
    if (analyser && !media.paused) {
      analyser.getByteFrequencyData(analyzerData);
      surface.amplitude = Math.max(
        0.12,
        analyzerData.reduce((sum, x) => sum + x, 0) / analyzerData.length / 110,
      );
    } else surface.amplitude = 0.15;
    surface.pause(
      win.state === 'minimized' ||
        document.hidden ||
        mode !== 'Now Playing' ||
        !media.hidden ||
        (media.paused && surface.frameCount > 0),
    );
    raf = requestAnimationFrame(animate);
  };
  raf = requestAnimationFrame(animate);
  win.onDispose(() => {
    media.pause();
    media.removeAttribute('src');
    media.load();
    for (const url of urls) URL.revokeObjectURL(url);
    cancelAnimationFrame(raf);
    source?.disconnect();
    analyser?.disconnect();
    surface.dispose();
    sys.surfaces.delete(surface);
  });
  sys.fs.on('change', refreshLibrary, { signal: win.signal });
  refreshLibrary();
  selectMode('Now Playing');
  if (args.path) {
    let i = files.findIndex((n) => n.path === args.path);
    if (i < 0) {
      files.push(sys.fs.stat(args.path));
      i = files.length - 1;
    }
    load(i, args.autoplay ?? false);
  } else if (files.length) load(0, false);
  return win;
}

export function makeSampleWav() {
  const rate = 22050,
    seconds = 14,
    count = rate * seconds,
    buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  const text = (offset, s) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + count * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, count * 2, true);
  const melody = [
    60, 64, 67, 72, 71, 67, 64, 62, 60, 64, 69, 72, 74, 71, 67, 64, 62, 65, 69, 74, 72, 69, 65, 62,
    60, 64, 67, 72,
  ];
  for (let i = 0; i < count; i++) {
    const t = i / rate,
      step = Math.floor(t * 2) % melody.length,
      phase = (t * 2) % 1,
      f = 440 * 2 ** ((melody[step] - 69) / 12),
      envelope = Math.min(1, phase * 16) * Math.exp(-phase * 2.5);
    const chord = [130.8128, 164.8138, 195.9977].reduce(
      (s, h) => s + Math.sin(2 * Math.PI * h * t) * 0.03,
      0,
    );
    const value =
      (Math.sin(2 * Math.PI * f * t) * 0.24 + Math.sin(2 * Math.PI * f * 2 * t) * 0.06) * envelope +
      chord;
    view.setInt16(44 + i * 2, clampAudio(value) * 32767, true);
  }
  return new Uint8Array(buffer);
}
const clampAudio = (n) => Math.max(-1, Math.min(1, n));
