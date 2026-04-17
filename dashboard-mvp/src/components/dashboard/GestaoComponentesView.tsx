import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { AlertaDonutDetalheModal } from "@/components/dashboard/AlertaDonutDetalheModal";
import type { ProcessoRow } from "@/lib/types";
import type { ComponenteGestaoRow } from "@/lib/parseGestaoComponentesCsv";

type Props = {
  rows: ComponenteGestaoRow[];
  processos: ProcessoRow[];
  chartDark: boolean;
  dataSourceLabel: string;
  timeStr: string;
};

type ThermometerMetric = {
  componente: string;
  valorBase: number | null;
  valorUtilizado: number;
  valorSaldoProj: number;
  percentualUtilizado: number;
};

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function normalizeComponentKey(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/\d+/g, (digits) => String(Number.parseInt(digits, 10)));
}

function resolveThermometerColor(percentualUtilizado: number) {
  if (percentualUtilizado >= 85) return "#dc2626";
  if (percentualUtilizado >= 60) return "#f59e0b";
  return "#22c55e";
}

function ThermometerCard({
  title,
  subtitle,
  percentualUtilizado,
  valorUtilizado,
  valorSaldoProj,
  valorBase,
  accent,
  onClick,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  percentualUtilizado: number;
  valorUtilizado: number;
  valorSaldoProj: number;
  valorBase: number | null;
  accent: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  const fill = valorBase != null && valorBase > 0 ? Math.max(0, Math.min(100, percentualUtilizado)) : 0;
  const fillColor = resolveThermometerColor(fill);

  const cardWidth = compact ? "min-w-[180px]" : "min-w-[190px]";
  const cardPadding = compact ? "px-4 py-5" : "px-5 py-6";
  const titleClass = compact ? "text-[11px]" : "text-xs";
  const subtitleClass = compact ? "text-[10px]" : "text-[11px]";
  const tickHeight = compact ? "h-[196px]" : "h-[238px]";
  const tubeWrapSize = compact ? "h-[210px] w-[62px]" : "h-[252px] w-[78px]";
  const tubeSize = compact ? "bottom-7 h-[158px] w-6 border-[3px]" : "bottom-9 h-[188px] w-7 border-[4px]";
  const bulbSize = compact ? "h-12 w-12 border-[3px]" : "h-16 w-16 border-[4px]";
  const connectorSize = compact ? "bottom-[18px] h-[18px] w-4" : "bottom-[24px] h-[22px] w-5";
  const percentClass = compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs";
  const labelBlockMargin = compact ? "mt-4" : "mt-5";
  const valueClass = compact ? "text-xs" : "text-sm";
  const metaClass = compact ? "text-[10px]" : "text-[11px]";
  const tooltipClass = compact ? "max-w-[180px] px-3 py-2" : "max-w-[210px] px-3.5 py-2.5";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex ${cardWidth} flex-col items-center rounded-2xl border border-slate-200/80 bg-white/70 ${cardPadding} text-left shadow-sm transition-colors hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:bg-slate-900/90 dark:focus-visible:ring-cyan-500/50`}
    >
      <p className={`text-center font-bold uppercase tracking-wide ${titleClass}`} style={{ color: accent }}>
        Aval. consumo de saldo disp.
      </p>
      <p className={`mt-1 text-center font-medium text-slate-500 dark:text-slate-400 ${subtitleClass}`}>{title}</p>
      {subtitle ? (
        <p className={`mt-0.5 text-center font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 ${compact ? "text-[9px]" : "text-[10px]"}`}>
          {subtitle}
        </p>
      ) : null}

      <div className="group relative mt-4 flex items-end gap-2">
        <div className={`flex ${tickHeight} flex-col justify-between ${compact ? "pb-4 pt-2" : "pb-5 pt-3"}`}>
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <span
              key={`tick-left-${idx}`}
              className={`${compact ? "h-[3px] w-3" : "h-1 w-4"} rounded-full bg-slate-300/80 dark:bg-slate-600/80`}
            />
          ))}
        </div>

        <div className={`relative ${tubeWrapSize}`}>
          <div className={`absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-full border-slate-300 bg-slate-100 shadow-inner dark:border-slate-500 dark:bg-slate-950 ${tubeSize}`}>
            <div
              className="absolute bottom-0 left-0 w-full rounded-b-full transition-[height,background-color] duration-500"
              style={{
                height: `${fill}%`,
                background: `linear-gradient(180deg, ${fillColor}CC 0%, ${fillColor} 100%)`,
              }}
            />
          </div>

          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full border-slate-300 shadow-inner dark:border-slate-500 ${bulbSize}`}
            style={{
              background: `radial-gradient(circle at 35% 35%, ${fillColor}AA 0%, ${fillColor} 70%)`,
            }}
          />

          <div className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-slate-100 dark:bg-slate-950 ${connectorSize}`} />

          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`rounded-full bg-white/85 font-bold tabular-nums text-slate-900 shadow-sm dark:bg-slate-900/85 dark:text-slate-100 ${percentClass}`}>
              {formatPercent(fill)}
            </span>
          </div>
        </div>

        <div className={`flex ${tickHeight} flex-col justify-between ${compact ? "pb-4 pt-2" : "pb-5 pt-3"}`}>
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <span
              key={`tick-right-${idx}`}
              className={`${compact ? "h-[3px] w-3" : "h-1 w-4"} rounded-full bg-slate-300/80 dark:bg-slate-600/80`}
            />
          ))}
        </div>

        <div className={`pointer-events-none absolute -top-2 left-1/2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-xl border border-slate-600 bg-slate-800/95 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:border-slate-500 dark:bg-slate-800 ${tooltipClass}`}>
          <p className="text-sm font-bold text-white">Total gasto</p>
          <p className="mt-1 text-xs font-medium text-slate-200">{formatBRL(valorUtilizado)}</p>
        </div>
      </div>

      <div className={`${labelBlockMargin} space-y-1 text-center`}>
        <p className={`font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 ${metaClass}`}>
          Saldo proj
        </p>
        <p className={`font-semibold text-slate-800 dark:text-slate-100 ${valueClass}`}>{formatBRL(valorSaldoProj)}</p>
        <p className={`text-slate-500 dark:text-slate-400 ${metaClass}`}>
          Dispon. total: {valorBase != null ? formatBRL(valorBase) : "—"}
        </p>
      </div>
    </button>
  );
}

function ComponentesThermometerModal({
  open,
  onClose,
  blocoTitulo,
  accent,
  items,
}: {
  open: boolean;
  onClose: () => void;
  blocoTitulo: string;
  accent: string;
  items: ThermometerMetric[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/70"
        aria-label="Fechar detalhe dos termômetros"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40">
        <header className="border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/90">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Consumo de saldo por componente
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Bloco <strong className="font-semibold" style={{ color: accent }}>{blocoTitulo}</strong>. Os termômetros abaixo
            destacam qual componente está utilizando mais saldo.
          </p>
        </header>

        <div className="bg-slate-50/50 px-5 py-5 dark:bg-slate-950/50">
          <div className="grid gap-5 md:grid-cols-3">
            {items.map((item, index) => (
              <div key={`${blocoTitulo}-${item.componente}`} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {index + 1}º maior uso
                </p>
                <div className="mt-3 flex justify-center">
                  <ThermometerCard
                    title={blocoTitulo}
                    subtitle={item.componente}
                    percentualUtilizado={item.percentualUtilizado}
                    valorUtilizado={item.valorUtilizado}
                    valorSaldoProj={item.valorSaldoProj}
                    valorBase={item.valorBase}
                    accent={accent}
                    compact={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComponenteTable({
  title,
  rows,
  processos,
  accent,
  accentSoft,
  thermometer,
  onThermometerClick,
  onCalendarClick,
}: {
  title: string;
  rows: ComponenteGestaoRow[];
  processos: ProcessoRow[];
  accent: string;
  accentSoft: string;
  thermometer: {
    percentualUtilizado: number;
    valorUtilizado: number;
    valorSaldoProj: number;
    valorBase: number | null;
  };
  onThermometerClick: () => void;
  onCalendarClick: (title: string, componente: string, rows: ProcessoRow[]) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px] xl:items-stretch">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:shadow-black/25">
        <div
          className="border-b px-4 py-3 dark:border-slate-700/80"
          style={{
            borderColor: `${accent}55`,
            backgroundColor: chartSafeColor(accentSoft),
          }}
        >
          <p className="text-sm font-bold tracking-tight dark:text-slate-100" style={{ color: chartSafeColor(accent) }}>
            {title}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: chartSafeColor(accentSoft) }}>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                <th className="px-4 py-3">Map. data alvo</th>
                <th className="px-4 py-3">Componente</th>
                <th className="px-4 py-3">Disponibilizado</th>
                <th className="px-4 py-3">Contrapartida</th>
                <th className="px-4 py-3">Dispon. total</th>
                <th className="px-4 py-3">Comprometido</th>
                <th className="px-4 py-3">JÁ executado</th>
                <th className="px-4 py-3">Saldo real</th>
                <th className="px-4 py-3">Saldo proj</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const processosDoComponente = processos.filter((processo) => {
                  return normalizeComponentKey(processo.componente) === normalizeComponentKey(row.componente);
                });
                return (
                  <tr
                    key={`${title}-${row.componente}`}
                    className="border-t border-slate-200/70 text-slate-700 odd:bg-white even:bg-slate-50/60 dark:border-slate-700/70 dark:text-slate-200 dark:odd:bg-slate-900/70 dark:even:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => onCalendarClick(title, row.componente, processosDoComponente)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        title={`Ver processos do ${row.componente}`}
                        aria-label={`Ver processos do ${row.componente}`}
                      >
                        <CalendarDays className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.componente}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(row.disponibilizado ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(row.contrapartida ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(row.disponTotal ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(row.comprometido ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(row.jaExecutado ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(row.saldoReal ?? 0)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatBRL(row.saldoProj ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ThermometerCard
        title={title}
        percentualUtilizado={thermometer.percentualUtilizado}
        valorUtilizado={thermometer.valorUtilizado}
        valorSaldoProj={thermometer.valorSaldoProj}
        valorBase={thermometer.valorBase}
        accent={accent}
        onClick={onThermometerClick}
        compact
      />
    </section>
  );
}

function chartSafeColor(value: string) {
  return value;
}

export default function GestaoComponentesView({ rows, processos, chartDark, dataSourceLabel, timeStr }: Props) {
  const psiRows = rows.filter((row) => row.bloco === "PSI");
  const pilaresRows = rows.filter((row) => row.bloco === "PILARES");
  const processosPilares = processos.filter((row) => row.bloco === "PILARES");
  const processosPsi = processos.filter((row) => row.bloco === "PSI");
  const [detalhe, setDetalhe] = useState<null | {
    blocoTitulo: string;
    fatiaNome: string;
    rows: ProcessoRow[];
  }>(null);
  const [thermometerDetalhe, setThermometerDetalhe] = useState<null | {
    blocoTitulo: string;
    accent: string;
    items: ThermometerMetric[];
  }>(null);

  const buildThermometer = (blocoRows: ComponenteGestaoRow[]): ThermometerMetric => {
    const totalGeral =
      blocoRows.find((row) => row.componente.trim().toUpperCase() === "TOTAL GERAL") ?? null;
    const valorBaseBruto =
      totalGeral && totalGeral.disponTotal != null && totalGeral.disponTotal > 0 ? totalGeral.disponTotal : null;
    const valorSaldoProj = totalGeral?.saldoProj ?? 0;
    const valorUtilizado =
      valorBaseBruto != null && valorBaseBruto > 0 ? Math.max(valorBaseBruto - valorSaldoProj, 0) : 0;
    const percentualUtilizado =
      valorBaseBruto != null && valorBaseBruto > 0 ? (valorUtilizado / valorBaseBruto) * 100 : 0;

    return {
      componente: blocoRows[0]?.bloco ?? "TOTAL GERAL",
      valorBase: valorBaseBruto,
      valorUtilizado,
      valorSaldoProj,
      percentualUtilizado,
    };
  };

  const buildThermometerByComponent = (blocoRows: ComponenteGestaoRow[]): ThermometerMetric[] => {
    return blocoRows
      .filter((row) => row.componente.trim().toUpperCase() !== "TOTAL GERAL")
      .map((row) => {
        const valorBase = row.disponTotal != null && row.disponTotal > 0 ? row.disponTotal : null;
        const valorSaldoProj = row.saldoProj ?? 0;
        const valorUtilizado = valorBase != null && valorBase > 0 ? Math.max(valorBase - valorSaldoProj, 0) : 0;
        const percentualUtilizado = valorBase != null && valorBase > 0 ? (valorUtilizado / valorBase) * 100 : 0;

        return {
          componente: row.componente,
          valorBase,
          valorSaldoProj,
          valorUtilizado,
          percentualUtilizado,
        };
      })
      .sort((a, b) => {
        if (b.percentualUtilizado !== a.percentualUtilizado) {
          return b.percentualUtilizado - a.percentualUtilizado;
        }
        return b.valorUtilizado - a.valorUtilizado;
      });
  };

  const thermometerPilares = buildThermometer(pilaresRows);
  const thermometerPsi = buildThermometer(psiRows);
  const thermometerPilaresByComponent = buildThermometerByComponent(pilaresRows);
  const thermometerPsiByComponent = buildThermometerByComponent(psiRows);

  return (
    <div className={chartDark ? "dark" : undefined}>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
          <div className="min-w-0 text-sm text-slate-600 dark:text-slate-400">
            <span>{dataSourceLabel || "A carregar…"} · última leitura {timeStr}</span>
          </div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Base: guia <strong className="font-semibold text-slate-700 dark:text-slate-200">GESTÃO $$ COMPONENTES</strong>
          </div>
        </div>

        <section className="grid gap-6">
          <ComponenteTable
            title="PILARES"
            rows={pilaresRows}
            processos={processosPilares}
            accent="#2563eb"
            accentSoft={chartDark ? "rgba(37,99,235,0.18)" : "#eff6ff"}
            thermometer={thermometerPilares}
            onThermometerClick={() =>
              setThermometerDetalhe({
                blocoTitulo: "PILARES",
                accent: "#2563eb",
                items: thermometerPilaresByComponent,
              })
            }
            onCalendarClick={(blocoTitulo, componente, rows) =>
              setDetalhe({ blocoTitulo, fatiaNome: componente, rows })
            }
          />
          <ComponenteTable
            title="PSI"
            rows={psiRows}
            processos={processosPsi}
            accent="#dc2626"
            accentSoft={chartDark ? "rgba(220,38,38,0.18)" : "#fef2f2"}
            thermometer={thermometerPsi}
            onThermometerClick={() =>
              setThermometerDetalhe({
                blocoTitulo: "PSI",
                accent: "#dc2626",
                items: thermometerPsiByComponent,
              })
            }
            onCalendarClick={(blocoTitulo, componente, rows) =>
              setDetalhe({ blocoTitulo, fatiaNome: componente, rows })
            }
          />
        </section>
        {detalhe ? (
          <AlertaDonutDetalheModal
            open
            onClose={() => setDetalhe(null)}
            blocoTitulo={detalhe.blocoTitulo}
            fatiaNome={detalhe.fatiaNome}
            rows={detalhe.rows}
            kind="componente"
          />
        ) : null}
        {thermometerDetalhe ? (
          <ComponentesThermometerModal
            open
            onClose={() => setThermometerDetalhe(null)}
            blocoTitulo={thermometerDetalhe.blocoTitulo}
            accent={thermometerDetalhe.accent}
            items={thermometerDetalhe.items}
          />
        ) : null}
      </div>
    </div>
  );
}
