import { apiClient } from "../api/apiClient";
import { registerSyncWorker } from "./syncCoordinator";
import { completeSyncAction, failSyncAction, getPendingSyncActions, offlineAccess, queueSyncAction } from "./idb";
import { logDataSource } from "./logger";

let syncInFlight = false;

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
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
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
  registerSyncWorker("shortcuts", processShortcutQueue);
};

ensureOnlineSyncHook();

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
