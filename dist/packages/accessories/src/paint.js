import { h, button, field, select, download } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';
import { History, clamp } from '../../core/src/index.js';
import { basename, dirname } from '../../filesystem/src/index.js';

export function floodFill(image, x, y, replacement, tolerance = 0) {
  const { width, height, data } = image;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const start = (y * width + x) * 4,
    target = Array.from(data.slice(start, start + 4));
  if (target.every((v, i) => v === replacement[i])) return false;
  const matches = (i) =>
    Math.abs(data[i] - target[0]) <= tolerance &&
    Math.abs(data[i + 1] - target[1]) <= tolerance &&
    Math.abs(data[i + 2] - target[2]) <= tolerance &&
    Math.abs(data[i + 3] - target[3]) <= tolerance;
  const seen = new Uint8Array(width * height),
    stack = [y * width + x];
  while (stack.length) {
    const pixel = stack.pop();
    if (seen[pixel]) continue;
    seen[pixel] = 1;
    const i = pixel * 4;
    if (!matches(i)) continue;
    data.set(replacement, i);
    const px = pixel % width,
      py = Math.floor(pixel / width);
    if (px > 0) stack.push(pixel - 1);
    if (px < width - 1) stack.push(pixel + 1);
    if (py > 0) stack.push(pixel - width);
    if (py < height - 1) stack.push(pixel + width);
  }
  return true;
}
const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
  255,
];
const toBlob = (canvas, type = 'image/png') =>
  new Promise((resolve) => canvas.toBlob(resolve, type));

export function createPaint(sys, args = {}) {
  let path = args.path ?? null,
    dirty = false,
    tool = 'pencil',
    foreground = '#000000',
    background = '#ffffff',
    lineWidth = 1,
    shapeMode = 'outline',
    zoom = 1,
    selection = null,
    polygon = [],
    curve = null;
  const history = new History(24);
  const win = sys.createWindow({
    title: 'untitled - Paint',
    icon: 'paint',
    width: 740,
    height: 520,
    minWidth: 420,
    minHeight: 280,
  });
  const canvas = h('canvas', {
      width: 600,
      height: 350,
      'aria-label': 'Paint canvas',
      tabIndex: 0,
    }),
    overlay = h('canvas', { width: 600, height: 350, class: 'paint-overlay' }),
    ctx = canvas.getContext('2d', { willReadFrequently: true }),
    octx = overlay.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const paper = h('div', { class: 'paint-paper' }, canvas, overlay),
    workspace = h('div', { class: 'paint-workspace' }, paper),
    palette = h('div', { class: 'paint-palette' }),
    tools = h('div', { class: 'paint-tools' }),
    status = h(
      'footer',
      { class: 'status-bar' },
      h('span', {}, 'For Help, click Help Topics on the Help Menu.'),
      h('span', {}, '600 × 350'),
    );
  const toolDefs = [
    ['free-select', 'Free-Form Select', '⌁'],
    ['select', 'Select', '▧'],
    ['eraser', 'Eraser / Color Eraser', '▰'],
    ['fill', 'Fill With Color', '▨'],
    ['picker', 'Pick Color', '⌖'],
    ['magnifier', 'Magnifier', '⌕'],
    ['pencil', 'Pencil', '╱'],
    ['brush', 'Brush', '▣'],
    ['airbrush', 'Airbrush', '⁙'],
    ['text', 'Text', 'A'],
    ['line', 'Line', '╱'],
    ['curve', 'Curve', '∿'],
    ['rect', 'Rectangle', '□'],
    ['polygon', 'Polygon', '⬠'],
    ['ellipse', 'Ellipse', '○'],
    ['roundrect', 'Rounded Rectangle', '▢'],
  ];
  const updateTitle = () =>
    win.setTitle(`${dirty ? '*' : ''}${path ? basename(path) : 'untitled'} - Paint`);
  const snapshot = () => ctx.getImageData(0, 0, canvas.width, canvas.height);
  const resize = (width, height, preserve = true) => {
    width = clamp(Math.round(width), 1, 4096);
    height = clamp(Math.round(height), 1, 4096);
    const data = preserve ? snapshot() : null;
    canvas.width = overlay.width = width;
    canvas.height = overlay.height = height;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    if (data) ctx.putImageData(data, 0, 0);
    syncSize();
  };
  const syncSize = () => {
    paper.style.width = canvas.width * zoom + 'px';
    paper.style.height = canvas.height * zoom + 'px';
    status.children[1].textContent = `${canvas.width} × ${canvas.height}`;
  };
  const changed = () => {
    dirty = true;
    updateTitle();
    drawSelection();
  };
  const checkpoint = () => {
    history.push(snapshot());
    let bytes = history.past.reduce((sum, image) => sum + image.data.byteLength, 0);
    while (bytes > 67108864 && history.past.length > 1)
      bytes -= history.past.shift().data.byteLength;
  };
  const restore = (image) => {
    if (!image) return;
    resize(image.width, image.height, false);
    ctx.putImageData(image, 0, 0);
    selection = null;
    changed();
  };
  const undo = () => restore(history.undo(snapshot())),
    redo = () => restore(history.redo(snapshot()));
  const choose = (id) => {
    tool = id;
    selection = null;
    polygon = [];
    curve = null;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    for (const b of tools.querySelectorAll('[data-tool]'))
      b.classList.toggle('pressed', b.dataset.tool === id);
    workspace.style.cursor =
      {
        text: 'text',
        picker: 'crosshair',
        magnifier: 'zoom-in',
        select: 'crosshair',
        'free-select': 'crosshair',
      }[id] ?? 'crosshair';
    status.children[0].textContent = toolDefs.find((d) => d[0] === id)?.[1] ?? id;
  };
  for (const [id, label, glyph] of toolDefs) {
    const btn = button(glyph, () => choose(id), {
      class: 'paint-tool',
      title: label,
      'aria-label': label,
      dataset: { tool: id },
    });
    tools.append(btn);
  }
  tools.append(
    h(
      'div',
      { class: 'paint-tool-options' },
      select(['1', '2', '3', '5', '8', '12'], String(lineWidth), (v) => (lineWidth = +v)),
      select(
        [
          { value: 'outline', label: 'Outline' },
          { value: 'fill', label: 'Fill' },
          { value: 'both', label: 'Both' },
        ],
        shapeMode,
        (v) => (shapeMode = v),
      ),
    ),
  );
  const swatch = h(
    'div',
    { class: 'paint-swatches' },
    h('span', { class: 'paint-bg' }),
    h('span', { class: 'paint-fg' }),
  );
  palette.append(swatch);
  const colors = [
    '#000000',
    '#808080',
    '#800000',
    '#808000',
    '#008000',
    '#008080',
    '#000080',
    '#800080',
    '#808040',
    '#004040',
    '#0080ff',
    '#004080',
    '#4000ff',
    '#804000',
    '#ffffff',
    '#c0c0c0',
    '#ff0000',
    '#ffff00',
    '#00ff00',
    '#00ffff',
    '#0000ff',
    '#ff00ff',
    '#ffff80',
    '#00ff80',
    '#80ffff',
    '#8080ff',
    '#ff0080',
    '#ff8040',
  ];
  const colorGrid = h('div', { class: 'paint-colors' });
  for (const color of colors) {
    const c = button(
      '',
      () => {
        foreground = color;
        updateColors();
      },
      { title: color, 'aria-label': 'Color ' + color, style: { background: color } },
    );
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      background = color;
      updateColors();
    });
    colorGrid.append(c);
  }
  palette.append(
    colorGrid,
    h('input', {
      type: 'color',
      value: foreground,
      title: 'Edit Colors',
      oninput: (e) => {
        foreground = e.target.value;
        updateColors();
      },
    }),
  );
  const updateColors = () => {
    swatch.querySelector('.paint-fg').style.background = foreground;
    swatch.querySelector('.paint-bg').style.background = background;
  };
  const selectionPath = (context, s) => {
    context.beginPath();
    if (s.polygon) {
      s.polygon.forEach((p, i) =>
        i ? context.lineTo(s.x + p.x, s.y + p.y) : context.moveTo(s.x + p.x, s.y + p.y),
      );
      context.closePath();
    } else context.rect(s.x + 0.5, s.y + 0.5, s.width, s.height);
  };
  const drawSelection = () => {
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (selection) {
      octx.setLineDash([3, 3]);
      selectionPath(octx, selection);
      octx.strokeStyle = '#000';
      octx.stroke();
      octx.strokeStyle = '#fff';
      octx.lineDashOffset = 3;
      octx.stroke();
      octx.lineDashOffset = 0;
      octx.setLineDash([]);
    }
  };
  const selectionPixels = (s) => {
    if (!s.polygon) return ctx.getImageData(s.x, s.y, s.width, s.height);
    const clipped = h('canvas', { width: s.width, height: s.height }),
      c = clipped.getContext('2d');
    selectionPath(c, { ...s, x: 0, y: 0 });
    c.clip();
    c.drawImage(canvas, -s.x, -s.y);
    return c.getImageData(0, 0, s.width, s.height);
  };
  const clearSelected = (s) => {
    ctx.save();
    if (s.polygon) {
      selectionPath(ctx, s);
      ctx.clip();
    }
    ctx.fillStyle = background;
    ctx.fillRect(s.x, s.y, s.width, s.height);
    ctx.restore();
  };
  const placePixels = (pixels, x, y) => {
    const source = h('canvas', { width: pixels.width, height: pixels.height });
    source.getContext('2d').putImageData(pixels, 0, 0);
    ctx.drawImage(source, x, y);
  };
  const configure = (color) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = shapeMode === 'both' ? background : color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = tool === 'brush' ? 'round' : 'square';
    ctx.lineJoin = 'round';
  };
  const drawShape = (a, b, color) => {
    configure(color);
    const x = Math.min(a.x, b.x),
      y = Math.min(a.y, b.y),
      w = Math.abs(a.x - b.x),
      hgt = Math.abs(a.y - b.y);
    ctx.beginPath();
    if (tool === 'line' || tool === 'curve') {
      ctx.moveTo(a.x + 0.5, a.y + 0.5);
      ctx.lineTo(b.x + 0.5, b.y + 0.5);
      ctx.stroke();
      return;
    }
    if (tool === 'ellipse') ctx.ellipse(x + w / 2, y + hgt / 2, w / 2, hgt / 2, 0, 0, Math.PI * 2);
    else if (tool === 'roundrect')
      ctx.roundRect(x + 0.5, y + 0.5, w, hgt, Math.min(12, w / 3, hgt / 3));
    else ctx.rect(x + 0.5, y + 0.5, w, hgt);
    if (shapeMode !== 'outline') ctx.fill();
    if (shapeMode !== 'fill') ctx.stroke();
  };
  const point = (e) => {
    const r = paper.getBoundingClientRect();
    return {
      x: clamp(Math.floor((e.clientX - r.left) / zoom), 0, canvas.width - 1),
      y: clamp(Math.floor((e.clientY - r.top) / zoom), 0, canvas.height - 1),
    };
  };
  const copySelection = () => {
    const s = selection ?? { x: 0, y: 0, width: canvas.width, height: canvas.height };
    sys.clipboard.image = selectionPixels(s);
  };
  const cutSelection = () => {
    copySelection();
    checkpoint();
    const s = selection ?? { x: 0, y: 0, width: canvas.width, height: canvas.height };
    clearSelected(s);
    selection = null;
    changed();
  };
  const pasteSelection = () => {
    const image = sys.clipboard.image;
    if (!image) return;
    checkpoint();
    if (image.width > canvas.width || image.height > canvas.height)
      resize(Math.max(image.width, canvas.width), Math.max(image.height, canvas.height));
    placePixels(image, 0, 0);
    selection = { x: 0, y: 0, width: image.width, height: image.height };
    tool = 'select';
    changed();
  };
  paper.addEventListener('contextmenu', (e) => e.preventDefault());
  paper.addEventListener('pointerdown', async (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    win.focus();
    const a = point(e),
      color = e.button === 2 ? background : foreground;
    let last = a,
      base,
      draggingSelection = false,
      moved = false,
      freePoints = [a];
    if (tool === 'picker') {
      const rgba = ctx.getImageData(a.x, a.y, 1, 1).data;
      foreground = '#' + [...rgba.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
      updateColors();
      choose('pencil');
      return;
    }
    if (tool === 'magnifier') {
      zoom = zoom === 1 ? 2 : zoom === 2 ? 4 : 1;
      syncSize();
      return;
    }
    if (tool === 'fill') {
      checkpoint();
      const image = snapshot();
      floodFill(image, a.x, a.y, rgb(color));
      ctx.putImageData(image, 0, 0);
      changed();
      return;
    }
    if (tool === 'text') {
      const text = await sys.dialogs.prompt('Enter text to place in the picture.', '', {
        title: 'Text',
        label: 'Text:',
      });
      if (text) {
        checkpoint();
        ctx.font = `${Math.max(12, lineWidth * 4)}px Arial`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';
        text
          .split('\n')
          .forEach((line, i) => ctx.fillText(line, a.x, a.y + i * Math.max(14, lineWidth * 5)));
        changed();
      }
      return;
    }
    if (tool === 'polygon') {
      if (!polygon.length) checkpoint();
      polygon.push(a);
      configure(color);
      if (polygon.length > 1) {
        ctx.beginPath();
        ctx.moveTo(polygon.at(-2).x, polygon.at(-2).y);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
      }
      if (e.detail === 2 && polygon.length > 2) {
        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        for (const p of polygon) ctx.lineTo(p.x, p.y);
        ctx.closePath();
        if (shapeMode !== 'outline') ctx.fill();
        if (shapeMode !== 'fill') ctx.stroke();
        polygon = [];
      }
      changed();
      return;
    }
    if (tool === 'curve' && curve) {
      checkpoint();
      ctx.putImageData(curve.base, 0, 0);
      configure(color);
      ctx.beginPath();
      ctx.moveTo(curve.a.x, curve.a.y);
      if (curve.control) {
        ctx.bezierCurveTo(curve.control.x, curve.control.y, a.x, a.y, curve.b.x, curve.b.y);
        ctx.stroke();
        curve = null;
      } else {
        ctx.quadraticCurveTo(a.x, a.y, curve.b.x, curve.b.y);
        ctx.stroke();
        curve.control = a;
      }
      changed();
      return;
    }
    if (['select', 'free-select'].includes(tool)) {
      if (
        selection &&
        a.x >= selection.x &&
        a.x <= selection.x + selection.width &&
        a.y >= selection.y &&
        a.y <= selection.y + selection.height
      ) {
        checkpoint();
        const s = { ...selection };
        const pixels = selectionPixels(s);
        clearSelected(s);
        base = snapshot();
        draggingSelection = { original: s, pixels };
      } else {
        selection = null;
        drawSelection();
      }
    } else {
      checkpoint();
      base = snapshot();
      configure(color);
      if (['pencil', 'brush', 'eraser'].includes(tool)) {
        ctx.fillStyle = tool === 'eraser' ? background : color;
        const size =
          tool === 'eraser'
            ? Math.max(5, lineWidth * 3)
            : tool === 'brush'
              ? Math.max(3, lineWidth * 2)
              : lineWidth;
        ctx.fillRect(a.x - size / 2, a.y - size / 2, size, size);
      }
    }
    paper.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const b = point(ev);
      moved = true;
      status.children[0].textContent = `${b.x}, ${b.y} px`;
      if (draggingSelection) {
        ctx.putImageData(base, 0, 0);
        selection = {
          ...draggingSelection.original,
          x: clamp(
            draggingSelection.original.x + b.x - a.x,
            0,
            canvas.width - draggingSelection.original.width,
          ),
          y: clamp(
            draggingSelection.original.y + b.y - a.y,
            0,
            canvas.height - draggingSelection.original.height,
          ),
        };
        placePixels(draggingSelection.pixels, selection.x, selection.y);
        drawSelection();
      } else if (tool === 'select' || tool === 'free-select') {
        freePoints.push(b);
        const points = tool === 'free-select' ? freePoints : [a, b],
          x = Math.min(...points.map((p) => p.x)),
          y = Math.min(...points.map((p) => p.y));
        selection = {
          x,
          y,
          width: Math.max(...points.map((p) => p.x)) - x + 1,
          height: Math.max(...points.map((p) => p.y)) - y + 1,
        };
        if (tool === 'free-select')
          selection.polygon = points.map((p) => ({ x: p.x - x, y: p.y - y }));
        drawSelection();
      } else if (['pencil', 'brush', 'eraser'].includes(tool)) {
        configure(tool === 'eraser' ? background : color);
        ctx.lineWidth =
          tool === 'eraser'
            ? Math.max(5, lineWidth * 3)
            : tool === 'brush'
              ? Math.max(3, lineWidth * 2)
              : lineWidth;
        ctx.beginPath();
        ctx.moveTo(last.x + 0.5, last.y + 0.5);
        ctx.lineTo(b.x + 0.5, b.y + 0.5);
        ctx.stroke();
      } else if (tool === 'airbrush') {
        ctx.fillStyle = color;
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2,
            r = Math.random() * Math.max(8, lineWidth * 3);
          ctx.fillRect(
            Math.round(b.x + Math.cos(angle) * r),
            Math.round(b.y + Math.sin(angle) * r),
            1,
            1,
          );
        }
      } else {
        ctx.putImageData(base, 0, 0);
        drawShape(a, b, color);
      }
      last = b;
    };
    const end = () => {
      paper.removeEventListener('pointermove', move);
      paper.removeEventListener('pointerup', end);
      paper.removeEventListener('pointercancel', end);
      paper.removeEventListener('lostpointercapture', end);
      if (tool === 'curve' && moved) curve = { a, b: last, base };
      if ((tool !== 'select' && tool !== 'free-select') || draggingSelection) changed();
    };
    paper.addEventListener('pointermove', move);
    paper.addEventListener('pointerup', end, { once: true });
    paper.addEventListener('pointercancel', end, { once: true });
    paper.addEventListener('lostpointercapture', end, { once: true });
  });
  const load = async (p) => {
    try {
      const image = await createImageBitmap(sys.fs.readFile(p, 'blob'));
      resize(image.width, image.height, false);
      ctx.drawImage(image, 0, 0);
      image.close();
      path = p;
      history.clear();
      selection = null;
      dirty = false;
      updateTitle();
    } catch (e) {
      await sys.dialogs.message(
        'Paint cannot open this file. The image format may not be supported by this browser.',
        { title: 'Paint' },
      );
    }
  };
  const save = async (as = false) => {
    try {
      let target = path;
      if (!target || as)
        target = await sys.dialogs.file({
          mode: 'save',
          path: path ? dirname(path) : 'C:\\My Documents\\My Pictures',
          filename: path ? basename(path).replace(/\.[^.]*$/, '.png') : 'untitled.png',
          typeLabel: 'PNG (*.png)',
        });
      if (!target) return false;
      if (!/\.png$/i.test(target)) target = target.replace(/\.[^\\.]+$/, '') + '.png';
      const blob = await toBlob(canvas);
      if (!blob) throw new Error('The image could not be encoded.');
      await sys.fs.writeFile(target, new Uint8Array(await blob.arrayBuffer()), 'image/png');
      path = target;
      dirty = false;
      updateTitle();
      return true;
    } catch (e) {
      await sys.dialogs.message(e.message, { title: 'Paint' });
      return false;
    }
  };
  const check = async () => {
    if (!dirty) return true;
    const choice = await sys.dialogs.message(
      'Save changes to ' + (path ? basename(path) : 'untitled') + '?',
      { title: 'Paint', buttons: ['Yes', 'No', 'Cancel'] },
    );
    return choice === 'Yes' ? save() : choice === 'No';
  };
  const open = async () => {
    if (!(await check())) return;
    const p = await sys.dialogs.file({
      extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'svg'],
      typeLabel: 'Picture Files',
    });
    if (p) await load(p);
  };
  const fresh = async () => {
    if (await check()) {
      path = null;
      history.clear();
      selection = null;
      resize(600, 350, false);
      dirty = false;
      updateTitle();
    }
  };
  const attributes = () => {
    const dlg = sys.wm.create({
      title: 'Attributes',
      width: 320,
      height: 225,
      resizable: false,
      center: true,
      modal: true,
    });
    const width = h('input', { type: 'number', min: 1, max: 4096, value: canvas.width }),
      height = h('input', { type: 'number', min: 1, max: 4096, value: canvas.height });
    dlg.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        h('p', {}, 'Image size in pixels. Maximum: 4096 × 4096.'),
        field('Width:', width),
        field('Height:', height),
        h(
          'div',
          { class: 'button-row' },
          button('OK', () => {
            checkpoint();
            resize(+width.value, +height.value);
            changed();
            dlg.close();
          }),
          button('Cancel', () => dlg.close()),
        ),
      ),
    );
  };
  const transform = async (mode) => {
    checkpoint();
    const tmp = h('canvas', { width: canvas.width, height: canvas.height });
    tmp.getContext('2d').drawImage(canvas, 0, 0);
    if (mode === 'rotate') {
      resize(tmp.height, tmp.width, false);
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(tmp, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else if (mode === 'horizontal') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tmp, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else if (mode === 'vertical') {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
      ctx.drawImage(tmp, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else if (mode === 'invert') {
      const data = snapshot();
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i] = 255 - data.data[i];
        data.data[i + 1] = 255 - data.data[i + 1];
        data.data[i + 2] = 255 - data.data[i + 2];
      }
      ctx.putImageData(data, 0, 0);
    }
    selection = null;
    changed();
  };
  win.menu([
    {
      label: 'File',
      items: [
        { label: 'New', shortcut: 'Ctrl+N', action: fresh },
        { label: 'Open...', shortcut: 'Ctrl+O', action: open },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => save() },
        { label: 'Save As...', action: () => save(true) },
        '-',
        {
          label: 'Export PNG...',
          action: async () =>
            download(await toBlob(canvas), path ? basename(path) : 'untitled.png'),
        },
        {
          label: 'Print...',
          action: () =>
            sys.printHTML(`<img style="max-width:100%" src="${canvas.toDataURL()}">`, 'Paint'),
        },
        {
          label: 'Set As Wallpaper',
          action: async () => {
            if (await save()) {
              sys.settings.update({ wallpaper: path, wallpaperStyle: 'stretch' });
            }
          },
        },
        '-',
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Edit',
      items: () => [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: undo, disabled: !history.past.length },
        { label: 'Repeat', shortcut: 'Ctrl+Y', action: redo, disabled: !history.future.length },
        '-',
        { label: 'Cut', shortcut: 'Ctrl+X', action: cutSelection },
        { label: 'Copy', shortcut: 'Ctrl+C', action: copySelection },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          action: pasteSelection,
          disabled: !sys.clipboard.image,
        },
        {
          label: 'Clear Selection',
          shortcut: 'Del',
          action: () => {
            checkpoint();
            const s = selection ?? { x: 0, y: 0, width: canvas.width, height: canvas.height };
            clearSelected(s);
            changed();
          },
        },
        {
          label: 'Select All',
          shortcut: 'Ctrl+A',
          action: () => {
            tool = 'select';
            selection = { x: 0, y: 0, width: canvas.width, height: canvas.height };
            drawSelection();
          },
        },
      ],
    },
    {
      label: 'View',
      items: () => [
        { label: 'Tool Box', checked: !tools.hidden, action: () => (tools.hidden = !tools.hidden) },
        {
          label: 'Color Box',
          checked: !palette.hidden,
          action: () => (palette.hidden = !palette.hidden),
        },
        {
          label: 'Status Bar',
          checked: !status.hidden,
          action: () => (status.hidden = !status.hidden),
        },
        '-',
        {
          label: 'Zoom',
          children: [1, 2, 4, 8].map((value) => ({
            label: value * 100 + '%',
            checked: zoom === value,
            action: () => {
              zoom = value;
              syncSize();
            },
          })),
        },
        {
          label: 'View Bitmap',
          action: () => {
            const w = sys.wm.create({
              title: 'View Bitmap',
              icon: 'paint',
              width: Math.min(canvas.width + 6, innerWidth),
              height: Math.min(canvas.height + 30, innerHeight - 28),
            });
            w.content.append(
              h('img', {
                src: canvas.toDataURL(),
                style: { width: '100%', height: '100%', objectFit: 'contain', background: '#fff' },
              }),
            );
          },
        },
      ],
    },
    {
      label: 'Image',
      items: [
        {
          label: 'Flip/Rotate',
          children: [
            { label: 'Flip Horizontal', action: () => transform('horizontal') },
            { label: 'Flip Vertical', action: () => transform('vertical') },
            { label: 'Rotate 90°', action: () => transform('rotate') },
          ],
        },
        {
          label: 'Stretch/Skew...',
          action: () => {
            const dlg = sys.wm.create({
              title: 'Stretch and Skew',
              width: 320,
              height: 275,
              modal: true,
              center: true,
              resizable: false,
            });
            const sx = h('input', { type: 'number', value: 100, min: 1, max: 500 }),
              sy = h('input', { type: 'number', value: 100, min: 1, max: 500 }),
              ax = h('input', { type: 'number', value: 0, min: -80, max: 80 }),
              ay = h('input', { type: 'number', value: 0, min: -80, max: 80 });
            dlg.content.append(
              h(
                'div',
                { class: 'dialog-content' },
                h(
                  'fieldset',
                  {},
                  h('legend', {}, 'Stretch (%)'),
                  field('Horizontal:', sx),
                  field('Vertical:', sy),
                ),
                h(
                  'fieldset',
                  {},
                  h('legend', {}, 'Skew (degrees)'),
                  field('Horizontal:', ax),
                  field('Vertical:', ay),
                ),
                h(
                  'div',
                  { class: 'button-row' },
                  button('OK', () => {
                    const values = [+sx.value, +sy.value, +ax.value, +ay.value];
                    if (
                      values.some((v) => !Number.isFinite(v)) ||
                      values[0] < 1 ||
                      values[0] > 500 ||
                      values[1] < 1 ||
                      values[1] > 500 ||
                      Math.abs(values[2]) > 80 ||
                      Math.abs(values[3]) > 80
                    ) {
                      sys.dialogs.message(
                        'Use stretch values from 1 to 500 and skew angles from −80 to 80.',
                      );
                      return;
                    }
                    const a = values[0] / 100,
                      d = values[1] / 100,
                      b = Math.tan((values[3] * Math.PI) / 180) * a,
                      c = Math.tan((values[2] * Math.PI) / 180) * d,
                      corners = [
                        [0, 0],
                        [canvas.width, 0],
                        [0, canvas.height],
                        [canvas.width, canvas.height],
                      ].map(([x, y]) => [a * x + c * y, b * x + d * y]),
                      minX = Math.min(...corners.map((p) => p[0])),
                      minY = Math.min(...corners.map((p) => p[1])),
                      w = Math.ceil(Math.max(...corners.map((p) => p[0])) - minX),
                      height = Math.ceil(Math.max(...corners.map((p) => p[1])) - minY);
                    if (w > 4096 || height > 4096) {
                      sys.dialogs.message('The transformed image would exceed 4096 × 4096 pixels.');
                      return;
                    }
                    checkpoint();
                    const source = h('canvas', { width: canvas.width, height: canvas.height });
                    source.getContext('2d').drawImage(canvas, 0, 0);
                    resize(w, height, false);
                    ctx.imageSmoothingEnabled = false;
                    ctx.setTransform(a, b, c, d, -minX, -minY);
                    ctx.drawImage(source, 0, 0);
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    selection = null;
                    changed();
                    dlg.close();
                  }),
                  button('Cancel', () => dlg.close()),
                ),
              ),
            );
          },
        },
        { label: 'Invert Colors', shortcut: 'Ctrl+I', action: () => transform('invert') },
        { label: 'Attributes...', shortcut: 'Ctrl+E', action: attributes },
        {
          label: 'Clear Image',
          action: () => {
            checkpoint();
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            selection = null;
            changed();
          },
        },
      ],
    },
    {
      label: 'Colors',
      items: [
        {
          label: 'Edit Colors...',
          action: () => palette.querySelector('input[type=color]').click(),
        },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Help Topics', action: () => sys.launch('help', { topic: 'paint' }) },
        {
          label: 'About Paint',
          action: () =>
            sys.dialogs.message(
              'Paint\nDrawing, selections, shapes and image editing.\n\nMillennium browser edition.',
              { title: 'About Paint', icon: 'paint' },
            ),
        },
      ],
    },
  ]);
  win.content.append(h('div', { class: 'paint-main' }, tools, workspace), palette, status);
  win.beforeClose = check;
  win.element.addEventListener(
    'keydown',
    (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        const actions = {
          z: undo,
          y: redo,
          s: () => save(e.shiftKey),
          o: open,
          n: fresh,
          c: copySelection,
          x: cutSelection,
          v: pasteSelection,
          a: () => {
            tool = 'select';
            selection = { x: 0, y: 0, width: canvas.width, height: canvas.height };
            drawSelection();
          },
          i: () => transform('invert'),
          e: attributes,
        };
        if (actions[e.key.toLowerCase()]) {
          e.preventDefault();
          actions[e.key.toLowerCase()]();
        }
      }
      if (e.key === 'Escape') {
        selection = null;
        polygon = [];
        curve = null;
        drawSelection();
      }
    },
    { signal: win.signal },
  );
  syncSize();
  updateColors();
  choose('pencil');
  if (path) load(path);
  win.canvas = canvas;
  return win;
}
