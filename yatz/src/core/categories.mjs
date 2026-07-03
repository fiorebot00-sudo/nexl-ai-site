export const CATEGORY_IDS = Object.freeze({
  ONES: "ones",
  TWOS: "twos",
  THREES: "threes",
  FOURS: "fours",
  FIVES: "fives",
  SIXES: "sixes",
  THREE_KIND: "threeKind",
  FOUR_KIND: "fourKind",
  FULL_HOUSE: "fullHouse",
  SMALL_STRAIGHT: "smallStraight",
  LARGE_STRAIGHT: "largeStraight",
  YAHTZEE: "yahtzee",
  CHANCE: "chance",
});

export const UPPER_CATEGORIES = Object.freeze([
  CATEGORY_IDS.ONES,
  CATEGORY_IDS.TWOS,
  CATEGORY_IDS.THREES,
  CATEGORY_IDS.FOURS,
  CATEGORY_IDS.FIVES,
  CATEGORY_IDS.SIXES,
]);

export const LOWER_CATEGORIES = Object.freeze([
  CATEGORY_IDS.THREE_KIND,
  CATEGORY_IDS.FOUR_KIND,
  CATEGORY_IDS.FULL_HOUSE,
  CATEGORY_IDS.SMALL_STRAIGHT,
  CATEGORY_IDS.LARGE_STRAIGHT,
  CATEGORY_IDS.YAHTZEE,
  CATEGORY_IDS.CHANCE,
]);

export const CATEGORY_DEFINITIONS = Object.freeze([
  { id: CATEGORY_IDS.ONES, label: "Ones", section: "upper", face: 1 },
  { id: CATEGORY_IDS.TWOS, label: "Twos", section: "upper", face: 2 },
  { id: CATEGORY_IDS.THREES, label: "Threes", section: "upper", face: 3 },
  { id: CATEGORY_IDS.FOURS, label: "Fours", section: "upper", face: 4 },
  { id: CATEGORY_IDS.FIVES, label: "Fives", section: "upper", face: 5 },
  { id: CATEGORY_IDS.SIXES, label: "Sixes", section: "upper", face: 6 },
  { id: CATEGORY_IDS.THREE_KIND, label: "3 of a Kind", section: "lower" },
  { id: CATEGORY_IDS.FOUR_KIND, label: "4 of a Kind", section: "lower" },
  { id: CATEGORY_IDS.FULL_HOUSE, label: "Full House", section: "lower" },
  { id: CATEGORY_IDS.SMALL_STRAIGHT, label: "Small Straight", section: "lower" },
  { id: CATEGORY_IDS.LARGE_STRAIGHT, label: "Large Straight", section: "lower" },
  { id: CATEGORY_IDS.YAHTZEE, label: "Yatz", section: "lower" },
  { id: CATEGORY_IDS.CHANCE, label: "Chance", section: "lower" },
]);

export const CATEGORY_BY_ID = Object.freeze(
  Object.fromEntries(CATEGORY_DEFINITIONS.map((category) => [category.id, category])),
);

export function getUpperCategoryForFace(face) {
  return UPPER_CATEGORIES[face - 1] ?? null;
}
