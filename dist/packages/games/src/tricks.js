import { h, button, select } from '../../ui/src/dom.js';
import { createDeck, shuffle, suitSymbols, cardColor, rankLabel } from './models.js';
import { cardElement } from './cards.js';

export class TrickGameModel {
  constructor(kind = 'hearts', random = Math.random) {
    this.kind = kind;
    this.random = random;
    this.round = 0;
    this.scores = kind === 'spades' ? [0, 0] : [0, 0, 0, 0];
    this.bags = [0, 0];
    this.newHand();
  }
  newHand() {
    const deck = shuffle(createDeck(), this.random);
    this.hands = Array.from({ length: 4 }, () => []);
    deck.forEach((c, i) => this.hands[i % 4].push(c));
    for (const hand of this.hands) hand.sort((a, b) => a.suit - b.suit || a.rank - b.rank);
    this.trick = [];
    this.taken = [0, 0, 0, 0];
    this.points = [0, 0, 0, 0];
    this.tricks = 0;
    this.broken = false;
    this.over = false;
    this.handOver = false;
    this.bids = [0, 0, 0, 0];
    this.phase = this.kind === 'spades' ? 'bidding' : this.round % 4 === 3 ? 'playing' : 'passing';
    this.turn = 0;
    if (this.phase === 'playing') this.findLeader();
  }
  findLeader() {
    this.turn =
      this.kind === 'hearts'
        ? this.hands.findIndex((h) => h.some((c) => c.suit === 2 && c.rank === 2))
        : this.round % 4;
  }
  pass(ids) {
    if (this.phase !== 'passing' || ids.length !== 3 || new Set(ids).size !== 3) return false;
    const selected = this.hands[0].filter((c) => ids.includes(c.id));
    if (selected.length !== 3) return false;
    const sets = [
        selected,
        ...this.hands
          .slice(1)
          .map((h) => [...h].sort((a, b) => this.danger(b) - this.danger(a)).slice(0, 3)),
      ],
      offset = [1, 3, 2][this.round % 4];
    for (let seat = 0; seat < 4; seat++)
      this.hands[seat] = this.hands[seat].filter((c) => !sets[seat].includes(c));
    for (let seat = 0; seat < 4; seat++) this.hands[(seat + offset) % 4].push(...sets[seat]);
    for (const h of this.hands) h.sort((a, b) => a.suit - b.suit || a.rank - b.rank);
    this.phase = 'playing';
    this.findLeader();
    return true;
  }
  danger(c) {
    return c.suit === 0 && c.rank === 12
      ? 100
      : c.suit === 1
        ? c.rank + 15
        : c.rank === 1
          ? 20
          : c.rank;
  }
  bid(value) {
    if (this.phase !== 'bidding' || !Number.isInteger(value) || value < 0 || value > 13)
      return false;
    this.bids[0] = value;
    for (let s = 1; s < 4; s++)
      this.bids[s] = Math.max(
        1,
        Math.min(
          8,
          Math.round(
            this.hands[s].reduce(
              (sum, c) =>
                sum +
                (c.suit === 0
                  ? c.rank === 1
                    ? 1.1
                    : c.rank >= 10
                      ? 0.85
                      : 0.3
                  : c.rank === 1
                    ? 0.9
                    : c.rank === 13
                      ? 0.3
                      : 0),
              0,
            ),
          ),
        ),
      );
    this.phase = 'playing';
    this.findLeader();
    return true;
  }
  rank(c) {
    return c.rank === 1 ? 14 : c.rank;
  }
  legal(seat = this.turn) {
    if (this.phase !== 'playing' || this.handOver) return [];
    const hand = this.hands[seat];
    let legal = [...hand];
    if (this.trick.length) {
      const lead = this.trick[0].card.suit,
        same = hand.filter((c) => c.suit === lead);
      if (same.length) legal = same;
      else if (this.kind === 'hearts' && this.tricks === 0) {
        const safe = hand.filter((c) => c.suit !== 1 && !(c.suit === 0 && c.rank === 12));
        if (safe.length) legal = safe;
      }
    } else if (this.kind === 'hearts') {
      if (this.tricks === 0) return hand.filter((c) => c.suit === 2 && c.rank === 2);
      if (!this.broken) {
        const non = hand.filter((c) => c.suit !== 1);
        if (non.length) legal = non;
      }
    } else if (!this.broken) {
      const non = hand.filter((c) => c.suit !== 0);
      if (non.length) legal = non;
    }
    return legal;
  }
  play(id) {
    const legal = this.legal(),
      card = legal.find((c) => c.id === id);
    if (!card || this.trick.length >= 4) return false;
    this.hands[this.turn] = this.hands[this.turn].filter((c) => c.id !== id);
    this.trick.push({ seat: this.turn, card });
    if (card.suit === (this.kind === 'hearts' ? 1 : 0)) this.broken = true;
    this.turn = (this.turn + 1) % 4;
    return true;
  }
  settle() {
    if (this.trick.length !== 4) return null;
    const lead = this.trick[0].card.suit;
    const contenders =
      this.kind === 'spades' && this.trick.some((t) => t.card.suit === 0)
        ? this.trick.filter((t) => t.card.suit === 0)
        : this.trick.filter((t) => t.card.suit === lead);
    contenders.sort((a, b) => this.rank(b.card) - this.rank(a.card));
    const winner = contenders[0].seat;
    this.taken[winner]++;
    this.points[winner] += this.trick.reduce(
      (sum, t) => sum + (t.card.suit === 1 ? 1 : t.card.suit === 0 && t.card.rank === 12 ? 13 : 0),
      0,
    );
    this.turn = winner;
    this.tricks++;
    this.trick = [];
    if (this.tricks === 13) this.finishHand();
    return winner;
  }
  finishHand() {
    if (this.handOver) return;
    this.handOver = true;
    this.phase = 'finished';
    if (this.kind === 'hearts') {
      const moon = this.points.findIndex((p) => p === 26);
      for (let s = 0; s < 4; s++)
        this.scores[s] += moon >= 0 ? (s === moon ? 0 : 26) : this.points[s];
      this.over = this.scores.some((s) => s >= 100);
    } else {
      for (let team = 0; team < 2; team++) {
        const seats = [team, team + 2],
          contract = seats.reduce((sum, s) => sum + this.bids[s], 0);
        let tricks = 0,
          score = 0,
          nilBags = 0;
        for (const s of seats) {
          if (this.bids[s] === 0) {
            score += this.taken[s] === 0 ? 100 : -100;
            nilBags += this.taken[s];
          } else tricks += this.taken[s];
        }
        const bags = nilBags + Math.max(0, tricks - contract);
        score += tricks >= contract ? contract * 10 : -contract * 10;
        score += bags;
        this.bags[team] += bags;
        while (this.bags[team] >= 10) {
          score -= 100;
          this.bags[team] -= 10;
        }
        this.scores[team] += score;
      }
      this.over = this.scores.some((s) => s >= 500) && this.scores[0] !== this.scores[1];
    }
    this.round++;
  }
  aiCard() {
    const legal = this.legal();
    if (!legal.length) return null;
    const lead = this.trick[0]?.card.suit;
    if (this.kind === 'hearts') {
      if (!this.trick.length) return [...legal].sort((a, b) => this.rank(a) - this.rank(b))[0];
      if (legal[0].suit !== lead)
        return [...legal].sort((a, b) => this.danger(b) - this.danger(a))[0];
      const high = Math.max(
        ...this.trick.filter((t) => t.card.suit === lead).map((t) => this.rank(t.card)),
      );
      const under = legal.filter((c) => this.rank(c) < high);
      return [...(under.length ? under : legal)].sort((a, b) =>
        under.length ? this.rank(b) - this.rank(a) : this.rank(a) - this.rank(b),
      )[0];
    }
    if (this.bids[this.turn] === 0)
      return [...legal].sort((a, b) => this.rank(a) - this.rank(b))[0];
    const needs = this.taken[this.turn] < this.bids[this.turn];
    return [...legal].sort((a, b) =>
      needs ? this.rank(b) - this.rank(a) : this.rank(a) - this.rank(b),
    )[0];
  }
}

export function createTrickGame(sys, args = {}) {
  const kind = args.kind ?? 'hearts',
    internet = !!args.internet,
    name = kind === 'spades' ? 'Internet Spades' : internet ? 'Internet Hearts' : 'Hearts';
  let model = new TrickGameModel(kind);
  const win = sys.createWindow({
    title: name,
    icon: 'game',
    width: 670,
    height: 520,
    minWidth: 400,
    minHeight: 360,
  });
  const table = h('div', { class: 'trick-table', 'aria-label': name + ' table' }),
    status = h('footer', { class: 'status-bar' }, h('span'), h('span'));
  const names = [sys.settings.get('userName') ?? 'You', 'West', 'North', 'East'];
  let selected = new Set(),
    timer;
  const schedule = () => {
    clearTimeout(timer);
    if (win.closed || model.phase !== 'playing') return;
    if (model.trick.length === 4) {
      timer = setTimeout(() => {
        model.settle();
        render();
        schedule();
      }, 850);
      return;
    }
    if (model.turn !== 0) {
      timer = setTimeout(() => {
        const c = model.aiCard();
        if (c) model.play(c.id);
        render();
        schedule();
      }, 480);
    }
  };
  const reset = () => {
    clearTimeout(timer);
    model = new TrickGameModel(kind);
    selected.clear();
    render();
    schedule();
  };
  const next = () => {
    model.newHand();
    selected.clear();
    render();
    schedule();
  };
  const play = (card) => {
    if (model.phase === 'passing') {
      if (selected.has(card.id)) selected.delete(card.id);
      else if (selected.size < 3) selected.add(card.id);
      render();
      return;
    }
    if (model.turn === 0 && model.play(card.id)) {
      render();
      schedule();
    }
  };
  function render() {
    table.replaceChildren();
    const labels = ['', 'west', 'north', 'east'];
    for (let i = 1; i < 4; i++) {
      const player = h(
        'div',
        { class: 'trick-player ' + labels[i] },
        h('strong', {}, names[i]),
        h('br'),
        `${model.hands[i].length} cards`,
        h('br'),
        kind === 'hearts'
          ? `${model.points[i]} points`
          : `Bid ${model.bids[i]} · Won ${model.taken[i]}`,
      );
      if (model.phase === 'playing' && model.turn === i) player.style.color = '#ffff8a';
      table.append(player);
    }
    const center = h('div', { class: 'trick-center' });
    for (const entry of model.trick) {
      const c = cardElement(entry.card);
      c.dataset.seat = entry.seat;
      center.append(c);
    }
    table.append(center);
    const hand = h('div', { class: 'trick-hand', 'aria-label': 'Your hand' }),
      legal = new Set(model.turn === 0 ? model.legal(0).map((c) => c.id) : []);
    for (const c of model.hands[0]) {
      const element = cardElement(c);
      element.classList.toggle('legal', legal.has(c.id));
      element.classList.toggle('selected', selected.has(c.id));
      element.addEventListener('click', () => play(c));
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          play(c);
        }
      });
      hand.append(element);
    }
    table.append(hand);
    const message = h('div', { class: 'trick-message' });
    if (model.phase === 'passing') {
      message.append(
        `Choose three cards to pass ${['left', 'right', 'across'][model.round % 4]}.`,
        h('br'),
        button(
          'Pass Cards',
          () => {
            if (model.pass([...selected])) {
              selected.clear();
              render();
              schedule();
            }
          },
          { disabled: selected.size !== 3 },
        ),
      );
    } else if (model.phase === 'bidding') {
      const bid = select(
        Array.from({ length: 14 }, (_, i) => String(i)),
        '3',
      );
      message.append(
        'How many tricks will you take?',
        h('br'),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '7px' } },
          bid,
          button('Bid', () => {
            model.bid(+bid.value);
            render();
            schedule();
          }),
        ),
      );
    } else if (model.handOver) {
      let text;
      if (kind === 'hearts') text = names.map((n, i) => `${n}: ${model.scores[i]}`).join(' · ');
      else text = `Your team: ${model.scores[0]} · Opponents: ${model.scores[1]}`;
      message.style.top = '105px';
      message.style.background = '#006200';
      message.style.padding = '16px';
      message.style.border = '1px solid #00a000';
      message.append(
        h('strong', {}, model.over ? 'Game over' : 'Hand complete'),
        h('p', {}, text),
        button(model.over ? 'New Game' : 'Next Hand', model.over ? reset : next),
      );
    } else
      message.append(
        model.turn === 0 ? 'Your turn. Select a legal card.' : '',
        kind === 'spades'
          ? h('p', {}, `Your bid: ${model.bids[0]} · Tricks: ${model.taken[0]}`)
          : null,
      );
    table.append(message);
    status.children[0].textContent =
      kind === 'hearts'
        ? names.map((n, i) => n + ': ' + model.scores[i]).join('   ')
        : `Your team: ${model.scores[0]}   Opponents: ${model.scores[1]}   Bags: ${model.bags[0]}`;
    status.children[1].textContent = `Hand ${model.round + 1} · ${model.tricks}/13 tricks`;
  }
  win.menu([
    {
      label: 'Game',
      items: [
        { label: 'New Game', shortcut: 'F2', action: reset },
        {
          label: 'Statistics',
          action: () =>
            sys.dialogs.message(
              kind === 'hearts'
                ? names.map((n, i) => `${n}: ${model.scores[i]} points`).join('\n')
                : `Your team: ${model.scores[0]} points\nOpponents: ${model.scores[1]} points\nYour bags: ${model.bags[0]}`,
              { title: 'Score', icon: 'game' },
            ),
        },
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
              kind === 'hearts'
                ? 'Avoid taking hearts (1 point each) and the Queen of Spades (13 points). Follow suit if you can. The Two of Clubs leads the first trick. Hearts cannot be led until broken, unless you only have hearts. Pass three cards at the start of each hand: left, right, across, then no pass. Taking all 26 points shoots the moon and gives each opponent 26 points. Lowest score wins when someone reaches 100.'
                : 'Bid how many tricks you will take. You and North are partners. Follow suit when possible; spades are trump and cannot be led until broken, unless you have only spades. Meet your combined contract for 10 points per bid trick; extra tricks are bags worth 1 point each. Ten bags cost 100 points. Nil bids score +100 if successful, −100 otherwise. Failed nil tricks count as bags. A team wins at 500 or more only when it has the higher score; a tie continues.',
              { title: 'How to Play ' + name, icon: 'game' },
            ),
        },
        ...(internet
          ? [
              {
                label: 'Connection Information',
                action: () =>
                  sys.dialogs.message(
                    'This browser edition uses local computer opponents. The original Microsoft Internet Games service is not connected.',
                    { title: 'Connection Information', icon: 'network' },
                  ),
              },
            ]
          : []),
      ],
    },
  ]);
  win.content.append(table, status);
  win.onDispose(() => clearTimeout(timer));
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
  schedule();
  win.model = model;
  return win;
}
