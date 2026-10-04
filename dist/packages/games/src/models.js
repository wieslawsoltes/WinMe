import { History } from '../../core/src/index.js';

export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(array, random = Math.random) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const suitSymbols = ['♠', '♥', '♣', '♦'];
export const rankLabel = (rank) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank] ?? String(rank);
export const cardColor = (card) => (card.suit % 2 === 1 ? 'red' : 'black');
export const createDeck = () =>
  Array.from({ length: 52 }, (_, id) => ({
    id,
    rank: (id % 13) + 1,
    suit: Math.floor(id / 13),
    faceUp: true,
  }));

export class MinesweeperModel {
  constructor(width = 8, height = 8, mines = 10, random = Math.random) {
    this.reset(width, height, mines, random);
  }
  reset(width = this.width, height = this.height, mines = this.mines, random = this.random) {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 3 ||
      height < 3 ||
      width > 100 ||
      height > 100 ||
      !Number.isInteger(mines) ||
      mines < 0 ||
      typeof random !== 'function'
    )
      throw new RangeError(
        'Use a board of 3–100 rows and columns and a nonnegative integer mine count.',
      );
    this.width = width;
    this.height = height;
    this.mines = Math.min(mines, width * height - 9);
    this.random = random;
    this.cells = Array.from({ length: width * height }, () => ({
      mine: false,
      count: 0,
      revealed: false,
      flag: 0,
    }));
    this.state = 'ready';
    this.flags = 0;
    this.revealed = 0;
    this.exploded = -1;
    return this;
  }
  neighbors(index) {
    const x = index % this.width,
      y = Math.floor(index / this.width),
      result = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < this.width && ny < this.height)
          result.push(ny * this.width + nx);
      }
    return result;
  }
  plant(first) {
    const safe = new Set([first, ...this.neighbors(first)]),
      choices = shuffle(
        this.cells.map((_, i) => i).filter((i) => !safe.has(i)),
        this.random,
      );
    for (const i of choices.slice(0, this.mines)) this.cells[i].mine = true;
    for (let i = 0; i < this.cells.length; i++)
      this.cells[i].count = this.neighbors(i).filter((j) => this.cells[j].mine).length;
    this.state = 'playing';
  }
  reveal(index) {
    const c = this.cells[index];
    if (!c || c.flag === 1 || c.revealed || ['lost', 'won'].includes(this.state)) return false;
    if (this.state === 'ready') this.plant(index);
    if (c.mine) {
      c.revealed = true;
      this.exploded = index;
      this.state = 'lost';
      return true;
    }
    const queue = [index];
    while (queue.length) {
      const i = queue.pop(),
        cell = this.cells[i];
      if (cell.revealed || cell.flag === 1 || cell.mine) continue;
      cell.revealed = true;
      cell.flag = 0;
      this.revealed++;
      if (cell.count === 0) queue.push(...this.neighbors(i));
    }
    if (this.revealed === this.width * this.height - this.mines) {
      this.state = 'won';
      for (const c of this.cells) if (c.mine) c.flag = 1;
      this.flags = this.mines;
    }
    return true;
  }
  flag(index, question = true) {
    const c = this.cells[index];
    if (!c || c.revealed || ['lost', 'won'].includes(this.state)) return;
    const old = c.flag;
    c.flag = question ? (c.flag + 1) % 3 : c.flag === 1 ? 0 : 1;
    this.flags += (c.flag === 1 ? 1 : 0) - (old === 1 ? 1 : 0);
  }
  chord(index) {
    const c = this.cells[index];
    if (!c?.revealed || !c.count) return;
    const adjacent = this.neighbors(index);
    if (adjacent.filter((i) => this.cells[i].flag === 1).length === c.count)
      for (const i of adjacent) {
        this.reveal(i);
        if (this.state === 'lost') break;
      }
  }
}

export class SolitaireModel {
  constructor({ draw = 1, random = Math.random } = {}) {
    this.drawCount = draw;
    this.random = random;
    this.history = new History(100);
    this.deal();
  }
  deal() {
    const deck = shuffle(
      createDeck().map((c) => ({ ...c, faceUp: false })),
      this.random,
    );
    this.tableau = Array.from({ length: 7 }, () => []);
    for (let row = 0; row < 7; row++)
      for (let column = row; column < 7; column++) {
        const card = deck.pop();
        card.faceUp = row === column;
        this.tableau[column].push(card);
      }
    this.stock = deck;
    this.waste = [];
    this.foundations = Array.from({ length: 4 }, () => []);
    this.score = 0;
    this.moves = 0;
    this.history.clear();
  }
  snapshot() {
    return structuredClone({
      tableau: this.tableau,
      stock: this.stock,
      waste: this.waste,
      foundations: this.foundations,
      score: this.score,
      moves: this.moves,
    });
  }
  restore(s) {
    Object.assign(this, structuredClone(s));
  }
  draw() {
    if (!this.stock.length && !this.waste.length) return false;
    this.history.push(this.snapshot());
    if (this.stock.length) {
      for (let i = 0; i < this.drawCount && this.stock.length; i++) {
        const c = this.stock.pop();
        c.faceUp = true;
        this.waste.push(c);
      }
    } else {
      this.stock = this.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      this.waste = [];
      this.score = Math.max(0, this.score - 100);
    }
    this.moves++;
    return true;
  }
  pile(source) {
    return source.type === 'tableau'
      ? this.tableau[source.index]
      : source.type === 'foundation'
        ? this.foundations[source.index]
        : source.type === 'waste'
          ? this.waste
          : this.stock;
  }
  movable(source) {
    const pile = this.pile(source),
      index = source.type === 'tableau' ? (source.cardIndex ?? pile.length - 1) : pile.length - 1;
    if (index < 0 || index >= pile.length) return null;
    const cards = pile.slice(index);
    if (!cards[0].faceUp) return null;
    if (source.type !== 'tableau' && cards.length !== 1) return null;
    for (let i = 1; i < cards.length; i++)
      if (
        !cards[i].faceUp ||
        cards[i - 1].rank !== cards[i].rank + 1 ||
        cardColor(cards[i - 1]) === cardColor(cards[i])
      )
        return null;
    return cards;
  }
  canMove(source, target) {
    if (
      source.type === target.type &&
      (source.index === target.index || source.type === 'foundation')
    )
      return false;
    const cards = this.movable(source);
    if (!cards) return false;
    const destination = this.pile(target),
      top = destination.at(-1),
      card = cards[0];
    if (target.type === 'foundation')
      return (
        cards.length === 1 &&
        (top ? card.suit === top.suit && card.rank === top.rank + 1 : card.rank === 1)
      );
    if (target.type === 'tableau')
      return top
        ? top.faceUp && card.rank === top.rank - 1 && cardColor(card) !== cardColor(top)
        : card.rank === 13;
    return false;
  }
  move(source, target) {
    if (!this.canMove(source, target)) return false;
    this.history.push(this.snapshot());
    const src = this.pile(source),
      cards = this.movable(source);
    src.splice(src.length - cards.length);
    this.pile(target).push(...cards);
    if (src.at(-1) && !src.at(-1).faceUp) {
      src.at(-1).faceUp = true;
      this.score += 5;
    }
    this.score +=
      target.type === 'foundation'
        ? 10
        : source.type === 'foundation'
          ? -15
          : source.type === 'waste'
            ? 5
            : 0;
    this.moves++;
    return true;
  }
  auto(source) {
    for (let i = 0; i < 4; i++)
      if (this.move(source, { type: 'foundation', index: i })) return true;
    return false;
  }
  undo() {
    const s = this.history.undo(this.snapshot());
    if (s) this.restore(s);
    return !!s;
  }
  hint() {
    for (const source of [
      { type: 'waste', index: 0 },
      ...this.tableau.flatMap((pile, index) =>
        pile.map((card, cardIndex) => ({ type: 'tableau', index, cardIndex })),
      ),
    ]) {
      for (const target of [
        ...this.foundations.map((_, index) => ({ type: 'foundation', index })),
        ...this.tableau.map((_, index) => ({ type: 'tableau', index })),
      ])
        if (this.canMove(source, target)) return { source, target };
    }
    return this.stock.length || this.waste.length ? { draw: true } : null;
  }
  get won() {
    return this.foundations.every((p) => p.length === 13);
  }
}

export class FreeCellModel {
  constructor(seed = 1) {
    this.seed = seed;
    this.history = new History(100);
    this.deal(seed);
  }
  deal(seed = this.seed) {
    this.seed = seed;
    const cards = shuffle(createDeck(), seededRandom(seed));
    this.tableau = Array.from({ length: 8 }, () => []);
    cards.forEach((c, i) => this.tableau[i % 8].push(c));
    this.cells = Array.from({ length: 4 }, () => []);
    this.foundations = Array.from({ length: 4 }, () => []);
    this.moves = 0;
    this.history.clear();
  }
  snapshot() {
    return structuredClone({
      tableau: this.tableau,
      cells: this.cells,
      foundations: this.foundations,
      moves: this.moves,
    });
  }
  pile(source) {
    return source.type === 'tableau'
      ? this.tableau[source.index]
      : source.type === 'cell'
        ? this.cells[source.index]
        : this.foundations[source.index];
  }
  canMove(source, target) {
    if (source.type === target.type && source.index === target.index) return false;
    const src = this.pile(source),
      at = source.type === 'tableau' ? (source.cardIndex ?? src.length - 1) : src.length - 1,
      cards = src.slice(at),
      dst = this.pile(target);
    if (!cards.length || at < 0) return false;
    for (let i = 1; i < cards.length; i++)
      if (
        cards[i - 1].rank !== cards[i].rank + 1 ||
        cardColor(cards[i - 1]) === cardColor(cards[i])
      )
        return false;
    const c = cards[0],
      top = dst.at(-1);
    if (target.type === 'cell') return cards.length === 1 && !dst.length;
    if (target.type === 'foundation')
      return (
        cards.length === 1 && (top ? c.suit === top.suit && c.rank === top.rank + 1 : c.rank === 1)
      );
    if (target.type === 'tableau') {
      const free = this.cells.filter((p) => !p.length).length,
        empty = this.tableau.filter(
          (p, i) =>
            !p.length && i !== target.index && !(source.type === 'tableau' && i === source.index),
        ).length,
        capacity = (free + 1) * 2 ** empty;
      return (
        cards.length <= capacity &&
        (!top || (c.rank === top.rank - 1 && cardColor(c) !== cardColor(top)))
      );
    }
    return false;
  }
  move(source, target) {
    if (!this.canMove(source, target)) return false;
    this.history.push(this.snapshot());
    const src = this.pile(source),
      at = source.type === 'tableau' ? (source.cardIndex ?? src.length - 1) : src.length - 1;
    this.pile(target).push(...src.splice(at));
    this.moves++;
    return true;
  }
  auto(source) {
    for (let index = 0; index < 4; index++)
      if (this.move(source, { type: 'foundation', index })) return true;
    return false;
  }
  undo() {
    const s = this.history.undo(this.snapshot());
    if (s) Object.assign(this, s);
    return !!s;
  }
  get won() {
    return this.foundations.every((p) => p.length === 13);
  }
}

export class SpiderModel {
  constructor({ suits = 1, random = Math.random } = {}) {
    this.suits = suits;
    this.random = random;
    this.history = new History(100);
    this.deal();
  }
  deal() {
    const deck = shuffle(
      Array.from({ length: 104 }, (_, id) => ({
        id,
        rank: (id % 13) + 1,
        suit:
          this.suits === 1
            ? 0
            : this.suits === 2
              ? Math.floor(id / 13) % 2
              : Math.floor(id / 13) % 4,
        faceUp: false,
      })),
      this.random,
    );
    this.tableau = Array.from({ length: 10 }, () => []);
    for (let i = 0; i < 54; i++) this.tableau[i % 10].push(deck.pop());
    for (const p of this.tableau) p.at(-1).faceUp = true;
    this.stock = deck;
    this.completed = [];
    this.score = 500;
    this.moves = 0;
    this.history.clear();
  }
  snapshot() {
    return structuredClone({
      tableau: this.tableau,
      stock: this.stock,
      completed: this.completed,
      score: this.score,
      moves: this.moves,
    });
  }
  movable(index, at) {
    const cards = this.tableau[index].slice(at);
    if (!cards.length || !cards[0].faceUp) return false;
    return cards.every(
      (c, i) =>
        c.faceUp && (!i || (c.rank === cards[i - 1].rank - 1 && c.suit === cards[i - 1].suit)),
    );
  }
  move(source, target) {
    if (source.index === target.index || !this.movable(source.index, source.cardIndex))
      return false;
    const cards = this.tableau[source.index].slice(source.cardIndex),
      top = this.tableau[target.index].at(-1);
    if (top && cards[0].rank !== top.rank - 1) return false;
    this.history.push(this.snapshot());
    this.tableau[source.index].splice(source.cardIndex);
    this.tableau[target.index].push(...cards);
    if (this.tableau[source.index].length) this.tableau[source.index].at(-1).faceUp = true;
    this.score--;
    this.moves++;
    this.collect();
    return true;
  }
  collect() {
    for (const pile of this.tableau) {
      if (pile.length < 13) continue;
      const run = pile.slice(-13);
      if (run.every((c, i) => c.faceUp && c.rank === 13 - i && c.suit === run[0].suit)) {
        this.completed.push(pile.splice(-13));
        this.score += 100;
        if (pile.length) pile.at(-1).faceUp = true;
      }
    }
  }
  draw() {
    if (!this.stock.length) return false;
    if (this.tableau.some((p) => !p.length)) return false;
    this.history.push(this.snapshot());
    for (const pile of this.tableau) {
      const c = this.stock.pop();
      c.faceUp = true;
      pile.push(c);
    }
    this.score--;
    this.moves++;
    this.collect();
    return true;
  }
  undo() {
    const s = this.history.undo(this.snapshot());
    if (s) Object.assign(this, s);
    return !!s;
  }
  get won() {
    return this.completed.length === 8;
  }
}

export class ReversiModel {
  constructor() {
    this.reset();
  }
  reset() {
    this.board = Array(64).fill(0);
    this.board[27] = this.board[36] = 2;
    this.board[28] = this.board[35] = 1;
    this.turn = 1;
    this.over = false;
  }
  flips(index, player = this.turn) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= 64 ||
      ![1, 2].includes(player) ||
      this.board[index]
    )
      return [];
    const x = index % 8,
      y = Math.floor(index / 8),
      flips = [];
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]) {
      let nx = x + dx,
        ny = y + dy,
        run = [];
      while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
        const cell = this.board[ny * 8 + nx];
        if (cell === 0) {
          run = [];
          break;
        }
        if (cell === player) break;
        run.push(ny * 8 + nx);
        nx += dx;
        ny += dy;
      }
      if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && this.board[ny * 8 + nx] === player)
        flips.push(...run);
    }
    return flips;
  }
  valid(player = this.turn) {
    return this.board.map((_, i) => i).filter((i) => this.flips(i, player).length);
  }
  play(index) {
    if (this.over) return false;
    const flips = this.flips(index);
    if (!flips.length) return false;
    this.board[index] = this.turn;
    for (const i of flips) this.board[i] = this.turn;
    this.turn = 3 - this.turn;
    if (!this.valid().length) this.turn = 3 - this.turn;
    this.over = !this.valid().length;
    return true;
  }
  ai() {
    const choices = this.valid();
    if (!choices.length) return;
    choices.sort((a, b) => this.value(b) - this.value(a));
    this.play(choices[0]);
  }
  value(i) {
    const x = i % 8,
      y = Math.floor(i / 8);
    return (
      ([0, 7, 56, 63].includes(i) ? 1000 : 0) +
      (x === 0 || x === 7 || y === 0 || y === 7 ? 40 : 0) -
      ([1, 6, 8, 9, 14, 15, 48, 49, 54, 55, 57, 62].includes(i) ? 70 : 0) +
      this.flips(i).length
    );
  }
}
