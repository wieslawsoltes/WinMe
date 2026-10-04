import { h, button, download } from '../../ui/src/dom.js';
import { basename, dirname } from '../../filesystem/src/index.js';

export function createSoundRecorder(sys, args = {}) {
  const win = sys.createWindow({
    title: 'Sound - Sound Recorder',
    icon: 'sound',
    width: 385,
    height: 235,
    resizable: false,
  });
  let session = null,
    starting = false,
    generation = 0,
    blob,
    path = args.path ?? null,
    url,
    length = 0,
    dirty = false;
  let playbackSource, playbackAnalyser;
  const audio = h('audio'),
    wave = h('canvas', { width: 340, height: 65, class: 'recorder-wave' });
  const ctx = wave.getContext('2d'),
    position = h('span', {}, 'Position: 0.00 sec.'),
    duration = h('span', {}, 'Length: 0.00 sec.');
  const slider = h('input', {
      type: 'range',
      min: 0,
      max: 1000,
      value: 0,
      'aria-label': 'Position',
    }),
    info = h('span', {}, 'Ready');
  const updateTitle = () =>
    win.setTitle((dirty ? '*' : '') + (path ? basename(path) : 'Sound') + ' - Sound Recorder');
  const assignBlob = (value) => {
    blob = value;
    URL.revokeObjectURL(url);
    url = URL.createObjectURL(value);
    audio.src = url;
  };
  const paint = () => {
    if (win.state === 'minimized' || document.hidden) return;
    const active = session?.recorder.state === 'recording';
    const analyser = active ? session.analyser : !audio.paused ? playbackAnalyser : null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 340, 65);
    ctx.strokeStyle = '#00e800';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (analyser) {
      const samples = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(samples);
      for (let x = 0; x < 340; x++) {
        const y = (samples[Math.floor((x * samples.length) / 340)] / 255) * 65;
        if (x) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    } else {
      ctx.moveTo(0, 32);
      ctx.lineTo(340, 32);
    }
    ctx.stroke();
    const current = active ? (Date.now() - session.started) / 1000 : audio.currentTime || 0;
    if (active) length = current;
    position.textContent = `Position: ${current.toFixed(2)} sec.`;
    duration.textContent = `Length: ${Number.isFinite(length) ? length.toFixed(2) : '0.00'} sec.`;
    slider.value = length ? String((current / length) * 1000) : '0';
  };
  const stop = async () => {
    audio.pause();
    if (starting) {
      generation++;
      starting = false;
    }
    const job = session;
    if (job && job.recorder.state !== 'inactive') job.recorder.stop();
    if (job) await job.completed;
    info.textContent = 'Ready';
  };
  const save = async (as = false) => {
    await stop();
    if (!blob) {
      sys.dialogs.message('There is no sound to save.', { title: 'Sound Recorder' });
      return false;
    }
    const ext = blob.type.includes('ogg')
      ? 'ogg'
      : blob.type.includes('mp4')
        ? 'm4a'
        : blob.type.includes('wav')
          ? 'wav'
          : 'webm';
    let dest = path;
    if (!dest || as)
      dest = await sys.dialogs.file({
        mode: 'save',
        path: path ? dirname(path) : 'C:\\My Documents\\My Music',
        filename: path ? basename(path) : 'Sound.' + ext,
        typeLabel: 'Audio File (*.' + ext + ')',
      });
    if (!dest) return false;
    await sys.fs.writeFile(dest, new Uint8Array(await blob.arrayBuffer()), blob.type);
    path = dest;
    dirty = false;
    updateTitle();
    return true;
  };
  const guard = async () => {
    await stop();
    if (!dirty) return true;
    const choice = await sys.dialogs.message('Save changes to this sound?', {
      title: 'Sound Recorder',
      buttons: ['Yes', 'No', 'Cancel'],
    });
    return choice === 'Yes' ? save() : choice === 'No';
  };
  const load = async (p) => {
    await stop();
    generation++;
    assignBlob(sys.fs.readFile(p, 'blob'));
    path = p;
    dirty = false;
    length = 0;
    updateTitle();
  };
  const record = async () => {
    if (starting || session) return;
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      sys.dialogs.message('Microphone recording is not available in this browser.', {
        title: 'Sound Recorder',
      });
      return;
    }
    if (!(await guard()) || win.closed || starting || session) return;
    starting = true;
    const token = ++generation;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== generation || win.closed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined),
        chunks = [];
      const context = sys.sound.context();
      let source, analyser;
      if (context) {
        source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
      }
      const job = { recorder, stream, source, analyser, started: Date.now(), completed: null };
      job.completed = new Promise((resolve) => {
        recorder.addEventListener('dataavailable', (event) => {
          if (event.data.size) chunks.push(event.data);
        });
        recorder.addEventListener(
          'stop',
          () => {
            source?.disconnect();
            stream.getTracks().forEach((t) => t.stop());
            if (token === generation && !win.closed) {
              assignBlob(new Blob(chunks, { type: recorder.mimeType }));
              length = (Date.now() - job.started) / 1000;
              path = null;
              dirty = true;
              updateTitle();
            }
            if (session === job) session = null;
            resolve();
          },
          { once: true },
        );
        recorder.addEventListener(
          'error',
          (event) => {
            info.textContent = event.error?.message ?? 'Recording failed.';
            stream.getTracks().forEach((t) => t.stop());
          },
          { once: true },
        );
      });
      session = job;
      recorder.start(250);
      info.textContent = 'Recording from your microphone...';
    } catch (error) {
      stream?.getTracks().forEach((t) => t.stop());
      session = null;
      if (!win.closed) sys.dialogs.message(error.message, { title: 'Sound Recorder' });
    } finally {
      if (token === generation) starting = false;
    }
  };
  const play = async () => {
    await stop();
    if (!blob) {
      info.textContent = 'Record or open a sound first.';
      return;
    }
    try {
      if (!playbackSource) {
        const context = sys.sound.context();
        if (context) {
          playbackSource = context.createMediaElementSource(audio);
          playbackAnalyser = context.createAnalyser();
          playbackAnalyser.fftSize = 1024;
          playbackSource.connect(playbackAnalyser);
          playbackAnalyser.connect(context.destination);
        }
      }
      await audio.play();
      info.textContent = 'Playing';
    } catch (error) {
      sys.dialogs.message(error.message, { title: 'Sound Recorder' });
    }
  };
  const fresh = async () => {
    if (!(await guard())) return;
    generation++;
    blob = null;
    path = null;
    dirty = false;
    URL.revokeObjectURL(url);
    audio.removeAttribute('src');
    audio.load();
    length = 0;
    updateTitle();
  };
  const open = async () => {
    if (!(await guard())) return;
    const p = await sys.dialogs.file({
      extensions: ['wav', 'mp3', 'ogg', 'webm', 'm4a'],
      typeLabel: 'Sound Files',
    });
    if (p) await load(p);
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New', action: fresh },
        { label: 'Open...', action: open },
        { label: 'Save', action: () => save() },
        { label: 'Save As...', action: () => save(true) },
        {
          label: 'Export...',
          action: async () => {
            await stop();
            if (blob)
              download(
                blob,
                basename(
                  path ??
                    'Sound.' +
                      (blob.type.includes('ogg')
                        ? 'ogg'
                        : blob.type.includes('mp4')
                          ? 'm4a'
                          : 'webm'),
                ),
              );
          },
        },
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        {
          label: 'Audio Properties',
          action: () =>
            sys.dialogs.message(
              `Format: ${blob?.type ?? 'No recording'}\nSize: ${blob?.size ?? 0} bytes\nLength: ${length.toFixed(2)} seconds`,
              { title: 'Audio Properties', icon: 'sound' },
            ),
        },
      ],
    },
    {
      label: 'Effects',
      items: [
        {
          label: 'Increase Speed',
          action: () => (audio.playbackRate = Math.min(4, audio.playbackRate * 1.25)),
        },
        {
          label: 'Decrease Speed',
          action: () => (audio.playbackRate = Math.max(0.25, audio.playbackRate / 1.25)),
        },
        { label: 'Normal Speed', action: () => (audio.playbackRate = 1) },
        {
          label: 'Increase Volume',
          action: () => (audio.volume = Math.min(1, audio.volume + 0.1)),
        },
        {
          label: 'Decrease Volume',
          action: () => (audio.volume = Math.max(0, audio.volume - 0.1)),
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'About Sound Recorder',
          action: () =>
            sys.dialogs.message(
              'Record from a microphone, play sounds and save recordings. The waveform shows actual audio samples. Recording format depends on browser codec support. Speed and volume effects affect playback.',
              { title: 'About Sound Recorder', icon: 'sound' },
            ),
        },
      ],
    },
  ]);
  slider.addEventListener('input', () => {
    if (length && !session) audio.currentTime = (+slider.value / 1000) * length;
  });
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration)) length = audio.duration;
  });
  audio.addEventListener('ended', () => (info.textContent = 'Ready'));
  win.content.append(
    h(
      'div',
      { class: 'recorder-body' },
      h('div', { class: 'recorder-stats' }, position, duration),
      wave,
      slider,
      h(
        'div',
        { class: 'recorder-controls' },
        button('◀◀', () => (audio.currentTime = 0), { title: 'Seek to Start' }),
        button(
          '▶▶',
          () => {
            if (Number.isFinite(audio.duration))
              audio.currentTime = Math.max(0, audio.duration - 0.05);
          },
          { title: 'Seek to End' },
        ),
        button('▶', play, { title: 'Play' }),
        button('■', stop, { title: 'Stop' }),
        button('●', record, { title: 'Record', style: { color: '#d00000' } }),
      ),
      info,
    ),
  );
  const interval = setInterval(paint, 80);
  win.beforeClose = guard;
  win.onDispose(() => {
    generation++;
    starting = false;
    audio.pause();
    if (session?.recorder.state !== 'inactive') {
      try {
        session?.recorder.stop();
      } catch {}
    }
    session?.stream.getTracks().forEach((t) => t.stop());
    playbackSource?.disconnect();
    playbackAnalyser?.disconnect();
    clearInterval(interval);
    URL.revokeObjectURL(url);
  });
  if (path) load(path);
  paint();
  return win;
}
