const workers = new Map();
let coordinatorStarted = false;
let intervalId = null;
let runInFlight = null;

const isBrowser = () => typeof window !== "undefined";

export const runRegisteredSyncWorkers = async () => {
  if (runInFlight) return runInFlight;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  runInFlight = Promise.allSettled(
    Array.from(workers.values()).map((worker) => worker())
  ).finally(() => {
    runInFlight = null;
  });
  return runInFlight;
};

const startCoordinator = () => {
  if (coordinatorStarted || !isBrowser()) return;
  coordinatorStarted = true;
  const wake = () => runRegisteredSyncWorkers().catch(() => null);
  window.addEventListener("online", wake);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });
  intervalId = window.setInterval(wake, 15000);
};

export const registerSyncWorker = (name, worker) => {
  if (!name || typeof worker !== "function") return;
  workers.set(name, worker);
  startCoordinator();
};

export const unregisterSyncWorker = (name) => {
  workers.delete(name);
};

export const getRegisteredSyncWorkerCount = () => workers.size;

export const stopSyncCoordinator = () => {
  if (intervalId && isBrowser()) window.clearInterval(intervalId);
  intervalId = null;
  coordinatorStarted = false;
};
