import { apiClient } from "../api/apiClient";
import { completeSyncAction, failSyncAction, getPendingSyncActions, offlineAccess, queueSyncAction } from "./idb";
import { logDataSource } from "./logger";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const getCachedUser = () => {
  try {
    const raw = localStorage.getItem("cachedUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setCachedUser = (user) => {
  if (!user) return;
  localStorage.setItem("cachedUser", JSON.stringify(user));
};

const processShortcutQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("auth.shortcuts");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.shortcuts.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        const res = await apiClient.patch(action.url, action.payload);
        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.shortcuts.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });

        const cached = getCachedUser();
        if (cached && res?.data?.shortcuts) {
          setCachedUser({ ...cached, shortcuts: res.data.shortcuts });
        }
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed");
        logDataSource("IDB", "sync.shortcuts.failed", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      }
    }
  } finally {
    syncInFlight = false;
  }
};

const ensureOnlineSyncHook = () => {
  if (onlineHandlerAttached || typeof window === "undefined") return;
  onlineHandlerAttached = true;
  window.addEventListener("online", () => {
    processShortcutQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processShortcutQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processShortcutQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const updateShortcutsLocalFirst = async (shortcuts) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch("/auth/shortcuts", { shortcuts });
    return res.data;
  }

  const cached = getCachedUser() || {};
  const nextUser = { ...cached, shortcuts };
  setCachedUser(nextUser);

  await queueSyncAction({
    entity: "auth.shortcuts",
    method: "PATCH",
    url: "/auth/shortcuts",
    payload: { shortcuts },
    meta: {},
  });

  processShortcutQueue().catch(() => null);
  return { shortcuts };
};
