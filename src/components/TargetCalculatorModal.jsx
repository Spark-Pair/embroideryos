import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import { formatNumbers } from "../utils";
import { fetchProductionConfig } from "../api/productionConfig";

const DEFAULT_CONFIG = {
  stitch_rate: 0.001,
  applique_rate: 1.111,
  on_target_pct: 30,
  after_target_pct: 34,
  pcs_per_round: 12,
  stitch_cap: 5000,
};

const todayInput = () => new Date().toISOString().slice(0, 10);
const emptyRow = () => ({ _key: crypto.randomUUID(), d_stitch: "", applique: "", pcs: "", rounds: "" });

function calcRow(row, cfg) {
  const stitchRaw = parseFloat(row.d_stitch) || 0;
  const pcs = parseFloat(row.pcs) || 0;
  const rounds = parseFloat(row.rounds) || 0;
  const applique = parseFloat(row.applique) || 0;

  const stitch =
    stitchRaw > 0 && stitchRaw <= (cfg.stitch_cap ?? DEFAULT_CONFIG.stitch_cap)
      ? (cfg.stitch_cap ?? DEFAULT_CONFIG.stitch_cap)
      : stitchRaw;

  const stitch_rate = cfg.stitch_rate ?? DEFAULT_CONFIG.stitch_rate;
  const applique_rate = cfg.applique_rate ?? DEFAULT_CONFIG.applique_rate;
  const on_target_pct = cfg.on_target_pct ?? DEFAULT_CONFIG.on_target_pct;
  const after_target_pct = cfg.after_target_pct ?? DEFAULT_CONFIG.after_target_pct;

  const total_stitch = stitchRaw * rounds;
  const stitch_base = (stitch * stitch_rate * pcs) / 100;
  const applique_base = (applique_rate * applique * pcs) / 100;
  const combined = stitch_base + applique_base;
  const on_target_amt = combined * on_target_pct;
  const after_target_amt = combined * after_target_pct;

  return { total_stitch, on_target_amt, after_target_amt };
}

function syncPcsRounds(field, value, pcsPerRound) {
  const num = parseFloat(value);
  if (!value || Number.isNaN(num) || num <= 0) {
    return {
      pcs: field === "pcs" ? value : "",
      rounds: field === "rounds" ? value : "",
    };
  }

  if (field === "pcs") {
    return { pcs: value, rounds: String(Math.ceil(num / pcsPerRound)) };
  }

  return { pcs: String(num * pcsPerRound), rounds: value };
}

export default function TargetCalculatorModal({ onClose }) {
  const [cfgDate, setCfgDate] = useState(todayInput());
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [rows, setRows] = useState([emptyRow()]);

  useEffect(() => {
    if (!cfgDate) return;

    const loadConfig = async () => {
      setCfgLoading(true);
      try {
        const res = await fetchProductionConfig(cfgDate);
        setCfg(res?.data ? { ...DEFAULT_CONFIG, ...res.data } : DEFAULT_CONFIG);
      } catch {
        setCfg(DEFAULT_CONFIG);
      } finally {
        setCfgLoading(false);
      }
    };

    loadConfig();
  }, [cfgDate]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const result = calcRow(row, cfg);
        acc.total_pcs += parseFloat(row.pcs) || 0;
        acc.total_rounds += parseFloat(row.rounds) || 0;
        acc.total_stitch += result.total_stitch;
        acc.total_on_target += result.on_target_amt;
        acc.total_after_target += result.after_target_amt;
        return acc;
      },
      {
        total_pcs: 0,
        total_rounds: 0,
        total_stitch: 0,
        total_on_target: 0,
        total_after_target: 0,
      }
    );
  }, [rows, cfg]);

  const updateRow = (rowKey, patch) => {
    setRows((prev) => prev.map((r) => (r._key === rowKey ? { ...r, ...patch } : r)));
  };

  const handleValue = (row, field, value) => {
    if (field === "pcs" || field === "rounds") {
      updateRow(row._key, syncPcsRounds(field, value, cfg.pcs_per_round ?? DEFAULT_CONFIG.pcs_per_round));
      return;
    }
    updateRow(row._key, { [field]: value });
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (rowKey) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r._key !== rowKey)));
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Target Calculator"
      subtitle="Uses same production calculation as staff record configuration for selected date."
      maxWidth="max-w-6xl"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {cfgLoading ? "Loading configuration..." : `Config: ${cfgDate || "-"}`}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" outline onClick={onClose}>Close</Button>
            <Button icon={Plus} onClick={addRow}>Add Row</Button>
          </div>
        </div>
      }
    >
      <div className="p-0.5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-2xl border border-gray-300 bg-white p-4">
          <Input
            label="Config Date"
            type="date"
            value={cfgDate}
            onChange={(e) => setCfgDate(e.target.value)}
          />

          <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Stitch Rate</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatNumbers(cfg.stitch_rate, 3)}</p>
          </div>
          <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Applique Rate</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatNumbers(cfg.applique_rate, 3)}</p>
          </div>
          <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">On Target %</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatNumbers(cfg.on_target_pct, 0)}%</p>
          </div>
          <div className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">After Target %</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatNumbers(cfg.after_target_pct, 0)}%</p>
          </div>
        </div>

        {cfgLoading ? (
          <div className="rounded-2xl border border-gray-300 bg-white py-16 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading production configuration...
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden">
            <div className="overflow-auto max-h-[48vh]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-100" style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}>
                  <tr className="text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-3 font-medium">#</th>
                    <th className="px-3 py-3 font-medium">D-Stitch</th>
                    <th className="px-3 py-3 font-medium">Applique</th>
                    <th className="px-3 py-3 font-medium">Rounds</th>
                    <th className="px-3 py-3 font-medium">Pcs</th>
                    <th className="px-3 py-3 font-medium text-right">Total Stitch</th>
                    <th className="px-3 py-3 font-medium text-right">On Target</th>
                    <th className="px-3 py-3 font-medium text-right">After Target</th>
                    <th className="px-3 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((row, idx) => {
                    const result = calcRow(row, cfg);
                    return (
                      <tr key={row._key} className="hover:bg-gray-50/80">
                        <td className="px-3 py-2 text-sm text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <Input value={row.d_stitch} onChange={(e) => handleValue(row, "d_stitch", e.target.value)} type="number" placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={row.applique} onChange={(e) => handleValue(row, "applique", e.target.value)} type="number" placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={row.rounds} onChange={(e) => handleValue(row, "rounds", e.target.value)} type="number" placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={row.pcs} onChange={(e) => handleValue(row, "pcs", e.target.value)} type="number" placeholder="0" />
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-700 tabular-nums">{formatNumbers(result.total_stitch, 0)}</td>
                        <td className="px-3 py-2 text-right text-sm text-rose-700 font-semibold tabular-nums">{formatNumbers(result.on_target_amt, 2)}</td>
                        <td className="px-3 py-2 text-right text-sm text-emerald-700 font-semibold tabular-nums">{formatNumbers(result.after_target_amt, 2)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            outline
                            icon={Trash2}
                            onClick={() => removeRow(row._key)}
                            disabled={rows.length <= 1}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-gray-300 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Total Pcs</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{formatNumbers(totals.total_pcs, 0)}</p>
          </div>
          <div className="rounded-2xl border border-gray-300 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Total Rounds</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{formatNumbers(totals.total_rounds, 0)}</p>
          </div>
          <div className="rounded-2xl border border-gray-300 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Total Stitch</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 tabular-nums">{formatNumbers(totals.total_stitch, 0)}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-[11px] uppercase tracking-wider text-rose-600">Total On Target</p>
            <p className="text-xl font-semibold text-rose-700 mt-1 tabular-nums">{formatNumbers(totals.total_on_target, 2)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] uppercase tracking-wider text-emerald-600">Total After Target</p>
            <p className="text-xl font-semibold text-emerald-700 mt-1 tabular-nums">{formatNumbers(totals.total_after_target, 2)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
