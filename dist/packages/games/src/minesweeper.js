import { h, button, field, checkbox } from '../../ui/src/dom.js';
import { MinesweeperModel } from './models.js';

function counter(value) {
  return h(
    'div',
    { class: 'mine-counter', 'aria-label': String(value) },
    String(Math.max(-99, Math.min(999, value))).padStart(3, '0'),
  );
}
function face(state) {
  const glasses = state === 'won',
    dead = state === 'lost';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="23" height="23" shape-rendering="crispEdges"><circle cx="12" cy="12" r="8" fill="#ffff00" stroke="#000"/>${glasses ? '<path d="M5 8h14v4h-5V9h-4v3H5z" fill="#000"/>' : dead ? '<path d="M7 8l3 3m-3 0l3-3m4 0l3 3m-3 0l3-3" stroke="#000"/>' : '<path d="M8 8h2v3H8zM14 8h2v3h-2z"/>'}${dead ? '<path d="M8 17l2-2h4l2 2" fill="none" stroke="#000"/>' : '<path d="M7 14l2 3h6l2-3" fill="none" stroke="#000"/>'}</svg>`;
  return h('img', {
    src: 'data:image/svg+xml,' + encodeURIComponent(svg),
    width: 23,
    height: 23,
    alt: dead ? 'Lost' : glasses ? 'Won' : 'New game',
  });
}

export function createMinesweeper(sys) {
  let level = sys.settings.get('minesLevel') ?? 'Beginner',
    question = true;
  const configs = { Beginner: [8, 8, 10], Intermediate: [16, 16, 40], Expert: [30, 16, 99] };
  let config = configs[level] ?? configs.Beginner;
  const model = new MinesweeperModel(...config);
  const win = sys.createWindow({
    title: 'Minesweeper',
    icon: 'mines',
    width: config[0] * 16 + 26,
    height: config[1] * 16 + 102,
    resizable: false,
  });
  let started = 0,
    elapsed = 0,
    scoreRecorded = false;
  const top = h('div', { class: 'mine-top' }),
    grid = h('div', { class: 'mine-grid', role: 'grid', 'aria-label': 'Mine field' }),
    panel = h('div', { class: 'minesweeper' }, top, grid);
  const reset = () => {
    model.reset(...config);
    elapsed = 0;
    started = 0;
    scoreRecorded = false;
    win.setBounds({ width: config[0] * 16 + 26, height: config[1] * 16 + 102 });
    render();
  };
  const setLevel = (label) => {
    level = label;
    config = configs[label];
    sys.settings.set('minesLevel', level);
    reset();
  };
  const status = () => {
    top.replaceChildren(
      counter(model.mines - model.flags),
      button(face(model.state), reset, { class: 'mine-face', 'aria-label': 'New game' }),
      counter(elapsed),
    );
  };
  const finish = () => {
    if (model.state === 'won' && !scoreRecorded) {
      scoreRecorded = true;
      sys.sound.play('win');
      const scores = sys.settings.get('minesScores') ?? {};
      if (!scores[level] || elapsed < scores[level].time) {
        sys.dialogs
          .prompt(
            `You have the fastest time for ${level} level.\nPlease enter your name.`,
            sys.settings.get('userName'),
            { title: 'Minesweeper' },
          )
          .then((name) => {
            if (name) {
              scores[level] = { name, time: elapsed };
              sys.settings.set('minesScores', scores);
            }
          });
      }
    }
  };
  function render() {
    status();
    grid.style.gridTemplateColumns = `repeat(${model.width},16px)`;
    grid.replaceChildren();
    for (let i = 0; i < model.cells.length; i++) {
      const c = model.cells[i],
        loss = model.state === 'lost',
        showMine = loss && c.mine;
      const cell = button(
        '',
        () => {
          const initial = model.state;
          model.reveal(i);
          if (initial === 'ready' && model.state === 'playing') started = Date.now();
          render();
          finish();
        },
        {
          class:
            'mine-cell' +
            (c.revealed || showMine ? ' revealed' : '') +
            (model.exploded === i ? ' exploded' : ''),
          role: 'gridcell',
          'aria-label': `Row ${Math.floor(i / model.width) + 1}, column ${(i % model.width) + 1}${c.revealed ? (c.mine ? ', mine' : `, ${c.count} adjacent mines`) : c.flag === 1 ? ', flagged' : ''}`,
        },
      );
      if (showMine || (c.revealed && c.mine)) cell.append(h('span', { class: 'mine-symbol' }));
      else if (c.flag === 1) cell.append(h('span', { class: 'mine-flag' }));
      else if (c.flag === 2 && !c.revealed) cell.textContent = '?';
      else if (c.revealed && c.count) {
        cell.textContent = String(c.count);
        cell.dataset.number = String(c.count);
      }
      if (loss && c.flag === 1 && !c.mine) cell.classList.add('wrong-flag');
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        model.flag(i, question);
        render();
      });
      cell.addEventListener('dblclick', () => {
        model.chord(i);
        render();
        finish();
      });
      cell.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          model.chord(i);
          render();
          finish();
        }
      });
      cell.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          model.flag(i, question);
          render();
        }
        const delta = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -model.width,
          ArrowDown: model.width,
        }[e.key];
        if (delta !== undefined) {
          e.preventDefault();
          grid.children[Math.max(0, Math.min(grid.children.length - 1, i + delta))]?.focus();
        }
      });
      grid.append(cell);
    }
  }
  const timer = setInterval(() => {
    if (model.state === 'playing' && started) {
      elapsed = Math.min(999, Math.floor((Date.now() - started) / 1000));
      status();
    }
  }, 500);
  win.onDispose(() => clearInterval(timer));
  const custom = () => {
    const dlg = sys.wm.create({
      title: 'Custom Field',
      width: 265,
      height: 213,
      resizable: false,
      center: true,
      modal: true,
    });
    const width = h('input', { type: 'number', min: 8, max: 30, value: config[0] }),
      height = h('input', { type: 'number', min: 8, max: 24, value: config[1] }),
      mines = h('input', { type: 'number', min: 10, max: 600, value: config[2] });
    dlg.content.append(
      h(
        'div',
        { class: 'dialog-content' },
        field('Height:', height),
        field('Width:', width),
        field('Mines:', mines),
        h(
          'div',
          { class: 'button-row' },
          button('OK', () => {
            const w = Math.max(8, Math.min(30, Math.round(+width.value) || 8)),
              ht = Math.max(8, Math.min(24, Math.round(+height.value) || 8));
            config = [w, ht, Math.max(10, Math.min(w * ht - 9, Math.round(+mines.value) || 10))];
            level = 'Custom';
            reset();
            dlg.close();
          }),
          button('Cancel', () => dlg.close()),
        ),
      ),
    );
  };
  win.menu([
    {
      label: 'Game',
      items: () => [
        { label: 'New', shortcut: 'F2', action: reset },
        '-',
        ...Object.keys(configs).map((label) => ({
          label,
          checked: label === level,
          action: () => setLevel(label),
        })),
        { label: 'Custom...', checked: level === 'Custom', action: custom },
        '-',
        { label: 'Marks (?)', checked: question, action: () => (question = !question) },
        {
          label: 'Sound',
          checked: sys.settings.get('sound'),
          action: () => sys.settings.set('sound', !sys.settings.get('sound')),
        },
        '-',
        {
          label: 'Best Times...',
          action: () => {
            const scores = sys.settings.get('minesScores') ?? {};
            sys.dialogs.message(
              [
                'Fastest Mine Sweepers',
                '',
                ...Object.keys(configs).map(
                  (k) =>
                    `${k}: ${scores[k] ? scores[k].time + ' seconds — ' + scores[k].name : '999 seconds — Anonymous'}`,
                ),
              ].join('\n'),
              { title: 'Fastest Mine Sweepers', icon: 'mines' },
            );
          },
        },
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Help Topics', action: () => sys.launch('help', { topic: 'minesweeper' }) },
        {
          label: 'About Minesweeper',
          action: () =>
            sys.dialogs.message(
              'Minesweeper\n\nLeft-click to reveal a square. Right-click or press F to flag a mine. Double-click an exposed number to reveal its neighbors when the correct number of flags is present.\n\nThe first square and its neighbors are safe.',
              { title: 'About Minesweeper', icon: 'mines' },
            ),
        },
      ],
    },
  ]);
  win.content.append(panel);
  win.element.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        reset();
      }
    },
    { signal: win.signal },
  );
  render();
  win.model = model;
  return win;
}
