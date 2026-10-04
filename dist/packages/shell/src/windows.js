import { EventHub, clamp, uid } from '../../core/src/index.js';
import { h, button } from '../../ui/src/dom.js';
import { icon } from '../../ui/src/icons.js';

export class WindowManager extends EventHub {
  constructor(host, menus, settings) {
    super();
    this.settings = settings;
    this.host = host;
    this.menus = menus;
    this.windows = new Map();
    this.activeId = null;
    this.z = 100;
    this.counter = 0;
    this.abort = new AbortController();
    window.addEventListener('resize', () => this.reflow(), { signal: this.abort.signal });
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.altKey && e.key === 'F4') {
          e.preventDefault();
          this.active?.close();
        }
        if (e.altKey && e.key === 'Tab') {
          e.preventDefault();
          this.cycle(e.shiftKey ? -1 : 1);
        }
        if (e.altKey && e.code === 'Space') {
          e.preventDefault();
          if (this.active) this.systemMenu(this.active);
        }
      },
      { signal: this.abort.signal },
    );
  }
  get viewport() {
    return {
      width: this.host.clientWidth || innerWidth,
      height: this.host.clientHeight || innerHeight - 28,
    };
  }
  get active() {
    return this.windows.get(this.activeId);
  }
  create(options = {}) {
    const vp = this.viewport;
    const ordinal = this.counter++;
    const width = Math.min(options.width ?? 560, vp.width),
      height = Math.min(options.height ?? 380, vp.height);
    const x = options.center
      ? (vp.width - width) / 2
      : (options.x ?? Math.min(165 + (ordinal % 9) * 22, Math.max(0, vp.width - width - 20)));
    const y = options.center
      ? (vp.height - height) / 2
      : (options.y ?? Math.min(65 + (ordinal % 9) * 22, Math.max(0, vp.height - height - 20)));
    const life = new AbortController();
    const id = uid();
    const element = h('section', {
      class: 'window',
      role: options.modal ? 'dialog' : 'region',
      'aria-modal': options.modal ? 'true' : undefined,
      'aria-label': options.title ?? 'Application',
      tabIndex: -1,
      dataset: { windowId: id, appId: options.appId ?? '' },
    });
    const title = h('span', { class: 'title-text' }, options.title ?? 'Application');
    let titleIcon = icon(options.icon ?? 'windows', 16);
    const controls = h('div', { class: 'title-controls' });
    const content = h('div', { class: 'window-content' });
    const titleBar = h('header', { class: 'title-bar' }, titleIcon, title, controls);
    element.append(titleBar, content);
    const win = {
      id,
      element,
      content,
      titleBar,
      options,
      abort: life,
      signal: life.signal,
      title: options.title ?? 'Application',
      icon: options.icon ?? 'windows',
      appId: options.appId ?? '',
      bounds: { x, y, width, height },
      state: 'normal',
      restoreState: 'normal',
      restoreBounds: null,
      disposers: [],
      closed: false,
      setTitle: (text) => {
        win.title = text;
        title.textContent = text;
        element.setAttribute('aria-label', text);
        this.emit('change');
      },
      setIcon: (name) => {
        win.icon = name;
        const fresh = icon(name, 16);
        titleIcon.replaceWith(fresh);
        titleIcon = fresh;
        this.emit('change');
      },
      focus: () => this.focus(id),
      minimize: () => this.minimize(id),
      maximize: () => this.maximize(id),
      restore: () => this.restore(id),
      close: () => this.close(id),
      onDispose: (fn) => {
        win.disposers.push(fn);
        return fn;
      },
      setBounds: (b) => {
        win.bounds = { ...win.bounds, ...b };
        this.layout(win);
      },
      menu: (items) => {
        const bar = this.menus.bar(items);
        content.prepend(bar);
        return bar;
      },
      status: (...parts) => {
        const bar = h(
          'footer',
          { class: 'status-bar' },
          parts.map((p) => h('span', {}, p)),
        );
        content.append(bar);
        return bar;
      },
    };
    if (options.minimizable !== false && !options.modal)
      controls.append(
        button('', () => win.minimize(), {
          title: 'Minimize',
          'aria-label': 'Minimize',
          dataset: { control: 'minimize' },
        }),
      );
    if (options.resizable !== false && !options.modal)
      controls.append(
        button('', () => (win.state === 'maximized' ? win.restore() : win.maximize()), {
          title: 'Maximize',
          'aria-label': 'Maximize',
          dataset: { control: 'maximize' },
        }),
      );
    controls.append(
      button('', () => win.close(), {
        title: 'Close',
        'aria-label': 'Close',
        dataset: { control: 'close' },
      }),
    );
    element.addEventListener('pointerdown', () => this.focus(id), {
      capture: true,
      signal: life.signal,
    });
    titleBar.addEventListener(
      'dblclick',
      (e) => {
        if (e.target.closest('button') || options.resizable === false || options.modal) return;
        win.state === 'maximized' ? win.restore() : win.maximize();
      },
      { signal: life.signal },
    );
    titleBar.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
        this.systemMenu(win, e.clientX, e.clientY);
      },
      { signal: life.signal },
    );
    titleIcon.style.pointerEvents = 'auto';
    titleIcon.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.systemMenu(win);
      },
      { signal: life.signal },
    );
    titleBar.addEventListener('pointerdown', (e) => this.#drag(e, win), { signal: life.signal });
    if (options.resizable !== false)
      for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
        const handle = h('div', { class: 'resize-handle', dataset: { dir } });
        handle.addEventListener('pointerdown', (e) => this.#drag(e, win, dir), {
          signal: life.signal,
        });
        element.append(handle);
      }
    element.addEventListener(
      'keydown',
      (e) => {
        if (options.modal && e.key === 'Tab') {
          const tabbable = [
            ...element.querySelectorAll(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
            ),
          ].filter((n) => n.offsetParent !== null);
          const first = tabbable[0],
            last = tabbable.at(-1);
          if (
            e.shiftKey &&
            (document.activeElement === first || document.activeElement === element)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      },
      { signal: life.signal },
    );
    this.windows.set(id, win);
    this.host.append(element);
    this.layout(win);
    this.focus(id);
    this.emit('open', win);
    this.emit('change');
    return win;
  }
  layout(win) {
    const vp = this.viewport;
    let b = win.bounds;
    if (win.state === 'maximized') b = { x: 0, y: 0, width: vp.width, height: vp.height };
    else {
      b.width = Math.min(b.width, vp.width);
      b.height = Math.min(b.height, vp.height);
      b.x = clamp(b.x, Math.min(0, vp.width - b.width), Math.max(0, vp.width - 80));
      b.y = clamp(b.y, 0, Math.max(0, vp.height - 25));
    }
    Object.assign(win.element.style, {
      left: Math.round(b.x) + 'px',
      top: Math.round(b.y) + 'px',
      width: Math.round(b.width) + 'px',
      height: Math.round(b.height) + 'px',
    });
    win.element.classList.toggle('maximized', win.state === 'maximized');
    win.element.hidden = win.state === 'minimized';
    const max = win.element.querySelector('[data-control=maximize],[data-control=restore]');
    if (max) {
      max.dataset.control = win.state === 'maximized' ? 'restore' : 'maximize';
      max.title = win.state === 'maximized' ? 'Restore Down' : 'Maximize';
      max.setAttribute('aria-label', max.title);
    }
    win.onResize?.(b);
  }
  focus(id) {
    const win = this.windows.get(id);
    if (!win || win.closed) return;
    const modal = [...this.windows.values()]
      .filter((w) => w.options.modal && w.state !== 'minimized')
      .at(-1);
    if (modal && modal.id !== id) {
      modal.element.animate(
        [{ filter: 'brightness(1)' }, { filter: 'brightness(1.4)' }, { filter: 'brightness(1)' }],
        { duration: 160, iterations: 2 },
      );
      return this.focus(modal.id);
    }
    if (win.state === 'minimized') {
      win.state = win.restoreState;
      this.layout(win);
    }
    for (const w of this.windows.values()) w.element.classList.toggle('active', w.id === id);
    if (this.activeId !== id) {
      this.activeId = id;
      win.element.style.zIndex = ++this.z;
      this.emit('focus', win);
      this.emit('change');
    }
    if (!win.element.contains(document.activeElement)) win.element.focus({ preventScroll: true });
  }
  minimize(id) {
    const win = this.windows.get(id);
    if (!win || win.options.modal || win.state === 'minimized') return;
    win.restoreState = win.state;
    win.state = 'minimized';
    win.element.classList.remove('active');
    this.layout(win);
    if (this.activeId === id) this.#focusTop();
    this.emit('change');
  }
  maximize(id) {
    const win = this.windows.get(id);
    if (!win || win.options.resizable === false) return;
    if (win.state !== 'maximized') {
      win.restoreBounds = { ...win.bounds };
      win.state = 'maximized';
      this.layout(win);
      this.focus(id);
      this.emit('change');
    }
  }
  restore(id) {
    const win = this.windows.get(id);
    if (!win) return;
    if (win.state === 'minimized') win.state = win.restoreState;
    else if (win.state === 'maximized') {
      win.state = 'normal';
      if (win.restoreBounds) win.bounds = { ...win.restoreBounds };
    }
    this.layout(win);
    this.focus(id);
    this.emit('change');
  }
  async close(id, { force = false } = {}) {
    const win = this.windows.get(id);
    if (!win || win.closing) return false;
    win.closing = true;
    try {
      if (!force && (await win.beforeClose?.()) === false) return false;
      win.closed = true;
      win.abort.abort();
      for (const dispose of win.disposers.reverse()) {
        try {
          dispose();
        } catch (e) {
          console.error(e);
        }
      }
      win.element.remove();
      this.windows.delete(id);
      if (this.activeId === id) this.#focusTop();
      this.emit('close', win);
      this.emit('change');
      return true;
    } finally {
      win.closing = false;
    }
  }
  #focusTop() {
    this.activeId = null;
    const eligible = [...this.windows.values()]
      .filter((w) => w.state !== 'minimized')
      .sort((a, b) => +b.element.style.zIndex - +a.element.style.zIndex);
    if (eligible[0]) this.focus(eligible[0].id);
  }
  cycle(direction = 1) {
    const list = [...this.windows.keys()];
    if (list.length)
      this.focus(list[(list.indexOf(this.activeId) + direction + list.length) % list.length]);
  }
  reflow() {
    for (const win of this.windows.values()) this.layout(win);
  }
  showDesktop() {
    const visible = [...this.windows.values()].filter(
      (w) => w.state !== 'minimized' && !w.options.modal,
    );
    if (visible.length) {
      this.desktopHidden = visible.map((w) => w.id);
      for (const win of visible) this.minimize(win.id);
    } else {
      for (const id of this.desktopHidden ?? []) this.restore(id);
      this.desktopHidden = [];
    }
  }
  arrange(mode = 'cascade') {
    const visible = [...this.windows.values()].filter(
        (w) => w.state !== 'minimized' && !w.options.modal,
      ),
      vp = this.viewport;
    visible.forEach((w, i) => {
      w.state = 'normal';
      const count = visible.length;
      w.bounds =
        mode === 'cascade'
          ? {
              x: i * 24 + 5,
              y: i * 24 + 5,
              width: Math.max(250, vp.width * 0.65),
              height: Math.max(180, vp.height * 0.65),
            }
          : mode === 'vertical'
            ? { x: (i * vp.width) / count, y: 0, width: vp.width / count, height: vp.height }
            : { x: 0, y: (i * vp.height) / count, width: vp.width, height: vp.height / count };
      this.layout(w);
    });
    this.emit('change');
  }
  systemMenu(win, x, y) {
    const r = win.element.getBoundingClientRect();
    this.menus.show(x ?? r.left + 3, y ?? r.top + 21, [
      { label: 'Restore', action: () => win.restore(), disabled: win.state === 'normal' },
      { label: 'Move', action: () => this.#keyboardMove(win), disabled: win.state !== 'normal' },
      {
        label: 'Size',
        action: () => this.#keyboardMove(win, true),
        disabled: win.state !== 'normal' || win.options.resizable === false,
      },
      {
        label: 'Minimize',
        action: () => win.minimize(),
        disabled: win.options.modal || win.options.minimizable === false,
      },
      {
        label: 'Maximize',
        action: () => win.maximize(),
        disabled: win.state === 'maximized' || win.options.resizable === false,
      },
      '-',
      { label: 'Close', shortcut: 'Alt+F4', action: () => win.close() },
    ]);
  }
  #keyboardMove(win, resize = false) {
    win.focus();
    const original = { ...win.bounds };
    const handler = (e) => {
      if (e.key === 'Escape') {
        win.bounds = original;
        this.layout(win);
        win.element.removeEventListener('keydown', handler);
        return;
      }
      if (e.key === 'Enter') {
        win.element.removeEventListener('keydown', handler);
        return;
      }
      const vector = {
        ArrowLeft: [-10, 0],
        ArrowRight: [10, 0],
        ArrowUp: [0, -10],
        ArrowDown: [0, 10],
      }[e.key];
      if (!vector) return;
      e.preventDefault();
      if (resize) {
        win.bounds.width = Math.max(win.options.minWidth ?? 200, win.bounds.width + vector[0]);
        win.bounds.height = Math.max(win.options.minHeight ?? 120, win.bounds.height + vector[1]);
      } else {
        win.bounds.x += vector[0];
        win.bounds.y += vector[1];
      }
      this.layout(win);
    };
    win.element.addEventListener('keydown', handler, { signal: win.signal });
  }
  #drag(event, win, direction) {
    if (
      event.button !== 0 ||
      event.target.closest('button') ||
      (win.state === 'maximized' && direction)
    )
      return;
    if (!direction && event.target.tagName === 'IMG') return;
    event.preventDefault();
    this.menus.close();
    this.focus(win.id);
    if (this.activeId !== win.id) return;
    const target = event.currentTarget;
    const origin = { x: event.clientX, y: event.clientY };
    let initial = { ...win.bounds };
    if (win.state === 'maximized' && !direction) {
      const relative = event.clientX / this.viewport.width;
      win.restore();
      win.bounds.x = event.clientX - win.bounds.width * relative;
      win.bounds.y = 0;
      initial = { ...win.bounds };
    }
    target.setPointerCapture(event.pointerId);
    win.element.classList.add('dragging');
    const outline =
      this.settings?.get('dragFullWindows') === false
        ? h('div', {
            class: 'window-drag-outline',
            style: {
              position: 'absolute',
              pointerEvents: 'none',
              border: '3px dotted #555',
              zIndex: String(this.z + 1),
            },
          })
        : null;
    if (outline) this.host.append(outline);
    const move = (e) => {
      const dx = e.clientX - origin.x,
        dy = e.clientY - origin.y;
      if (!direction) win.bounds = { ...initial, x: initial.x + dx, y: initial.y + dy };
      else {
        const minW = Math.min(win.options.minWidth ?? 220, this.viewport.width),
          minH = Math.min(win.options.minHeight ?? 140, this.viewport.height);
        const b = { ...initial };
        if (direction.includes('e')) b.width = Math.max(minW, initial.width + dx);
        if (direction.includes('s')) b.height = Math.max(minH, initial.height + dy);
        if (direction.includes('w')) {
          b.width = Math.max(minW, initial.width - dx);
          b.x = initial.x + initial.width - b.width;
        }
        if (direction.includes('n')) {
          b.height = Math.max(minH, initial.height - dy);
          b.y = initial.y + initial.height - b.height;
        }
        win.bounds = b;
      }
      if (outline)
        Object.assign(outline.style, {
          left: win.bounds.x + 'px',
          top: win.bounds.y + 'px',
          width: win.bounds.width + 'px',
          height: win.bounds.height + 'px',
        });
      else this.layout(win);
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      target.removeEventListener('lostpointercapture', end);
      win.element.classList.remove('dragging');
      outline?.remove();
      this.layout(win);
      this.emit('change');
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end, { once: true });
    target.addEventListener('pointercancel', end, { once: true });
    target.addEventListener('lostpointercapture', end, { once: true });
  }
}
