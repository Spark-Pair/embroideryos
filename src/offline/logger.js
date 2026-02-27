const nowIso = () => new Date().toISOString();

const safeJson = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const logDataSource = (source, event, payload = {}) => {
  const tag = source === "IDB" ? "IDB" : "CLOUD";
  const time = nowIso();
  const body = Object.keys(payload).length ? ` ${safeJson(payload)}` : "";
  // Requested by user: clear source logging for every action.
  // eslint-disable-next-line no-console
  console.info(`[DATA][${tag}] ${time} ${event}${body}`);
};

