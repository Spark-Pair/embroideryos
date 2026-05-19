const listeners = new Set();
let syncController = null;
let cancelRequested = false;

let state = {
  phase: "idle", // idle | syncing | done
  totalSteps: 0,
  completedSteps: 0,
  failedSteps: 0,
  currentStepId: "",
  currentStepLabel: "",
  lastError: "",
  startedAt: 0,
  finishedAt: 0,
};

const emit = () => {
  const snapshot = { ...state };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore listener errors
    }
  });
};

const patchState = (patch) => {
  state = { ...state, ...(patch || {}) };
  emit();
};

export const getBootstrapSyncState = () => ({ ...state });

export const subscribeBootstrapSyncState = (listener) => {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
};

export const startBootstrapSync = (totalSteps = 0) => {
  if (syncController) {
    try {
      syncController.abort();
    } catch {
      // ignore abort failures
    }
  }
  syncController = typeof AbortController !== "undefined" ? new AbortController() : null;
  cancelRequested = false;
  patchState({
    phase: "syncing",
    totalSteps: Math.max(0, Number(totalSteps) || 0),
    completedSteps: 0,
    failedSteps: 0,
    currentStepId: "",
    currentStepLabel: "",
    lastError: "",
    startedAt: Date.now(),
    finishedAt: 0,
  });
};

export const markBootstrapSyncStepDone = (stepId = "", stepLabel = "") => {
  patchState({
    completedSteps: Math.min(state.totalSteps, state.completedSteps + 1),
    currentStepId: String(stepId || ""),
    currentStepLabel: String(stepLabel || ""),
  });
};

export const failBootstrapSyncStep = (stepId = "", stepLabel = "", message = "") => {
  patchState({
    failedSteps: state.failedSteps + 1,
    currentStepId: String(stepId || ""),
    currentStepLabel: String(stepLabel || ""),
    lastError: String(message || ""),
  });
};

export const completeBootstrapSync = () => {
  syncController = null;
  cancelRequested = false;
  patchState({
    phase: "done",
    currentStepId: "",
    currentStepLabel: "",
    finishedAt: Date.now(),
  });
};

export const getBootstrapSyncSignal = () => syncController?.signal || null;

export const isBootstrapSyncCancelled = () => {
  if (cancelRequested) return true;
  return Boolean(syncController?.signal?.aborted);
};

export const cancelBootstrapSync = () => {
  cancelRequested = true;
  if (syncController) {
    try {
      syncController.abort();
    } catch {
      // ignore abort failures
    }
  }
  syncController = null;
  resetBootstrapSync();
};

export const resetBootstrapSync = () => {
  cancelRequested = false;
  syncController = null;
  state = {
    phase: "idle",
    totalSteps: 0,
    completedSteps: 0,
    failedSteps: 0,
    currentStepId: "",
    currentStepLabel: "",
    lastError: "",
    startedAt: 0,
    finishedAt: 0,
  };
  emit();
};
