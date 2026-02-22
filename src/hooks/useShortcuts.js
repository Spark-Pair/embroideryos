import { useMemo } from "react";
import useAuth from "./useAuth";
import { updateMyShortcuts } from "../api/auth.api";
import { DEFAULT_SHORTCUTS, assignShortcutInMap } from "../utils/shortcuts";

function normalizeShortcuts(user) {
  return {
    ...DEFAULT_SHORTCUTS,
    ...(user?.shortcuts || {}),
  };
}

export function useShortcutMap() {
  const { user } = useAuth();

  return useMemo(() => normalizeShortcuts(user), [user?.shortcuts]);
}

export function useShortcut(actionId) {
  const shortcuts = useShortcutMap();
  return shortcuts[actionId] || "";
}

export function useShortcutActions() {
  const { user, setUser } = useAuth();
  const shortcutMap = useShortcutMap();

  const assignShortcut = async (actionId, combo) => {
    const { map, removedFromActionId } = assignShortcutInMap(shortcutMap, actionId, combo);
    const res = await updateMyShortcuts(map);
    const persisted = {
      ...DEFAULT_SHORTCUTS,
      ...(res?.shortcuts || map),
    };

    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shortcuts: persisted,
      };
    });

    return { map: persisted, removedFromActionId };
  };

  const resetShortcuts = async () => {
    const res = await updateMyShortcuts(DEFAULT_SHORTCUTS);
    const persisted = {
      ...DEFAULT_SHORTCUTS,
      ...(res?.shortcuts || DEFAULT_SHORTCUTS),
    };

    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shortcuts: persisted,
      };
    });

    return persisted;
  };

  return {
    shortcutMap,
    user,
    assignShortcut,
    resetShortcuts,
  };
}
