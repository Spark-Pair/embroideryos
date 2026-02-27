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
  logDataSource("IDB", "subscription.me.local", { hasData: Boolean(cached) });
  return cached || { data: null };
};
