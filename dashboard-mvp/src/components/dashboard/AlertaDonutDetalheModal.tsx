"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { ProcessoRow } from "@/lib/types";
import { formatOndeBucketLabel, ONDE_VAZIO_LABEL } from "@/lib/aggregations";
import { formatBRL, formatDataUltimaMovimentacaoBR } from "@/lib/format";
import { useResizableTableColumns } from "@/hooks/useResizableTableColumns";

/** Larguras iniciais (px) — ordem das colunas da tabela de detalhe. */
const ALERTA_FATIA_COL_WIDTHS = [
  104, 128, 196, 92, 116, 104, 64, 96, 188, 92, 148,
] as const;

function ColResizeGrip({
  colIndex,
  onResizeStart,
}: {
  colIndex: number;
  onResizeStart: (colIndex: number, e: React.MouseEvent) => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Arrastar para redimensionar a coluna"
      className="absolute right-0 top-0 z-[1] h-full w-2 translate-x-1/2 cursor-col-resize select-none hover:bg-sky-500/35 dark:hover:bg-sky-400/30"
      onMouseDown={(e) => onResizeStart(colIndex, e)}
    />
  );
}

const tdTextBox =
  "min-w-0 overflow-hidden align-top text-[11px] break-words [overflow-wrap:anywhere] [word-break:break-word]";

const tdTextInner = "block min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]";

/** Datas e números numa linha; conteúdo confinado à célula (ellipsis se estreita). */
const tdCellNoWrapOuter =
  "min-w-0 overflow-hidden border border-slate-200 px-2 py-1.5 align-top tabular-nums text-slate-800 dark:border-slate-700 dark:text-slate-200";

const tdCellNoWrapInner = "block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap";

function formatStartProcessoBR(iso: string | null | undefined): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split("-");
    return `${da}/${mo}/${y}`;
  }
  return s;
}

function formatDateAllowBlank(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split("-");
    return `${da}/${mo}/${y}`;
  }
  return s;
}

function ondeLabel(r: ProcessoRow) {
  const t = (r.onde ?? "").trim();
  return t.length > 0 ? t : ONDE_VAZIO_LABEL;
}

/** Timestamp para ordenar; datas ausentes ou inválidas → NaN (ficam por último na ordem crescente). */
function parseSortableDate(value: string | null | undefined): number {
  const s = (value ?? "").trim();
  if (!s || s === "—") return Number.NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00`).getTime();
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, da, mo, y] = m;
    return new Date(`${y}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}T12:00:00`).getTime();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? Number.NaN : t;
}

type SortableColKey = "ultimaMovimentacao" | "startProcesso";

function AlertaFatiaTabelaBloco({
  title,
  accent,
  rows,
}: {
  title: string;
  accent: string;
  rows: ProcessoRow[];
}) {
  const [sortState, setSortState] = useState<{
    key: SortableColKey;
    dir: "asc" | "desc";
  } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sortState) return rows;
    const { key, dir } = sortState;
    const mul = dir === "asc" ? 1 : -1;
    const getMs = (r: ProcessoRow) =>
      key === "ultimaMovimentacao" ? parseSortableDate(r.ultimaMovimentacao) : parseSortableDate(r.startProcesso);
    return [...rows].sort((a, b) => {
      const da = getMs(a);
      const db = getMs(b);
      const aNa = Number.isNaN(da);
      const bNa = Number.isNaN(db);
      if (aNa && bNa) return 0;
      if (aNa) return 1;
      if (bNa) return -1;
      return (da - db) * mul;
    });
  }, [rows, sortState]);

  function toggleSort(key: SortableColKey) {
    setSortState((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }

  const { widths, onResizeStart, tableMinWidth } = useResizableTableColumns(
    [...ALERTA_FATIA_COL_WIDTHS],
  );

  const thSortableCls =
    "relative min-w-0 overflow-hidden border border-slate-300 px-2 py-2 pr-3 font-semibold dark:border-slate-600 align-bottom";

  const thPlainCls =
    "relative min-w-0 overflow-hidden whitespace-normal border border-slate-300 px-2 py-2 pr-3 font-semibold dark:border-slate-600";

  return (
    <div className="mb-8 last:mb-0">
      <h3
        className="mb-2 border-b-2 pb-1 text-sm font-bold uppercase tracking-wide"
        style={{ borderColor: accent, color: accent }}
      >
        {title}
        <span className="ml-2 font-semibold normal-case text-slate-600 dark:text-slate-300">
          ({rows.length} {rows.length === 1 ? "linha" : "linhas"})
        </span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum processo neste bloco nesta fatia.</p>
      ) : (
        <>
          <p className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">
            Arraste a borda direita das células do cabeçalho para redimensionar as colunas.
          </p>
        <div className="rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
          <table
            className="table-fixed border-collapse text-left text-[11px]"
            style={{ width: tableMinWidth, minWidth: tableMinWidth }}
          >
            <colgroup>
              {widths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">STATUS</span>
                  <ColResizeGrip colIndex={0} onResizeStart={onResizeStart} />
                </th>
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">PROCESSO</span>
                  <ColResizeGrip colIndex={1} onResizeStart={onResizeStart} />
                </th>
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">ITEM/OBJETO - SIMPLIFICADO</span>
                  <ColResizeGrip colIndex={2} onResizeStart={onResizeStart} />
                </th>
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">VALOR TOTAL</span>
                  <ColResizeGrip colIndex={3} onResizeStart={onResizeStart} />
                </th>
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">ONDE ESTÁ O PROCESSO?</span>
                  <ColResizeGrip colIndex={4} onResizeStart={onResizeStart} />
                </th>
                <th className={thSortableCls}>
                  <button
                    type="button"
                    className="flex w-full min-w-0 max-w-full cursor-pointer flex-wrap items-center gap-1 overflow-hidden pr-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-800 hover:underline dark:text-slate-100"
                    onClick={() => toggleSort("ultimaMovimentacao")}
                    aria-sort={
                      sortState?.key === "ultimaMovimentacao"
                        ? sortState.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <span className="min-w-0 break-words leading-snug [overflow-wrap:anywhere]">ÚLTIMA MOVIMENTAÇÃO</span>
                    {sortState?.key === "ultimaMovimentacao" ? (
                      sortState.dir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      )
                    ) : null}
                  </button>
                  <ColResizeGrip colIndex={5} onResizeStart={onResizeStart} />
                </th>
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">STANDBY</span>
                  <ColResizeGrip colIndex={6} onResizeStart={onResizeStart} />
                </th>
                <th className={thSortableCls}>
                  <button
                    type="button"
                    className="flex w-full min-w-0 max-w-full cursor-pointer flex-wrap items-center gap-1 overflow-hidden pr-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-800 hover:underline dark:text-slate-100"
                    onClick={() => toggleSort("startProcesso")}
                    aria-sort={
                      sortState?.key === "startProcesso"
                        ? sortState.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <span className="min-w-0 break-words leading-snug [overflow-wrap:anywhere]">START PROCESSO</span>
                    {sortState?.key === "startProcesso" ? (
                      sortState.dir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      )
                    ) : null}
                  </button>
                  <ColResizeGrip colIndex={7} onResizeStart={onResizeStart} />
                </th>
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">SITUAÇÃO DOS PROCESSOS</span>
                  <ColResizeGrip colIndex={8} onResizeStart={onResizeStart} />
                </th>
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">MAP. DATA ALVO</span>
                  <ColResizeGrip colIndex={9} onResizeStart={onResizeStart} />
                </th>
                <th className={thPlainCls}>
                  <span className="block min-w-0 break-words pr-1 [overflow-wrap:anywhere]">TERMO ENC.</span>
                  <ColResizeGrip colIndex={10} onResizeStart={onResizeStart} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, idx) => (
                <tr
                  key={`${title}-${r.processo}-${idx}`}
                  className={
                    idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/80 dark:bg-slate-900/80"
                  }
                >
                  <td
                    className={`border border-slate-200 px-2 py-1.5 text-slate-700 dark:border-slate-700 dark:text-slate-300 ${tdTextBox}`}
                  >
                    {r.status?.trim() ? (
                      <span className={tdTextInner}>{r.status.trim()}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td
                    className={`border border-slate-200 px-2 py-1.5 text-slate-800 dark:border-slate-700 dark:text-slate-200 ${tdTextBox}`}
                  >
                    <span className={tdTextInner}>{r.processo}</span>
                  </td>
                  <td
                    className={`border border-slate-200 px-2 py-1.5 text-slate-800 dark:border-slate-700 dark:text-slate-200 ${tdTextBox}`}
                  >
                    <span className={tdTextInner}>{r.item?.trim() || "—"}</span>
                  </td>
                  <td className={tdCellNoWrapOuter} title={r.valor != null ? formatBRL(r.valor) : undefined}>
                    <span className={tdCellNoWrapInner}>{r.valor != null ? formatBRL(r.valor) : "—"}</span>
                  </td>
                  <td
                    className={`border border-slate-200 px-2 py-1.5 text-slate-800 dark:border-slate-700 dark:text-slate-200 ${tdTextBox}`}
                  >
                    <span className={tdTextInner}>{ondeLabel(r)}</span>
                  </td>
                  <td
                    className={tdCellNoWrapOuter}
                    title={formatDataUltimaMovimentacaoBR(r.ultimaMovimentacao)}
                  >
                    <span className={tdCellNoWrapInner}>{formatDataUltimaMovimentacaoBR(r.ultimaMovimentacao)}</span>
                  </td>
                  <td
                    className={tdCellNoWrapOuter}
                    title={r.standByDias != null ? String(r.standByDias) : undefined}
                  >
                    <span className={tdCellNoWrapInner}>{r.standByDias != null ? `${r.standByDias}` : "—"}</span>
                  </td>
                  <td className={tdCellNoWrapOuter} title={formatStartProcessoBR(r.startProcesso)}>
                    <span className={tdCellNoWrapInner}>{formatStartProcessoBR(r.startProcesso)}</span>
                  </td>
                  <td
                    className={`border border-slate-200 px-2 py-1.5 text-slate-700 dark:border-slate-700 dark:text-slate-300 ${tdTextBox}`}
                  >
                    {r.situacao?.trim() ? (
                      <span className={tdTextInner}>{r.situacao.trim()}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td
                    className={`border border-slate-200 px-2 py-1.5 tabular-nums text-slate-800 dark:border-slate-700 dark:text-slate-200 ${tdTextBox}`}
                  >
                    <span className={tdTextInner}>
                      {formatDateAllowBlank(r.proximaDataAlvo) || "—"}
                    </span>
                  </td>
                  <td
                    className={`border border-slate-200 px-2 py-1.5 text-slate-800 dark:border-slate-700 dark:text-slate-200 ${tdTextBox}`}
                  >
                    <span className={tdTextInner}>{r.termoEnc?.trim() || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

export type AlertaDonutDetalheKind =
  | "alertas"
  | "alocacaoFocal"
  | "componente"
  | "dfdTrd"
  | "termoEnc"
  | "onde"
  | "endProcesso"
  | "status";

export type AlertaDonutDetalheModalProps = {
  open: boolean;
  onClose: () => void;
  /** Ex.: PILARES, PSI, CONSOLIDADO */
  blocoTitulo: string;
  /** Ex.: Crítico, Atenção, OK, Interno/Externo, Incluso/Ausente ou um bucket de ONDE. */
  fatiaNome: string;
  rows: ProcessoRow[];
  /** Mesmo modal/tabela; títulos e texto explicativo conforme o indicador. */
  kind?: AlertaDonutDetalheKind;
};

const ACCENT_PILARES = "#2563eb";
const ACCENT_PSI = "#dc2626";

export function AlertaDonutDetalheModal({
  open,
  onClose,
  blocoTitulo,
  fatiaNome,
  rows,
  kind = "alertas",
}: AlertaDonutDetalheModalProps) {
  const { pilaresRows, psiRows, isConsolidado } = useMemo(() => {
    const isConsolidado = blocoTitulo === "CONSOLIDADO";
    if (!isConsolidado) {
      return { pilaresRows: rows, psiRows: [] as ProcessoRow[], isConsolidado: false };
    }
    return {
      pilaresRows: rows.filter((r) => r.bloco === "PILARES"),
      psiRows: rows.filter((r) => r.bloco === "PSI"),
      isConsolidado: true,
    };
  }, [blocoTitulo, rows]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
        aria-labelledby="fatia-donut-detalhe-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/90 sm:px-5 sm:py-4">
          <div className="min-w-0 pr-2">
            <h2
              id="fatia-donut-detalhe-title"
              className="text-base font-bold text-slate-900 dark:text-white sm:text-lg"
            >
              {kind === "alocacaoFocal" ? (
                <>
                  Alocação focal — <span className="font-semibold">{fatiaNome}</span>
                </>
              ) : kind === "componente" ? (
                <>
                  Processos do componente — <span className="font-semibold">{fatiaNome}</span>
                </>
              ) : kind === "dfdTrd" ? (
                <>
                  DFD / TDR — <span className="font-semibold">{fatiaNome}</span>
                </>
              ) : kind === "termoEnc" ? (
                <>
                  Distribuição termo enc. — <span className="font-semibold">{fatiaNome}</span>
                </>
              ) : kind === "onde" ? (
                <>
                  Onde está o processo? — <span className="font-semibold">{formatOndeBucketLabel(fatiaNome)}</span>
                </>
              ) : kind === "endProcesso" ? (
                <>
                  END processo — <span className="font-semibold">{fatiaNome}</span>
                </>
              ) : kind === "status" ? (
                <>
                  Status — <span className="font-semibold">{fatiaNome}</span>
                </>
              ) : (
                <>
                  Alertas críticos — <span className="font-semibold">{fatiaNome}</span>
                </>
              )}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
              Bloco <strong className="font-semibold text-slate-800 dark:text-slate-100">{blocoTitulo}</strong>
              {" · "}
              {kind === "alocacaoFocal" ? (
                isConsolidado ? (
                  <>
                    Linhas na categoria <strong className="font-semibold">{fatiaNome}</strong> (coluna ALOCAÇÃO
                    FOCAL): processos com nº oficial e «Pendente criação» com alocação preenchida,{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      separadas por PILARES e PSI
                    </strong>{" "}
                    (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}).
                  </>
                ) : (
                  <>
                    Linhas na categoria <strong className="font-semibold">{fatiaNome}</strong> (coluna ALOCAÇÃO
                    FOCAL): processos com nº oficial e «Pendente criação» com alocação preenchida — {rows.length}{" "}
                    {rows.length === 1 ? "linha" : "linhas"}.
                  </>
                )
              ) : kind === "componente" ? (
                isConsolidado ? (
                  <>
                    Processos do componente <strong className="font-semibold">{fatiaNome}</strong>, com a coluna{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">MAP. DATA ALVO</strong>,{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      separados por PILARES e PSI
                    </strong>{" "}
                    (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}). Células sem data permanecem vazias.
                  </>
                ) : (
                  <>
                    Processos do componente <strong className="font-semibold">{fatiaNome}</strong>, com a coluna{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">MAP. DATA ALVO</strong>:{" "}
                    {rows.length} {rows.length === 1 ? "linha" : "linhas"}. Células sem data permanecem vazias.
                  </>
                )
              ) : kind === "dfdTrd" ? (
                isConsolidado ? (
                  <>
                    Processos criados da categoria <strong className="font-semibold">{fatiaNome}</strong> no gráfico{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">DFD / TDR</strong>,{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      separados por PILARES e PSI
                    </strong>{" "}
                    (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}).
                  </>
                ) : (
                  <>
                    Processos criados da categoria <strong className="font-semibold">{fatiaNome}</strong> no gráfico{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">DFD / TDR</strong>:{" "}
                    {rows.length} {rows.length === 1 ? "linha" : "linhas"}.
                  </>
                )
              ) : kind === "termoEnc" ? (
                isConsolidado ? (
                  <>
                    Processos com número oficial na categoria <strong className="font-semibold">{fatiaNome}</strong>{" "}
                    (coluna TERMO ENC.),{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      separados por PILARES e PSI
                    </strong>{" "}
                    (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}).
                  </>
                ) : (
                  <>
                    Processos com número oficial na categoria <strong className="font-semibold">{fatiaNome}</strong>{" "}
                    (coluna TERMO ENC.): {rows.length} {rows.length === 1 ? "linha" : "linhas"}.
                  </>
                )
              ) : kind === "onde" ? (
                isConsolidado ? (
                  <>
                    Processos no bucket <strong className="font-semibold">{formatOndeBucketLabel(fatiaNome)}</strong>{" "}
                    da coluna ONDE ESTÁ O PROCESSO?,{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      separados por PILARES e PSI
                    </strong>{" "}
                    (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}).
                  </>
                ) : (
                  <>
                    Processos no bucket <strong className="font-semibold">{formatOndeBucketLabel(fatiaNome)}</strong>{" "}
                    da coluna ONDE ESTÁ O PROCESSO?: {rows.length} {rows.length === 1 ? "linha" : "linhas"}.
                  </>
                )
              ) : kind === "endProcesso" ? (
                isConsolidado ? (
                  <>
                    Processos com número oficial na categoria <strong className="font-semibold">{fatiaNome}</strong>{" "}
                    do gráfico END PROCESSO,{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      separados por PILARES e PSI
                    </strong>{" "}
                    (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}).
                  </>
                ) : (
                  <>
                    Processos com número oficial na categoria <strong className="font-semibold">{fatiaNome}</strong>{" "}
                    do gráfico END PROCESSO: {rows.length} {rows.length === 1 ? "linha" : "linhas"}.
                  </>
                )
              ) : kind === "status" ? (
                isConsolidado ? (
                  <>
                    Processos com número oficial na categoria <strong className="font-semibold">{fatiaNome}</strong>{" "}
                    da coluna STATUS,{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      separadas por PILARES e PSI
                    </strong>{" "}
                    (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}).
                  </>
                ) : (
                  <>
                    Processos com número oficial na categoria <strong className="font-semibold">{fatiaNome}</strong>{" "}
                    da coluna STATUS: {rows.length} {rows.length === 1 ? "linha" : "linhas"}.
                  </>
                )
              ) : isConsolidado ? (
                <>
                  Processos com número oficial na fatia do gráfico,{" "}
                  <strong className="font-semibold text-slate-800 dark:text-slate-100">
                    separados por PILARES e PSI
                  </strong>{" "}
                  (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}).
                </>
              ) : (
                <>
                  Processos com número oficial que entram na fatia do gráfico ({rows.length}{" "}
                  {rows.length === 1 ? "linha" : "linhas"}).
                </>
              )}
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

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50/50 px-4 py-4 dark:bg-slate-950/50 sm:px-5 sm:py-5">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum processo nesta fatia.</p>
          ) : isConsolidado ? (
            <>
              <AlertaFatiaTabelaBloco title="PILARES" accent={ACCENT_PILARES} rows={pilaresRows} />
              <AlertaFatiaTabelaBloco title="PSI" accent={ACCENT_PSI} rows={psiRows} />
            </>
          ) : (
            <AlertaFatiaTabelaBloco
              title={blocoTitulo}
              accent={blocoTitulo === "PSI" ? ACCENT_PSI : ACCENT_PILARES}
              rows={rows}
            />
          )}
        </div>
      </div>
    </div>
  );
}
