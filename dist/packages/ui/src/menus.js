import { h, button, separator } from './dom.js';
import { icon } from './icons.js';
export class MenuManager {
  constructor(host = document.body) {
    this.host = host;
    this.layers = [];
    this.closeHooks = new Set();
    this.abort = new AbortController();
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!e.target.closest('.menu-popup,.menu-bar,.start-button')) this.close();
      },
      { signal: this.abort.signal },
    );
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.layers.length) {
          e.preventDefault();
          this.close();
        }
      },
      { signal: this.abort.signal },
    );
  }
  close(depth = 0) {
    clearTimeout(this.hoverTimer);
    while (this.layers.length > depth) this.layers.pop().element.remove();
    if (!depth) {
      for (const hook of this.closeHooks) hook();
      this.closeHooks.clear();
    }
  }
  show(x, y, items, { depth = 0, parentButton, className = '', focus = true } = {}) {
    this.close(depth);
    const menu = h('div', { class: 'menu-popup ' + className, role: 'menu', tabIndex: -1 });
    const buttons = [];
    const resolved = typeof items === 'function' ? items() : items;
    let active = -1;
    const choose = (index, submenu = false) => {
      buttons.forEach((entry, i) => entry.button.classList.toggle('selected', i === index));
      active = index;
      const entry = buttons[index];
      if (!entry || entry.item.disabled) return;
      if (submenu && entry.item.children) openSubmenu(entry);
    };
    const openSubmenu = (entry) => {
      const r = entry.button.getBoundingClientRect();
      this.show(r.right - 3, r.top - 3, entry.item.children, {
        depth: depth + 1,
        parentButton: entry.button,
        focus: false,
      });
    };
    for (const item of resolved) {
      if (!item || item === '-' || item.separator) {
        menu.append(separator());
        continue;
      }
      if (item.hidden) continue;
      const index = buttons.length;
      const row = button(
        '',
        () => {
          if (item.disabled) return;
          if (item.children) {
            choose(index, true);
            return;
          }
          this.close();
          try {
            const result = item.action?.();
            result?.catch?.((error) => this.onError?.(error));
          } catch (error) {
            this.onError?.(error);
          }
        },
        {
          class: 'menu-item' + (item.checked ? ' checked' : ''),
          role: item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem',
          'aria-checked': item.checked === undefined ? undefined : String(item.checked),
          'aria-haspopup': item.children ? 'menu' : undefined,
          disabled: item.disabled,
        },
      );
      if (item.icon)
        row.append(
          h(
            'span',
            { class: 'menu-icon' },
            icon(item.icon, className.includes('start-root') ? 24 : 16),
          ),
        );
      row.append(
        h('span', { class: 'menu-label' }, item.label),
        item.shortcut ? h('span', { class: 'shortcut' }, item.shortcut) : null,
        item.children ? h('span', { class: 'submenu-arrow' }, '▶') : null,
      );
      const entry = { button: row, item };
      buttons.push(entry);
      menu.append(row);
      row.addEventListener('pointerenter', () => {
        clearTimeout(this.hoverTimer);
        choose(index);
        this.hoverTimer = setTimeout(() => {
          if (!menu.isConnected) return;
          this.close(depth + 1);
          if (item.children) openSubmenu(entry);
        }, 170);
      });
    }
    this.host.append(menu);
    this.layers.push({ element: menu, parentButton });
    const rect = menu.getBoundingClientRect();
    if (x + rect.width > innerWidth)
      x = parentButton
        ? Math.max(0, parentButton.getBoundingClientRect().left - rect.width + 3)
        : innerWidth - rect.width - 2;
    menu.style.left = Math.max(0, x) + 'px';
    menu.style.top = Math.max(0, Math.min(y, innerHeight - rect.height - 3)) + 'px';
    menu.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const enabled = buttons.map((v, i) => (v.item.disabled ? -1 : i)).filter((i) => i >= 0);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const pos = enabled.indexOf(active);
        const index =
          enabled[
            pos < 0
              ? e.key === 'ArrowDown'
                ? 0
                : enabled.length - 1
              : (pos + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
          ];
        choose(index);
        buttons[index]?.button.focus();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (buttons[active]?.item.children) {
          openSubmenu(buttons[active]);
          this.layers.at(-1).element.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (depth) {
          this.close(depth);
          parentButton?.focus();
        }
      } else if (e.key === 'Escape') {
        this.close();
        parentButton?.focus();
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        buttons[active].button.click();
      } else if (e.key.length === 1 && /\w/.test(e.key)) {
        const found = buttons.findIndex(
          (v) => !v.item.disabled && v.item.label.toLowerCase().startsWith(e.key.toLowerCase()),
        );
        if (found >= 0) {
          choose(found);
          buttons[found].button.focus();
        }
      }
    });
    if (focus) menu.focus();
    return menu;
  }
  bar(items) {
    const bar = h('nav', { class: 'menu-bar', 'aria-label': 'Application menu' });
    for (const item of items) {
      const btn = button(
        item.label,
        () => {
          const opened = btn.classList.contains('selected');
          this.close();
          if (opened) return;
          const r = btn.getBoundingClientRect();
          btn.classList.add('selected');
          this.closeHooks.add(() => btn.classList.remove('selected'));
          this.show(r.left, r.bottom, item.items, { focus: true });
          btn.classList.add('selected');
          this.closeHooks.add(() => btn.classList.remove('selected'));
        },
        { 'aria-haspopup': 'menu' },
      );
      btn.addEventListener('pointerenter', () => {
        if (bar.querySelector('.selected') && !btn.classList.contains('selected')) btn.click();
      });
      bar.append(btn);
    }
    return bar;
  }
  dispose() {
    this.close();
    this.abort.abort();
  }
}
