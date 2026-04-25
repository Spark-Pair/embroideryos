import { apiClient } from "../api/apiClient";
import { getEntitySnapshot, offlineAccess, upsertEntitySnapshot } from "./idb";
import { logDataSource } from "./logger";

const SUBSCRIPTION_KEY = "subscription:me";

export const fetchMySubscriptionLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/subscriptions/me");
    const data = res.data;
    await upsertEntitySnapshot(SUBSCRIPTION_KEY, data);
    return data;
  }

  const cached = await getEntitySnapshot(SUBSCRIPTION_KEY);
  if (cached) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      apiClient
        .get("/subscriptions/me")
        .then(async (res) => {
          await upsertEntitySnapshot(SUBSCRIPTION_KEY, res.data);
        })
        .catch(() => null);
    }
    logDataSource("IDB", "subscription.me.local", { hasData: true });
    return cached;
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await apiClient.get("/subscriptions/me");
      const data = res.data;
      await upsertEntitySnapshot(SUBSCRIPTION_KEY, data);
      return data;
    } catch {
      // fall back to empty shape
    }
  }

  logDataSource("IDB", "subscription.me.local", { hasData: Boolean(cached) });
  return cached || { data: null };
};
