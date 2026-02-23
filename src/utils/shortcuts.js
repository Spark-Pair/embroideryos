export const SHORTCUT_ACTIONS = [
  {
    id: "page_header_primary_action",
    label: "Primary Page Action",
    description: "Triggers the main action button shown in page headers.",
  },
  {
    id: "production_add_row",
    label: "Production: Add Row",
    description: "Add a new production row from last input (pcs/rounds)",
  },
];

export const DEFAULT_SHORTCUTS = {
  page_header_primary_action: "Ctrl+Space",
  production_add_row: "ArrowRight",
};

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

const KEY_ALIASES = {
  " ": "Space",
  Spacebar: "Space",
  Escape: "Esc",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

export function normalizeKey(key) {
  if (!key) return "";
  if (KEY_ALIASES[key]) return KEY_ALIASES[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function formatShortcutFromEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");

  if (MODIFIER_KEYS.has(e.key)) {
    return {
      combo: parts.join("+"),
      display: parts.join(" + "),
      isModifierOnly: true,
    };
  }

  const key = normalizeKey(e.key);
  const combo = [...parts, key].join("+");

  return {
    combo,
    display: [...parts, key].join(" + "),
    isModifierOnly: false,
  };
}

function parseShortcutCombo(combo = "") {
  if (!combo) {
    return { ctrl: false, shift: false, alt: false, key: "" };
  }

  const tokens = combo
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);

  const ctrl = tokens.some((token) => token.toLowerCase() === "ctrl");
  const shift = tokens.some((token) => token.toLowerCase() === "shift");
  const alt = tokens.some((token) => token.toLowerCase() === "alt");

  const keyToken = tokens.find(
    (token) => !["ctrl", "shift", "alt"].includes(token.toLowerCase())
  );

  return {
    ctrl,
    shift,
    alt,
    key: normalizeKey(keyToken || ""),
  };
}

export function isEventMatchingShortcut(e, combo) {
  const parsed = parseShortcutCombo(combo);
  if (!parsed.key) return false;

  if (e.ctrlKey !== parsed.ctrl) return false;
  if (e.shiftKey !== parsed.shift) return false;
  if (e.altKey !== parsed.alt) return false;

  return normalizeKey(e.key) === parsed.key;
}

export function assignShortcutInMap(shortcutMap, actionId, combo) {
  const map = { ...shortcutMap };
  let removedFromActionId = null;

  Object.entries(map).forEach(([id, assignedCombo]) => {
    if (id !== actionId && assignedCombo === combo) {
      map[id] = "";
      removedFromActionId = id;
    }
  });

  map[actionId] = combo;

  return { map, removedFromActionId };
}

export function findActionByShortcut(shortcutMap, combo, ignoreActionId = "") {
  return SHORTCUT_ACTIONS.find(
    (action) => action.id !== ignoreActionId && shortcutMap[action.id] === combo
  );
}

export function getActionLabel(actionId) {
  return SHORTCUT_ACTIONS.find((action) => action.id === actionId)?.label || actionId;
}

export function formatComboDisplay(combo = "") {
  if (!combo) return "Not set";
  return combo.split("+").join(" + ");
}

export function shouldIgnoreGlobalShortcutTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.closest("[data-shortcut-capture='true']")) return true;

  const tag = target.tagName;

  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}
