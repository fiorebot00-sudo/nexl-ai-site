const SHORT_LABELS = {
  threeKind: "3 Kind",
  fourKind: "4 Kind",
  smallStraight: "Sm Straight",
  largeStraight: "Lg Straight",
};

// Cube orientation (rotateX, rotateY) that brings each face value to the front.
const FACE_ORIENTATIONS = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

const FACE_PLACEMENTS = {
  1: "translateZ(var(--die-half))",
  2: "rotateX(90deg) translateZ(var(--die-half))",
  3: "rotateY(90deg) translateZ(var(--die-half))",
  4: "rotateY(-90deg) translateZ(var(--die-half))",
  5: "rotateX(-90deg) translateZ(var(--die-half))",
  6: "rotateY(180deg) translateZ(var(--die-half))",
};

export function mountApp(root, { categories, maxRolls, onRoll, onHoldDie, onScore, onNewGame, onToggleMute }) {
  root.replaceChildren();

  // --- Status strip -------------------------------------------------------
  const strip = element("header", "strip");
  const wordmark = element("span", "wordmark", "YATZ");
  const scoreBlock = element("div", "strip-score");
  const scoreValue = element("strong", "strip-score-value", "0");
  scoreBlock.append(element("span", "strip-score-label", "Score"), scoreValue);
  const rollPips = element("div", "roll-pips", null, { "aria-label": "Rolls left" });
  const pipDots = [];
  for (let i = 0; i < maxRolls; i += 1) {
    const dot = element("span", "roll-pip");
    pipDots.push(dot);
    rollPips.append(dot);
  }
  const muteButton = iconButton("mute", "Toggle sound", onToggleMute);
  const newGameButton = iconButton("restart", "New game", onNewGame);
  newGameButton.append(svgRestart());
  strip.append(wordmark, scoreBlock, rollPips, element("span", "strip-spacer"), muteButton, newGameButton);

  const srStatus = element("p", "sr-only", "Roll to start.", { "aria-live": "polite" });

  // --- Table --------------------------------------------------------------
  const table = element("section", "table", null, { "aria-label": "Roll table" });
  const felt = element("div", "felt");
  const diceLayer = element("div", "dice-layer", null, { "aria-label": "Dice" });
  const rack = element("div", "rack", null, { "aria-label": "Held dice rack" });
  const rackSlots = [];
  for (let i = 0; i < 5; i += 1) {
    const slot = element("span", "rack-slot");
    rackSlots.push(slot);
    rack.append(slot);
  }
  const spotlight = element("div", "spotlight");
  const yatzStamp = element("div", "yatz-stamp", "YATZ");
  const shine = element("div", "felt-shine");
  felt.append(diceLayer, rack, spotlight, shine, yatzStamp);

  const rail = element("div", "rail");
  const rollButton = button("Roll dice", "roll-button", onRoll);
  rail.append(rollButton);
  table.append(felt, rail);

  // --- Scorecard ----------------------------------------------------------
  const scorecard = element("section", "scorecard", null, { "aria-label": "Scorecard" });
  const upperColumn = element("div", "score-column");
  const lowerColumn = element("div", "score-column");
  const chips = new Map();

  categories.forEach((category) => {
    const chip = button("", "chip", () => onScore(category.id));
    chip.disabled = true;
    const label = SHORT_LABELS[category.id] ?? category.label;
    chip.append(element("span", "chip-label", label), element("span", "chip-value", "–"));
    chips.set(category.id, chip);
    (category.section === "upper" ? upperColumn : lowerColumn).append(chip);
  });

  const bonusChip = element("div", "chip bonus-chip");
  const bonusFill = element("span", "bonus-fill");
  const bonusValue = element("span", "chip-value", "0/63");
  bonusChip.append(bonusFill, element("span", "chip-label", "Bonus"), bonusValue);
  upperColumn.append(bonusChip);

  scorecard.append(upperColumn, lowerColumn);

  // --- End-of-game overlay --------------------------------------------------
  const endCard = element("div", "end-card");
  const endTotal = element("strong", "end-total", "0");
  const endRows = element("div", "end-rows");
  const endNewGame = button("New game", "roll-button end-new-game", onNewGame);
  endCard.append(element("span", "end-eyebrow", "Final score"), endTotal, endRows, endNewGame);
  const endOverlay = element("div", "end-overlay");
  endOverlay.append(endCard);
  felt.append(endOverlay);

  root.append(strip, srStatus, table, scorecard);

  // --- Dice ---------------------------------------------------------------
  const dice = [];
  for (let i = 0; i < 5; i += 1) {
    const die = buildDie(i, onHoldDie);
    dice.push(die);
    diceLayer.append(die.button);
  }

  return {
    diceLayer,
    felt,
    dice,
    rackSlots,
    rollButton,
    spotlight,
    yatzStamp,
    shine,
    muteButton,
    setMuteIcon(muted) {
      muteButton.replaceChildren(svgSpeaker(muted));
    },
    setScore(value) {
      scoreValue.textContent = String(value);
    },
    scoreValueEl: scoreValue,
    setRollsUsed(used) {
      pipDots.forEach((dot, i) => dot.classList.toggle("is-spent", i < used));
    },
    setRollButton(label, disabled) {
      rollButton.textContent = label;
      rollButton.disabled = disabled;
    },
    setStatus(text) {
      srStatus.textContent = text;
    },
    setRackSlot(index, filled) {
      rackSlots[index].classList.toggle("is-filled", filled);
    },
    chipRect(categoryId) {
      return chips.get(categoryId).querySelector(".chip-value").getBoundingClientRect();
    },
    updateChip(categoryId, { score, preview, available }) {
      const chip = chips.get(categoryId);
      const valueEl = chip.querySelector(".chip-value");
      chip.classList.toggle("is-scored", score != null);
      chip.classList.toggle("is-avail", available && score == null);
      chip.classList.toggle("is-zero", score == null && preview === 0);
      chip.disabled = !available || score != null;
      valueEl.textContent = score != null ? String(score) : preview != null ? String(preview) : "–";
      valueEl.classList.toggle("is-preview", score == null && preview != null);
    },
    stampChip(categoryId) {
      retrigger(chips.get(categoryId), "is-stamping");
    },
    shimmerChip(categoryId) {
      retrigger(chips.get(categoryId), "is-shimmering");
    },
    updateBonus(totals, threshold) {
      const locked = totals.upperBonus > 0;
      bonusFill.style.width = `${Math.min(100, (totals.upperScore / threshold) * 100)}%`;
      bonusValue.textContent = locked ? "+35" : `${totals.upperScore}/${threshold}`;
      bonusChip.classList.toggle("is-locked", locked);
    },
    stampBonus() {
      retrigger(bonusChip, "is-stamping");
    },
    showEnd(total, rows) {
      endRows.replaceChildren(
        ...rows.map(([label, value]) => {
          const row = element("div", "end-row");
          row.append(element("span", "", label), element("span", "", String(value)));
          return row;
        }),
      );
      endTotal.textContent = "0";
      endOverlay.classList.add("is-open");
      return endTotal;
    },
    hideEnd() {
      endOverlay.classList.remove("is-open");
    },
  };
}

function buildDie(index, onHoldDie) {
  const buttonEl = button("", "die", () => onHoldDie(index));
  buttonEl.disabled = true;
  const shadow = element("span", "die-shadow");
  const arc = element("span", "die-arc");
  const cube = element("span", "cube");
  for (let value = 1; value <= 6; value += 1) {
    const face = element("span", "cube-face");
    face.style.transform = FACE_PLACEMENTS[value];
    face.append(renderPips(value));
    cube.append(face);
  }
  arc.append(cube);
  buttonEl.append(shadow, arc);
  // toss-arc uses fill:both; drop the class after it ends or its final keyframe
  // transform keeps overriding the held-die scale on .die-arc.
  arc.addEventListener("animationend", (event) => {
    if (event.animationName === "toss-arc") buttonEl.classList.remove("is-tossing");
  });

  const die = {
    button: buttonEl,
    cube,
    value: null,
    held: false,
    spinX: 0,
    spinY: 0,
    tiltZ: 0,
    setPosition(x, y) {
      buttonEl.style.setProperty("--die-x", `${x}%`);
      buttonEl.style.setProperty("--die-y", `${y}%`);
    },
    // Land on `value` after `turns` extra full tumbles in each axis.
    spinTo(value, turns = 0) {
      const [baseX, baseY] = FACE_ORIENTATIONS[value];
      die.spinX = Math.ceil(die.spinX / 360) * 360 + turns * 360 + baseX;
      die.spinY = Math.ceil(die.spinY / 360) * 360 + turns * 360 + baseY;
      cube.style.transform = `rotateZ(${die.tiltZ}deg) rotateX(${die.spinX}deg) rotateY(${die.spinY}deg)`;
    },
    setTilt(degrees) {
      die.tiltZ = degrees;
    },
    setInstant(instant) {
      buttonEl.classList.toggle("is-instant", instant);
    },
    toss() {
      retrigger(buttonEl, "is-tossing");
    },
    setHeldStyle(held) {
      buttonEl.classList.toggle("is-held", held);
    },
    setGold(gold) {
      buttonEl.classList.toggle("is-gold", gold);
    },
    show(visible) {
      buttonEl.classList.toggle("is-hidden", !visible);
    },
    setLabel(value, held) {
      buttonEl.setAttribute(
        "aria-label",
        value == null ? `Die ${index + 1}: empty` : `Die ${index + 1}: ${value}${held ? ", held" : ""}`,
      );
      buttonEl.setAttribute("aria-pressed", held ? "true" : "false");
    },
  };
  die.show(false);
  die.setLabel(null, false);
  return die;
}

export function buildFlyDie(value, size) {
  const flyer = element("div", "fly-die");
  flyer.style.width = `${size}px`;
  flyer.style.height = `${size}px`;
  flyer.append(renderPips(value));
  return flyer;
}

function renderPips(value) {
  const pips = element("span", `pips pips-${value}`);
  for (let i = 0; i < value; i += 1) {
    pips.append(element("span", "pip"));
  }
  return pips;
}

function retrigger(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

function iconButton(kind, label, onClick) {
  const item = button("", `icon-button icon-${kind}`, onClick);
  item.setAttribute("aria-label", label);
  return item;
}

function svgSpeaker(muted) {
  return svg(
    muted
      ? "M3 9v6h4l5 4V5L7 9H3zm14.6-1.6L16.2 8.8 18.4 11l-2.2 2.2 1.4 1.4L19.8 12.4l2.2 2.2 1.4-1.4L21.2 11l2.2-2.2-1.4-1.4-2.2 2.2-2.2-2.2z"
      : "M3 9v6h4l5 4V5L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z",
  );
}

function svgRestart() {
  return svg("M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z");
}

function svg(pathData) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "0 0 24 24");
  el.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "currentColor");
  el.append(path);
  return el;
}

function button(label, className, onClick) {
  const item = element("button", className, label);
  item.type = "button";
  item.addEventListener("click", onClick);
  return item;
}

function element(tagName, className = "", content = null, attributes = {}) {
  const item = document.createElement(tagName);
  if (className) item.className = className;
  if (content instanceof Node) {
    item.append(content);
  } else if (content != null) {
    item.textContent = content;
  }
  Object.entries(attributes).forEach(([name, value]) => item.setAttribute(name, value));
  return item;
}
