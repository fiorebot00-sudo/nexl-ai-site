import {
  CATEGORY_BY_ID,
  CATEGORY_IDS,
  LOWER_CATEGORIES,
  UPPER_CATEGORIES,
  getUpperCategoryForFace,
} from "./categories.mjs";

export function sumDice(dice) {
  return dice.reduce((total, value) => total + value, 0);
}

export function countFaces(dice) {
  return dice.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function isYahtzeeRoll(dice) {
  return dice.length > 0 && dice.every((value) => value === dice[0]);
}

function hasCount(dice, target) {
  return Object.values(countFaces(dice)).some((count) => count >= target);
}

function hasFullHouse(dice) {
  const counts = Object.values(countFaces(dice)).sort((a, b) => a - b);
  return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
}

function hasStraight(dice, length) {
  const unique = [...new Set(dice)].sort((a, b) => a - b);
  let run = 1;

  for (let index = 1; index < unique.length; index += 1) {
    run = unique[index] === unique[index - 1] + 1 ? run + 1 : 1;
    if (run >= length) return true;
  }

  return length <= 1;
}

export function getJokerInfo(game) {
  if (!game.dice.every(Number.isInteger) || !isYahtzeeRoll(game.dice)) {
    return { active: false, forcedCategoryId: null, jokerLower: false };
  }

  // Joker rules apply once the Yahtzee box is filled, whether it holds 50 or a scratched 0.
  if (game.scores[CATEGORY_IDS.YAHTZEE] == null) {
    return { active: false, forcedCategoryId: null, jokerLower: false };
  }

  const upperCategoryId = getUpperCategoryForFace(game.dice[0]);
  if (game.scores[upperCategoryId] == null) {
    return { active: true, forcedCategoryId: upperCategoryId, jokerLower: false };
  }

  const openLower = LOWER_CATEGORIES.filter((categoryId) => game.scores[categoryId] == null);
  if (openLower.length > 0) {
    return { active: true, forcedCategoryId: null, jokerLower: true };
  }

  return { active: true, forcedCategoryId: null, jokerLower: false };
}

export function scoreDice(categoryId, dice, jokerInfo = { active: false, jokerLower: false }) {
  const category = CATEGORY_BY_ID[categoryId];
  if (!category) throw new Error(`Unknown category: ${categoryId}`);

  if (category.section === "upper") {
    return dice.filter((value) => value === category.face).reduce((total, value) => total + value, 0);
  }

  if (
    jokerInfo.jokerLower &&
    [CATEGORY_IDS.FULL_HOUSE, CATEGORY_IDS.SMALL_STRAIGHT, CATEGORY_IDS.LARGE_STRAIGHT].includes(categoryId)
  ) {
    return {
      [CATEGORY_IDS.FULL_HOUSE]: 25,
      [CATEGORY_IDS.SMALL_STRAIGHT]: 30,
      [CATEGORY_IDS.LARGE_STRAIGHT]: 40,
    }[categoryId];
  }

  switch (categoryId) {
    case CATEGORY_IDS.THREE_KIND:
      return hasCount(dice, 3) ? sumDice(dice) : 0;
    case CATEGORY_IDS.FOUR_KIND:
      return hasCount(dice, 4) ? sumDice(dice) : 0;
    case CATEGORY_IDS.FULL_HOUSE:
      return hasFullHouse(dice) ? 25 : 0;
    case CATEGORY_IDS.SMALL_STRAIGHT:
      return hasStraight(dice, 4) ? 30 : 0;
    case CATEGORY_IDS.LARGE_STRAIGHT:
      return hasStraight(dice, 5) ? 40 : 0;
    case CATEGORY_IDS.YAHTZEE:
      return isYahtzeeRoll(dice) ? 50 : 0;
    case CATEGORY_IDS.CHANCE:
      return sumDice(dice);
    default:
      throw new Error(`Unsupported category: ${categoryId}`);
  }
}

export function getUpperScore(scores) {
  return UPPER_CATEGORIES.reduce((total, categoryId) => total + (scores[categoryId] ?? 0), 0);
}

export function getLowerScore(scores) {
  return LOWER_CATEGORIES.reduce((total, categoryId) => total + (scores[categoryId] ?? 0), 0);
}
