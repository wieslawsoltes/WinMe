import { h, button, select } from '../../ui/src/dom.js';
import {
  SolitaireModel,
  FreeCellModel,
  SpiderModel,
  suitSymbols,
  rankLabel,
  cardColor,
} from './models.js';

export function cardElement(card, { small = false, back = false } = {}) {
  const node = h('div', {
    class:
      'playing-card' +
      (small ? ' small' : '') +
      (back || !card.faceUp ? ' card-back' : '') +
      (cardColor(card) === 'red' ? ' red' : ''),
    'aria-label':
      back || !card.faceUp
        ? 'Face-down card'
        : `${rankLabel(card.rank)} of ${['spades', 'hearts', 'clubs', 'diamonds'][card.suit]}`,
    tabIndex: 0,
  });
  if (!back && card.faceUp) {
    const corner = () =>
      h(
        'div',
        { class: 'card-corner' },
        h('span', {}, rankLabel(card.rank)),
        h('span', {}, suitSymbols[card.suit]),
      );
    const bottom = corner();
    bottom.classList.add('bottom');
    node.append(
      corner(),
      h(
        'div',
        { class: 'card-pip' + (card.rank > 10 ? ' court' : '') },
        card.rank > 10 ? rankLabel(card.rank) : suitSymbols[card.suit],
      ),
      bottom,
    );
  }
  return node;
}

export function createCardGame(sys, args = {}) {
  const kind = args.kind ?? 'solitaire';
  let seed = Math.floor(Math.random() * 32000) + 1;
  let model =
    kind === 'freecell'
      ? new FreeCellModel(seed)
      : kind === 'spider'
        ? new SpiderModel({ suits: 1 })
        : new SolitaireModel({ draw: sys.settings.get('solitaireDraw') ?? 1 });
  const name = { solitaire: 'Solitaire', freecell: 'FreeCell', spider: 'Spider Solitaire' }[kind];
  const win = sys.createWindow({
    title: name,
    icon: 'game',
    width: kind === 'spider' ? 900 : kind === 'freecell' ? 730 : 650,
    height: 510,
    minWidth: kind === 'spider' ? 580 : 420,
    minHeight: 300,
  });
  const table = h('div', {
      class: 'card-table ' + kind,
      tabIndex: 0,
      'aria-label': name + ' table',
    }),
    status = h(
      'footer',
      { class: 'status-bar' },
      h('span', {}, 'Select a card, then its destination.'),
      h('span'),
    );
  let selected = null,
    wonShown = false,
    started = Date.now();
  const onState = () => {
    if (model.won && !wonShown) {
      wonShown = true;
      sys.sound.play('win');
      sys.dialogs.message(`Congratulations! You won ${name}.\n\n${model.moves} moves.`, {
        title: name,
        icon: 'game',
      });
    }
  };
  const newDeal = () => {
    selected = null;
    wonShown = false;
    started = Date.now();
    if (kind === 'freecell') {
      seed = Math.floor(Math.random() * 32000) + 1;
      model.deal(seed);
    } else model.deal();
    render();
  };
  const finishMove = (source, target) => {
    const moved = model.move(source, target);
    if (moved) {
      selected = null;
      render();
      onState();
    } else {
      sys.sound.play('click');
    }
    return moved;
  };
  const selectSource = (source, e) => {
    if (selected) {
      if (finishMove(selected, { type: source.type, index: source.index })) return;
    }
    if (kind === 'spider' && !model.movable(source.index, source.cardIndex)) return;
    if (kind === 'solitaire' && !model.movable(source)) return;
    selected = source;
    highlight();
  };
  const targetNode = (type, index, className = '') => {
    const node = h('div', {
      class: 'card-slot ' + className,
      dataset: { pile: type, index: String(index) },
      tabIndex: 0,
      'aria-label': `${type} ${index + 1}`,
    });
    node.addEventListener('click', (e) => {
      if (e.target === node && selected) finishMove(selected, { type, index });
    });
    node.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      node.classList.add('drop-target');
    });
    node.addEventListener('dragleave', () => node.classList.remove('drop-target'));
    node.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      node.classList.remove('drop-target');
      try {
        const source = JSON.parse(e.dataTransfer.getData('application/x-millennium-card'));
        finishMove(source, { type, index });
      } catch {}
    });
    node.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === node && selected) {
        e.preventDefault();
        finishMove(selected, { type, index });
      }
    });
    return node;
  };
  const attach = (node, source) => {
    node.dataset.source = JSON.stringify(source);
    node.draggable = true;
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      selectSource(source, e);
    });
    node.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (kind !== 'spider' && model.auto(source)) {
        selected = null;
        render();
        onState();
      }
    });
    node.addEventListener('dragstart', (e) => {
      selected = source;
      e.dataTransfer.setData('application/x-millennium-card', JSON.stringify(source));
      e.dataTransfer.effectAllowed = 'move';
      highlight();
    });
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSource(source);
      }
    });
  };
  const highlight = () => {
    for (const node of table.querySelectorAll('[data-source]')) {
      const s = JSON.parse(node.dataset.source);
      node.classList.toggle(
        'selected',
        !!selected &&
          s.type === selected.type &&
          s.index === selected.index &&
          (selected.cardIndex === undefined || s.cardIndex >= selected.cardIndex),
      );
    }
  };
  function render() {
    table.replaceChildren();
    const top = h('div', { class: 'card-top' }),
      bottom = h('div', { class: 'card-columns' });
    table.append(top, bottom);
    if (kind === 'solitaire') {
      const stock = targetNode('stock', 0);
      stock.classList.add('stock-slot');
      stock.title = 'Deal a new card';
      stock.append(
        model.stock.length
          ? cardElement({ ...model.stock.at(-1), faceUp: false })
          : h('span', { class: 'recycle-stock' }, '↶'),
      );
      stock.addEventListener('click', (e) => {
        e.stopPropagation();
        model.draw();
        selected = null;
        render();
      });
      top.append(stock);
      const waste = targetNode('waste', 0);
      const visible = model.waste.slice(-Math.min(model.drawCount, model.waste.length));
      visible.forEach((c, i) => {
        const card = cardElement(c);
        card.style.left = i * 14 + 'px';
        if (i === visible.length - 1) attach(card, { type: 'waste', index: 0 });
        waste.append(card);
      });
      top.append(waste, h('div', { class: 'card-top-spacer' }));
    } else if (kind === 'freecell') {
      for (let i = 0; i < 4; i++) {
        const slot = targetNode('cell', i);
        slot.classList.add('free-cell');
        if (model.cells[i].length) {
          const card = cardElement(model.cells[i][0]);
          attach(card, { type: 'cell', index: i });
          slot.append(card);
        }
        top.append(slot);
      }
      top.append(h('div', { class: 'card-top-spacer' }));
    } else {
      for (let i = 0; i < model.completed.length; i++)
        top.append(cardElement(model.completed[i][0], { small: true }));
      top.append(h('div', { class: 'card-top-spacer' }));
      const stock = button(
        `Deal (${model.stock.length / 10})`,
        () => {
          if (!model.draw() && model.stock.length)
            sys.dialogs.message(
              'You must place at least one card in each empty column before dealing a new row.',
              { title: name },
            );
          selected = null;
          render();
        },
        { class: 'spider-stock', disabled: !model.stock.length },
      );
      top.append(stock);
    }
    if (kind !== 'spider')
      for (let i = 0; i < 4; i++) {
        const slot = targetNode('foundation', i);
        slot.classList.add('foundation-slot');
        slot.dataset.suit = suitSymbols[i];
        if (model.foundations[i].length) {
          const card = cardElement(model.foundations[i].at(-1));
          attach(card, { type: 'foundation', index: i });
          slot.append(card);
        }
        top.append(slot);
      }
    model.tableau.forEach((pile, index) => {
      const column = targetNode('tableau', index, 'card-column');
      const available = Math.max(160, table.clientHeight - 140),
        faceCount = pile.filter((c) => c.faceUp).length,
        closedCount = pile.length - faceCount;
      const step = Math.min(
        kind === 'freecell' ? 25 : 23,
        Math.max(12, (available - 96 - closedCount * 10) / Math.max(1, faceCount - 1)),
      );
      let y = 0;
      pile.forEach((c, cardIndex) => {
        const card = cardElement(c);
        card.style.top = y + 'px';
        card.style.zIndex = cardIndex + 1;
        y += c.faceUp ? step : 10;
        if (c.faceUp) attach(card, { type: 'tableau', index, cardIndex });
        column.append(card);
      });
      column.style.minHeight = Math.max(100, y + 96) + 'px';
      bottom.append(column);
    });
    bottom.style.gridTemplateColumns = `repeat(${model.tableau.length}, minmax(0, 1fr))`;
    status.children[0].textContent = model.won
      ? 'Congratulations! You won!'
      : selected
        ? 'Choose a destination, or double-click a card to send it to a foundation.'
        : kind === 'freecell'
          ? `Game #${model.seed} — Select a card, then its destination.`
          : 'Select a card, then its destination.';
    status.children[1].textContent = `${model.score !== undefined ? 'Score: ' + model.score + '   ' : ''}Moves: ${model.moves}`;
    highlight();
  }
  const hint = () => {
    if (kind === 'solitaire') {
      const move = model.hint();
      if (!move) {
        sys.dialogs.message('No moves are available. Deal a new game or undo a move.', {
          title: name,
        });
        return;
      }
      if (move.draw) {
        status.children[0].textContent = 'Click the stock pile to deal.';
        table.querySelector('.stock-slot').classList.add('hint');
      } else {
        selected = move.source;
        highlight();
        table
          .querySelector(`[data-pile="${move.target.type}"][data-index="${move.target.index}"]`)
          ?.classList.add('hint');
        status.children[0].textContent = 'Move the selected card to the highlighted pile.';
      }
    } else {
      let found = false;
      for (let i = 0; i < model.tableau.length && !found; i++)
        for (let j = 0; j < model.tableau[i].length && !found; j++) {
          const source = { type: 'tableau', index: i, cardIndex: j };
          for (let k = 0; k < model.tableau.length; k++) {
            const target = { type: 'tableau', index: k };
            const valid =
              kind === 'freecell'
                ? model.canMove(source, target)
                : k !== i &&
                  model.movable(i, j) &&
                  (!model.tableau[k].length ||
                    model.tableau[k].at(-1).rank === model.tableau[i][j].rank + 1);
            if (valid) {
              selected = source;
              highlight();
              table
                .querySelector(`[data-pile="tableau"][data-index="${k}"]`)
                ?.classList.add('hint');
              found = true;
              break;
            }
          }
        }
      if (!found)
        status.children[0].textContent =
          kind === 'spider'
            ? 'Deal another row, or undo a move.'
            : 'Try a free cell or a foundation.';
    }
  };
  const options = () => {
    if (kind === 'solitaire') {
      sys.dialogs
        .message('How many cards would you like to draw?', {
          title: 'Solitaire Options',
          buttons: ['Draw One', 'Draw Three', 'Cancel'],
        })
        .then((choice) => {
          if (choice?.startsWith('Draw')) {
            model.drawCount = choice === 'Draw One' ? 1 : 3;
            sys.settings.set('solitaireDraw', model.drawCount);
            newDeal();
          }
        });
    } else if (kind === 'spider') {
      sys.dialogs
        .message('Choose a difficulty. This starts a new game.', {
          title: 'Spider Solitaire',
          buttons: ['One Suit', 'Two Suits', 'Four Suits', 'Cancel'],
        })
        .then((choice) => {
          const suits = { 'One Suit': 1, 'Two Suits': 2, 'Four Suits': 4 }[choice];
          if (suits) {
            model = new SpiderModel({ suits });
            selected = null;
            wonShown = false;
            render();
          }
        });
    } else {
      sys.dialogs
        .prompt('Enter a game number from 1 to 32000.', String(model.seed), {
          title: 'Select Game',
          label: 'Game:',
        })
        .then((value) => {
          if (value && Number.isInteger(+value) && +value >= 1 && +value <= 32000) {
            model.deal(+value);
            selected = null;
            wonShown = false;
            render();
          }
        });
    }
  };
  win.menu([
    {
      label: 'Game',
      items: () => [
        { label: 'Deal', shortcut: 'F2', action: newDeal },
        { label: kind === 'freecell' ? 'Select Game...' : 'Options...', action: options },
        '-',
        {
          label: 'Undo',
          shortcut: 'Ctrl+Z',
          action: () => {
            model.undo();
            selected = null;
            render();
          },
          disabled: !model.history.past.length,
        },
        { label: 'Hint', shortcut: 'H', action: hint },
        ...(kind === 'solitaire'
          ? [
              {
                label: 'Auto Finish',
                action: () => {
                  let changed = true,
                    limit = 100;
                  while (changed && limit--) {
                    changed = false;
                    for (let i = 0; i < 7; i++)
                      if (model.auto({ type: 'tableau', index: i })) changed = true;
                    if (model.auto({ type: 'waste', index: 0 })) changed = true;
                  }
                  selected = null;
                  render();
                  onState();
                },
              },
            ]
          : []),
        '-',
        { label: 'Exit', action: () => win.close() },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'How to Play',
          action: () =>
            sys.dialogs.message(
              kind === 'solitaire'
                ? 'Build the four foundations from Ace to King, by suit. Build tableau columns downward in alternating colors. Only Kings may enter empty columns. Click the stock to draw. Drag cards, or click a source then a destination. Double-click to move to a foundation.'
                : kind === 'freecell'
                  ? 'Move all cards to four foundations, Ace to King by suit. Build tableau columns downward in alternating colors. Four free cells each hold one card. Sequence moves are limited by the available free cells and empty columns. Any card can enter an empty column.'
                  : 'Build complete King-to-Ace sequences of the same suit. Move descending sequences of one suit together. A card can be placed on a card one rank higher. Empty columns accept any card. Fill all empty columns before dealing another row. Complete eight sequences to win.',
              { title: name, icon: 'game' },
            ),
        },
        {
          label: 'About ' + name,
          action: () =>
            sys.dialogs.message(
              name + '\n\nMillennium browser edition.\nPlayable rules, undo, hints and new deals.',
              { title: 'About ' + name, icon: 'game' },
            ),
        },
      ],
    },
  ]);
  win.content.append(table, status);
  win.element.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        newDeal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        model.undo();
        selected = null;
        render();
      }
      if (e.key.toLowerCase() === 'h') hint();
      if (e.key === 'Escape') {
        selected = null;
        highlight();
      }
    },
    { signal: win.signal },
  );
  win.onResize = () => {
    if (table.isConnected) render();
  };
  render();
  win.model = model;
  return win;
}
