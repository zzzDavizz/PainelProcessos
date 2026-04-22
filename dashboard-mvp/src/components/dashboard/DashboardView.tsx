"use client";

import Image from "next/image";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarRange,
  Clock,
  Hash,
  Hourglass,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListOrdered,
  LogOut,
  Moon,
  PieChart,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Wallet,
  FileSpreadsheet,
  Tag,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import type { ProcessoRow } from "@/lib/types";
import { MOCK_PROCESSOS } from "@/lib/mockData";
import {
  alocacaoFocalPie,
  apenasProcessosComNumeroOficial,
  type AlocacaoFocalFiltro,
  type DfdTrdColuna,
  distribuicaoPorOnde,
  distribuicaoPorStatus,
  filterByAlocacaoFocal,
  filterByBloco,
  filterByStartProcessoRange,
  formatOndeBucketLabel,
  endProcessoDonut,
  healthDonut,
  processosCriadosPorFatiaAlerta,
  processosCriadosPorFatiaAlocacaoFocal,
  processosCriadosPorBucketDfdTrd,
  processosCriadosPorFatiaEndProcesso,
  processosCriadosPorFatiaTermoEnc,
  processosPorBucketOnde,
  processosPorStatus,
  kpisGlobais,
  resumoBloco,
  searchRows,
  termoEncPie,
  dfdTrdBars,
  type DfdTrdBarPoint,
  topAtrasados,
  valorTotalPendentesCriacao,
  valorTotalProcessos,
} from "@/lib/aggregations";
import { formatBRL, formatDataUltimaMovimentacaoBR } from "@/lib/format";
import { exportResumoPlanilhaComoExcel } from "@/lib/exportResumoExcel";
import { KpiDetailModal } from "@/components/dashboard/KpiDetailModal";
import { KpiStandbyOndeModal } from "@/components/dashboard/KpiStandbyOndeModal";
import { AlertaDonutDetalheModal } from "@/components/dashboard/AlertaDonutDetalheModal";
import { KpiTotalStartEvolucaoModal } from "@/components/dashboard/KpiTotalStartEvolucaoModal";
import GestaoComponentesView from "@/components/dashboard/GestaoComponentesView";
import type { ComponenteGestaoRow } from "@/lib/parseGestaoComponentesCsv";

const COLORS = {
  pilares: "#2563eb",
  psi: "#dc2626",
  consolidado: "#0f172a",
};

type KpiModalKey = "alertas" | "diasEmCurso" | "semEnd" | "standbyOnde" | "totalStartEvolucao";

type KpiCard = {
  label: string;
  desc?: string;
  value: string;
  sub: ReactNode;
  modal: KpiModalKey | null;
};

/** Cores de eixo/grid do Recharts (SVG não herda `dark:` do Tailwind). */
const barChartTheme = {
  light: {
    yTick: "#1e293b",
    xTick: "#64748b",
    grid: "#e2e8f0",
    axis: "#cbd5e1",
    cursor: "rgba(15, 23, 42, 0.06)",
  },
  dark: {
    yTick: "#ffffff",
    xTick: "#f1f5f9",
    grid: "#475569",
    axis: "#94a3b8",
    cursor: "rgba(248, 250, 252, 0.08)",
  },
} as const;

function MiniDonut({
  data,
  chartDark = false,
  onSliceClick,
}: {
  data: { name: string; value: number; color: string; count: number; total: number }[];
  chartDark?: boolean;
  /** Quando definido, as fatias ficam clicáveis (ex.: donut de alertas). */
  onSliceClick?: (sliceName: string) => void;
}) {
  return (
    <div className="h-[120px] w-full min-w-[100px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={120}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={38}
            outerRadius={52}
            paddingAngle={2}
            style={{ outline: "none", cursor: onSliceClick ? "pointer" : "default" }}
            onClick={(_sector, index) => {
              if (!onSliceClick || typeof index !== "number") return;
              const item = data[index];
              if (item?.name && item.name !== "Sem dados") onSliceClick(item.name);
            }}
          >
            {data.map((e) => (
              <Cell key={e.name} fill={e.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0];
              const slice = item?.payload as
                | { name?: string; value?: number; count?: number; total?: number; color?: string }
                | undefined;
              const percent = typeof item?.value === "number" ? item.value : Number(item?.value ?? 0);
              const count = slice?.count ?? 0;
              const total = slice?.total ?? 0;

              return (
                <div className="max-w-[240px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/10">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: slice?.color ?? "#94a3b8" }}
                    />
                    {slice?.name ?? "Sem dados"}
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">{percent}%</strong>{" "}
                    <span className="text-slate-500 dark:text-slate-400">
                      ({count}
                      {total > 0 ? ` de ${total}` : ""})
                    </span>
                  </p>
                  <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-snug text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">Orientação</p>
                    <p>Até 5 dias → OK</p>
                    <p>6 a 10 dias → ATENÇÃO</p>
                    <p>Acima de 10 dias → CRÍTICO</p>
                  </div>
                </div>
              );
            }}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Pizza (sem furo) — mesmos dados que o donut de alertas. */
function MiniPie({
  data,
  chartDark = false,
  onSliceClick,
}: {
  data: { name: string; value: number; color: string; count: number; total: number }[];
  chartDark?: boolean;
  onSliceClick?: (sliceName: string) => void;
}) {
  return (
    <div className="h-[120px] w-full min-w-[100px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={120}>
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={54}
            paddingAngle={1}
            style={{ outline: "none", cursor: onSliceClick ? "pointer" : "default" }}
            onClick={(_sector, index) => {
              if (!onSliceClick || typeof index !== "number") return;
              const item = data[index];
              if (item?.name && item.name !== "Sem dados") onSliceClick(item.name);
            }}
          >
            {data.map((e) => (
              <Cell key={e.name} fill={e.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, _name, item) => {
              const payload = item?.payload as { count?: number; total?: number } | undefined;
              const count = payload?.count ?? 0;
              const total = payload?.total ?? 0;
              return [`${v ?? 0}% (${count}${total > 0 ? ` de ${total}` : ""})`, ""];
            }}
            contentStyle={
              chartDark
                ? {
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "0.75rem",
                    color: "#ffffff",
                  }
                : undefined
            }
            labelStyle={chartDark ? { color: "#ffffff" } : undefined}
            itemStyle={chartDark ? { color: "#ffffff" } : undefined}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

function OndeProcessoBars({
  rows,
  chartDark = false,
  barFill,
  onBarClick,
}: {
  rows: ProcessoRow[];
  chartDark?: boolean;
  barFill: string;
  onBarClick?: (bucketNome: string) => void;
}) {
  const t = chartDark ? barChartTheme.dark : barChartTheme.light;
  const chartRows = distribuicaoPorOnde(rows, 8, { uniformBarFill: barFill });
  const rankedRows = chartRows.map((row, i) => ({
    ...row,
    rankLabel: `${i + 1}º ${row.name}`,
  }));
  // Ordem do array = ordem no eixo Y: 1º (maior volume) primeiro → aparece no topo.
  const displayData = rankedRows;
  const barThickness = 44;
  /** Altura mínima alinha os gráficos entre as 3 colunas mesmo com poucas barras (ex.: PSI). */
  const chartMinHeightPx = 300;
  const chartHeight = Math.max(
    chartMinHeightPx,
    Math.max(200, displayData.length * (barThickness + 18) + 72),
  );
  if (chartRows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <ListOrdered className="h-3.5 w-3.5" />
          Onde está o processo?
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados para exibir.</p>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2">
      <div className="shrink-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <ListOrdered className="h-3.5 w-3.5" />
          Onde está o processo?{" "}
          <span className="font-normal text-slate-400 dark:text-slate-500">(ranking)</span>
        </p>
        <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Status "Efetivado" e "Efetivado/Recorrente" são desconsiderados.
        </p>
      </div>
      <div
        className="w-full shrink-0 rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50/90 to-white px-1 pb-3 pt-3 shadow-inner dark:border-slate-600 dark:from-slate-800/60 dark:to-slate-900/40"
        style={{ height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={displayData}
            margin={{ top: 8, right: 40, left: 4, bottom: 8 }}
            barCategoryGap="18%"
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              hide
            />
            <YAxis
              type="category"
              dataKey="rankLabel"
              width={112}
              tick={{ fontSize: 11, fill: t.yTick, fontWeight: 600 }}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: t.cursor }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as {
                  name: string;
                  v: number;
                  count: number;
                  pendenteCriacao: number;
                  valorTotal: number;
                  pctValor: number;
                };
                const pctProcFmt = d.v.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                });
                const pctValFmt = d.pctValor.toLocaleString("pt-BR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                });
                return (
                  <div className="max-w-[280px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/10">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatOndeBucketLabel(d.name)}
                    </p>
                    <p className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300">
                      <span className="block">
                        <span className="text-slate-500 dark:text-slate-400">Processos criados:</span>{" "}
                        <strong className="text-slate-900 dark:text-white">{d.count}</strong>
                        <span className="text-slate-500 dark:text-slate-400">
                          {" "}
                          ({pctProcFmt}% do total de processos criados)
                        </span>
                      </span>
                      {d.pendenteCriacao > 0 ? (
                        <span className="block text-slate-600 dark:text-slate-300">
                          <span className="text-slate-500 dark:text-slate-400">Pendente de criação:</span>{" "}
                          <strong className="text-slate-900 dark:text-white">{d.pendenteCriacao}</strong>
                          <span className="text-slate-500 dark:text-slate-400">
                            {" "}
                            ({d.pendenteCriacao === 1 ? "linha" : "linhas"} com PROCESSO pendente de criação neste
                            local)
                          </span>
                        </span>
                      ) : null}
                      <span className="block">
                        <span className="text-slate-500 dark:text-slate-400">Valor (coluna VALOR TOTAL):</span>{" "}
                        <strong className="text-slate-900 dark:text-white">
                          {formatBRL(d.valorTotal)}
                        </strong>
                      </span>
                      <span className="block">
                        <span className="text-slate-500 dark:text-slate-400">
                          Representatividade em valor:
                        </span>{" "}
                        <strong className="text-slate-900 dark:text-white">{pctValFmt}%</strong>
                        <span className="text-slate-500 dark:text-slate-400"> do valor do card</span>
                      </span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="v"
              barSize={barThickness}
              radius={[0, 12, 12, 0]}
              onClick={(data) => {
                const nome = (data as { name?: string } | undefined)?.name;
                if (onBarClick && nome) onBarClick(nome);
              }}
              style={{ cursor: onBarClick ? "pointer" : "default" }}
            >
              <LabelList
                dataKey="v"
                position="right"
                offset={8}
                formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `${v}%` : "")}
                style={{ fontSize: 10, fontWeight: 700, fill: chartDark ? "#e2e8f0" : "#334155" }}
              />
              {displayData.map((r, i) => (
                <Cell
                  key={`${r.name}-${i}`}
                  fill={r.fill}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={2}
                  style={{
                    filter: "drop-shadow(4px 6px 12px rgba(15, 23, 42, 0.14))",
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatusYAxisTick({
  x,
  y,
  payload,
  fill,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  fill?: string;
}) {
  const text = payload?.value ?? "";
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill={fill ?? "#64748b"}
        fontSize={10}
        fontWeight={600}
        style={{ whiteSpace: "nowrap" }}
      >
        {text}
      </text>
    </g>
  );
}

function StatusBars({
  rows,
  chartDark = false,
  onBarClick,
}: {
  rows: ProcessoRow[];
  chartDark?: boolean;
  onBarClick?: (statusNome: string) => void;
}) {
  const t = chartDark ? barChartTheme.dark : barChartTheme.light;
  const chartRows = distribuicaoPorStatus(rows);
  const displayData = chartRows.map((row, i) => ({
    ...row,
    rankLabel: `${i + 1}º ${row.name}`,
  }));
  const barThickness = 20;
  const chartHeight = Math.max(120, displayData.length * (barThickness + 18) + 24);

  if (displayData.length === 0) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-3.5 w-3.5" />
          Status
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados para exibir.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2">
      <div className="shrink-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-3.5 w-3.5" />
          Status
        </p>
        <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Representatividade por quantidade de processos criados do bloco.
        </p>
      </div>
      <div
        className="w-full shrink-0 rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50/90 to-white px-1 pb-2 pt-2.5 shadow-inner dark:border-slate-600 dark:from-slate-800/60 dark:to-slate-900/40"
        style={{ height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={displayData} margin={{ top: 4, right: 40, left: 6, bottom: 4 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="rankLabel"
              width={180}
              tick={<StatusYAxisTick fill={t.yTick} />}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: t.cursor }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as {
                  name: string;
                  v: number;
                  count: number;
                  total: number;
                };
                return (
                  <div className="max-w-[240px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/10">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{d.name}</p>
                    <p className="mt-2 text-slate-600 dark:text-slate-300">
                      <span className="text-slate-500 dark:text-slate-400">Linhas no status:</span>{" "}
                      <strong className="text-slate-900 dark:text-white">{d.count}</strong>
                      <span className="text-slate-500 dark:text-slate-400"> ({d.v}% de {d.total})</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="v"
              barSize={barThickness}
              radius={[0, 10, 10, 0]}
              onClick={(data) => {
                const nome = (data as { name?: string } | undefined)?.name;
                if (onBarClick && nome) onBarClick(nome);
              }}
              style={{ cursor: onBarClick ? "pointer" : "default" }}
            >
              <LabelList
                dataKey="v"
                position="right"
                offset={8}
                formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `${v}%` : "")}
                style={{ fontSize: 10, fontWeight: 700, fill: chartDark ? "#e2e8f0" : "#334155" }}
              />
              {displayData.map((r, i) => (
                <Cell
                  key={`${r.name}-${i}`}
                  fill={r.fill}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={2}
                  style={{ filter: "drop-shadow(4px 6px 12px rgba(15, 23, 42, 0.14))" }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const DFD_COLOR = "#7c3aed";
const TRD_COLOR = "#0891b2";

function DfdTrdBars({
  rows,
  chartDark = false,
  onBarClick,
}: {
  rows: ProcessoRow[];
  chartDark?: boolean;
  onBarClick?: (coluna: DfdTrdColuna, bucketNome: string) => void;
}) {
  const t = chartDark ? barChartTheme.dark : barChartTheme.light;
  const data: DfdTrdBarPoint[] = dfdTrdBars(rows);

  const barThickness = 28;
  const chartHeight = 260;
  const labelFill = chartDark ? "#e2e8f0" : "#334155";

  if (data.length === 0 || rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-3.5 w-3.5" />
          DFD / TDR
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500">Sem dados para exibir.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col space-y-2">
      <div className="shrink-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <BarChart3 className="h-3.5 w-3.5" />
          DFD / TDR
        </p>
        <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Representatividade por quantidade de linhas do bloco.
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] font-medium">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: DFD_COLOR }} />
            <span className="text-slate-600 dark:text-slate-400">DFD</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: TRD_COLOR }} />
            <span className="text-slate-600 dark:text-slate-400">TDR</span>
          </span>
        </div>
      </div>
      <div
        className="w-full shrink-0 rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white px-2 pb-2 pt-5 shadow-inner dark:border-slate-600 dark:from-slate-800/60 dark:to-slate-900/40"
        style={{ height: chartHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 12, left: 0, bottom: 4 }}
            barCategoryGap="22%"
            barGap={4}
          >
            <XAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: t.yTick, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis type="number" domain={[0, 100]} hide />
            <Tooltip
              cursor={{ fill: t.cursor }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const dPoint = payload.find((p) => p.dataKey === "dfd");
                const tPoint = payload.find((p) => p.dataKey === "trd");
                const pt = dPoint?.payload as DfdTrdBarPoint | undefined;
                const total = pt?.total ?? 0;
                return (
                  <div className="w-52 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/10">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{label}</p>
                    <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                      Total de processos criados no bloco: <strong className="text-slate-600 dark:text-slate-300">{total}</strong>
                    </p>
                    <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 dark:border-slate-700">
                      {dPoint ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DFD_COLOR }} />
                            DFD
                          </span>
                          <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
                            {dPoint.value}%
                            <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">
                              ({pt?.dfdCount ?? 0})
                            </span>
                          </span>
                        </div>
                      ) : null}
                      {tPoint ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TRD_COLOR }} />
                            TDR
                          </span>
                          <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
                            {tPoint.value}%
                            <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">
                              ({(tPoint.payload as DfdTrdBarPoint).trdCount})
                            </span>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="dfd"
              name="DFD"
              barSize={barThickness}
              radius={[4, 4, 0, 0]}
              fill={DFD_COLOR}
              onClick={(data) => {
                const nome = (data as { name?: string } | undefined)?.name;
                if (onBarClick && nome) onBarClick("DFD", nome);
              }}
              style={{ cursor: onBarClick ? "pointer" : "default" }}
            >
              <LabelList
                dataKey="dfd"
                position="top"
                formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `${v}%` : "")}
                style={{ fontSize: 10, fontWeight: 700, fill: labelFill }}
              />
            </Bar>
            <Bar
              dataKey="trd"
              name="TDR"
              barSize={barThickness}
              radius={[4, 4, 0, 0]}
              fill={TRD_COLOR}
              onClick={(data) => {
                const nome = (data as { name?: string } | undefined)?.name;
                if (onBarClick && nome) onBarClick("TRD", nome);
              }}
              style={{ cursor: onBarClick ? "pointer" : "default" }}
            >
              <LabelList
                dataKey="trd"
                position="top"
                formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `${v}%` : "")}
                style={{ fontSize: 10, fontWeight: 700, fill: labelFill }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BlocoPanel({
  title,
  accent,
  rows,
  headerIcon: HeaderIcon,
  chartDark = false,
  onAlertaFatiaClick,
  onAlocacaoFocalFatiaClick,
  onTermoEncFatiaClick,
  onOndeBarClick,
  onStatusBarClick,
  onDfdTrdBarClick,
}: {
  title: string;
  accent: string;
  rows: ProcessoRow[];
  headerIcon: LucideIcon;
  chartDark?: boolean;
  /** Abre detalhe em tabela ao clicar numa fatia do donut «Alertas críticos». */
  onAlertaFatiaClick?: (fatiaNome: string) => void;
  /** Abre detalhe em tabela ao clicar na pizza ou legenda «Alocação focal». */
  onAlocacaoFocalFatiaClick?: (fatiaNome: string) => void;
  /** Abre detalhe em tabela ao clicar no donut/legenda «Distribuição termo enc.». */
  onTermoEncFatiaClick?: (fatiaNome: string) => void;
  /** Abre detalhe em tabela ao clicar numa barra do ranking «Onde está o processo?». */
  onOndeBarClick?: (bucketNome: string) => void;
  /** Abre detalhe em tabela ao clicar numa barra do gráfico «Status». */
  onStatusBarClick?: (statusNome: string) => void;
  /** Abre detalhe em tabela ao clicar numa barra do gráfico «DFD / TRD». */
  onDfdTrdBarClick?: (coluna: DfdTrdColuna, bucketNome: string) => void;
}) {
  const resumo = resumoBloco(rows);
  const donut = healthDonut(rows);
  const focalSlices = alocacaoFocalPie(rows);
  const termoEncSlices = termoEncPie(rows);
  const valorTotalCard = valorTotalProcessos(rows);
  const valorNaoCriados = valorTotalPendentesCriacao(rows);
  return (
    <article
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900/70 dark:shadow-black/30"
      style={{ borderTopWidth: 4, borderTopColor: accent }}
    >
      <header
        className="flex items-center justify-between px-4 py-3 dark:bg-white/[0.04]"
        style={{ background: `${accent}12` }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm dark:bg-slate-800/90 dark:shadow-none"
            style={{ color: chartDark ? "#f8fafc" : accent }}
          >
            <HeaderIcon className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-sm font-bold tracking-wide text-slate-800 dark:text-slate-100">
            {title}
          </h2>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-b border-slate-100 p-4 dark:border-slate-700/80 sm:h-[19.5rem] sm:content-start">
        {/* Linha 1: mesma altura mínima nos 3 blocos (reserva para pendentes mesmo quando 0) */}
        <div className="col-span-2 grid min-h-[5.25rem] grid-cols-2 gap-x-3">
          <div className="flex min-h-0 flex-col">
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              <Hash className="h-3.5 w-3.5 shrink-0 opacity-70" />
              Total
            </p>
            <p className="text-2xl font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100">
              {resumo.total}
            </p>
            <div className="mt-1 min-h-[2.75rem]">
              {resumo.pendenteCriacao > 0 ? (
                <p className="text-[10px] font-medium leading-tight text-slate-700 dark:text-slate-300">
                  {resumo.pendenteCriacao} pendente{resumo.pendenteCriacao > 1 ? "s" : ""} de criação
                  <span className="block font-normal text-slate-500 dark:text-slate-400">
                    (não entram neste total)
                  </span>
                </p>
              ) : (
                <p className="invisible text-[10px] leading-tight" aria-hidden="true">
                  0 pendente de criação
                  <span className="block">(não entram neste total)</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-col">
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 opacity-70" />
              Críticos
            </p>
            <p className="text-2xl font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100">
              {resumo.pctCriticos}%
            </p>
            <div className="mt-1 min-h-[2.75rem]">
              {resumo.criticosForaCalculo > 0 ? (
                <p className="text-[10px] font-medium leading-tight text-slate-700 dark:text-slate-300">
                  {resumo.criticosForaCalculo} linha{resumo.criticosForaCalculo > 1 ? "s" : ""} não{" "}
                  entra{resumo.criticosForaCalculo > 1 ? "m" : ""} no cálculo
                  <span className="block font-normal text-slate-500 dark:text-slate-400">
                    (sem processo criado)
                  </span>
                </p>
              ) : (
                <p className="invisible text-[10px] leading-tight" aria-hidden="true">
                  0 linhas não entraram no cálculo
                  <span className="block">(sem processo criado)</span>
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            <Hourglass className="h-3.5 w-3.5 shrink-0 opacity-70" />
            Standby
          </p>
          <p className="text-xl font-semibold tabular-nums leading-none text-slate-900 dark:text-slate-100">
            {resumo.standbyMedio}d
          </p>
          <div className="mt-1 min-h-[1.25rem]">
            {resumo.pendenteCriacao > 0 ? (
              <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                {resumo.pendenteCriacao} linha{resumo.pendenteCriacao > 1 ? "s" : ""} não{" "}
                entra{resumo.pendenteCriacao > 1 ? "m" : ""} no cálculo
              </p>
            ) : (
              <p className="invisible text-[10px] leading-tight" aria-hidden="true">
                0 linhas não entram no cálculo
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
            Em curso
          </p>
          <p className="text-xl font-semibold tabular-nums leading-none text-slate-900 dark:text-slate-100">
            {resumo.diasEmCursoMedio}d
          </p>
          <div className="mt-1 min-h-[1.25rem]">
            {resumo.pendenteCriacao > 0 ? (
              <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                {resumo.pendenteCriacao} linha{resumo.pendenteCriacao > 1 ? "s" : ""} não{" "}
                entra{resumo.pendenteCriacao > 1 ? "m" : ""} no cálculo
              </p>
            ) : (
              <p className="invisible text-[10px] leading-tight" aria-hidden="true">
                0 linhas não entram no cálculo
              </p>
            )}
          </div>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/60">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            Valor total (soma da coluna VALOR TOTAL neste bloco)
          </p>
          <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
            {formatBRL(valorTotalCard)}
          </p>
          <p className="mt-2 border-t border-slate-200/90 pt-2 text-[10px] leading-snug text-slate-600 dark:border-slate-600/70 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Valor acumulado em processos não criados:
            </span>{" "}
            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
              {formatBRL(valorNaoCriados)}
            </span>{" "}
            <span className="text-slate-500 dark:text-slate-500">(do montante acima)</span>
          </p>
        </div>
      </div>
      <div className="shrink-0 border-b border-slate-100 p-4 dark:border-slate-700/80">
        <StatusBars rows={rows} chartDark={chartDark} onBarClick={onStatusBarClick} />
      </div>
      <div className="shrink-0 border-b border-slate-100 p-4 dark:border-slate-700/80 sm:h-[13.5rem] sm:flex sm:flex-col">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <PieChart className="h-3.5 w-3.5" />
          Alertas críticos
        </p>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
          <ul className="min-w-0 flex-1 space-y-1.5 text-xs sm:min-w-[120px]">
            {donut.map((d) => (
              <li key={d.name}>
                <button
                  type="button"
                  disabled={!onAlertaFatiaClick || d.name === "Sem dados"}
                  onClick={() => onAlertaFatiaClick?.(d.name)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left ${
                    onAlertaFatiaClick && d.name !== "Sem dados"
                      ? "cursor-pointer text-slate-600 hover:bg-slate-200/70 dark:text-white dark:hover:bg-slate-700/60"
                      : "cursor-default text-slate-600 dark:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <strong className="shrink-0 text-slate-900 dark:text-white">{d.value}%</strong>
                </button>
              </li>
            ))}
          </ul>
          <div className="mx-auto w-full min-w-[120px] max-w-[160px] shrink-0 sm:mx-0">
            <MiniDonut
              data={donut}
              chartDark={chartDark}
              onSliceClick={onAlertaFatiaClick}
            />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-b border-slate-100 p-4 dark:border-slate-700/80 sm:h-[14.5rem] sm:flex sm:flex-col">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Tag className="h-3.5 w-3.5" />
          Alocação focal
          <span className="ml-0.5 font-normal normal-case text-slate-400 dark:text-slate-500">
            (interno / externo)
          </span>
        </p>
        <p className="mb-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Processos com número oficial; vazio na planilha conta como &quot;Não informado&quot;.
        </p>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
          <ul className="min-w-0 flex-1 space-y-1.5 text-xs sm:min-w-[120px]">
            {focalSlices.map((d) => (
              <li key={d.name}>
                <button
                  type="button"
                  disabled={!onAlocacaoFocalFatiaClick || d.name === "Sem dados"}
                  onClick={() => onAlocacaoFocalFatiaClick?.(d.name)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left ${
                    onAlocacaoFocalFatiaClick && d.name !== "Sem dados"
                      ? "cursor-pointer text-slate-600 hover:bg-slate-200/70 dark:text-white dark:hover:bg-slate-700/60"
                      : "cursor-default text-slate-600 dark:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <strong className="shrink-0 text-slate-900 dark:text-white">{d.value}%</strong>
                </button>
              </li>
            ))}
          </ul>
          <div className="mx-auto w-full min-w-[120px] max-w-[160px] shrink-0 sm:mx-0">
            <MiniPie data={focalSlices} chartDark={chartDark} onSliceClick={onAlocacaoFocalFatiaClick} />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-b border-slate-100 p-4 dark:border-slate-700/80 sm:h-[13.5rem] sm:flex sm:flex-col">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <PieChart className="h-3.5 w-3.5" />
          Distribuição termo enc.
        </p>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
          <ul className="min-w-0 flex-1 space-y-1.5 text-xs sm:min-w-[120px]">
            {termoEncSlices.map((d) => (
              <li key={d.name}>
                <button
                  type="button"
                  disabled={!onTermoEncFatiaClick || d.name === "Sem dados"}
                  onClick={() => onTermoEncFatiaClick?.(d.name)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left ${
                    onTermoEncFatiaClick && d.name !== "Sem dados"
                      ? "cursor-pointer text-slate-600 hover:bg-slate-200/70 dark:text-white dark:hover:bg-slate-700/60"
                      : "cursor-default text-slate-600 dark:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <strong className="shrink-0 text-slate-900 dark:text-white">{d.value}%</strong>
                </button>
              </li>
            ))}
          </ul>
          <div className="mx-auto w-full min-w-[120px] max-w-[160px] shrink-0 sm:mx-0">
            <MiniDonut data={termoEncSlices} chartDark={chartDark} onSliceClick={onTermoEncFatiaClick} />
          </div>
        </div>
      </div>
      <div className="shrink-0 border-b border-slate-100 p-4 dark:border-slate-700/80">
        <DfdTrdBars rows={rows} chartDark={chartDark} onBarClick={onDfdTrdBarClick} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <OndeProcessoBars rows={rows} chartDark={chartDark} barFill={accent} onBarClick={onOndeBarClick} />
      </div>
    </article>
  );
}

function ultimosMovimentadosListRow(r: ProcessoRow) {
  const localizacao = r.onde?.trim() || "—";
  const dataUltRaw = r.ultimaMovimentacao?.trim() || "";
  const dataUlt = dataUltRaw ? formatDataUltimaMovimentacaoBR(dataUltRaw) : "—";
  return (
    <li
      key={`${r.processo}-${r.item}-ultimos`}
      className="border-b border-slate-200/70 py-1.5 text-[10px] last:border-b-0 last:pb-0 dark:border-slate-600/50 sm:py-1"
    >
      {/* Ordem: processo · dias em curso · localização do processo · data última movimentação */}
      <div className="grid w-full max-w-none grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_4.75rem_minmax(0,0.85fr)_minmax(0,5.75rem)] sm:items-center sm:gap-x-2 sm:gap-y-0">
        <span className="min-w-0 break-words font-medium leading-snug text-slate-800 dark:text-slate-200">
          {r.processo}
        </span>
        <span className="flex shrink-0 items-center sm:justify-center">
          <strong className="tabular-nums text-slate-900 dark:text-white">{r.diasEmCurso}d</strong>
        </span>
        <span
          className="min-w-0 truncate leading-snug text-slate-600 dark:text-slate-400 sm:text-left"
          title={localizacao !== "—" ? localizacao : undefined}
        >
          {localizacao}
        </span>
        <span
          className="min-w-0 whitespace-normal break-words font-medium tabular-nums leading-snug text-slate-700 dark:text-slate-300 sm:text-left"
          title={dataUltRaw || undefined}
        >
          {dataUlt}
        </span>
      </div>
    </li>
  );
}

function UltimosMovimentadosCard({ rows }: { rows: ProcessoRow[] }) {
  const top = topAtrasados(rows, 5);
  return (
    <div className="w-full min-w-0 max-w-none self-stretch rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-700 dark:bg-slate-800/50 sm:p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Clock className="h-3 w-3 shrink-0" />
        Top atrasados
      </p>
      <div
        className="mb-1 hidden w-full grid-cols-[minmax(0,1fr)_4.75rem_minmax(0,0.85fr)_minmax(0,5.75rem)] gap-x-2 text-[9px] font-bold uppercase leading-tight tracking-wide text-slate-400 dark:text-slate-500 sm:grid"
        aria-hidden
      >
        <span className="min-w-0">Processo</span>
        <span className="flex flex-col items-center justify-center gap-0 text-center">
          <span>Dias</span>
          <span>em curso</span>
        </span>
        <span className="min-w-0">Localização processo</span>
        <span className="min-w-0 text-left">
          <span className="block">Data últ.</span>
          <span className="block">movimentação</span>
        </span>
      </div>
      <ul className="w-full min-w-0">{top.map((r) => ultimosMovimentadosListRow(r))}</ul>
    </div>
  );
}

const THEME_KEY = "interpi-dashboard-theme";

type ProcessosApiResponse = {
  rows: ProcessoRow[] | null;
  source: "csv" | "mock" | "error";
  message?: string;
  updatedAt?: string;
};

type RefreshVisual = "idle" | "loading" | "success" | "error";

type DashboardTab = "overview-processos" | "gestao-componentes";

type ComponentesApiResponse = {
  rows: ComponenteGestaoRow[] | null;
  source: "csv" | "mock" | "error";
  message?: string;
  updatedAt?: string;
};

export default function DashboardView() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview-processos");
  const [search, setSearch] = useState("");
  /** Intervalo (ISO `YYYY-MM-DD`) na coluna START PROCESSO; vazio = sem filtro nesse limite. */
  const [startProcessoDe, setStartProcessoDe] = useState("");
  const [startProcessoAte, setStartProcessoAte] = useState("");
  const [alocacaoFocalFiltro, setAlocacaoFocalFiltro] = useState<AlocacaoFocalFiltro>("todos");
  const [lastUpdate, setLastUpdate] = useState(() => new Date());
  const [kpiModal, setKpiModal] = useState<KpiModalKey | null>(null);
  const [alertaFatiaDetalhe, setAlertaFatiaDetalhe] = useState<null | {
    kind: "alertas" | "alocacaoFocal" | "termoEnc" | "onde" | "endProcesso" | "status" | "dfdTrd";
    blocoTitulo: string;
    fatiaNome: string;
    rows: ProcessoRow[];
  }>(null);
  /** null = ainda não leu localStorage (evita gravar "light" antes da preferência real). */
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  /** Dados vindos de `/api/processos` (CSV no Drive). `undefined` = ainda a carregar. */
  const [remoteProcessos, setRemoteProcessos] = useState<ProcessoRow[] | null | undefined>(undefined);
  const [dataSourceLabel, setDataSourceLabel] = useState<string>("");
  const [remoteComponentes, setRemoteComponentes] = useState<ComponenteGestaoRow[] | null | undefined>(undefined);
  const [componentesDataSourceLabel, setComponentesDataSourceLabel] = useState<string>("");
  /** Momento da última resposta do servidor em `/api/processos` (ISO). */
  const [serverUpdatedAtIso, setServerUpdatedAtIso] = useState<string | null>(null);
  const [componentesUpdatedAtIso, setComponentesUpdatedAtIso] = useState<string | null>(null);
  const [refreshVisual, setRefreshVisual] = useState<RefreshVisual>("idle");
  const refreshResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    let isDark = false;
    if (stored === "dark") isDark = true;
    else if (stored === "light") isDark = false;
    else isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(isDark);
  }, []);

  useLayoutEffect(() => {
    if (darkMode === null) return;
    localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
    // Causa raiz do “só muda o ícone”: `darkMode: class` reage a QUALQUER `.dark` na árvore.
    // Remove resíduos em <html>/<body> para o tema depender só de data-dashboard-theme no painel.
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
  }, [darkMode]);

  /** @returns true se a API respondeu sem estado de erro (CSV/mock OK). */
  const loadProcessos = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/processos?_=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const data = (await res.json()) as ProcessosApiResponse;
      const stamp = data.updatedAt ?? new Date().toISOString();
      if (!res.ok) {
        setRemoteProcessos(null);
        setServerUpdatedAtIso(stamp);
        setDataSourceLabel(
          res.status === 401
            ? "Não autorizado — atualize a página ou entre de novo."
            : data.message?.trim()
              ? `API: ${data.message}`
              : `Erro ao carregar dados (${res.status}).`,
        );
        setLastUpdate(new Date());
        return false;
      }
      setServerUpdatedAtIso(stamp);
      if (data.rows && data.rows.length > 0) {
        setRemoteProcessos(data.rows);
        setDataSourceLabel(
          data.source === "csv" ? "Planilha (CSV)" : data.source === "mock" ? "Dados de exemplo" : "Dados de exemplo",
        );
      } else {
        setRemoteProcessos(null);
        setDataSourceLabel(
          data.source === "error" && data.message ? `CSV: ${data.message}` : "Dados de exemplo",
        );
      }
      setLastUpdate(new Date());
      return data.source !== "error";
    } catch {
      setRemoteProcessos(null);
      setDataSourceLabel("Dados de exemplo (erro ao carregar CSV)");
      setServerUpdatedAtIso(new Date().toISOString());
      setLastUpdate(new Date());
      return false;
    }
  }, []);

  const loadComponentes = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/gestao-componentes?_=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const data = (await res.json()) as ComponentesApiResponse;
      const stamp = data.updatedAt ?? new Date().toISOString();
      if (!res.ok) {
        setRemoteComponentes(null);
        setComponentesUpdatedAtIso(stamp);
        setComponentesDataSourceLabel(
          res.status === 401
            ? "Não autorizado — atualize a página ou entre de novo."
            : data.message?.trim()
              ? `API: ${data.message}`
              : `Erro ao carregar dados (${res.status}).`,
        );
        return false;
      }
      setComponentesUpdatedAtIso(stamp);
      if (data.rows && data.rows.length > 0) {
        setRemoteComponentes(data.rows);
        setComponentesDataSourceLabel(data.source === "csv" ? "Planilha (CSV componentes)" : "Dados de exemplo");
      } else {
        setRemoteComponentes(null);
        setComponentesDataSourceLabel(
          data.source === "error" && data.message ? `CSV: ${data.message}` : "Dados de exemplo",
        );
      }
      return data.source !== "error";
    } catch {
      setRemoteComponentes(null);
      setComponentesDataSourceLabel("Dados de exemplo (erro ao carregar CSV)");
      setComponentesUpdatedAtIso(new Date().toISOString());
      return false;
    }
  }, []);

  useEffect(() => {
    void loadProcessos();
    void loadComponentes();
  }, [loadProcessos, loadComponentes]);

  useEffect(() => {
    return () => {
      if (refreshResetTimeoutRef.current) clearTimeout(refreshResetTimeoutRef.current);
    };
  }, []);

  const baseProcessos = remoteProcessos === undefined ? MOCK_PROCESSOS : (remoteProcessos ?? MOCK_PROCESSOS);

  const filtered = useMemo(() => {
    const busca = searchRows(baseProcessos, search);
    const porData = filterByStartProcessoRange(busca, startProcessoDe, startProcessoAte);
    return filterByAlocacaoFocal(porData, alocacaoFocalFiltro);
  }, [baseProcessos, search, startProcessoDe, startProcessoAte, alocacaoFocalFiltro]);

  const pilaresRows = useMemo(() => filterByBloco(filtered, "PILARES"), [filtered]);
  const psiRows = useMemo(() => filterByBloco(filtered, "PSI"), [filtered]);
  const allForKpi = filtered;

  const kpis = useMemo(() => kpisGlobais(allForKpi), [allForKpi]);

  const alertasRows = useMemo(
    () => allForKpi.filter((r) => r.alerta === "CRÍTICO" || r.alerta === "ATENÇÃO"),
    [allForKpi],
  );

  const kpiCards = useMemo<KpiCard[]>(
    () => [
        {
          label: "Total de processos",
          value: String(kpis.totalProcessos),
          sub:
            kpis.pendenteCriacao > 0
              ? `${kpis.pendenteCriacao} pendente${kpis.pendenteCriacao > 1 ? "s" : ""} de criação`
              : "",
          modal: "totalStartEvolucao" as const,
        },
        {
          label: "Alertas críticos",
          desc: "Total de processos em que a última movimentação é =< a 10 dias",
          value: String(kpis.criticosTotal),
          sub: (
            <div className="flex w-full flex-col items-end gap-1.5 text-right normal-case">
              <div className="min-w-0">
                <p className="text-[9px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                  % do total criado:
                </p>
                <p className="text-[11px] font-semibold leading-tight tabular-nums text-slate-700 dark:text-slate-200">
                  {kpis.totalProcessos > 0
                    ? `${kpis.pctCriticos}% (${kpis.alertasCriticos}/${kpis.totalProcessos})`
                    : "—"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                  Linhas críticas fora do cálculo:
                </p>
                <p className="text-[11px] font-semibold leading-tight text-slate-700 dark:text-slate-200">
                  {kpis.criticosSemProcessoCriado}
                </p>
              </div>
            </div>
          ),
          modal: "alertas" as const,
        },
        {
          label: "Standby médio",
          desc: "Média geral dos dias sem ocorrer movimentações nos processos",
          value: `${kpis.standbyMedio}d`,
          sub:
            kpis.pendenteCriacao > 0
              ? `${kpis.pendenteCriacao} processo${kpis.pendenteCriacao > 1 ? "s" : ""} fora do cálculo`
              : "média",
          modal: "standbyOnde" as const,
        },
        {
          label: "Média geral de dias em curso",
          desc: "Tempo médio, em dias, entre a data de abertura e a data de fechamento dos processos.",
          value: `${kpis.diasEmCursoMedio}d`,
          sub:
            kpis.pendenteCriacao > 0
              ? `${kpis.pendenteCriacao} processo${kpis.pendenteCriacao > 1 ? "s" : ""} fora do cálculo`
              : "média",
          modal: "diasEmCurso" as const,
        },
        {
          label: "Sem end",
          value: String(kpis.semEnd),
          sub:
            kpis.comDataFim > 0
              ? `${kpis.comDataFim} ${kpis.comDataFim === 1 ? "já possui" : "já possuem"} data de fim`
              : "Nenhum com data de fim",
          modal: "semEnd" as const,
        },
      ],
    [kpis],
  );
  const pilaresAlertas = useMemo(
    () => filterByBloco(alertasRows, "PILARES"),
    [alertasRows],
  );
  const psiAlertas = useMemo(() => filterByBloco(alertasRows, "PSI"), [alertasRows]);

  const semEndRows = useMemo(() => allForKpi.filter((r) => !r.endProcesso), [allForKpi]);
  const pilaresSemEnd = useMemo(() => filterByBloco(semEndRows, "PILARES"), [semEndRows]);
  const psiSemEnd = useMemo(() => filterByBloco(semEndRows, "PSI"), [semEndRows]);
  const diasEmCursoRows = useMemo(
    () => apenasProcessosComNumeroOficial(allForKpi).filter((r) => r.diasEmCurso != null),
    [allForKpi],
  );
  const pilaresDiasEmCurso = useMemo(() => filterByBloco(diasEmCursoRows, "PILARES"), [diasEmCursoRows]);
  const psiDiasEmCurso = useMemo(() => filterByBloco(diasEmCursoRows, "PSI"), [diasEmCursoRows]);

  const refresh = useCallback(async () => {
    if (refreshResetTimeoutRef.current) {
      clearTimeout(refreshResetTimeoutRef.current);
      refreshResetTimeoutRef.current = null;
    }
    setRefreshVisual("loading");
    const [okProcessos, okComponentes] = await Promise.all([loadProcessos(), loadComponentes()]);
    const ok = okProcessos && okComponentes;
    setRefreshVisual(ok ? "success" : "error");
    refreshResetTimeoutRef.current = setTimeout(() => {
      setRefreshVisual("idle");
      refreshResetTimeoutRef.current = null;
    }, ok ? 2200 : 2600);
  }, [loadComponentes, loadProcessos]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }, []);

  const onStartProcessoDeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setStartProcessoDe(v);
    if (v) setStartProcessoAte((at) => (at && v > at ? v : at));
  };

  const onStartProcessoAteChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setStartProcessoAte(v);
    if (v) setStartProcessoDe((de) => (de && v < de ? v : de));
  };

  const timeStr = lastUpdate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const apiSyncLabel =
    serverUpdatedAtIso != null
      ? new Date(serverUpdatedAtIso).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "A carregar…";

  const componentesTimeLabel =
    componentesUpdatedAtIso != null
      ? new Date(componentesUpdatedAtIso).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "A carregar…";

  const kpiIconMap = [
    { Icon: Hash },
    { Icon: AlertTriangle },
    { Icon: Hourglass },
    { Icon: Clock },
    { Icon: BarChart3 },
  ] as const;

  return (
    <div
      className="min-h-screen"
      data-dashboard-theme={darkMode === true ? "dark" : undefined}
    >
      <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      {/* Cabeçalho: claro contrasta com o corpo; escuro mantém o gradiente institucional */}
      <header className="border-b border-[#003d7a]/40 bg-gradient-to-b from-[#0062cc] via-[#0056b3] to-[#004a99] text-white shadow-lg shadow-[#001f3d]/35 dark:border-slate-800/80 dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:shadow-lg dark:shadow-slate-900/20">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="h-14 w-[9.5rem] shrink-0 sm:h-16 sm:w-[11.5rem] lg:w-[13rem]">
              <Image
                src="/interpi-45-anos-logo-wide.png"
                alt="Logo 45 anos INTERPI"
                width={1024}
                height={270}
                className="block h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100/90 dark:text-slate-400">
                Painel executivo
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-white sm:text-2xl dark:text-white">
                INTERPI - GESTÃO CONTRATOS
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-snug text-blue-50/95 dark:text-slate-300">
                Acompanhamento do andamento dos processos Pilares II e PSI — Contratações
              </p>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:max-w-[min(100%,42rem)]">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="search"
                placeholder="Buscar processo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/95 py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-md placeholder:text-slate-500 outline-none ring-white/40 focus:ring-2 dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400 dark:shadow-inner dark:ring-cyan-500/40 sm:w-56"
              />
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshVisual === "loading"}
              aria-busy={refreshVisual === "loading"}
              title={
                refreshVisual === "loading"
                  ? "A atualizar…"
                  : refreshVisual === "success"
                    ? "Dados atualizados"
                    : refreshVisual === "error"
                      ? "Falha ao atualizar — toque para tentar de novo"
                      : "Recarregar dados da planilha (API)"
              }
              className={`inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold shadow-sm backdrop-blur-sm transition-[background-color,border-color,color,box-shadow] duration-300 disabled:cursor-wait disabled:opacity-95 dark:shadow-none ${
                refreshVisual === "success"
                  ? "border-emerald-200 bg-emerald-500 text-white ring-2 ring-emerald-300/60 hover:bg-emerald-500 dark:border-emerald-400/80 dark:bg-emerald-600 dark:text-white dark:ring-emerald-400/40"
                  : refreshVisual === "error"
                    ? "border-red-200 bg-red-600 text-white ring-2 ring-red-300/50 hover:bg-red-600 dark:border-red-400/70 dark:bg-red-700"
                    : "border-white/25 bg-white/15 text-white hover:bg-white/25 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              }`}
            >
              <RefreshCw
                className={`h-4 w-4 shrink-0 ${refreshVisual === "loading" ? "animate-spin" : ""}`}
                aria-hidden
              />
              {refreshVisual === "loading"
                ? "A atualizar…"
                : refreshVisual === "success"
                  ? "Atualizado"
                  : refreshVisual === "error"
                    ? "Erro"
                    : "Atualizar"}
            </button>
            <button
              type="button"
              disabled={darkMode === null}
              onClick={() => {
                if (darkMode === null) return;
                setDarkMode(!darkMode);
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/25 disabled:cursor-wait disabled:opacity-60 dark:border-white/20 dark:bg-white/10 dark:text-white dark:shadow-none dark:hover:bg-white/15"
              title={
                darkMode === null
                  ? "Carregando tema…"
                  : darkMode
                    ? "Tema claro"
                    : "Tema escuro"
              }
              aria-label={
                darkMode === null
                  ? "Carregando preferência de tema"
                  : darkMode
                    ? "Ativar tema claro"
                    : "Ativar tema escuro"
              }
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex min-w-[6.5rem] items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/15 px-3 py-2.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/25 dark:border-white/20 dark:bg-white/10 dark:text-white dark:shadow-none dark:hover:bg-white/15"
              title="Encerrar sessão"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Sair
            </button>
            </div>
            <div
              className="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 dark:border-white/15 dark:bg-white/[0.06]"
              role="group"
              aria-label="Filtro por data de início do processo (START PROCESSO)"
            >
              <div className="flex items-center gap-2 text-white">
                <CalendarRange className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-100/95 dark:text-slate-300">
                  Start processo
                </span>
              </div>
              <label className="flex flex-col gap-0.5 text-[10px] font-medium text-blue-100/90 dark:text-slate-400">
                De
                <input
                  type="date"
                  value={startProcessoDe}
                  onChange={onStartProcessoDeChange}
                  max={startProcessoAte || undefined}
                  className="rounded-lg border border-white/25 bg-white/95 px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-white/30 focus:ring-2 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100 dark:ring-cyan-500/40"
                  aria-label="Data inicial START PROCESSO"
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[10px] font-medium text-blue-100/90 dark:text-slate-400">
                Até
                <input
                  type="date"
                  value={startProcessoAte}
                  onChange={onStartProcessoAteChange}
                  min={startProcessoDe || undefined}
                  className="rounded-lg border border-white/25 bg-white/95 px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-white/30 focus:ring-2 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100 dark:ring-cyan-500/40"
                  aria-label="Data final START PROCESSO"
                />
              </label>
              {(startProcessoDe || startProcessoAte) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartProcessoDe("");
                    setStartProcessoAte("");
                  }}
                  className="ml-auto rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20 dark:border-white/25 dark:hover:bg-white/15"
                >
                  Limpar datas
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("overview-processos")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ease-out ${
              activeTab === "overview-processos"
                ? "translate-y-0 scale-100 bg-slate-900 text-white shadow-md shadow-slate-300/60 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-cyan-500/20"
                : "translate-y-[1px] scale-[0.985] border border-slate-200 bg-white text-slate-700 hover:-translate-y-[1px] hover:scale-100 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            Overview de Processos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gestao-componentes")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ease-out ${
              activeTab === "gestao-componentes"
                ? "translate-y-0 scale-100 bg-slate-900 text-white shadow-md shadow-slate-300/60 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-cyan-500/20"
                : "translate-y-[1px] scale-[0.985] border border-slate-200 bg-white text-slate-700 hover:-translate-y-[1px] hover:scale-100 hover:bg-slate-50 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            Gestão $$ de componentes
          </button>
        </div>
        {activeTab === "gestao-componentes" ? (
          <GestaoComponentesView
            rows={remoteComponentes ?? []}
            processos={baseProcessos}
            chartDark={darkMode === true}
            dataSourceLabel={componentesDataSourceLabel}
            timeStr={componentesTimeLabel}
          />
        ) : (
        <>
        <div className="mb-6 flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
            <span className="min-w-0">
              {dataSourceLabel || "A carregar…"} · última leitura {timeStr}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:items-center">
            <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="whitespace-nowrap text-xs font-semibold text-slate-700 dark:text-slate-200">
                Alocação Focal
              </span>
              <select
                id="filtro-alocacao-focal"
                value={alocacaoFocalFiltro}
                onChange={(e) => setAlocacaoFocalFiltro(e.target.value as AlocacaoFocalFiltro)}
                disabled={remoteProcessos === undefined}
                className="min-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 shadow-sm outline-none ring-slate-300/50 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-cyan-500/30"
                aria-label="Filtrar por alocação focal"
              >
                <option value="todos">Todos</option>
                <option value="Interno">Interno</option>
                <option value="Externo">Externo</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => exportResumoPlanilhaComoExcel(filtered)}
              disabled={remoteProcessos === undefined}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700/80"
              title="Exporta os dados visíveis no painel (respeita pesquisa, datas START e Alocação Focal), espelho do RESUMO"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* KPIs globais — barra de título + linha valor | detalhe (altura de cabeçalho fixa para alinhar todos os cartões) */}
        <section className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-5">
          {kpiCards.map((k, i) => {
            const { Icon } = kpiIconMap[i];
            const detail = (
              <div className="flex min-h-[2.75rem] min-w-0 max-w-[42%] shrink-0 flex-col justify-center pl-2 text-right text-[10px] font-medium leading-snug text-slate-600 sm:text-[11px] dark:text-slate-300">
                {k.sub}
              </div>
            );
            const body = (
              <div className="flex min-h-0 w-full flex-1 flex-col">
                <div
                  className="flex min-h-[2.75rem] items-center border-b border-slate-200/70 dark:border-slate-600/50"
                  style={{ backgroundColor: darkMode === true ? "#002942" : "#F5FAF4" }}
                >
                  <p
                    className="w-full px-3 py-0 text-left text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-600 sm:text-[11px] dark:text-slate-200"
                  >
                    <span className="block">
                      {k.label}
                      {k.modal ? (
                        <span className="ml-1 font-normal normal-case text-slate-500 opacity-90 dark:text-slate-400">
                          (detalhar)
                        </span>
                      ) : null}
                    </span>
                  </p>
                </div>
                <div className="flex min-h-[4.25rem] flex-1 items-center justify-between gap-2 px-3 py-2.5 sm:min-h-[4.5rem] sm:gap-3 sm:px-3.5 sm:py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50/90 text-slate-600 shadow-inner shadow-slate-200/40 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300 dark:shadow-slate-950/40 sm:h-11 sm:w-11">
                      <Icon className="h-[1.05rem] w-[1.05rem] sm:h-5 sm:w-5" aria-hidden />
                    </span>
                    <p className="min-w-0 text-[clamp(1.35rem,2vw,1.85rem)] font-bold leading-none tabular-nums tracking-tight text-slate-900 dark:text-white">
                      {k.value}
                    </p>
                  </div>
                  {detail}
                </div>
              </div>
            );
            const cardClass =
              "group relative flex min-h-0 flex-col self-stretch overflow-hidden rounded-xl border border-slate-200/90 bg-white p-0 text-left shadow-sm shadow-slate-200/40 ring-1 ring-slate-100/80 dark:border-slate-700/90 dark:bg-slate-900/75 dark:shadow-black/25 dark:ring-slate-800/60";
            const hoverDesc =
              "desc" in k && k.desc
                ? (
                    <div className="pointer-events-none absolute inset-x-3 top-11 z-10 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-2 text-[10px] font-medium leading-snug text-slate-600 opacity-0 shadow-lg shadow-slate-200/50 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:shadow-black/30">
                      {k.desc}
                    </div>
                  )
                : null;
            if (k.modal) {
              return (
                <button
                  key={k.label}
                  type="button"
                  onClick={() => setKpiModal(k.modal)}
                  className={`${cardClass} m-0 cursor-pointer appearance-none font-inherit transition-shadow hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:hover:border-slate-600 dark:focus-visible:ring-cyan-500/50`}
                >
                  {hoverDesc}
                  {body}
                </button>
              );
            }
            return (
              <div key={k.label} className={cardClass}>
                {hoverDesc}
                {body}
              </div>
            );
          })}
        </section>

        <KpiDetailModal
          open={kpiModal === "alertas"}
          onClose={() => setKpiModal(null)}
          heading="Alertas críticos e atenção"
          subheading="Processos com alerta CRÍTICO ou ATENÇÃO, separados por PILARES e PSI (mesmas colunas da planilha)."
          pilares={pilaresAlertas}
          psi={psiAlertas}
        />
        <KpiDetailModal
          open={kpiModal === "semEnd"}
          onClose={() => setKpiModal(null)}
          heading="Sem data de fim (END PROCESSO)"
          subheading="Processos sem preenchimento da data de fim, por bloco."
          pilares={pilaresSemEnd}
          psi={psiSemEnd}
        />
        <KpiDetailModal
          open={kpiModal === "diasEmCurso"}
          onClose={() => setKpiModal(null)}
          heading="Média geral de dias em curso"
          subheading="Processos criados com DIAS EM CURSO preenchido, separados por PILARES e PSI, incluindo START PROCESSO e DIAS EM CURSO na tabela."
          pilares={pilaresDiasEmCurso}
          psi={psiDiasEmCurso}
          columns={[
            { key: "processo", label: "Processo" },
            { key: "valor", label: "VALOR TOTAL" },
            { key: "onde", label: "ONDE ESTÁ O PROCESSO?" },
            { key: "ultimaMovimentacao", label: "ÚLTIMA MOVIMENTAÇÃO" },
            { key: "startProcesso", label: "START PROCESSO" },
            { key: "diasEmCurso", label: "DIAS EM CURSO" },
            { key: "termoEnc", label: "TERMO ENC." },
          ]}
        />
        <KpiStandbyOndeModal
          open={kpiModal === "standbyOnde"}
          onClose={() => setKpiModal(null)}
          rows={allForKpi}
          chartDark={darkMode === true}
        />
        <KpiTotalStartEvolucaoModal
          open={kpiModal === "totalStartEvolucao"}
          onClose={() => setKpiModal(null)}
          rows={allForKpi}
          chartDark={darkMode === true}
        />
        {alertaFatiaDetalhe ? (
          <AlertaDonutDetalheModal
            open
            onClose={() => setAlertaFatiaDetalhe(null)}
            kind={alertaFatiaDetalhe.kind}
            blocoTitulo={alertaFatiaDetalhe.blocoTitulo}
            fatiaNome={alertaFatiaDetalhe.fatiaNome}
            rows={alertaFatiaDetalhe.rows}
          />
        ) : null}

        {/* Três colunas PILARES | PSI | CONSOLIDADO — mesma altura para alinhar gráficos */}
        <section className="mb-8 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <BlocoPanel
            title="PILARES"
            accent={COLORS.pilares}
            rows={pilaresRows}
            headerIcon={Layers}
            chartDark={darkMode === true}
            onAlertaFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "alertas",
                blocoTitulo: "PILARES",
                fatiaNome,
                rows: processosCriadosPorFatiaAlerta(pilaresRows, fatiaNome),
              })
            }
            onAlocacaoFocalFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "alocacaoFocal",
                blocoTitulo: "PILARES",
                fatiaNome,
                rows: processosCriadosPorFatiaAlocacaoFocal(pilaresRows, fatiaNome),
              })
            }
            onTermoEncFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "termoEnc",
                blocoTitulo: "PILARES",
                fatiaNome,
                rows: processosCriadosPorFatiaTermoEnc(pilaresRows, fatiaNome),
              })
            }
            onOndeBarClick={(bucketNome) =>
              setAlertaFatiaDetalhe({
                kind: "onde",
                blocoTitulo: "PILARES",
                fatiaNome: bucketNome,
                rows: processosPorBucketOnde(pilaresRows, bucketNome),
              })
            }
            onStatusBarClick={(statusNome) =>
              setAlertaFatiaDetalhe({
                kind: "status",
                blocoTitulo: "PILARES",
                fatiaNome: statusNome,
                rows: processosPorStatus(pilaresRows, statusNome),
              })
            }
            onDfdTrdBarClick={(coluna, bucketNome) =>
              setAlertaFatiaDetalhe({
                kind: "dfdTrd",
                blocoTitulo: "PILARES",
                fatiaNome: `${coluna} — ${bucketNome}`,
                rows: processosCriadosPorBucketDfdTrd(pilaresRows, coluna, bucketNome),
              })
            }
          />
          <BlocoPanel
            title="PSI"
            accent={COLORS.psi}
            rows={psiRows}
            headerIcon={Briefcase}
            chartDark={darkMode === true}
            onAlertaFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "alertas",
                blocoTitulo: "PSI",
                fatiaNome,
                rows: processosCriadosPorFatiaAlerta(psiRows, fatiaNome),
              })
            }
            onAlocacaoFocalFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "alocacaoFocal",
                blocoTitulo: "PSI",
                fatiaNome,
                rows: processosCriadosPorFatiaAlocacaoFocal(psiRows, fatiaNome),
              })
            }
            onTermoEncFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "termoEnc",
                blocoTitulo: "PSI",
                fatiaNome,
                rows: processosCriadosPorFatiaTermoEnc(psiRows, fatiaNome),
              })
            }
            onOndeBarClick={(bucketNome) =>
              setAlertaFatiaDetalhe({
                kind: "onde",
                blocoTitulo: "PSI",
                fatiaNome: bucketNome,
                rows: processosPorBucketOnde(psiRows, bucketNome),
              })
            }
            onStatusBarClick={(statusNome) =>
              setAlertaFatiaDetalhe({
                kind: "status",
                blocoTitulo: "PSI",
                fatiaNome: statusNome,
                rows: processosPorStatus(psiRows, statusNome),
              })
            }
            onDfdTrdBarClick={(coluna, bucketNome) =>
              setAlertaFatiaDetalhe({
                kind: "dfdTrd",
                blocoTitulo: "PSI",
                fatiaNome: `${coluna} — ${bucketNome}`,
                rows: processosCriadosPorBucketDfdTrd(psiRows, coluna, bucketNome),
              })
            }
          />
          <BlocoPanel
            title="CONSOLIDADO"
            accent={COLORS.consolidado}
            rows={filtered}
            headerIcon={LayoutGrid}
            chartDark={darkMode === true}
            onAlertaFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "alertas",
                blocoTitulo: "CONSOLIDADO",
                fatiaNome,
                rows: processosCriadosPorFatiaAlerta(filtered, fatiaNome),
              })
            }
            onAlocacaoFocalFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "alocacaoFocal",
                blocoTitulo: "CONSOLIDADO",
                fatiaNome,
                rows: processosCriadosPorFatiaAlocacaoFocal(filtered, fatiaNome),
              })
            }
            onTermoEncFatiaClick={(fatiaNome) =>
              setAlertaFatiaDetalhe({
                kind: "termoEnc",
                blocoTitulo: "CONSOLIDADO",
                fatiaNome,
                rows: processosCriadosPorFatiaTermoEnc(filtered, fatiaNome),
              })
            }
            onOndeBarClick={(bucketNome) =>
              setAlertaFatiaDetalhe({
                kind: "onde",
                blocoTitulo: "CONSOLIDADO",
                fatiaNome: bucketNome,
                rows: processosPorBucketOnde(filtered, bucketNome),
              })
            }
            onStatusBarClick={(statusNome) =>
              setAlertaFatiaDetalhe({
                kind: "status",
                blocoTitulo: "CONSOLIDADO",
                fatiaNome: statusNome,
                rows: processosPorStatus(filtered, statusNome),
              })
            }
            onDfdTrdBarClick={(coluna, bucketNome) =>
              setAlertaFatiaDetalhe({
                kind: "dfdTrd",
                blocoTitulo: "CONSOLIDADO",
                fatiaNome: `${coluna} — ${bucketNome}`,
                rows: processosCriadosPorBucketDfdTrd(filtered, coluna, bucketNome),
              })
            }
          />
        </section>

        {/* Segunda linha: donuts + top atrasados por bloco */}
        <section className="mb-8 grid gap-4 lg:grid-cols-3">
          {(
            [
              ["PILARES", pilaresRows],
              ["PSI", psiRows],
              ["CONSOLIDADO", filtered],
            ] as const
          ).map(([label, rows]) => {
            const RowIcon =
              label === "PILARES" ? Layers : label === "PSI" ? Briefcase : LayoutGrid;
            const rowAccent =
              label === "PILARES"
                ? COLORS.pilares
                : label === "PSI"
                  ? COLORS.psi
                  : COLORS.consolidado;
            const endDonut = endProcessoDonut(rows);
            return (
              <div
                key={label}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:shadow-black/25"
              >
                <p className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-100">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/80"
                    style={{ color: darkMode === true ? "#f8fafc" : rowAccent }}
                  >
                    <RowIcon className="h-4 w-4" aria-hidden />
                  </span>
                  {label}
                </p>
                <div className="flex w-full min-w-0 flex-col gap-4">
                  {/* Linha 1: donut END com legenda lateral */}
                  <div className="flex justify-center">
                    <div className="w-full min-w-0 max-w-[320px]">
                      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden />
                        END processo
                      </p>
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                        <ul className="min-w-0 flex-1 space-y-1.5 text-xs sm:min-w-[120px]">
                          {endDonut.map((d) => (
                            <li key={d.name}>
                              <button
                                type="button"
                                disabled={d.name === "Sem dados"}
                                onClick={() =>
                                  setAlertaFatiaDetalhe({
                                    kind: "endProcesso",
                                    blocoTitulo: label,
                                    fatiaNome: d.name,
                                    rows: processosCriadosPorFatiaEndProcesso(rows, d.name),
                                  })
                                }
                                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left text-slate-600 hover:bg-slate-200/70 dark:text-white dark:hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ background: d.color }}
                                  />
                                  {d.name}
                                </span>
                                <strong className="text-slate-900 dark:text-white">{d.value}%</strong>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="mx-auto w-full min-w-[120px] max-w-[160px] shrink-0 sm:mx-0">
                          <MiniDonut
                            data={endDonut}
                            chartDark={darkMode === true}
                            onSliceClick={(fatiaNome) =>
                              setAlertaFatiaDetalhe({
                                kind: "endProcesso",
                                blocoTitulo: label,
                                fatiaNome,
                                rows: processosCriadosPorFatiaEndProcesso(rows, fatiaNome),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Linha 2: tabela em largura total */}
                  <UltimosMovimentadosCard rows={rows} />
                </div>
              </div>
            );
          })}
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              © 2026 INTERPI — Governo do Estado
            </span>
            <a href="#" className="hover:text-slate-700 dark:hover:text-slate-200">
            </a>
            <a href="#" className="hover:text-slate-700 dark:hover:text-slate-200">        
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Painel online
            </span>
          </div>
        </footer>

        <div
          className="pointer-events-none fixed bottom-4 right-4 z-50 max-w-[min(100vw-2rem,16rem)] select-none rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 text-left text-[11px] shadow-lg shadow-slate-900/10 backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/95 dark:shadow-black/40"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Última leitura API
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-medium tabular-nums text-slate-800 dark:text-slate-100">
            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
            {apiSyncLabel}
          </p>
        </div>
        </>
        )}
      </div>
    </div>
  </div>
  );
}
