import { createMinesweeper } from './minesweeper.js';
import { createCardGame } from './cards.js';
import { createBoardGame, createBackgammon } from './boards.js';
import { createTrickGame } from './tricks.js';
import { createPinball } from './pinball.js';
export function registerGames(registry) {
  for (const app of [
    {
      id: 'minesweeper',
      title: 'Minesweeper',
      icon: 'mines',
      commands: ['winmine', 'winmine.exe'],
      create: createMinesweeper,
    },
    {
      id: 'solitaire',
      title: 'Solitaire',
      icon: 'game',
      commands: ['sol', 'sol.exe'],
      create: (sys) => createCardGame(sys, { kind: 'solitaire' }),
    },
    {
      id: 'freecell',
      title: 'FreeCell',
      icon: 'game',
      commands: ['freecell.exe'],
      create: (sys) => createCardGame(sys, { kind: 'freecell' }),
    },
    {
      id: 'spider',
      title: 'Spider Solitaire',
      icon: 'game',
      commands: ['spider.exe'],
      create: (sys) => createCardGame(sys, { kind: 'spider' }),
    },
    {
      id: 'hearts',
      title: 'Hearts',
      icon: 'game',
      commands: ['mshearts', 'mshearts.exe'],
      create: (sys) => createTrickGame(sys, { kind: 'hearts' }),
    },
    {
      id: 'pinball',
      title: 'Pinball',
      icon: 'pinball',
      commands: ['pinball.exe'],
      create: createPinball,
    },
    {
      id: 'internet-reversi',
      title: 'Internet Reversi',
      icon: 'game',
      commands: ['reversi'],
      create: (sys) => createBoardGame(sys, { kind: 'reversi' }),
    },
    {
      id: 'internet-checkers',
      title: 'Internet Checkers',
      icon: 'game',
      commands: ['checkers'],
      create: (sys) => createBoardGame(sys, { kind: 'checkers' }),
    },
    {
      id: 'internet-backgammon',
      title: 'Internet Backgammon',
      icon: 'game',
      commands: ['backgammon'],
      create: createBackgammon,
    },
    {
      id: 'internet-hearts',
      title: 'Internet Hearts',
      icon: 'game',
      create: (sys) => createTrickGame(sys, { kind: 'hearts', internet: true }),
    },
    {
      id: 'internet-spades',
      title: 'Internet Spades',
      icon: 'game',
      commands: ['spades'],
      create: (sys) => createTrickGame(sys, { kind: 'spades' }),
    },
  ])
    registry.register({ ...app, category: 'Games' });
}
