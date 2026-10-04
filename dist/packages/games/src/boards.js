import { h, button } from '../../ui/src/dom.js';
import { History } from '../../core/src/index.js';
import { ReversiModel } from './models.js';

export class CheckersModel {
  constructor() {
    this.reset();
  }
  reset() {
    this.board = Array(64).fill(null);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if ((x + y) % 2 === 1 && (y < 3 || y > 4))
          this.board[y * 8 + x] = { player: y < 3 ? 2 : 1, king: false };
    this.turn = 1;
    this.forced = null;
    this.winner = null;
  }
  movesFor(index, capturesOnly = false) {
    const piece = this.board[index];
    if (!piece) return [];
    const x = index % 8,
      y = Math.floor(index / 8),
      directions = piece.king ? [-1, 1] : [piece.player === 1 ? -1 : 1],
      moves = [];
    for (const dy of directions)
      for (const dx of [-1, 1]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
        const adjacent = ny * 8 + nx;
        if (!this.board[adjacent]) {
          if (!capturesOnly) moves.push({ from: index, to: adjacent, capture: null });
        } else if (this.board[adjacent].player !== piece.player) {
          const tx = x + dx * 2,
            ty = y + dy * 2;
          if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8 && !this.board[ty * 8 + tx])
            moves.push({ from: index, to: ty * 8 + tx, capture: adjacent });
        }
      }
    return moves;
  }
  valid() {
    if (this.winner) return [];
    const sources =
      this.forced !== null
        ? [this.forced]
        : this.board.map((p, i) => (p?.player === this.turn ? i : -1)).filter((i) => i >= 0);
    const moves = sources.flatMap((i) => this.movesFor(i, this.forced !== null));
    const captures = moves.filter((m) => m.capture !== null);
    return captures.length ? captures : moves;
  }
  play(from, to) {
    const move = this.valid().find((m) => m.from === from && m.to === to);
    if (!move) return false;
    const piece = this.board[from];
    this.board[from] = null;
    this.board[to] = piece;
    if (move.capture !== null) this.board[move.capture] = null;
    let promoted = false;
    if (!piece.king && ((piece.player === 1 && to < 8) || (piece.player === 2 && to >= 56))) {
      piece.king = true;
      promoted = true;
    }
    if (move.capture !== null && !promoted && this.movesFor(to, true).length) {
      this.forced = to;
      return true;
    }
    this.forced = null;
    this.turn = 3 - this.turn;
    if (!this.valid().length) this.winner = 3 - this.turn;
    return true;
  }
  ai() {
    const moves = this.valid();
    moves.sort(
      (a, b) =>
        (b.capture !== null ? 10 : 0) +
        (b.to >= 56 ? 5 : 0) -
        ((a.capture !== null ? 10 : 0) + (a.to >= 56 ? 5 : 0)),
    );
    const chosen = moves[0];
    if (chosen) this.play(chosen.from, chosen.to);
  }
}

export function createBoardGame(sys, args = {}) {
  const reversi = args.kind === 'reversi',
    title = reversi ? 'Internet Reversi' : 'Internet Checkers',
    model = reversi ? new ReversiModel() : new CheckersModel();
  const win = sys.createWindow({
    title,
    icon: 'game',
    width: 575,
    height: 490,
    minWidth: 360,
    minHeight: 330,
  });
  const grid = h('div', {
      class: 'board-grid',
      role: 'grid',
      'aria-label': reversi ? 'Reversi board' : 'Checkers board',
    }),
    info = h('aside', { class: 'board-info' }),
    status = h('div', { class: 'game-turn' }),
    counts = h('div', { class: 'opponent-label' });
  let selected = null,
    thinking = false,
    history = [],
    computerTimer;
  const snapshot = () =>
    structuredClone(
      reversi
        ? { board: model.board, turn: model.turn, over: model.over }
        : { board: model.board, turn: model.turn, forced: model.forced, winner: model.winner },
    );
  const reset = () => {
    clearTimeout(computerTimer);
    model.reset();
    history = [];
    selected = null;
    thinking = false;
    render();
  };
  const undo = () => {
    clearTimeout(computerTimer);
    const previous = history.pop();
    if (previous) {
      Object.assign(model, previous);
      selected = null;
      thinking = false;
      render();
    }
  };
  const ended = () => (reversi ? model.over : !!model.winner);
  const after = () => {
    render();
    if (ended()) {
      const one = reversi ? model.board.filter((x) => x === 1).length : 0,
        two = reversi ? model.board.filter((x) => x === 2).length : 0;
      const result = reversi
        ? one === two
          ? 'The game is a draw.'
          : one > two
            ? 'You won!'
            : 'The computer won.'
        : model.winner === 1
          ? 'You won!'
          : 'The computer won.';
      status.textContent = result;
      if (result === 'You won!') sys.sound.play('win');
      return;
    }
    if (model.turn === 2) {
      thinking = true;
      status.textContent = 'Computer is thinking...';
      computerTimer = setTimeout(() => {
        if (win.closed) return;
        model.ai();
        thinking = false;
        after();
      }, 420);
    }
  };
  const play = (index) => {
    if (thinking || model.turn !== 1 || ended()) return;
    if (reversi) {
      if (!model.flips(index).length) return;
      history.push(snapshot());
      model.play(index);
      after();
    } else {
      if (selected !== null && model.valid().some((m) => m.from === selected && m.to === index)) {
        if (model.forced === null) history.push(snapshot());
        model.play(selected, index);
        selected = model.forced;
        after();
      } else if (model.board[index]?.player === 1) {
        selected = index;
        render();
      }
    }
  };
  function render() {
    grid.replaceChildren();
    const valid = reversi
      ? model.valid(1)
      : model
          .valid()
          .filter((m) => m.from === selected)
          .map((m) => m.to);
    for (let i = 0; i < 64; i++) {
      const cell = button('', () => play(i), {
        class:
          'board-cell' +
          (((i % 8) + Math.floor(i / 8)) % 2 ? ' dark' : '') +
          (reversi ? ' reversi' : '') +
          (selected === i ? ' selected' : '') +
          (!thinking && model.turn === 1 && valid.includes(i) ? ' valid' : ''),
        role: 'gridcell',
        'aria-label': String.fromCharCode(65 + (i % 8)) + (8 - Math.floor(i / 8)),
      });
      const p = model.board[i];
      if (p) {
        const player = reversi ? p : p.player;
        cell.append(
          h(
            'span',
            {
              class:
                'board-piece ' +
                (reversi ? (player === 1 ? 'black' : '') : player === 1 ? 'red' : 'black'),
            },
            !reversi && p.king ? 'K' : '',
          ),
        );
      }
      grid.append(cell);
    }
    const one = model.board.filter((p) => (reversi ? p === 1 : p?.player === 1)).length,
      two = model.board.filter((p) => (reversi ? p === 2 : p?.player === 2)).length;
    counts.replaceChildren(h('b', {}, 'You: ' + one), h('br'), 'Computer: ' + two);
    status.textContent = ended()
      ? 'Game finished.'
      : thinking
        ? 'Computer is thinking...'
        : model.turn === 1
          ? reversi
            ? 'Your turn. You play black.'
            : model.forced !== null
              ? 'Continue the capture.'
              : 'Your turn. Select a red piece.'
          : 'Computer’s turn.';
  }
  info.append(
    h('h3', {}, reversi ? 'Reversi' : 'Checkers'),
    h('p', {}, 'Local game'),
    counts,
    status,
    button('New Game', reset),
    button('Undo', undo),
    h('p', { class: 'muted' }, 'Opponent: Computer'),
  );
  win.menu([
    {
      label: 'Game',
      items: [
        { label: 'New Game', shortcut: 'F2', action: reset },
        { label: 'Undo', action: undo },
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
              reversi
                ? 'Place a black disk so a line of white disks is bounded by your disks. Those disks flip to black. If a player has no legal move, their turn is passed. The player with the most disks when neither can move wins.'
                : 'Move red pieces diagonally forward on dark squares. Captures are mandatory. Jump an opposing piece into an empty square; continue jumping when possible. Reaching the far row crowns a king, which can also move backward. Win by taking all pieces or leaving the opponent no moves.',
              { title, icon: 'game' },
            ),
        },
        {
          label: 'Connection Information',
          action: () =>
            sys.dialogs.message(
              'This browser edition plays against a local computer opponent. It does not connect to the original Microsoft Internet Games service.',
              { title: 'Connection Information', icon: 'network' },
            ),
        },
      ],
    },
  ]);
  win.content.append(
    h('div', { class: 'board-game' }, h('div', { class: 'board-area' }, grid), info),
  );
  win.onDispose(() => clearTimeout(computerTimer));
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

export class BackgammonModel {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }
  reset() {
    this.points = Array(24).fill(0);
    for (const [index, count] of [
      [23, 2],
      [12, 5],
      [7, 3],
      [5, 5],
      [0, -2],
      [11, -5],
      [16, -3],
      [18, -5],
    ])
      this.points[index] = count;
    this.bar = { 1: 0, 2: 0 };
    this.off = { 1: 0, 2: 0 };
    this.turn = 1;
    this.dice = [];
    this.rolled = [];
    this.winner = null;
  }
  roll() {
    if (this.dice.length || this.winner) return false;
    const a = 1 + Math.floor(this.random() * 6),
      b = 1 + Math.floor(this.random() * 6);
    this.rolled = [a, b];
    this.dice = a === b ? [a, a, a, a] : [a, b];
    return true;
  }
  home(player) {
    const sign = player === 1 ? 1 : -1;
    return (
      !this.bar[player] &&
      this.points.every((n, i) => n * sign <= 0 || (player === 1 ? i <= 5 : i >= 18))
    );
  }
  rawOptions() {
    if (!this.dice.length || this.winner) return [];
    const player = this.turn,
      sign = player === 1 ? 1 : -1,
      moves = [];
    const sources = this.bar[player]
      ? [-1]
      : this.points.map((n, i) => (n * sign > 0 ? i : -2)).filter((i) => i >= 0);
    for (const from of sources)
      for (const die of [...new Set(this.dice)]) {
        const to =
          from === -1 ? (player === 1 ? 24 - die : die - 1) : from + (player === 1 ? -die : die);
        if (to >= 0 && to < 24) {
          if (this.points[to] * sign >= -1) moves.push({ from, to, die });
        } else if (from >= 0 && this.home(player)) {
          const distance = player === 1 ? from + 1 : 24 - from;
          const farther = this.points.some(
            (n, i) => n * sign > 0 && (player === 1 ? i > from : i < from),
          );
          if (die === distance || (die > distance && !farther)) moves.push({ from, to: 24, die });
        }
      }
    return moves;
  }
  snapshot() {
    return {
      points: [...this.points],
      bar: { ...this.bar },
      off: { ...this.off },
      dice: [...this.dice],
      winner: this.winner,
    };
  }
  stateKey() {
    return `${this.turn}|${this.points.join(',')}|${this.bar[1]},${this.bar[2]}|${this.off[1]},${this.off[2]}|${[...this.dice].sort().join(',')}|${this.winner}`;
  }
  applyMove(move) {
    const player = this.turn,
      sign = player === 1 ? 1 : -1;
    if (move.from === -1) this.bar[player]--;
    else this.points[move.from] -= sign;
    if (move.to === 24) this.off[player]++;
    else {
      if (this.points[move.to] === -sign) {
        this.points[move.to] = 0;
        this.bar[3 - player]++;
      }
      this.points[move.to] += sign;
    }
    this.dice.splice(this.dice.indexOf(move.die), 1);
    if (this.off[player] === 15) this.winner = player;
  }
  options() {
    const key = this.stateKey();
    if (this.cachedKey === key) return this.cachedOptions.map((m) => ({ ...m }));
    const memo = new Map();
    const remaining = () => {
      const k = this.stateKey();
      if (memo.has(k)) return memo.get(k);
      let best = 0;
      const limit = this.dice.length;
      for (const move of this.rawOptions()) {
        const state = this.snapshot();
        this.applyMove(move);
        const count = 1 + remaining();
        Object.assign(this, state);
        best = Math.max(best, count);
        if (best === limit) break;
      }
      memo.set(k, best);
      return best;
    };
    const candidates = this.rawOptions().map((move) => {
      const state = this.snapshot();
      this.applyMove(move);
      const count = 1 + remaining();
      Object.assign(this, state);
      return { move, count };
    });
    const best = Math.max(0, ...candidates.map((c) => c.count));
    let legal = candidates.filter((c) => c.count === best).map((c) => c.move);
    // Both dice must be used when possible; when only one can be used, use the higher die.
    if (best === 1 && new Set(this.dice).size > 1) {
      const higher = Math.max(...legal.map((m) => m.die));
      legal = legal.filter((m) => m.die === higher);
    }
    this.cachedKey = key;
    this.cachedOptions = legal;
    return legal.map((m) => ({ ...m }));
  }
  play(move) {
    const valid = this.options().find(
      (m) => m.from === move.from && m.to === move.to && m.die === move.die,
    );
    if (!valid) return false;
    this.applyMove(valid);
    return true;
  }
  endTurn() {
    this.dice = [];
    this.rolled = [];
    this.turn = 3 - this.turn;
  }
}

export function createBackgammon(sys) {
  const model = new BackgammonModel();
  const win = sys.createWindow({
    title: 'Internet Backgammon',
    icon: 'game',
    width: 760,
    height: 530,
    minWidth: 430,
    minHeight: 350,
  });
  const board = h('div', { class: 'backgammon-board', 'aria-label': 'Backgammon board' }),
    info = h('aside', { class: 'board-info' }),
    dice = h('div', { class: 'dice-row' }),
    message = h('div', { class: 'game-turn' }),
    score = h('p');
  let selected = null,
    aiTimer,
    thinking = false;
  const reset = () => {
    clearTimeout(aiTimer);
    thinking = false;
    model.reset();
    selected = null;
    render();
  };
  const checkTurn = () => {
    if (model.winner) {
      message.textContent = model.winner === 1 ? 'You won!' : 'The computer won.';
      return;
    }
    if (!model.dice.length || !model.options().length) {
      model.endTurn();
      selected = null;
      if (model.turn === 2) computer();
    }
    render();
  };
  const roll = () => {
    if (model.turn !== 1 || thinking) return;
    model.roll();
    if (model.bar[1]) selected = -1;
    checkTurn();
  };
  const moveTo = (to) => {
    if (model.turn !== 1 || thinking) return;
    const candidates = model
      .options()
      .filter((m) => m.from === selected && m.to === to)
      .sort((a, b) => b.die - a.die);
    if (candidates.length) {
      model.play(candidates[0]);
      selected = model.bar[1] ? -1 : null;
      checkTurn();
    }
  };
  const computer = () => {
    thinking = true;
    model.roll();
    render();
    const step = () => {
      if (win.closed) return;
      const moves = model.options();
      if (!moves.length || !model.dice.length) {
        model.endTurn();
        thinking = false;
        render();
        return;
      }
      moves.sort((a, b) => {
        const score = (m) =>
          (m.to === 24 ? 50 : 0) +
          (m.to >= 0 && m.to < 24 && model.points[m.to] === 1 ? 20 : 0) +
          (m.from === -1 ? 30 : 0) +
          m.die;
        return score(b) - score(a);
      });
      model.play(moves[0]);
      render();
      if (model.winner) {
        thinking = false;
        render();
        return;
      }
      aiTimer = setTimeout(step, 350);
    };
    aiTimer = setTimeout(step, 500);
  };
  function render() {
    board.replaceChildren();
    dice.replaceChildren();
    const order = [
        12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
      ],
      valid = model.options();
    for (const [index, pos] of order.entries()) {
      const point = button(
        '',
        () => {
          if (thinking || model.turn !== 1) return;
          if (selected !== null && valid.some((m) => m.from === selected && m.to === pos)) {
            moveTo(pos);
            return;
          }
          if (model.points[pos] > 0 && !model.bar[1]) {
            selected = pos;
            render();
          }
        },
        {
          class:
            'backgammon-point' +
            (index >= 12 ? ' bottom' : '') +
            (pos % 2 ? ' alt' : '') +
            (selected === pos ? ' selected' : '') +
            (model.turn === 1 && valid.some((m) => m.from === selected && m.to === pos)
              ? ' valid'
              : ''),
          title: `Point ${pos + 1}: ${Math.abs(model.points[pos])} ${model.points[pos] >= 0 ? 'white' : 'black'} checkers`,
        },
      );
      for (let i = 0; i < Math.min(7, Math.abs(model.points[pos])); i++)
        point.append(
          h(
            'span',
            { class: 'board-piece' + (model.points[pos] < 0 ? ' black' : '') },
            i === 6 && Math.abs(model.points[pos]) > 7 ? String(Math.abs(model.points[pos])) : '',
          ),
        );
      board.append(point);
    }
    for (const value of model.dice) dice.append(h('span', { class: 'die' }, value));
    score.textContent = `You: ${model.off[1]} off · ${model.bar[1]} on bar\nComputer: ${model.off[2]} off · ${model.bar[2]} on bar`;
    message.textContent = model.winner
      ? model.winner === 1
        ? 'You won!'
        : 'The computer won.'
      : thinking
        ? 'Computer’s turn.'
        : !model.dice.length
          ? 'Roll the dice to begin your turn.'
          : model.bar[1]
            ? 'Re-enter your checker from the bar.'
            : 'Choose a white checker and its destination.';
  }
  info.append(
    h('h3', {}, 'Backgammon'),
    h('p', {}, 'Local game · You play white'),
    score,
    message,
    dice,
    button('Roll Dice', roll),
    button('Select Bar', () => {
      if (model.bar[1]) {
        selected = -1;
        render();
      }
    }),
    button('Bear Off', () => moveTo(24)),
    button('New Game', reset),
  );
  win.menu([
    {
      label: 'Game',
      items: [
        { label: 'New Game', action: reset },
        { label: 'Roll Dice', action: roll },
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
              'Move white checkers toward point 1, using the dice. A point occupied by two or more black checkers is blocked. Landing on one black checker hits it onto the bar. Checkers on the bar must re-enter first. Doubles allow four moves. Once all your checkers are in points 1–6, bear them off. First to bear off all 15 wins.\n\nLocal computer opponent. The original online service is not connected. Doubling cube and match play are not implemented.',
              { title: 'Backgammon', icon: 'game' },
            ),
        },
      ],
    },
  ]);
  win.content.append(
    h('div', { class: 'board-game' }, h('div', { class: 'board-area' }, board), info),
  );
  win.onDispose(() => clearTimeout(aiTimer));
  render();
  win.model = model;
  return win;
}
