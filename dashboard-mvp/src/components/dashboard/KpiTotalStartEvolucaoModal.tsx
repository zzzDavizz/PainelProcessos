"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { X } from "lucide-react";
import type { ProcessoRow } from "@/lib/types";
import { evolucaoIniciosPorStartProcesso, ONDE_VAZIO_LABEL } from "@/lib/aggregations";

const chartTheme = {
  light: {
    yTick: "#1e293b",
    xTick: "#475569",
    grid: "#e2e8f0",
    cursor: "rgba(15, 23, 42, 0.06)",
    /** Ciano bem saturado para contraste forte no fundo branco. */
    line: "#0e7490",
  },
  dark: {
    yTick: "#f1f5f9",
    xTick: "#cbd5e1",
    grid: "#475569",
    cursor: "rgba(248, 250, 252, 0.08)",
    line: "#38bdf8",
  },
} as const;

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const MAX_TOOLTIP_LINHAS = 80;

const DOT_PENDENTE = "#dc2626";
const DOT_PENDENTE_DARK = "#f87171";

type ChartPoint = ReturnType<typeof evolucaoIniciosPorStartProcesso>[number] & {
  /** Data completa para o tooltip: dd/mm/aaaa ou mês por extenso. */
  dataTitulo: string;
  /** Rótulo no eixo: um tick por ano, centrado no intervalo desse ano nos dados. */
  showAxisTick: boolean;
  tickYear: string;
};

type StartEvolucaoChartModel = {
  chartData: ChartPoint[];
  /** Primeira `sortKey` de cada ano após o primeiro — linhas verticais entre anos. */
  yearDividerSortKeys: string[];
};

function buildStartEvolucaoChartModel(
  raw: ReturnType<typeof evolucaoIniciosPorStartProcesso>,
): StartEvolucaoChartModel {
  const years = raw.map((p) => p.sortKey.slice(0, 4));
  const showAxisTick = raw.map(() => false);
  const yearDividerSortKeys: string[] = [];
  let segStart = 0;
  for (let i = 1; i <= raw.length; i++) {
    const atEnd = i === raw.length;
    const yearChanged = !atEnd && years[i] !== years[segStart];
    if (atEnd || yearChanged) {
      const segEnd = atEnd ? raw.length - 1 : i - 1;
      showAxisTick[Math.floor((segStart + segEnd) / 2)] = true;
      if (yearChanged && i < raw.length) {
        yearDividerSortKeys.push(raw[i].sortKey);
      }
      segStart = i;
    }
  }

  const chartData: ChartPoint[] = raw.map((p, i) => {
    const isDay = p.sortKey.length >= 10;
    let dataTitulo = p.label;
    if (isDay) {
      const [y, m, d] = p.sortKey.split("-");
      dataTitulo = `${d}/${m}/${y}`;
    } else {
      const ym = p.sortKey.slice(0, 7);
      const [y, mo] = ym.split("-");
      const mi = Math.min(12, Math.max(1, parseInt(mo, 10))) - 1;
      dataTitulo = `${MESES_PT[mi]} de ${y}`;
    }

    return {
      ...p,
      dataTitulo,
      showAxisTick: showAxisTick[i],
      tickYear: years[i] ?? "",
    };
  });

  return { chartData, yearDividerSortKeys };
}

export type KpiTotalStartEvolucaoModalProps = {
  open: boolean;
  onClose: () => void;
  rows: ProcessoRow[];
  chartDark?: boolean;
};

export function KpiTotalStartEvolucaoModal({ open, onClose, rows, chartDark = false }: KpiTotalStartEvolucaoModalProps) {
  const t = chartDark ? chartTheme.dark : chartTheme.light;

  const { chartData, yearDividerSortKeys } = useMemo(
    () => buildStartEvolucaoChartModel(evolucaoIniciosPorStartProcesso(rows)),
    [rows],
  );

  /** Altura em unidades de quantidade: traço só junto ao eixo X (não atravessa a área do gráfico). */
  const yearDividerAxisDepth = useMemo(() => {
    const m = chartData.reduce((acc, p) => Math.max(acc, p.quantidadeTotal), 0);
    const span = Math.max(m, 1);
    return Math.max(0.1, Math.min(0.42, span * 0.048));
  }, [chartData]);

  const pendenteFill = chartDark ? DOT_PENDENTE_DARK : DOT_PENDENTE;

  const renderDot = useCallback(
    (props: { cx?: number; cy?: number; payload?: ChartPoint }) => {
      const { cx, cy, payload } = props;
      if (cx == null || cy == null || !payload) return null;
      const temPendente = payload.quantidadePendentesCriacao > 0;
      const fill = temPendente ? pendenteFill : t.line;
      return (
        <circle
          cx={cx}
          cy={cy}
          r={4.5}
          fill={fill}
          stroke="#ffffff"
          strokeWidth={2}
          aria-label={
            temPendente
              ? `${payload.quantidadeTotal} linha(s) no período, ${payload.quantidadePendentesCriacao} sem processo criado`
              : undefined
          }
        />
      );
    },
    [pendenteFill, t.line],
  );

  const renderActiveDot = useCallback(
    (props: { cx?: number; cy?: number; payload?: ChartPoint }) => {
      const { cx, cy, payload } = props;
      if (cx == null || cy == null || !payload) return null;
      const temPendente = payload.quantidadePendentesCriacao > 0;
      if (temPendente) {
        return (
          <circle cx={cx} cy={cy} r={8} fill={pendenteFill} stroke="#ffffff" strokeWidth={2.5} />
        );
      }
      return <circle cx={cx} cy={cy} r={8} fill="#ffffff" stroke={t.line} strokeWidth={2.5} />;
    },
    [pendenteFill, t.line],
  );

  const renderYearTick = useCallback(
    (props: { x?: string | number; y?: string | number; index?: number; payload?: { value?: string } }) => {
      const x = Number(props.x ?? 0);
      const y = Number(props.y ?? 0);
      const byValue =
        props.payload?.value != null
          ? chartData.findIndex((d) => d.sortKey === props.payload!.value)
          : -1;
      const index = byValue >= 0 ? byValue : (props.index ?? 0);
      const item = chartData[index];
      if (!item?.showAxisTick) return <g />;
      return (
        <g transform={`translate(${x},${y})`}>
          <text textAnchor="middle" fill={t.xTick} fontSize={11} fontWeight={700} dy={14}>
            {item.tickYear}
          </text>
        </g>
      );
    },
    [chartData, t.xTick],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const chartH = 420;

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
        aria-labelledby="kpi-total-start-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/90 sm:px-5 sm:py-4">
          <div className="min-w-0 pr-2">
            <h2
              id="kpi-total-start-title"
              className="text-base font-bold text-slate-900 dark:text-white sm:text-lg"
            >
              Início dos processos ao longo do tempo
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">
              Evolução pelo <strong>START PROCESSO</strong>. Linhas <strong>Pendente Criação</strong> com START
              {" "}preenchido aparecem no gráfico como <strong>bolinha vermelha</strong>.
            </p>
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
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma linha com START PROCESSO no formato AAAA-MM-DD (nem processos criados nem pendentes de criação).
            </p>
          ) : (
            <div
              className="w-full rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 px-2 pb-3 pt-4 shadow-inner dark:border-slate-600 dark:from-slate-900 dark:to-slate-800/60"
              style={{ height: chartH }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 32, right: 24, left: 10, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                  {yearDividerSortKeys.map((sk) => (
                    <ReferenceLine
                      key={sk}
                      segment={[
                        { x: sk, y: 0 },
                        { x: sk, y: yearDividerAxisDepth },
                      ]}
                      stroke={t.xTick}
                      strokeOpacity={0.45}
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      ifOverflow="visible"
                    />
                  ))}
                  <XAxis
                    dataKey="sortKey"
                    type="category"
                    tickLine={false}
                    axisLine={{ stroke: t.grid }}
                    interval={0}
                    minTickGap={8}
                    height={40}
                    tick={renderYearTick}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, "auto"]}
                    tick={{ fontSize: 11, fill: t.yTick }}
                    axisLine={{ stroke: t.grid }}
                    tickLine={{ stroke: t.grid }}
                  />
                  <Tooltip
                    cursor={{ stroke: t.line, strokeWidth: 1, strokeDasharray: "4 4" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as ChartPoint;
                      const list = p.detalhes ?? [];
                      const pendList = p.detalhesPendentesCriacao ?? [];
                      const shown = list.slice(0, MAX_TOOLTIP_LINHAS);
                      const rest = list.length - shown.length;
                      const shownPend = pendList.slice(0, MAX_TOOLTIP_LINHAS);
                      const restPend = pendList.length - shownPend.length;
                      return (
                        <div className="w-[22rem] rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs shadow-lg ring-1 ring-slate-900/5 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/10">
                          {/* Cabeçalho */}
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{p.dataTitulo}</p>
                          <div className="mt-1.5 flex items-center gap-3 text-[11px] tabular-nums">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {p.quantidadeTotal} {p.quantidadeTotal === 1 ? "linha" : "linhas"}
                            </span>
                            {p.quantidade > 0 ? (
                              <span className="text-slate-500 dark:text-slate-400">
                                {p.quantidade} c/ nº oficial
                              </span>
                            ) : null}
                            {p.quantidadePendentesCriacao > 0 ? (
                              <span className="font-semibold text-red-600 dark:text-red-400">
                                {p.quantidadePendentesCriacao} s/ processo
                              </span>
                            ) : null}
                          </div>

                          {/* Listas */}
                          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto border-t border-slate-100 pt-2 dark:border-slate-700">
                            {shown.length > 0 ? (
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                  Com nº oficial
                                </p>
                                <ul className="space-y-0.5">
                                  {shown.map((d, idx) => (
                                    <li key={`${d.processo}-${idx}`} className="flex items-baseline gap-1.5">
                                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                                        {d.processo}
                                      </span>
                                      <span className="shrink-0 text-slate-500 dark:text-slate-400">
                                        {d.onde === ONDE_VAZIO_LABEL ? "—" : d.onde}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {rest > 0 ? (
                                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                                    +{rest} mais
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {shownPend.length > 0 ? (
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">
                                  Sem processo criado
                                </p>
                                <ul className="space-y-0.5">
                                  {shownPend.map((d, idx) => (
                                    <li key={`pend-${d.processo}-${idx}`} className="flex items-baseline gap-1.5">
                                      <span className="min-w-0 flex-1 truncate font-medium text-red-700 dark:text-red-300">
                                        {d.processo}
                                      </span>
                                      <span className="shrink-0 text-slate-500 dark:text-slate-400">
                                        {d.onde === ONDE_VAZIO_LABEL ? "—" : d.onde}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {restPend > 0 ? (
                                  <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                                    +{restPend} mais
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                      dataKey="quantidadeTotal"
                      name="Total de linhas"
                    stroke={t.line}
                    strokeWidth={3}
                    dot={renderDot}
                    activeDot={renderActiveDot}
                  >
                    <LabelList
                      dataKey="quantidadeTotal"
                      position="top"
                      offset={10}
                      content={(props: {
                        x?: number | string;
                        y?: number | string;
                        index?: number;
                        value?: unknown;
                        payload?: ChartPoint;
                      }) => {
                        const payload = props.payload;
                        const byKey =
                          payload?.sortKey != null
                            ? chartData.findIndex((d) => d.sortKey === payload.sortKey)
                            : -1;
                        const idx = byKey >= 0 ? byKey : (props.index ?? 0);
                        const pt = chartData[idx];
                        if (!pt) return null;
                        const x = Number(props.x ?? 0);
                        const y = Number(props.y ?? 0);
                        const n = typeof props.value === "number" ? props.value : Number(props.value);
                        const pend = pt.quantidadePendentesCriacao;
                        if (!Number.isFinite(n) || n < 0) return null;
                        if (n === 0) return null;
                        return (
                          <text
                            x={x}
                            y={y}
                            dy={-16}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={800}
                            dominantBaseline="auto"
                          >
                            <tspan fill={pend > 0 ? pendenteFill : t.yTick}>{String(n)}</tspan>
                            {pend > 0 ? (
                              <tspan fill={pendenteFill} fontWeight={800}>
                                {" *"}
                              </tspan>
                            ) : null}
                          </text>
                        );
                      }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
