"use client";

import { useEffect, useMemo } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { X } from "lucide-react";
import type { ProcessoRow } from "@/lib/types";
import { ONDE_VAZIO_LABEL, rankingStandbyMedioPorOndePilaresPsi } from "@/lib/aggregations";

/** Mesmas cores dos cartões PILARES / PSI no painel. */
const COLOR_PILARES = "#2563eb";
const COLOR_PSI = "#dc2626";

const chartTheme = {
  light: { yTick: "#1e293b", grid: "#e2e8f0", cursor: "rgba(15, 23, 42, 0.06)" },
  dark: { yTick: "#f1f5f9", grid: "#475569", cursor: "rgba(248, 250, 252, 0.08)" },
} as const;

function truncLabel(s: string, max = 22): string {
  const t = s === ONDE_VAZIO_LABEL ? "(sem local definido)" : s;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

type ChartRow = {
  onde: string;
  ondeFull: string;
  rankLabel: string;
  quantidadePilares: number;
  quantidadePsi: number;
  standbyPilares: number;
  standbyPsi: number;
};

export type KpiStandbyOndeModalProps = {
  open: boolean;
  onClose: () => void;
  rows: ProcessoRow[];
  chartDark?: boolean;
};

export function KpiStandbyOndeModal({ open, onClose, rows, chartDark = false }: KpiStandbyOndeModalProps) {
  const t = chartDark ? chartTheme.dark : chartTheme.light;

  const chartData = useMemo((): ChartRow[] => {
    const ranked = rankingStandbyMedioPorOndePilaresPsi(rows, 20);
    return ranked.map((r, i) => ({
      onde: r.onde,
      ondeFull: r.onde === ONDE_VAZIO_LABEL ? "(sem local definido)" : r.onde,
      rankLabel: `${i + 1}º ${truncLabel(r.onde === ONDE_VAZIO_LABEL ? "(sem local definido)" : r.onde, 20)}`,
      quantidadePilares: r.quantidadePilares,
      quantidadePsi: r.quantidadePsi,
      standbyPilares: r.standbyMedioPilares,
      standbyPsi: r.standbyMedioPsi,
    }));
  }, [rows]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const barThickness = 48;
  const chartHeight = Math.max(260, chartData.length * (barThickness + 12) + 56);
  const maxSb = chartData.reduce(
    (m, r) => Math.max(m, r.standbyPilares, r.standbyPsi),
    1,
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/70"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpi-standby-onde-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/90 sm:px-5 sm:py-4">
          <div className="min-w-0 pr-2">
            <h2
              id="kpi-standby-onde-title"
              className="text-base font-bold text-slate-900 dark:text-white sm:text-lg"
            >
              Standby médio por local
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">
              Média de dias em stand-by, separada em{" "}
              <strong className="font-semibold text-slate-800 dark:text-slate-100">PILARES</strong> e{" "}
              <strong className="font-semibold text-slate-800 dark:text-slate-100">PSI</strong>. Só entra no gráfico os processos
              já criados.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-6 shrink-0 rounded-sm shadow-sm"
                  style={{ backgroundColor: COLOR_PILARES }}
                  aria-hidden
                />
                PILARES
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-6 shrink-0 rounded-sm shadow-sm"
                  style={{ backgroundColor: COLOR_PSI }}
                  aria-hidden
                />
                PSI
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 px-4 py-4 dark:bg-slate-950/50 sm:px-5 sm:py-5">
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sem processos criados para exibir o ranking.</p>
          ) : (
            <div
              className="w-full rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50/90 to-white px-1 pb-2 pt-2 shadow-inner dark:border-slate-600 dark:from-slate-800/60 dark:to-slate-900/40"
              style={{ height: chartHeight }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 8, right: 44, left: 4, bottom: 8 }}
                  barCategoryGap="14%"
                  barGap={4}
                >
                  <XAxis type="number" domain={[0, Math.max(maxSb * 1.12, 1)]} hide />
                  <YAxis
                    type="category"
                    dataKey="rankLabel"
                    width={152}
                    tick={{ fontSize: 10, fill: t.yTick, fontWeight: 600 }}
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: t.cursor }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as ChartRow;
                      const pil = d.quantidadePilares > 0;
                      const ps = d.quantidadePsi > 0;
                      return (
                        <div className="max-w-[300px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/10">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{d.ondeFull}</p>
                          <ul className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">
                            <li className="flex items-start gap-2">
                              <span
                                className="mt-1 h-2 w-3 shrink-0 rounded-sm"
                                style={{ backgroundColor: COLOR_PILARES }}
                                aria-hidden
                              />
                              <span>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">PILARES:</span>{" "}
                                {pil ? (
                                  <>
                                    <strong className="tabular-nums text-slate-900 dark:text-white">
                                      {d.standbyPilares}d
                                    </strong>{" "}
                                    <span className="text-slate-500 dark:text-slate-400">
                                      ({d.quantidadePilares}{" "}
                                      {d.quantidadePilares === 1 ? "processo" : "processos"})
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-500 dark:text-slate-400">sem processos neste local</span>
                                )}
                              </span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span
                                className="mt-1 h-2 w-3 shrink-0 rounded-sm"
                                style={{ backgroundColor: COLOR_PSI }}
                                aria-hidden
                              />
                              <span>
                                <span className="font-semibold text-slate-800 dark:text-slate-100">PSI:</span>{" "}
                                {ps ? (
                                  <>
                                    <strong className="tabular-nums text-slate-900 dark:text-white">
                                      {d.standbyPsi}d
                                    </strong>{" "}
                                    <span className="text-slate-500 dark:text-slate-400">
                                      ({d.quantidadePsi}{" "}
                                      {d.quantidadePsi === 1 ? "processo" : "processos"})
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-500 dark:text-slate-400">sem processos neste local</span>
                                )}
                              </span>
                            </li>
                          </ul>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="standbyPilares"
                    name="PILARES"
                    fill={COLOR_PILARES}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                  >
                    <LabelList
                      dataKey="standbyPilares"
                      position="right"
                      offset={4}
                      formatter={(v) => {
                        const n = typeof v === "number" ? v : Number(v);
                        return Number.isFinite(n) && n > 0 ? `${n}d` : "";
                      }}
                      style={{
                        fill: t.yTick,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  </Bar>
                  <Bar
                    dataKey="standbyPsi"
                    name="PSI"
                    fill={COLOR_PSI}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                  >
                    <LabelList
                      dataKey="standbyPsi"
                      position="right"
                      offset={4}
                      formatter={(v) => {
                        const n = typeof v === "number" ? v : Number(v);
                        return Number.isFinite(n) && n > 0 ? `${n}d` : "";
                      }}
                      style={{
                        fill: t.yTick,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
