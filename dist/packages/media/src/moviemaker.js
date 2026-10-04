import { h, button, field, pickFiles, download } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';
import { basename } from '../../filesystem/src/index.js';
import { uid } from '../../core/src/index.js';

export function createMovieMaker(sys, args = {}) {
  const win = sys.createWindow({
    title: 'Untitled - Windows Movie Maker',
    icon: 'movie',
    width: 850,
    height: 590,
    minWidth: 530,
    minHeight: 390,
  });
  let clips = [],
    collection = [],
    selected = -1,
    projectPath = args.path ?? null,
    playing = false,
    current = 0,
    urls = new Map(),
    exporting = false,
    raf = 0,
    loadedId = null,
    seekRequested = false,
    dirty = false;
  const video = h('video', { playsInline: true, preload: 'auto', style: { display: 'none' } }),
    image = h('img', { style: { display: 'none' } }),
    preview = h('canvas', { width: 640, height: 360, 'aria-label': 'Movie preview' }),
    ctx = preview.getContext('2d'),
    bins = h('div', { class: 'movie-collection' }),
    timeline = h('div', { class: 'movie-timeline', 'aria-label': 'Storyboard' }),
    time = h('span', {}, '0:00.00'),
    status = h('footer', { class: 'status-bar' }, h('span', {}, 'Ready'), h('span', {}, '0 clips'));
  const title = () => {
    dirty = true;
    win.setTitle((projectPath ? basename(projectPath) : 'Untitled') + ' * - Windows Movie Maker');
  };
  const duration = (clip) => Math.max(0.1, (clip.out ?? clip.duration ?? 5) - (clip.in ?? 0));
  const total = () => clips.reduce((sum, c) => sum + duration(c), 0);
  const sourceUrl = (path) => {
    if (!urls.has(path)) urls.set(path, URL.createObjectURL(sys.fs.readFile(path, 'blob')));
    return urls.get(path);
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
  const clipAt = (t) => {
    let offset = 0;
    for (const [index, clip] of clips.entries()) {
      const d = duration(clip);
      if (t < offset + d || index === clips.length - 1)
        return { clip, index, local: t - offset, offset };
      offset += d;
    }
    return null;
  };
  const draw = () => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 640, 360);
    const entry = clipAt(current);
    if (!entry) return;
    const clip = entry.clip;
    if (loadedId !== clip.id) {
      loadedId = clip.id;
      if (clip.kind === 'video') {
        video.src = sourceUrl(clip.path);
        video.currentTime = (clip.in ?? 0) + entry.local;
        video.muted = false;
        if (playing) video.play().catch(() => {});
      } else {
        video.pause();
        if (clip.kind === 'image') image.src = sourceUrl(clip.path);
      }
    }
    const source = clip.kind === 'video' ? video : clip.kind === 'image' ? image : null;
    if (source && (source.videoWidth || source.naturalWidth)) {
      const w = source.videoWidth || source.naturalWidth,
        ht = source.videoHeight || source.naturalHeight,
        scale = Math.min(640 / w, 360 / ht);
      ctx.drawImage(source, (640 - w * scale) / 2, (360 - ht * scale) / 2, w * scale, ht * scale);
    }
    if (clip.kind === 'title') {
      ctx.fillStyle = clip.color ?? '#143354';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px Arial';
      const lines = (clip.text ?? '').split('\n');
      lines.forEach((l, i) => ctx.fillText(l, 320, 160 + i * 45));
    }
    if (clip.caption) {
      ctx.fillStyle = '#0009';
      ctx.fillRect(0, 298, 640, 62);
      ctx.fillStyle = '#fff';
      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(clip.caption, 320, 337, 610);
    }
    time.textContent = fmt(current) + ' / ' + fmt(total());
  };
  let last = 0;
  const tick = (t) => {
    if (win.closed) return;
    if (playing && !exporting) {
      const dt = Math.min(0.1, (t - (last || t)) / 1000);
      current += dt;
      if (current >= total()) {
        current = 0;
        playing = false;
        video.pause();
        loadedId = null;
      }
      draw();
    }
    last = t;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const selectClip = (index) => {
    selected = index;
    current = clips.slice(0, index).reduce((sum, c) => sum + duration(c), 0);
    loadedId = null;
    render();
    draw();
  };
  const render = () => {
    timeline.replaceChildren();
    for (const [index, clip] of clips.entries()) {
      const card = button('', () => selectClip(index), {
        class: 'movie-clip' + (index === selected ? ' selected' : ''),
        draggable: true,
      });
      card.append(
        icon(clip.kind === 'title' ? 'wordpad' : clip.kind === 'image' ? 'paint' : 'movie', 32),
        h('strong', {}, clip.kind === 'title' ? clip.text : basename(clip.path)),
        h('span', {}, fmt(duration(clip))),
      );
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-millennium-clip', String(index));
      });
      card.addEventListener('dragover', (e) => e.preventDefault());
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData('application/x-millennium-clip'));
        if (Number.isInteger(from) && from >= 0 && from < clips.length) {
          const [moved] = clips.splice(from, 1);
          clips.splice(index, 0, moved);
          selected = index;
          title();
          render();
        }
      });
      timeline.append(card);
    }
    if (!clips.length)
      timeline.append(
        h(
          'div',
          { class: 'empty-message' },
          'Drag a clip from Collections to the storyboard, or double-click it.',
        ),
      );
    status.children[1].textContent = `${clips.length} clips · ${fmt(total())}`;
  };
  const add = (entry) => {
    clips.push({ ...entry, id: uid(), in: 0, out: entry.duration ?? 5 });
    selected = clips.length - 1;
    title();
    render();
    draw();
  };
  const renderCollection = () => {
    bins.replaceChildren();
    for (const entry of collection) {
      const item = button('', () => {}, { class: 'movie-bin-item', draggable: true });
      item.append(
        icon(entry.kind === 'image' ? 'paint' : 'movie', 32),
        h('span', {}, basename(entry.path)),
      );
      item.addEventListener('dblclick', () => add(entry));
      item.addEventListener('dragstart', (e) =>
        e.dataTransfer.setData('application/x-millennium-media', entry.path),
      );
      bins.append(item);
    }
  };
  timeline.addEventListener('dragover', (e) => e.preventDefault());
  timeline.addEventListener('drop', (e) => {
    e.preventDefault();
    const p = e.dataTransfer.getData('application/x-millennium-media');
    const entry = collection.find((c) => c.path === p);
    if (entry) add(entry);
  });
  const inspect = async (path) => {
    const node = sys.fs.stat(path),
      kind =
        node.mime?.startsWith('image/') || /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(path)
          ? 'image'
          : 'video';
    let length = 5;
    if (kind === 'video') {
      const probe = h('video', { preload: 'metadata', src: sourceUrl(path) });
      length = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(5), 5000);
        probe.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve(Number.isFinite(probe.duration) ? probe.duration : 5);
        };
        probe.onerror = () => {
          clearTimeout(timeout);
          resolve(5);
        };
      });
      probe.removeAttribute('src');
      probe.load();
    }
    return { path, kind, duration: length };
  };
  const imports = async () => {
    const files = await pickFiles({ accept: 'video/*,image/*', multiple: true });
    if (!files.length) return;
    status.children[0].textContent = 'Importing...';
    try {
      const paths = await sys.fs.importFiles(files, 'C:\\My Documents\\My Videos');
      for (const path of paths) collection.push(await inspect(path));
      title();
      renderCollection();
      status.children[0].textContent =
        'Double-click a collection item to add it to the storyboard.';
    } catch (e) {
      sys.dialogs.message(e.message, { title: 'Movie Maker' });
    }
  };
  const addFromDrive = async () => {
    const p = await sys.dialogs.file({
      extensions: ['mp4', 'webm', 'ogv', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
      typeLabel: 'Video and Pictures',
    });
    if (p) {
      const entry = await inspect(p);
      collection.push(entry);
      renderCollection();
      add(entry);
    }
  };
  const addTitle = async () => {
    const text = await sys.dialogs.prompt('Enter the title for your movie.', 'My Movie', {
      title: 'Title',
      label: 'Title:',
    });
    if (text) add({ kind: 'title', text, duration: 5, color: '#173a60' });
  };
  const editClip = () => {
    const clip = clips[selected];
    if (!clip) return;
    const dlg = sys.wm.create({
      title: 'Clip Properties',
      width: 380,
      height: 245,
      modal: true,
      center: true,
      resizable: false,
    });
    const start = h('input', { type: 'number', min: 0, step: 0.1, value: clip.in ?? 0 }),
      end = h('input', { type: 'number', min: 0.1, step: 0.1, value: clip.out ?? clip.duration }),
      caption = h('input', { value: clip.caption ?? '' });
    dlg.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        field('Start (sec):', start),
        field('End (sec):', end),
        field('Caption:', caption),
        h(
          'p',
          {},
          'Trim points refer to the original clip. Images and titles use the duration between Start and End.',
        ),
        h(
          'div',
          { class: 'button-row' },
          button('OK', () => {
            const a = +start.value,
              b = +end.value;
            if (
              a < 0 ||
              b <= a ||
              !Number.isFinite(b) ||
              (clip.kind === 'video' && b > clip.duration + 0.1)
            ) {
              sys.dialogs.message('Enter valid trim points within the clip duration.');
              return;
            }
            clip.in = a;
            clip.out = b;
            clip.caption = caption.value;
            title();
            loadedId = null;
            render();
            draw();
            dlg.close();
          }),
          button('Cancel', () => dlg.close()),
        ),
      ),
    );
  };
  const save = async (as = false) => {
    let p = projectPath;
    if (!p || as)
      p = await sys.dialogs.file({
        mode: 'save',
        filename: 'My Movie.mswmm',
        typeLabel: 'Movie Maker Project (*.mswmm)',
      });
    if (p) {
      await sys.fs.writeFile(
        p,
        JSON.stringify({ format: 'millennium-movie', version: 1, clips, collection }, null, 2),
        'application/json',
      );
      projectPath = p;
      dirty = false;
      win.setTitle(basename(p) + ' - Windows Movie Maker');
      return true;
    }
    return false;
  };
  const open = async (path) => {
    if (exporting) return;
    if (dirty) {
      const answer = await sys.dialogs.message('Save changes to this movie project?', {
        title: 'Movie Maker',
        buttons: ['Yes', 'No', 'Cancel'],
      });
      if (!answer || answer === 'Cancel' || (answer === 'Yes' && !(await save()))) return;
    }
    const p =
      typeof path === 'string'
        ? path
        : await sys.dialogs.file({ extensions: ['mswmm'], typeLabel: 'Movie Maker Projects' });
    if (p) {
      try {
        const data = JSON.parse(sys.fs.readFile(p));
        if (data.format !== 'millennium-movie' || data.version !== 1 || !Array.isArray(data.clips))
          throw new Error('This is not a Millennium Movie Maker project.');
        for (const clip of data.clips)
          if (
            !['title', 'image', 'video'].includes(clip.kind) ||
            !Number.isFinite(clip.out) ||
            !Number.isFinite(clip.in) ||
            clip.in < 0 ||
            clip.out <= clip.in ||
            (clip.kind !== 'title' && !sys.fs.exists(clip.path))
          )
            throw new Error('A clip is invalid or its source file is missing.');
        clips = data.clips;
        collection = Array.isArray(data.collection) ? data.collection : [];
        projectPath = p;
        dirty = false;
        selected = -1;
        current = 0;
        loadedId = null;
        renderCollection();
        render();
        draw();
        win.setTitle(basename(p) + ' - Windows Movie Maker');
      } catch (e) {
        sys.dialogs.message(e.message, { title: 'Open Project' });
      }
    }
  };
  const exportMovie = async () => {
    if (!clips.length || exporting) return;
    if (!canvasCaptureSupported()) {
      sys.dialogs.message('This browser cannot record a canvas to a video file.', {
        title: 'Save Movie',
      });
      return;
    }
    const type = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) {
      sys.dialogs.message('No supported video recording codec is available.', {
        title: 'Save Movie',
      });
      return;
    }
    const target = await sys.dialogs.file({
      mode: 'save',
      path: 'C:\\My Documents\\My Videos',
      filename: type.includes('mp4') ? 'My Movie.mp4' : 'My Movie.webm',
      typeLabel: 'Video File',
    });
    if (!target || exporting || win.closed) return;
    exporting = true;
    playing = false;
    video.pause();
    win.content.inert = true;
    const timelineCopy = structuredClone(clips),
      job = new AbortController(),
      signal = job.signal;
    const output = h('canvas', { width: 640, height: 360 }),
      outputContext = output.getContext('2d'),
      exportVideo = h('video', { playsInline: true, preload: 'auto' }),
      exportImage = h('img');
    const progress = sys.wm.create({
      title: 'Saving Movie',
      icon: 'movie',
      width: 365,
      height: 160,
      modal: true,
      center: true,
      resizable: false,
    });
    const progressText = h('p', {}, 'Preparing movie...'),
      meter = h('progress', { max: 100, value: 0, style: { width: '100%' } });
    progress.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        progressText,
        meter,
        h(
          'div',
          { class: 'button-row' },
          button('Cancel', () => job.abort()),
        ),
      ),
    );
    progress.beforeClose = () => {
      job.abort();
      return true;
    };
    const abortOnClose = () => job.abort();
    win.signal.addEventListener('abort', abortOnClose, { once: true });
    let stream, recorder, audioSource, destination, recordingError;
    const chunks = [];
    const waitReady = (element, event, predicate) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException('Export canceled.', 'AbortError'));
          return;
        }
        if (predicate()) {
          resolve();
          return;
        }
        const clear = () => {
          clearTimeout(timeout);
          element.removeEventListener(event, ready);
          element.removeEventListener('error', failed);
          signal.removeEventListener('abort', abort);
        };
        const ready = () => {
            clear();
            resolve();
          },
          failed = () => {
            clear();
            reject(new Error('A movie clip cannot be decoded by this browser.'));
          },
          abort = () => {
            clear();
            reject(new DOMException('Export canceled.', 'AbortError'));
          };
        const timeout = setTimeout(() => {
          clear();
          reject(new Error('Timed out while loading a movie clip.'));
        }, 15000);
        element.addEventListener(event, ready, { once: true });
        element.addEventListener('error', failed, { once: true });
        signal.addEventListener('abort', abort, { once: true });
      });
    const frame = (clip, source) => {
      outputContext.fillStyle = clip.kind === 'title' ? (clip.color ?? '#143354') : '#000';
      outputContext.fillRect(0, 0, 640, 360);
      if (source) {
        const w = source.videoWidth || source.naturalWidth,
          ht = source.videoHeight || source.naturalHeight;
        if (w && ht) {
          const scale = Math.min(640 / w, 360 / ht);
          outputContext.drawImage(
            source,
            (640 - w * scale) / 2,
            (360 - ht * scale) / 2,
            w * scale,
            ht * scale,
          );
        }
      }
      if (clip.kind === 'title') {
        outputContext.fillStyle = '#fff';
        outputContext.textAlign = 'center';
        outputContext.font = 'bold 36px Arial';
        (clip.text ?? '')
          .split('\n')
          .forEach((line, i) => outputContext.fillText(line, 320, 160 + i * 45, 620));
      }
      if (clip.caption) {
        outputContext.fillStyle = '#0009';
        outputContext.fillRect(0, 298, 640, 62);
        outputContext.fillStyle = '#fff';
        outputContext.font = '22px Arial';
        outputContext.textAlign = 'center';
        outputContext.fillText(clip.caption, 320, 337, 610);
      }
      ctx.drawImage(output, 0, 0);
    };
    try {
      stream = output.captureStream(30);
      const context = sys.sound.context();
      if (context) {
        destination = context.createMediaStreamDestination();
        audioSource = context.createMediaElementSource(exportVideo);
        audioSource.connect(destination);
        for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
      }
      recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3500000 });
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const completed = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.onerror = (e) => {
        recordingError = e.error ?? new Error('Movie recording failed.');
        job.abort();
      };
      let offset = 0;
      const movieLength = timelineCopy.reduce((n, c) => n + duration(c), 0);
      for (const [index, clip] of timelineCopy.entries()) {
        if (signal.aborted) throw new DOMException('Export canceled.', 'AbortError');
        if (recorder.state === 'recording') recorder.pause();
        exportVideo.pause();
        progressText.textContent = `Preparing clip ${index + 1} of ${timelineCopy.length}...`;
        let source = null;
        if (clip.kind === 'video') {
          exportVideo.src = sourceUrl(clip.path);
          exportVideo.load();
          await waitReady(exportVideo, 'loadeddata', () => exportVideo.readyState >= 2);
          exportVideo.currentTime = clip.in ?? 0;
          await waitReady(exportVideo, 'seeked', () => !exportVideo.seeking);
          source = exportVideo;
        } else if (clip.kind === 'image') {
          exportImage.src = sourceUrl(clip.path);
          await waitReady(
            exportImage,
            'load',
            () => exportImage.complete && exportImage.naturalWidth > 0,
          );
          source = exportImage;
        }
        frame(clip, source);
        if (signal.aborted) throw new DOMException('Export canceled.', 'AbortError');
        if (recorder.state === 'inactive') recorder.start(250);
        else recorder.resume();
        if (clip.kind === 'video') await exportVideo.play();
        progressText.textContent = `Saving clip ${index + 1} of ${timelineCopy.length}. Keep this tab visible.`;
        const started = performance.now();
        await new Promise((resolve, reject) => {
          let animation;
          const abort = () => {
            cancelAnimationFrame(animation);
            reject(new DOMException('Export canceled.', 'AbortError'));
          };
          signal.addEventListener('abort', abort, { once: true });
          const tick = (now) => {
            if (signal.aborted) return abort();
            const elapsed = Math.min(duration(clip), (now - started) / 1000);
            frame(clip, source);
            meter.value = ((offset + elapsed) / movieLength) * 100;
            if (elapsed >= duration(clip)) {
              signal.removeEventListener('abort', abort);
              resolve();
            } else animation = requestAnimationFrame(tick);
          };
          animation = requestAnimationFrame(tick);
        });
        exportVideo.pause();
        offset += duration(clip);
      }
      if (recorder.state !== 'inactive') recorder.stop();
      await completed;
      if (recordingError) throw recordingError;
      if (signal.aborted) throw new DOMException('Export canceled.', 'AbortError');
      const blob = new Blob(chunks, { type });
      await sys.fs.writeFile(target, new Uint8Array(await blob.arrayBuffer()), type);
      status.children[0].textContent = 'Movie saved to ' + target;
    } catch (error) {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      status.children[0].textContent =
        signal.aborted && !recordingError ? 'Export canceled.' : 'Export failed.';
      if ((!signal.aborted || recordingError) && !win.closed)
        sys.dialogs.message((recordingError ?? error).message, { title: 'Save Movie' });
    } finally {
      exportVideo.pause();
      exportVideo.removeAttribute('src');
      exportVideo.load();
      audioSource?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      win.signal.removeEventListener('abort', abortOnClose);
      win.content.inert = false;
      exporting = false;
      await sys.wm.close(progress.id, { force: true });
      current = 0;
      loadedId = null;
      if (!win.closed) draw();
    }
  };
  const canvasCaptureSupported = () => !!preview.captureStream && !!globalThis.MediaRecorder;
  const toggle = () => {
    if (exporting) return;
    if (!clips.length) {
      status.children[0].textContent = 'Add clips to the storyboard first.';
      return;
    }
    playing = !playing;
    last = 0;
    if (playing) {
      loadedId = null;
      draw();
      if (clipAt(current)?.clip.kind === 'video') video.play().catch(() => {});
    } else video.pause();
  };
  const newProject = async () => {
    if (dirty) {
      const answer = await sys.dialogs.message('Save changes to this movie project?', {
        title: 'Movie Maker',
        buttons: ['Yes', 'No', 'Cancel'],
      });
      if (!answer || answer === 'Cancel' || (answer === 'Yes' && !(await save()))) return;
    }
    clips = [];
    collection = [];
    selected = -1;
    projectPath = null;
    current = 0;
    dirty = false;
    playing = false;
    video.pause();
    win.setTitle('Untitled - Windows Movie Maker');
    render();
    renderCollection();
    draw();
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New Project', action: newProject },
        { label: 'Open Project...', action: () => open() },
        { label: 'Save Project', shortcut: 'Ctrl+S', action: () => save() },
        { label: 'Save Project As...', action: () => save(true) },
        '-',
        { label: 'Import...', action: imports },
        { label: 'Import from My Documents...', action: addFromDrive },
        { label: 'Save Movie...', action: exportMovie },
        '-',
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        {
          label: 'Delete Clip',
          action: () => {
            if (selected >= 0) {
              clips.splice(selected, 1);
              selected = -1;
              loadedId = null;
              title();
              render();
              draw();
            }
          },
        },
        { label: 'Clip Properties...', action: editClip },
        {
          label: 'Move Left',
          action: () => {
            if (selected > 0) {
              [clips[selected - 1], clips[selected]] = [clips[selected], clips[selected - 1]];
              selected--;
              title();
              render();
            }
          },
        },
        {
          label: 'Move Right',
          action: () => {
            if (selected >= 0 && selected < clips.length - 1) {
              [clips[selected + 1], clips[selected]] = [clips[selected], clips[selected + 1]];
              selected++;
              title();
              render();
            }
          },
        },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Play / Pause', action: toggle },
        {
          label: 'Rewind',
          action: () => {
            current = 0;
            loadedId = null;
            draw();
          },
        },
      ],
    },
    {
      label: 'Clip',
      items: [
        { label: 'Title...', action: addTitle },
        { label: 'Properties...', action: editClip },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'Movie Maker Help',
          action: () =>
            sys.dialogs.message(
              'Import videos or pictures, then double-click a collection item to add it to the storyboard. Drag clips to reorder them. Use Clip Properties to trim clips and add captions. Add title cards with Clip > Title.\n\nSave Project keeps an editable .mswmm JSON project. Save Movie records the edited timeline to a WebM or MP4 video in real time. Browser codec support applies. This is not the original Microsoft MSWMM file format.',
              { title: 'Movie Maker Help', icon: 'movie' },
            ),
        },
      ],
    },
  ]);
  const tools = h(
    'div',
    { class: 'toolbar' },
    button([icon('file', 16), 'New'], newProject, { class: 'tool-button' }),
    button([icon('folder', 16), 'Open'], () => open(), { class: 'tool-button' }),
    button([icon('floppy', 16), 'Save'], () => save(), { class: 'tool-button' }),
    h('div', { class: 'separator' }),
    button('Import', imports, { class: 'tool-button' }),
    button('Title', addTitle, { class: 'tool-button' }),
    button('Save Movie', exportMovie, { class: 'tool-button' }),
  );
  win.content.append(
    tools,
    h(
      'div',
      { class: 'movie-upper' },
      h(
        'aside',
        { class: 'movie-tasks' },
        h('h3', {}, 'Collections'),
        button([icon('folder', 16), 'My Collections'], renderCollection, { class: 'tree-item' }),
        h('hr'),
        button('Import video or pictures', imports),
        button('Add from My Documents', addFromDrive),
        button('Make titles', addTitle),
        button('Save movie', exportMovie),
      ),
      h(
        'section',
        { class: 'movie-bin' },
        h('div', { class: 'movie-section-title' }, 'Collections'),
        bins,
      ),
      h(
        'div',
        { class: 'movie-preview' },
        preview,
        h(
          'div',
          { class: 'movie-preview-controls' },
          button('◀◀', () => {
            current = 0;
            loadedId = null;
            draw();
          }),
          button('▶ / Ⅱ', toggle),
          button('■', () => {
            playing = false;
            current = 0;
            video.pause();
            loadedId = null;
            draw();
          }),
          time,
        ),
      ),
    ),
    h(
      'div',
      { class: 'movie-storyboard-title' },
      'Storyboard',
      button('Clip Properties', editClip, { class: 'tool-button' }),
    ),
    timeline,
    status,
  );
  video.addEventListener('loadeddata', draw);
  image.addEventListener('load', draw);
  win.onDispose(() => {
    playing = exporting = false;
    video.pause();
    cancelAnimationFrame(raf);
    for (const url of urls.values()) URL.revokeObjectURL(url);
  });
  win.beforeClose = async () => {
    if (exporting)
      return await sys.dialogs.confirm('Cancel export and close Movie Maker?', 'Movie Maker');
    if (!dirty) return true;
    const c = await sys.dialogs.message('Save changes to this movie project?', {
      title: 'Movie Maker',
      buttons: ['Yes', 'No', 'Cancel'],
    });
    return c === 'Yes' ? save() : c === 'No';
  };
  render();
  draw();
  if (projectPath) open(projectPath);
  return win;
}
