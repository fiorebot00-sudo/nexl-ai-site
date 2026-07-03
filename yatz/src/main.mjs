import {
  CATEGORY_DEFINITIONS,
  CATEGORY_IDS,
  createGame,
  getAvailableCategories,
  getTotals,
  isGameComplete,
  previewScore,
  rollDice,
  scoreCategory,
  toggleHold,
} from "./core/game.mjs";
import { isYahtzeeRoll } from "./core/scoring.mjs";
import { mountApp, buildFlyDie } from "./web/render.mjs";
import { createFoley } from "./web/audio.mjs";

const ROLL_STAGGER_MS = 70;
const ROLL_FLIGHT_MS = 620;
const FLY_STAGGER_MS = 55;
const FLY_FLIGHT_MS = 460;
const NOD_CATEGORIES = [CATEGORY_IDS.FULL_HOUSE, CATEGORY_IDS.SMALL_STRAIGHT, CATEGORY_IDS.LARGE_STRAIGHT];

const sfx = createFoley();

let game = createGame();
let phase = "idle"; // idle | rolling | celebrating | picking | scoring | over
let epoch = 0;
let positions = Array.from({ length: 5 }, () => ({ x: 50, y: 40 }));
let shimmeredThisTurn = new Set();
let activeFliers = [];

const view = mountApp(document.querySelector("#app"), {
  categories: CATEGORY_DEFINITIONS,
  maxRolls: game.config.maxRolls,
  onRoll: () => roll(),
  onHoldDie: holdDie,
  onScore: pick,
  onNewGame: newGame,
  onToggleMute: toggleMute,
});
view.setMuteIcon(sfx.isMuted());

function later(fn, ms) {
  const at = epoch;
  window.setTimeout(() => {
    if (at === epoch) fn();
  }, ms);
}

// --- Geometry -------------------------------------------------------------

function layerRect() {
  return view.diceLayer.getBoundingClientRect();
}

function dieSizePx() {
  return view.dice[0].button.offsetWidth || 48;
}

function rackSlotPosition(index) {
  const layer = layerRect();
  const slot = view.rackSlots[index].getBoundingClientRect();
  return {
    x: ((slot.left + slot.width / 2 - layer.left) / layer.width) * 100,
    y: ((slot.top + slot.height / 2 - layer.top) / layer.height) * 100,
  };
}

// Random non-overlapping spots on the open felt above the rack.
function generateScatter(count, occupied) {
  const layer = layerRect();
  const rack = view.rackSlots[0].parentElement.getBoundingClientRect();
  const die = dieSizePx();
  const minGap = die * 1.18;
  const xMin = ((die * 0.7) / layer.width) * 100;
  const xMax = 100 - xMin;
  const yMin = ((die * 0.7) / layer.height) * 100;
  const yMax = ((rack.top - layer.top - die * 0.75) / layer.height) * 100;
  const placed = [...occupied];
  const result = [];

  for (let n = 0; n < count; n += 1) {
    let best = null;
    let bestClearance = -1;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const spot = {
        x: xMin + Math.random() * (xMax - xMin),
        y: yMin + Math.random() * (Math.max(yMax - yMin, 4)),
      };
      const clearance = Math.min(
        Infinity,
        ...placed.map((other) => {
          const dx = ((spot.x - other.x) / 100) * layer.width;
          const dy = ((spot.y - other.y) / 100) * layer.height;
          return Math.hypot(dx, dy);
        }),
      );
      if (clearance >= minGap) {
        best = spot;
        break;
      }
      if (clearance > bestClearance) {
        bestClearance = clearance;
        best = spot;
      }
    }
    placed.push(best);
    result.push(best);
  }

  return result;
}

// --- Status / scorecard sync -----------------------------------------------

function syncChips() {
  const available = new Set(phase === "picking" ? getAvailableCategories(game) : []);
  CATEGORY_DEFINITIONS.forEach((category) => {
    const score = game.scores[category.id];
    const preview =
      phase === "picking" && score == null && available.has(category.id) ? previewScore(game, category.id) : null;
    view.updateChip(category.id, { score, preview, available: available.has(category.id) });
  });
  view.updateBonus(getTotals(game), game.config.upperBonusThreshold);
}

function syncStrip() {
  view.setScore(getTotals(game).total);
  view.setRollsUsed(game.rollsUsed);
}

function syncRollButton() {
  const rollsLeft = game.config.maxRolls - game.rollsUsed;
  if (phase === "over") {
    view.setRollButton("Game over", true);
  } else if (phase === "idle") {
    view.setRollButton("Roll dice", false);
  } else if (phase === "picking") {
    view.setRollButton(rollsLeft > 0 ? `Roll again · ${rollsLeft}` : "Pick a score", rollsLeft <= 0);
  } else {
    view.setRollButton("Rolling…", true);
  }
}

function setDiceInteractive(interactive) {
  view.dice.forEach((die, i) => {
    die.button.disabled = !interactive || game.dice[i] == null;
  });
}

// --- Actions ----------------------------------------------------------------

function roll(fixedValues = null) {
  if (phase !== "idle" && phase !== "picking") return;
  if (game.rollsUsed >= game.config.maxRolls) return;

  const isFirstRoll = game.rollsUsed === 0;
  const rng = fixedValues ? sequenceRng(fixedValues) : Math.random;
  game = rollDice(game, rng);
  phase = "rolling";
  setDiceInteractive(false);
  syncStrip();
  syncRollButton();
  syncChips();
  view.setStatus(`Rolled ${game.dice.filter((_, i) => !game.held[i]).join(", ")}.`);

  const moving = game.dice.map((_, i) => i).filter((i) => !game.held[i]);
  const scatter = generateScatter(
    moving.length,
    game.dice.map((_, i) => i).filter((i) => game.held[i]).map((i) => positions[i]),
  );

  moving.forEach((dieIndex, k) => {
    const die = view.dice[dieIndex];
    const target = scatter[k];
    positions[dieIndex] = target;
    later(() => {
      if (isFirstRoll) {
        die.setInstant(true);
        die.setPosition(108, 18 + Math.random() * 40);
        die.show(true);
        void die.button.offsetWidth;
        die.setInstant(false);
      }
      die.setTilt(Math.round(Math.random() * 32 - 16));
      die.setPosition(target.x, target.y);
      die.spinTo(game.dice[dieIndex], 1 + Math.round(Math.random()));
      die.toss();
      die.setLabel(game.dice[dieIndex], false);
    }, k * ROLL_STAGGER_MS);
    sfx.clack(k * (ROLL_STAGGER_MS / 1000) + ROLL_FLIGHT_MS / 1000 - 0.12);
  });

  const settleAt = moving.length * ROLL_STAGGER_MS + ROLL_FLIGHT_MS + 80;
  later(() => {
    if (isYahtzeeRoll(game.dice) && game.scores[CATEGORY_IDS.YAHTZEE] !== 0) {
      celebrateYatz();
    } else {
      enterPicking();
    }
  }, settleAt);
}

function enterPicking() {
  phase = "picking";
  setDiceInteractive(true);
  syncRollButton();
  syncChips();

  NOD_CATEGORIES.forEach((categoryId, k) => {
    if (game.scores[categoryId] != null || shimmeredThisTurn.has(categoryId)) return;
    const preview = previewScore(game, categoryId);
    if (preview != null && preview > 0) {
      shimmeredThisTurn.add(categoryId);
      later(() => view.shimmerChip(categoryId), 120 + k * 90);
      sfx.shimmer(0.12 + k * 0.09);
    }
  });
}

function celebrateYatz() {
  phase = "celebrating";
  view.spotlight.classList.add("is-on");
  view.dice.forEach((die) => die.setGold(true));
  view.setStatus("Yatz! Five of a kind.");

  later(() => {
    const lineY = 38;
    [18, 34, 50, 66, 82].forEach((x, i) => {
      positions[i] = { x, y: lineY };
      view.dice[i].setTilt(0);
      view.dice[i].setPosition(x, lineY);
    });
  }, 250);

  later(() => {
    view.dice.forEach((die, i) => die.spinTo(game.dice[i], 1));
  }, 700);

  sfx.yatz(0.7);
  later(() => {
    view.yatzStamp.classList.add("is-on");
    view.shine.classList.add("is-on");
  }, 850);

  later(() => {
    view.spotlight.classList.remove("is-on");
    view.yatzStamp.classList.remove("is-on");
    view.shine.classList.remove("is-on");
    view.dice.forEach((die) => die.setGold(false));
    enterPicking();
  }, 2100);
}

function holdDie(index) {
  if (phase !== "picking" || game.dice[index] == null) return;
  game = toggleHold(game, index);
  const held = game.held[index];
  const die = view.dice[index];
  sfx.tick();

  if (held) {
    positions[index] = rackSlotPosition(index);
    die.setTilt(0);
    sfx.felt(0.18);
  } else {
    const loose = game.dice.map((_, i) => i).filter((i) => i !== index && !game.held[i] && game.dice[i] != null);
    [positions[index]] = generateScatter(1, loose.map((i) => positions[i]));
    die.setTilt(Math.round(Math.random() * 32 - 16));
    sfx.clack(0.2);
  }

  die.setPosition(positions[index].x, positions[index].y);
  die.setHeldStyle(held);
  die.spinTo(game.dice[index], 0);
  die.setLabel(game.dice[index], held);
  view.setRackSlot(index, held);
  view.setStatus(held ? `Die ${index + 1} held.` : `Die ${index + 1} released.`);
}

function pick(categoryId) {
  if (phase !== "picking" || !getAvailableCategories(game).includes(categoryId)) return;

  const diceValues = [...game.dice];
  const before = getTotals(game);
  const value = previewScore(game, categoryId);
  const next = scoreCategory(game, categoryId);
  const after = getTotals(next);

  phase = "scoring";
  setDiceInteractive(false);
  syncChips();
  syncRollButton();
  view.setStatus(`Scored ${value} in ${categoryId}.`);

  const chipTarget = view.chipRect(categoryId);
  const size = dieSizePx();

  diceValues.forEach((dieValue, i) => {
    const die = view.dice[i];
    const from = die.button.getBoundingClientRect();
    later(() => {
      die.show(false);
      const flyer = buildFlyDie(dieValue, size);
      document.body.append(flyer);
      activeFliers.push(flyer);
      const dx = chipTarget.left + chipTarget.width / 2 - (from.left + from.width / 2);
      const dy = chipTarget.top + chipTarget.height / 2 - (from.top + from.height / 2);
      flyer.style.left = `${from.left}px`;
      flyer.style.top = `${from.top}px`;
      const flight = flyer.animate(
        [
          { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.3) rotate(${i % 2 ? 14 : -14}deg)`, opacity: 0.9 },
        ],
        { duration: FLY_FLIGHT_MS, easing: "cubic-bezier(0.35, 0, 0.25, 1)", fill: "forwards" },
      );
      flight.onfinish = () => {
        flyer.remove();
        activeFliers = activeFliers.filter((f) => f !== flyer);
      };
    }, i * FLY_STAGGER_MS);
    sfx.tick(i * (FLY_STAGGER_MS / 1000) + FLY_FLIGHT_MS / 1000);
  });

  const landedAt = 4 * FLY_STAGGER_MS + FLY_FLIGHT_MS;
  later(() => {
    game = next;
    view.stampChip(categoryId);
    sfx.stamp();
    syncChips();
    countUp(view.scoreValueEl, before.total, after.total, 480);
    if (before.upperBonus === 0 && after.upperBonus > 0) {
      later(() => {
        view.stampBonus();
        sfx.shimmer();
      }, 300);
    }
  }, landedAt);

  later(() => {
    if (isGameComplete(game)) {
      finishGame(after);
    } else {
      startTurn();
    }
  }, landedAt + 560);
}

function startTurn() {
  phase = "idle";
  shimmeredThisTurn = new Set();
  view.dice.forEach((die, i) => {
    die.show(false);
    die.setHeldStyle(false);
    die.setLabel(null, false);
    view.setRackSlot(i, false);
  });
  syncStrip();
  syncRollButton();
  syncChips();
  view.setStatus(`Turn ${game.turn}. Roll to start.`);
}

function finishGame(totals) {
  phase = "over";
  syncRollButton();
  const rows = [
    ["Upper section", totals.upperScore],
    ["Upper bonus", totals.upperBonus],
    ["Lower section", totals.lowerScore],
    ["Yatz bonus", totals.yahtzeeBonus],
  ];
  const totalEl = view.showEnd(totals.total, rows);
  countUp(totalEl, 0, totals.total, 1000);
  sfx.stamp();
  sfx.shimmer(0.5);
  view.setStatus(`Game over. Final score ${totals.total}.`);
}

function newGame() {
  epoch += 1;
  activeFliers.forEach((flyer) => flyer.remove());
  activeFliers = [];
  game = createGame();
  positions = Array.from({ length: 5 }, () => ({ x: 50, y: 40 }));
  shimmeredThisTurn = new Set();
  view.hideEnd();
  view.spotlight.classList.remove("is-on");
  view.yatzStamp.classList.remove("is-on");
  view.shine.classList.remove("is-on");
  view.dice.forEach((die) => {
    die.setGold(false);
  });
  sfx.tick();
  startTurn();
}

function toggleMute() {
  sfx.setMuted(!sfx.isMuted());
  view.setMuteIcon(sfx.isMuted());
  if (!sfx.isMuted()) sfx.tick();
}

function countUp(el, from, to, duration) {
  const at = epoch;
  const start = performance.now();
  function frame(now) {
    if (at !== epoch) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = String(Math.round(from + (to - from) * eased));
    if (t < 1) window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
}

function sequenceRng(values) {
  let cursor = 0;
  return () => {
    const value = values[cursor % values.length];
    cursor += 1;
    return (value - 1) / 6 + 0.01;
  };
}

// Keep held dice glued to their rack slots across rotations/resizes.
window.addEventListener("resize", () => {
  game.held.forEach((held, i) => {
    if (held && game.dice[i] != null) {
      positions[i] = rackSlotPosition(i);
      const die = view.dice[i];
      die.setInstant(true);
      die.setPosition(positions[i].x, positions[i].y);
      void die.button.offsetWidth;
      die.setInstant(false);
    }
  });
});

// Tiny test seam (mirrors Gravity Assist's window.GG convention).
window.YZ = {
  roll: (values) => roll(values),
  state: () => game,
  phase: () => phase,
};

startTurn();
