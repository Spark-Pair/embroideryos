export const PAYOUT_MODES = {
  TARGET_DUAL_PCT: "target_dual_pct",
  SINGLE_PCT: "single_pct",
  SALARY_BONUS_ONLY: "salary_bonus_only",
  STITCH_BLOCK_RATE: "stitch_block_rate",
};

export const DEFAULT_PAYOUT_MODE = PAYOUT_MODES.TARGET_DUAL_PCT;

export const EMPTY_PRODUCTION_CONFIG = {
  payout_mode: DEFAULT_PAYOUT_MODE,
  stitch_rate: "",
  applique_rate: "",
  on_target_pct: "",
  after_target_pct: "",
  production_pct: "",
  stitch_block_size: "",
  amount_per_block: "",
  target_amount: "",
  pcs_per_round: "",
  bonus_rate: "",
  allowance: "",
  off_amount: "",
  stitch_cap: "",
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeProductionConfig = (config = {}) => ({
  ...EMPTY_PRODUCTION_CONFIG,
  ...config,
  payout_mode: config?.payout_mode || DEFAULT_PAYOUT_MODE,
  stitch_rate: toNumber(config?.stitch_rate, 0),
  applique_rate: toNumber(config?.applique_rate, 0),
  on_target_pct: toNumber(config?.on_target_pct, 0),
  after_target_pct: toNumber(config?.after_target_pct, 0),
  production_pct: toNumber(config?.production_pct, 0),
  stitch_block_size: toNumber(config?.stitch_block_size, 0),
  amount_per_block: toNumber(config?.amount_per_block, 0),
  target_amount: toNumber(config?.target_amount, 0),
  pcs_per_round: toNumber(config?.pcs_per_round, 0),
  bonus_rate: toNumber(config?.bonus_rate, 0),
  allowance: toNumber(config?.allowance, 0),
  off_amount: toNumber(config?.off_amount, 0),
  stitch_cap: toNumber(config?.stitch_cap, 0),
});

export const isTargetMode = (config = {}) =>
  normalizeProductionConfig(config).payout_mode === PAYOUT_MODES.TARGET_DUAL_PCT;

export const shouldShowProductionAmount = (config = {}) =>
  normalizeProductionConfig(config).payout_mode !== PAYOUT_MODES.SALARY_BONUS_ONLY;

export const getPayoutModeLabel = (mode) => {
  switch (mode) {
    case PAYOUT_MODES.SINGLE_PCT:
      return "Single %";
    case PAYOUT_MODES.SALARY_BONUS_ONLY:
      return "Salary + Bonus Only";
    case PAYOUT_MODES.STITCH_BLOCK_RATE:
      return "Stitch Block Rate";
    default:
      return "Target Based";
  }
};

export const getPayoutModeOptions = () => ([
  { label: "Target Based", value: PAYOUT_MODES.TARGET_DUAL_PCT },
  { label: "Single %", value: PAYOUT_MODES.SINGLE_PCT },
  { label: "Salary + Bonus Only", value: PAYOUT_MODES.SALARY_BONUS_ONLY },
  { label: "Stitch Block Rate", value: PAYOUT_MODES.STITCH_BLOCK_RATE },
]);

export const getModeSummary = (rawConfig = {}) => {
  const config = normalizeProductionConfig(rawConfig);
  switch (config.payout_mode) {
    case PAYOUT_MODES.SINGLE_PCT:
      return `Single production rate: ${config.production_pct}%`;
    case PAYOUT_MODES.SALARY_BONUS_ONLY:
      return "Production tracked only. Payout comes from salary/off-day and bonus.";
    case PAYOUT_MODES.STITCH_BLOCK_RATE:
      return `${config.amount_per_block} per ${config.stitch_block_size} stitches`;
    default:
      return `On target: ${config.on_target_pct}% · After target: ${config.after_target_pct}% · Target: ${config.target_amount}`;
  }
};

export const getProductionAmountLabels = (rawConfig = {}) => {
  const config = normalizeProductionConfig(rawConfig);
  switch (config.payout_mode) {
    case PAYOUT_MODES.SINGLE_PCT:
      return {
        primary: `Amount (${config.production_pct}%)`,
        secondary: null,
        summaryPrimary: "Production Amount",
        summarySecondary: null,
      };
    case PAYOUT_MODES.SALARY_BONUS_ONLY:
      return {
        primary: "Tracked Amount",
        secondary: null,
        summaryPrimary: "Tracked Amount",
        summarySecondary: null,
      };
    case PAYOUT_MODES.STITCH_BLOCK_RATE:
      return {
        primary: `Amount (${config.amount_per_block}/${config.stitch_block_size})`,
        secondary: null,
        summaryPrimary: "Stitch Amount",
        summarySecondary: null,
      };
    default:
      return {
        primary: `On Target (${config.on_target_pct}%)`,
        secondary: `After Target (${config.after_target_pct}%)`,
        summaryPrimary: "On Target",
        summarySecondary: "After Target",
      };
  }
};

export const calculateProductionRow = (row = {}, rawConfig = {}) => {
  const config = normalizeProductionConfig(rawConfig);
  const stitchRaw = toNumber(row?.d_stitch, 0);
  const pcs = toNumber(row?.pcs, 0);
  const rounds = toNumber(row?.rounds, 0);
  const applique = toNumber(row?.applique, 0);
  const effectiveStitch = stitchRaw > 0 && stitchRaw <= config.stitch_cap ? config.stitch_cap : stitchRaw;
  const total_stitch = stitchRaw * rounds;
  const stitch_base = (effectiveStitch * config.stitch_rate * pcs) / 100;
  const applique_base = (config.applique_rate * applique * pcs) / 100;
  const combined = stitch_base + applique_base;

  if (config.payout_mode === PAYOUT_MODES.SALARY_BONUS_ONLY) {
    return { total_stitch, on_target_amt: 0, after_target_amt: 0 };
  }
  if (config.payout_mode === PAYOUT_MODES.SINGLE_PCT) {
    const amount = combined * config.production_pct;
    return { total_stitch, on_target_amt: amount, after_target_amt: amount };
  }
  if (config.payout_mode === PAYOUT_MODES.STITCH_BLOCK_RATE) {
    const amount = config.stitch_block_size > 0
      ? (total_stitch / config.stitch_block_size) * config.amount_per_block
      : 0;
    return { total_stitch, on_target_amt: amount, after_target_amt: amount };
  }
  return {
    total_stitch,
    on_target_amt: combined * config.on_target_pct,
    after_target_amt: combined * config.after_target_pct,
  };
};

export const calculateProductionTotals = (rows = [], config = {}) =>
  rows.reduce(
    (acc, row) => {
      const next = calculateProductionRow(row, config);
      return {
        pcs: acc.pcs + toNumber(row?.pcs, 0),
        rounds: acc.rounds + toNumber(row?.rounds, 0),
        total_stitch: acc.total_stitch + next.total_stitch,
        on_target_amt: acc.on_target_amt + next.on_target_amt,
        after_target_amt: acc.after_target_amt + next.after_target_amt,
      };
    },
    { pcs: 0, rounds: 0, total_stitch: 0, on_target_amt: 0, after_target_amt: 0 }
  );

export const getTargetProgress = (totals, rawConfig = {}, flags = {}) => {
  const config = normalizeProductionConfig(rawConfig);
  const targetMode = isTargetMode(config);
  const onTargetAmount = toNumber(totals?.on_target_amt, 0);
  const targetAmount = toNumber(config.target_amount, 0);
  const targetMet = targetMode && targetAmount > 0 ? onTargetAmount >= targetAmount : false;
  const forceAfter = targetMode && Boolean(flags?.force_after_target_for_non_target);
  const forceFull = targetMode && Boolean(flags?.force_full_target_for_non_target);
  const effectiveAmount = forceFull
    ? (config.on_target_pct > 0 ? (targetAmount / config.on_target_pct) * config.after_target_pct : targetAmount)
    : (targetMet || forceAfter)
    ? toNumber(totals?.after_target_amt, 0)
    : onTargetAmount;

  return { targetMode, targetMet, forceAfter, forceFull, effectiveAmount };
};
