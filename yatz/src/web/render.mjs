const PIP_LABELS = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
};

export function renderApp(root, model) {
  root.replaceChildren(
    renderHeader(model),
    renderBoard(model),
  );
}

function renderHeader({ game, totals, message, onNewGame }) {
  const header = element("header", "app-header");
  const titleGroup = element("div", "title-group");
  titleGroup.append(
    element("p", "eyebrow", "Portable dice tactics"),
    element("h1", "", "Yatz"),
  );

  const stats = element("section", "stats", null, { "aria-label": "Game status" });
  stats.append(
    statBlock("Turn", game.status === "complete" ? "Done" : String(game.turn)),
    statBlock("Rolls", `${game.rollsUsed}/${game.config.maxRolls}`),
    statBlock("Score", String(totals.total)),
  );

  const actions = element("div", "header-actions");
  actions.append(button("New game", "button subtle", onNewGame));

  header.append(titleGroup, stats, actions, element("p", "message", message));
  return header;
}

function renderBoard(model) {
  const board = element("section", "game-board");
  const playColumn = element("div", "play-column");
  playColumn.append(renderRollTable(model), renderDicePanel(model));
  board.append(playColumn, renderScorePanel(model));
  return board;
}

function renderRollTable({
  game,
  rollingDice,
  holdingDice,
  clearingDice,
  clearingDiceValues,
  rollAnimation,
  isClearingTurn,
  diePositions,
  onHoldDie,
}) {
  const panel = element("section", "roll-table", null, { "aria-label": "Roll table" });
  const tableSurface = element("div", "table-surface");
  const heldRack = element("div", "held-rack", null, { "aria-label": "Held dice rack" });
  const looseLayer = element("div", "loose-dice-layer", null, { "aria-label": "Dice on table" });
  const diceValues = clearingDiceValues ?? game.dice;

  game.dice.forEach((_, index) => {
    heldRack.append(element("span", game.held[index] ? "rack-slot is-filled" : "rack-slot"));
  });

  diceValues.forEach((value, index) => {
    const position = diePositions[index] ?? { x: 50, y: 50, r: 0 };
    const isHeld = game.held[index] && !clearingDice.has(index);
    const classes = [
      "die",
      isHeld ? "is-held" : "is-loose",
      rollingDice.has(index) ? `is-${rollAnimation === "reroll" ? "rerolling" : "rolling"}` : "",
      holdingDice.has(index) ? "is-hold-pulse" : "",
      clearingDice.has(index) ? "is-clearing" : "",
    ].filter(Boolean).join(" ");
    const die = button("", classes, () => onHoldDie(index));
    die.disabled = game.rollsUsed === 0 || game.status === "complete" || isClearingTurn;
    die.setAttribute("aria-label", value == null ? `Empty die ${index + 1}` : `Die ${index + 1}, ${value}${game.held[index] ? ", held" : ""}`);
    die.dataset.value = value ?? "";
    die.style.setProperty("--die-x", `${position.x}%`);
    die.style.setProperty("--die-y", `${position.y}%`);
    die.style.setProperty("--die-rotation", `${position.r}deg`);
    die.append(renderPips(value));
    looseLayer.append(die);
  });

  tableSurface.append(heldRack, looseLayer);
  panel.append(element("h2", "", "Table"), tableSurface);
  return panel;
}

function renderDicePanel({ game, totals, isClearingTurn, onRoll }) {
  const panel = element("section", "dice-panel", null, { "aria-label": "Dice controls" });
  const rollsLeft = game.config.maxRolls - game.rollsUsed;
  const rollButton = button(game.rollsUsed === 0 ? "Roll dice" : `Roll ${rollsLeft} left`, "button primary", onRoll);
  rollButton.disabled = game.status === "complete" || rollsLeft <= 0 || isClearingTurn;

  const progress = element("div", "bonus-progress");
  const progressBar = element("span", "bonus-progress-fill");
  progressBar.style.width = `${Math.min(100, (totals.upperScore / game.config.upperBonusThreshold) * 100)}%`;
  progress.append(
    element("div", "bonus-progress-track", progressBar),
    element(
      "p",
      "bonus-copy",
      totals.upperBonus > 0 ? `Upper bonus locked: +${totals.upperBonus}` : `${totals.upperNeeded} upper points to bonus`,
    ),
  );

  panel.append(
    element("h2", "", "Controls"),
    element("div", "roll-actions", rollButton),
    progress,
    renderTotals(totals),
  );

  return panel;
}

function renderScorePanel({ scoreRows, isClearingTurn, onScore }) {
  const panel = element("section", "score-panel", null, { "aria-label": "Scorecard" });
  panel.append(element("h2", "", "Scorecard"));

  const upperRows = scoreRows.filter((row) => row.section === "upper");
  const lowerRows = scoreRows.filter((row) => row.section === "lower");

  panel.append(renderScoreSection("Upper", upperRows, isClearingTurn, onScore), renderScoreSection("Lower", lowerRows, isClearingTurn, onScore));
  return panel;
}

function renderScoreSection(title, rows, isClearingTurn, onScore) {
  const section = element("section", "score-section");
  section.append(element("h3", "", title));

  const list = element("div", "score-list");
  rows.forEach((row) => {
    const rowButton = button("", `score-row ${row.available ? "is-available" : ""} ${row.score != null ? "is-scored" : ""}`, () =>
      onScore(row.id),
    );
    rowButton.disabled = !row.available || isClearingTurn;
    rowButton.append(
      element("span", "score-label", row.label),
      element("span", row.preview != null ? "score-value is-preview" : "score-value", row.score == null ? previewText(row) : String(row.score)),
    );
    list.append(rowButton);
  });

  section.append(list);
  return section;
}

function renderPips(value) {
  const pips = element("span", `pips pips-${PIP_LABELS[value] ?? "empty"}`);
  const count = value ?? 0;
  for (let index = 0; index < count; index += 1) {
    pips.append(element("span", "pip"));
  }
  return pips;
}

function renderTotals(totals) {
  const panel = element("section", "totals", null, { "aria-label": "Score totals" });
  panel.append(
    statBlock("Upper", String(totals.upperScore)),
    statBlock("Bonus", String(totals.upperBonus + totals.yahtzeeBonus)),
    statBlock("Lower", String(totals.lowerScore)),
    statBlock("Open", String(totals.remainingCategories)),
  );
  return panel;
}

function statBlock(label, value) {
  const block = element("div", "stat");
  block.append(element("span", "stat-label", label), element("strong", "stat-value", value));
  return block;
}

function previewText(row) {
  if (row.preview == null) return "—";
  return String(row.preview);
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
