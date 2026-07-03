import { CATEGORY_DEFINITIONS, CATEGORY_IDS, LOWER_CATEGORIES, UPPER_CATEGORIES } from "./categories.mjs";
import { getJokerInfo, getLowerScore, getUpperScore, isYahtzeeRoll, scoreDice } from "./scoring.mjs";

export const DEFAULT_CONFIG = Object.freeze({
  diceCount: 5,
  diceSides: 6,
  maxRolls: 3,
  upperBonusThreshold: 63,
  upperBonus: 35,
  yahtzeeBonus: 100,
});

function buildEmptyScores() {
  return Object.fromEntries(CATEGORY_DEFINITIONS.map((category) => [category.id, null]));
}

function assertRollExists(game) {
  if (game.rollsUsed === 0) {
    throw new Error("Roll before choosing a score.");
  }
}

function assertPlayable(game) {
  if (game.status === "complete") {
    throw new Error("This game is already complete.");
  }
}

export function createGame(config = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  return {
    config: mergedConfig,
    dice: Array.from({ length: mergedConfig.diceCount }, () => null),
    held: Array.from({ length: mergedConfig.diceCount }, () => false),
    rollsUsed: 0,
    scores: buildEmptyScores(),
    yahtzeeBonusCount: 0,
    turn: 1,
    status: "ready",
  };
}

export function rollDice(game, rng = Math.random) {
  assertPlayable(game);

  if (game.rollsUsed >= game.config.maxRolls) {
    throw new Error("No rolls left this turn.");
  }

  const nextDice = game.dice.map((value, index) => {
    if (game.held[index] && value != null) return value;
    return Math.floor(rng() * game.config.diceSides) + 1;
  });

  return {
    ...game,
    dice: nextDice,
    rollsUsed: game.rollsUsed + 1,
    status: "inProgress",
  };
}

export function toggleHold(game, dieIndex) {
  assertPlayable(game);
  assertRollExists(game);

  if (dieIndex < 0 || dieIndex >= game.config.diceCount) {
    throw new Error("That die does not exist.");
  }

  const held = game.held.map((isHeld, index) => (index === dieIndex ? !isHeld : isHeld));

  return { ...game, held };
}

export function getAvailableCategories(game) {
  if (game.rollsUsed === 0 || game.status === "complete") return [];

  const openCategories = CATEGORY_DEFINITIONS.map((category) => category.id).filter(
    (categoryId) => game.scores[categoryId] == null,
  );
  const jokerInfo = getJokerInfo(game);

  if (jokerInfo.forcedCategoryId) return [jokerInfo.forcedCategoryId];
  if (jokerInfo.jokerLower) {
    return LOWER_CATEGORIES.filter((categoryId) => game.scores[categoryId] == null);
  }

  return openCategories;
}

export function previewScore(game, categoryId) {
  assertRollExists(game);

  if (!getAvailableCategories(game).includes(categoryId)) {
    return null;
  }

  return scoreDice(categoryId, game.dice, getJokerInfo(game));
}

export function scoreCategory(game, categoryId) {
  assertPlayable(game);
  assertRollExists(game);

  if (!getAvailableCategories(game).includes(categoryId)) {
    throw new Error("That category is not available right now.");
  }

  const scoredValue = scoreDice(categoryId, game.dice, getJokerInfo(game));
  const scores = { ...game.scores, [categoryId]: scoredValue };
  const earnsYahtzeeBonus =
    isYahtzeeRoll(game.dice) && game.scores[CATEGORY_IDS.YAHTZEE] === 50 && categoryId !== CATEGORY_IDS.YAHTZEE;
  const yahtzeeBonusCount = game.yahtzeeBonusCount + (earnsYahtzeeBonus ? 1 : 0);
  const complete = CATEGORY_DEFINITIONS.every((category) => scores[category.id] != null);

  return {
    ...game,
    dice: Array.from({ length: game.config.diceCount }, () => null),
    held: Array.from({ length: game.config.diceCount }, () => false),
    rollsUsed: 0,
    scores,
    yahtzeeBonusCount,
    turn: complete ? game.turn : game.turn + 1,
    status: complete ? "complete" : "ready",
  };
}

export function getTotals(game) {
  const upperScore = getUpperScore(game.scores);
  const lowerScore = getLowerScore(game.scores);
  const upperBonus = upperScore >= game.config.upperBonusThreshold ? game.config.upperBonus : 0;
  const yahtzeeBonus = game.yahtzeeBonusCount * game.config.yahtzeeBonus;

  return {
    upperScore,
    upperBonus,
    upperNeeded: Math.max(0, game.config.upperBonusThreshold - upperScore),
    lowerScore,
    yahtzeeBonus,
    total: upperScore + upperBonus + lowerScore + yahtzeeBonus,
    remainingCategories: CATEGORY_DEFINITIONS.filter((category) => game.scores[category.id] == null).length,
  };
}

export function isGameComplete(game) {
  return game.status === "complete";
}

export { CATEGORY_DEFINITIONS, CATEGORY_IDS, LOWER_CATEGORIES, UPPER_CATEGORIES };
