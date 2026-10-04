export function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function')
      element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in element && !key.startsWith('aria-') && key !== 'list') element[key] = value;
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  const append = (child) => {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) child.forEach(append);
    else element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  };
  children.forEach(append);
  return element;
}
export const button = (label, action, attrs = {}) =>
  h('button', { type: 'button', ...attrs, onclick: action }, label);
export function field(label, input, attrs = {}) {
  return h('label', { class: 'field-row', ...attrs }, h('span', {}, label), input);
}
export function checkbox(label, checked, change) {
  const input = h('input', { type: 'checkbox', checked, onchange: () => change?.(input.checked) });
  return h('label', { class: 'checkbox-row' }, input, label);
}
export const separator = () => h('div', { class: 'separator', role: 'separator' });
export function select(options, value, change) {
  return h(
    'select',
    { value, onchange: (e) => change?.(e.target.value) },
    options.map((item) =>
      typeof item === 'string'
        ? h('option', { value: item, selected: item === value }, item)
        : h('option', { value: item.value, selected: item.value === value }, item.label),
    ),
  );
}
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function pickFiles({ accept = '', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    document.body.append(input);
    let done = false;
    const finish = (files) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish([...input.files]), { once: true });
    input.addEventListener('cancel', () => finish([]), { once: true });
    input.click();
  });
}
export function toolbar(items) {
  return h(
    'div',
    { class: 'toolbar' },
    items.map((item) =>
      item === '-'
        ? separator()
        : button(item.label, item.action, {
            title: item.title ?? item.label,
            disabled: item.disabled,
            class: 'tool-button ' + (item.class ?? ''),
          }),
    ),
  );
}
export function tabs(items, selected = 0) {
  const bar = h('div', { class: 'tab-bar', role: 'tablist' });
  const body = h('div', { class: 'tab-body', role: 'tabpanel' });
  const buttons = items.map((item, index) =>
    button(item.label, () => show(index), { role: 'tab' }),
  );
  bar.append(...buttons);
  function show(index) {
    buttons.forEach((b, i) => {
      b.classList.toggle('selected', index === i);
      b.setAttribute('aria-selected', String(index === i));
      b.tabIndex = i === index ? 0 : -1;
    });
    body.replaceChildren(
      typeof items[index].content === 'function' ? items[index].content() : items[index].content,
    );
  }
  bar.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    selected =
      (buttons.indexOf(document.activeElement) + (e.key === 'ArrowRight' ? 1 : -1) + items.length) %
      items.length;
    show(selected);
    buttons[selected].focus();
  });
  show(selected);
  return h('div', { class: 'tabs' }, bar, body);
}
