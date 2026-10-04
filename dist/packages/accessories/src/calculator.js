import { h, button } from '../../ui/src/dom.js';

/** Standard-mode, immediate-execution calculator with repeat equals and memory. */
export class CalculatorModel {
  constructor() {
    this.memory = 0;
    this.clear();
  }
  clear() {
    this.display = '0';
    this.accumulator = null;
    this.operator = null;
    this.fresh = true;
    this.repeat = null;
    this.error = false;
  }
  number() {
    return Number(this.display);
  }
  format(value) {
    if (!Number.isFinite(value)) throw new Error('Cannot divide by zero.');
    if (Math.abs(value) > 1e100) throw new Error('Result is too large.');
    return Object.is(value, -0) ? '0' : Number(value.toPrecision(14)).toString();
  }
  show(value) {
    this.display = this.format(value);
    this.error = false;
  }
  calculate(a, b, op) {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        if (b === 0) throw new Error('Cannot divide by zero.');
        return a / b;
      case '^':
        return a ** b;
      case 'mod':
        return a % b;
      default:
        return b;
    }
  }
  press(key) {
    try {
      if (key === 'C') {
        this.clear();
        return;
      }
      if (this.error) {
        if (/^[0-9.]$/.test(key)) this.clear();
        else if (!['MC', 'MR'].includes(key)) return;
      }
      if (/^\d$/.test(key)) {
        if (this.fresh || this.display === '0') {
          this.display = key;
          this.fresh = false;
        } else if (this.display.replace(/[-.]/g, '').length < 16) this.display += key;
        return;
      }
      if (key === '.') {
        if (this.fresh) {
          this.display = '0';
          this.fresh = false;
        }
        if (!this.display.includes('.')) this.display += '.';
        return;
      }
      if (key === 'CE') {
        this.display = '0';
        this.fresh = true;
        return;
      }
      if (key === 'Back') {
        if (!this.fresh) {
          this.display = this.display.slice(0, -1);
          if (!this.display || this.display === '-') this.display = '0';
        }
        return;
      }
      if (key === '±') {
        if (this.number() !== 0)
          this.display = this.display.startsWith('-') ? this.display.slice(1) : '-' + this.display;
        return;
      }
      if (['+', '-', '*', '/', '^', 'mod'].includes(key)) {
        const value = this.number();
        if (this.operator && !this.fresh) {
          this.accumulator = this.calculate(this.accumulator, value, this.operator);
          this.show(this.accumulator);
        } else if (this.accumulator === null || !this.operator) this.accumulator = value;
        this.operator = key;
        this.fresh = true;
        this.repeat = null;
        return;
      }
      if (key === '=') {
        if (this.operator) {
          const b = this.number();
          this.repeat = { operator: this.operator, b };
          this.show(this.calculate(this.accumulator, b, this.operator));
          this.operator = null;
          this.accumulator = null;
        } else if (this.repeat)
          this.show(this.calculate(this.number(), this.repeat.b, this.repeat.operator));
        this.fresh = true;
        return;
      }
      if (key === '%') {
        this.show(
          this.operator === '+' || this.operator === '-'
            ? ((this.accumulator ?? 0) * this.number()) / 100
            : this.number() / 100,
        );
        this.fresh = false;
        return;
      }
      if (key === 'MC') {
        this.memory = 0;
        return;
      }
      if (key === 'MR') {
        this.show(this.memory);
        this.fresh = true;
        return;
      }
      if (key === 'MS') {
        this.memory = this.number();
        this.fresh = true;
        return;
      }
      if (key === 'M+') {
        this.memory += this.number();
        this.fresh = true;
        return;
      }
      const n = this.number();
      const ops = {
        sqrt: () => Math.sqrt(n),
        '1/x': () => 1 / n,
        'x²': () => n * n,
        sin: () => Math.sin((n * Math.PI) / 180),
        cos: () => Math.cos((n * Math.PI) / 180),
        tan: () => Math.tan((n * Math.PI) / 180),
        log: () => Math.log10(n),
        ln: () => Math.log(n),
        exp: () => Math.exp(n),
        π: () => Math.PI,
        'n!': () => {
          if (n < 0 || n > 170 || n % 1) throw new Error('Invalid input for factorial.');
          let r = 1;
          for (let i = 2; i <= n; i++) r *= i;
          return r;
        },
        Int: () => Math.trunc(n),
        Hex: () => {
          this.display = Math.trunc(n).toString(16).toUpperCase();
          return undefined;
        },
      };
      if (ops[key]) {
        const value = ops[key]();
        if (value !== undefined) this.show(value);
        this.fresh = true;
      }
    } catch (error) {
      this.display = error.message;
      this.error = true;
      this.operator = null;
      this.accumulator = null;
      this.repeat = null;
      this.fresh = true;
    }
  }
}

export function createCalculator(sys) {
  const model = new CalculatorModel();
  let scientific = false;
  const win = sys.createWindow({
    title: 'Calculator',
    icon: 'calculator',
    width: 281,
    height: 279,
    resizable: false,
  });
  const display = h(
      'div',
      { class: 'calculator-display', 'aria-label': 'Calculator display', role: 'status' },
      '0',
    ),
    memory = h('span', { class: 'memory-indicator' }, '');
  const main = h('div', { class: 'calculator' }),
    grid = h('div', { class: 'calculator-grid' }),
    science = h('div', { class: 'calc-scientific', hidden: true });
  const press = (key) => {
    model.press(key);
    display.textContent = model.display;
    memory.textContent = model.memory ? 'M' : '';
  };
  const map = [
    ['MC', '7', '8', '9', '/', 'sqrt'],
    ['MR', '4', '5', '6', '*', '%'],
    ['MS', '1', '2', '3', '-', '1/x'],
    ['M+', '0', '±', '.', '+', '='],
  ];
  for (const row of map)
    for (let i = 0; i < row.length; i++) {
      const key = row[i];
      grid.append(
        button(key === 'sqrt' ? 'sqrt' : key === '*' ? '*' : key, () => press(key), {
          class: i === 0 ? 'memory' : i >= 4 ? 'operator' : '',
          title:
            {
              MC: 'Clear memory',
              MR: 'Recall memory',
              MS: 'Store memory',
              'M+': 'Add to memory',
              '±': 'Change sign',
              sqrt: 'Square root',
              '1/x': 'Reciprocal',
            }[key] ?? key,
        }),
      );
    }
  for (const key of ['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'π', 'x²', '^', 'mod', 'n!', 'Int'])
    science.append(button(key, () => press(key)));
  const switchMode = (value) => {
    scientific = value;
    science.hidden = !value;
    win.setBounds({ height: value ? 342 : 279 });
  };
  win.menu([
    {
      label: 'Edit',
      items: [
        {
          label: 'Copy',
          shortcut: 'Ctrl+C',
          action: () => {
            sys.clipboard.text = model.display;
            navigator.clipboard?.writeText(model.display).catch(() => {});
          },
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          action: () => {
            const text = sys.clipboard.text ?? '';
            if (Number.isFinite(Number(text))) {
              model.show(Number(text));
              display.textContent = model.display;
            }
          },
        },
      ],
    },
    {
      label: 'View',
      items: () => [
        { label: 'Standard', checked: !scientific, action: () => switchMode(false) },
        { label: 'Scientific', checked: scientific, action: () => switchMode(true) },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Help Topics', action: () => sys.launch('help', { topic: 'accessories' }) },
        {
          label: 'About Calculator',
          action: () =>
            sys.dialogs.message(
              'Calculator\nStandard and scientific calculations, with memory.\n\nMillennium browser edition.',
              { title: 'About Calculator', icon: 'calculator' },
            ),
        },
      ],
    },
  ]);
  main.append(
    display,
    science,
    h(
      'div',
      { class: 'calculator-clear' },
      memory,
      button('Backspace', () => press('Back')),
      button('CE', () => press('CE')),
      button('C', () => press('C')),
    ),
    grid,
  );
  win.content.append(main);
  win.element.addEventListener(
    'keydown',
    (e) => {
      const key =
        { Enter: '=', Escape: 'C', Backspace: 'Back', Delete: 'CE', ',': '.' }[e.key] ?? e.key;
      if (/^[0-9.+\-*/=%]$/.test(key) || ['C', 'CE', 'Back'].includes(key)) {
        e.preventDefault();
        press(key);
      }
    },
    { signal: win.signal },
  );
  win.model = model;
  return win;
}
