import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MinesweeperModel,
  SolitaireModel,
  FreeCellModel,
  SpiderModel,
  ReversiModel,
  seededRandom,
} from '../dist/packages/games/src/models.js';
import { BackgammonModel, CheckersModel } from '../dist/packages/games/src/boards.js';
import { TrickGameModel } from '../dist/packages/games/src/tricks.js';

test('Minesweeper protects the first neighborhood, supports flags/chords and wins', () => {
  const game = new MinesweeperModel(8, 8, 10, seededRandom(1));
  game.reveal(27);
  for (const i of [27, ...game.neighbors(27)]) assert.equal(game.cells[i].mine, false);
  assert.equal(game.cells.filter((c) => c.mine).length, 10);
  for (let i = 0; i < 64; i++) if (!game.cells[i].mine) game.reveal(i);
  assert.equal(game.state, 'won');
  assert.equal(game.flags, 10);
  for (const args of [
    [2, 2, 1],
    [8.5, 8, 10],
    [8, 8, -2],
    [Infinity, 8, 10],
  ])
    assert.throws(() => new MinesweeperModel(...args), RangeError);
});
test('Minesweeper only chords when adjacent flags match the revealed number', () => {
  const game = new MinesweeperModel(8, 8, 10, seededRandom(8));
  game.reveal(27);
  const i = game.cells.findIndex((c) => c.revealed && c.count > 0);
  const before = game.revealed;
  game.chord(i);
  assert.equal(game.revealed, before);
  for (const j of game.neighbors(i)) if (game.cells[j].mine) game.flag(j);
  game.chord(i);
  assert.notEqual(game.state, 'lost');
  assert.ok(game.revealed >= before);
});
test('Solitaire rejects foundation-to-foundation scoring and restores draws', () => {
  const game = new SolitaireModel({ random: seededRandom(2) });
  const before = game.snapshot();
  game.draw();
  assert.equal(game.waste.length, 1);
  game.undo();
  assert.deepEqual(game.snapshot(), before);
  game.foundations = [[{ id: 0, rank: 1, suit: 0, faceUp: true }], [], [], []];
  assert.equal(
    game.move({ type: 'foundation', index: 0 }, { type: 'foundation', index: 1 }),
    false,
  );
  assert.equal(game.score, 0);
});
test('FreeCell transfer capacity and Spider suit sequences constrain movement', () => {
  const game = new FreeCellModel(42);
  assert.equal(game.tableau.flat().length, 52);
  const before = game.snapshot();
  const source = { type: 'tableau', index: 0, cardIndex: game.tableau[0].length - 1 };
  assert.equal(game.move(source, { type: 'cell', index: 0 }), true);
  game.undo();
  assert.deepEqual(game.snapshot(), before);
  const spider = new SpiderModel({ random: seededRandom(4) });
  assert.equal(spider.tableau.flat().length + spider.stock.length, 104);
  const snapshot = spider.snapshot();
  spider.draw();
  spider.undo();
  assert.deepEqual(spider.snapshot(), snapshot);
  spider.tableau[0] = [];
  assert.equal(spider.draw(), false);
});
test('Reversi validates coordinates, flips lines and completes a legal game', () => {
  const game = new ReversiModel();
  assert.equal(game.valid().length, 4);
  assert.equal(game.play(64), false);
  assert.equal(game.play(-1), false);
  for (let i = 0; i < 60 && !game.over; i++) game.ai();
  assert.equal(game.over, true);
  assert.equal(game.board.length, 64);
});
test('Checkers enforces captures and continued jumps', () => {
  const game = new CheckersModel();
  game.board.fill(null);
  game.board[42] = { player: 1, king: false };
  game.board[35] = { player: 2, king: false };
  game.board[21] = { player: 2, king: false };
  game.board[7] = { player: 2, king: false };
  assert.deepEqual(game.valid(), [{ from: 42, to: 28, capture: 35 }]);
  assert.equal(game.play(42, 33), false);
  game.play(42, 28);
  assert.equal(game.forced, 28);
  game.play(28, 14);
  assert.equal(game.turn, 2);
  assert.equal(game.board[35], null);
  assert.equal(game.board[21], null);
});
function backgammonFixture(single, player = 1) {
  const game = new BackgammonModel();
  game.points.fill(0);
  game.points[single ? 0 : 1] = 14;
  game.points[21] = -2;
  game.points[11] = -13;
  game.bar = { 1: 1, 2: 0 };
  game.dice = [1, 2];
  if (player === 2) {
    game.points = game.points.reverse().map((n) => -n);
    game.bar = { 1: 0, 2: 1 };
    game.turn = 2;
  }
  return game;
}
test('Backgammon uses both dice when possible and otherwise uses the higher die', () => {
  for (const player of [1, 2])
    for (const single of [false, true]) {
      const game = backgammonFixture(single, player),
        before = game.snapshot(),
        moves = game.options();
      assert.deepEqual(game.snapshot(), before);
      assert.deepEqual(
        moves.map((m) => m.die),
        [2],
      );
      assert.equal(game.play({ from: -1, to: player === 1 ? 23 : 0, die: 1 }), false);
      assert.equal(game.play(moves[0]), true);
      if (!single) assert.ok(game.options().length);
    }
});
test('Backgammon seeded full play conserves all checkers', () => {
  const game = new BackgammonModel(seededRandom(57));
  for (let turn = 0; turn < 600 && !game.winner; turn++) {
    game.roll();
    let moves = game.options();
    while (moves.length && !game.winner) {
      game.play(moves[0]);
      for (const player of [1, 2]) {
        const sign = player === 1 ? 1 : -1;
        assert.equal(
          game.points.reduce((sum, n) => sum + Math.max(0, n * sign), 0) +
            game.bar[player] +
            game.off[player],
          15,
        );
      }
      moves = game.options();
    }
    if (!game.winner) game.endTurn();
  }
  assert.ok(game.winner);
});
test('Hearts passing, following suit, scoring and complete AI hands conserve cards', () => {
  for (let seed = 0; seed < 15; seed++) {
    const game = new TrickGameModel('hearts', seededRandom(seed));
    assert.equal(game.pass(game.hands[0].slice(0, 3).map((c) => c.id)), true);
    assert.equal(game.legal()[0].rank, 2);
    assert.equal(game.legal()[0].suit, 2);
    const used = new Set();
    for (let i = 0; i < 52; i++) {
      const c = game.aiCard();
      assert.ok(c);
      assert.equal(used.has(c.id), false);
      used.add(c.id);
      game.play(c.id);
      if (game.trick.length === 4) game.settle();
    }
    assert.equal(game.handOver, true);
    assert.equal(
      game.taken.reduce((a, b) => a + b, 0),
      13,
    );
    assert.equal(
      game.points.reduce((a, b) => a + b, 0),
      26,
    );
    assert.equal(game.hands.flat().length, 0);
  }
});
test('Hearts shooting the moon scores opponents only and cannot score twice', () => {
  const game = new TrickGameModel('hearts');
  game.points = [26, 0, 0, 0];
  game.finishHand();
  assert.deepEqual(game.scores, [0, 26, 26, 26]);
  game.finishHand();
  assert.deepEqual(game.scores, [0, 26, 26, 26]);
  assert.equal(game.round, 1);
});
test('Spades scores failed nil bags including contract failure and handles ties', () => {
  const game = new TrickGameModel('spades');
  game.bids = [0, 4, 3, 2];
  game.taken = [2, 4, 3, 4];
  game.bags = [9, 0];
  game.finishHand();
  assert.equal(game.scores[0], -168);
  assert.equal(game.bags[0], 1);
  const failed = new TrickGameModel('spades');
  failed.bids = [0, 4, 3, 2];
  failed.taken = [2, 5, 1, 5];
  failed.bags = [9, 0];
  failed.finishHand();
  assert.equal(failed.scores[0], -228);
  assert.equal(failed.bags[0], 1);
  const tied = new TrickGameModel('spades');
  tied.scores = [450, 447];
  tied.bids = [3, 3, 2, 2];
  tied.taken = [3, 3, 2, 5];
  tied.finishHand();
  assert.deepEqual(tied.scores, [500, 500]);
  assert.equal(tied.over, false);
});
