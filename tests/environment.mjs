import { JSDOM, VirtualConsole } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

/** DOM integration harness. Graphics and media are stubs, not browser/driver QA. */
export function environment(
  html = '<main id="desktop"><canvas id="desktop-surface"></canvas><div id="desktop-icons"></div><div id="windows"></div><div id="selection-box" hidden></div></main><footer id="taskbar"></footer><div id="menus"></div><div id="overlays"></div><div id="announcer"></div>',
) {
  const failures = [],
    virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (!e.message.startsWith('Not implemented:')) failures.push(e);
  });
  const dom = new JSDOM(html, {
    url: 'https://millennium.test/',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  const originals = new Map(),
    expose = (key, value) => {
      originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    };
  for (const key of [
    'window',
    'document',
    'Node',
    'Element',
    'HTMLElement',
    'HTMLCanvasElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'CustomEvent',
    'AbortController',
    'DOMParser',
    'FileReader',
    'getComputedStyle',
    'getSelection',
    'localStorage',
    'navigator',
    'location',
    'screen',
  ])
    expose(
      key,
      key === 'window'
        ? window
        : typeof window[key] === 'function' && ['getSelection', 'getComputedStyle'].includes(key)
          ? window[key].bind(window)
          : window[key],
    );
  expose('innerWidth', 1024);
  expose('innerHeight', 768);
  expose('devicePixelRatio', 1);
  expose('indexedDB', new IDBFactory());
  const frames = new Map();
  let frameId = 0;
  expose('requestAnimationFrame', (fn) => {
    frames.set(++frameId, fn);
    return frameId;
  });
  expose('cancelAnimationFrame', (id) => frames.delete(id));
  expose(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  const timers = new Set();
  const setTimer = globalThis.setInterval,
    clearTimer = globalThis.clearInterval;
  expose('setInterval', (...args) => {
    const id = setTimer(...args);
    timers.add(id);
    return id;
  });
  expose('clearInterval', (id) => {
    timers.delete(id);
    clearTimer(id);
  });
  window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
  window.Element.prototype.setPointerCapture = () => {};
  window.Element.prototype.releasePointerCapture = () => {};
  window.Element.prototype.scrollIntoView = () => {};
  window.HTMLMediaElement.prototype.load = function () {};
  window.HTMLMediaElement.prototype.pause = function () {
    Object.defineProperty(this, 'paused', { value: true, configurable: true });
    this.dispatchEvent(new window.Event('pause'));
  };
  window.HTMLMediaElement.prototype.play = function () {
    Object.defineProperty(this, 'paused', { value: false, configurable: true });
    this.dispatchEvent(new window.Event('play'));
    return Promise.resolve();
  };
  window.document.execCommand = () => true;
  const context = (canvas) =>
    new Proxy(
      {
        canvas,
        measureText: (text) => ({ width: String(text).length * 7 }),
        createImageData: (w, h) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
        getImageData: (x, y, w, h) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        getLineDash: () => [],
        isPointInPath: () => false,
      },
      {
        get(target, key) {
          if (key in target) return target[key];
          return () => {};
        },
      },
    );
  window.HTMLCanvasElement.prototype.getContext = function (type) {
    if (type !== '2d') return null;
    return (this.testContext ??= context(this));
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
  window.HTMLCanvasElement.prototype.toBlob = (callback) =>
    callback(new Blob(['image'], { type: 'image/png' }));
  expose('createImageBitmap', async () => ({ width: 16, height: 16, close() {} }));
  expose(
    'ImageData',
    class {
      constructor(data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    },
  );
  return {
    window,
    failures,
    frames,
    async flushFrame(time = 1000) {
      const current = [...frames.values()];
      frames.clear();
      for (const fn of current) fn(time);
      await new Promise((resolve) => setImmediate(resolve));
    },
    close() {
      for (const timer of timers) clearTimer(timer);
      dom.window.close();
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}
