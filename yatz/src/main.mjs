import {
  CATEGORY_DEFINITIONS,
  createGame,
  getAvailableCategories,
  getTotals,
  isGameComplete,
  previewScore,
  rollDice,
  scoreCategory,
  toggleHold,
} from "./core/game.mjs";
import { renderApp } from "./web/render.mjs";

const app = document.querySelector("#app");
const RACK_SLOTS = [
  { x: 12, y: 88, r: 0 },
  { x: 31, y: 88, r: 0 },
  { x: 50, y: 88, r: 0 },
  { x: 69, y: 88, r: 0 },
  { x: 88, y: 88, r: 0 },
];
const STARTING_POSITIONS = [
  { x: 20, y: 26, r: -12 },
  { x: 38, y: 34, r: 10 },
  { x: 57, y: 25, r: -7 },
  { x: 72, y: 46, r: 14 },
  { x: 31, y: 58, r: -16 },
];

let game = createGame();
let gameEpoch = 0;
let message = "Roll to start.";
let rollingDice = new Set();
let holdingDice = new Set();
let clearingDice = new Set();
let clearingDiceValues = null;
let rollAnimation = null;
let isClearingTurn = false;
let diePositions = STARTING_POSITIONS;

function nextLoosePosition(index) {
  const lane = index % 5;
  return {
    x: 16 + lane * 16 + Math.random() * 8,
    y: 18 + Math.random() * 46,
    r: Math.round(Math.random() * 44 - 22),
  };
}

function syncDiePositions(nextGame, movingDice = new Set()) {
  diePositions = nextGame.dice.map((value, index) => {
    if (value == null) return diePositions[index] ?? STARTING_POSITIONS[index];
    if (nextGame.held[index]) return RACK_SLOTS[index];
    if (movingDice.has(index)) return nextLoosePosition(index);
    return diePositions[index] ?? STARTING_POSITIONS[index];
  });
}

function setGame(nextGame, nextMessage) {
  game = nextGame;
  message = nextMessage;
  render();
}

function runAction(action) {
  try {
    action();
  } catch (error) {
    message = error.message;
    render();
  }
}

function roll() {
  runAction(() => {
    const before = game.dice;
    const next = rollDice(game);
    rollAnimation = game.rollsUsed === 0 ? "initial" : "reroll";
    rollingDice = new Set(
      next.dice.map((_, index) => index).filter((index) => !next.held[index] && (game.rollsUsed === 0 || before[index] != null)),
    );
    syncDiePositions(next, rollingDice);
    setGame(next, `${next.config.maxRolls - next.rollsUsed} roll${next.config.maxRolls - next.rollsUsed === 1 ? "" : "s"} left.`);

    const epoch = gameEpoch;
    window.setTimeout(() => {
      if (epoch !== gameEpoch) return;
      rollingDice = new Set();
      rollAnimation = null;
      render();
    }, 700);
  });
}

function holdDie(index) {
  runAction(() => {
    const next = toggleHold(game, index);
    holdingDice = new Set([index]);
    syncDiePositions(next, new Set([index]));
    setGame(next, next.held[index] ? "Die held." : "Die released.");

    const epoch = gameEpoch;
    window.setTimeout(() => {
      if (epoch !== gameEpoch) return;
      holdingDice = new Set();
      render();
    }, 300);
  });
}

function score(categoryId) {
  runAction(() => {
    const scorePreview = previewScore(game, categoryId);
    const next = scoreCategory(game, categoryId);
    const isDone = isGameComplete(next);
    clearingDice = new Set(game.dice.map((_, index) => index));
    clearingDiceValues = [...game.dice];
    syncDiePositions(game);
    isClearingTurn = true;
    message = `Scored ${scorePreview}. Clearing the table.`;
    render();

    const epoch = gameEpoch;
    window.setTimeout(() => {
      if (epoch !== gameEpoch) return;
      clearingDice = new Set();
      clearingDiceValues = null;
      isClearingTurn = false;
      syncDiePositions(next);
      setGame(next, isDone ? `Final score: ${getTotals(next).total}.` : `Scored ${scorePreview}. Roll for turn ${next.turn}.`);
    }, 540);
  });
}

function newGame() {
  gameEpoch += 1;
  rollingDice = new Set();
  holdingDice = new Set();
  clearingDice = new Set();
  clearingDiceValues = null;
  rollAnimation = null;
  isClearingTurn = false;
  diePositions = STARTING_POSITIONS;
  setGame(createGame(), "Roll to start.");
}

function getScoreRows() {
  const available = new Set(getAvailableCategories(game));

  return CATEGORY_DEFINITIONS.map((category) => {
    const committedScore = game.scores[category.id];
    const preview = committedScore == null && available.has(category.id) ? previewScore(game, category.id) : null;

    return {
      ...category,
      score: committedScore,
      preview,
      available: available.has(category.id),
    };
  });
}

function render() {
  renderApp(app, {
    game,
    totals: getTotals(game),
    scoreRows: getScoreRows(),
    message,
    rollingDice,
    holdingDice,
    clearingDice,
    clearingDiceValues,
    rollAnimation,
    isClearingTurn,
    diePositions,
    onRoll: roll,
    onHoldDie: holdDie,
    onScore: score,
    onNewGame: newGame,
  });
}

render();
