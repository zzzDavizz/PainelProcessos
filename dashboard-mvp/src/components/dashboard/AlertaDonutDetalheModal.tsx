"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import type { ProcessoRow } from "@/lib/types";
import { formatOndeBucketLabel, ONDE_VAZIO_LABEL } from "@/lib/aggregations";
import { formatBRL, formatDataUltimaMovimentacaoBR } from "@/lib/format";

function formatStartProcessoBR(iso: string | null | undefined): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
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

function AlertaFatiaTabelaBloco({
  title,
  accent,
  rows,
}: {
  title: string;
  accent: string;
  rows: ProcessoRow[];
}) {
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
        <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
          <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                <th className="whitespace-nowrap border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600">
                  PROCESSO
                </th>
                <th className="whitespace-nowrap border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600">
                  VALOR TOTAL
                </th>
                <th className="whitespace-nowrap border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600">
                  ONDE ESTÁ O PROCESSO?
                </th>
                <th className="whitespace-nowrap border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600">
                  ÚLTIMA MOVIMENTAÇÃO
                </th>
                <th className="whitespace-nowrap border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600">
                  START PROCESSO
                </th>
                <th className="whitespace-nowrap border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600">
                  TERMO ENC.
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={`${title}-${r.processo}-${idx}`}
                  className={
                    idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/80 dark:bg-slate-900/80"
                  }
                >
                  <td className="max-w-[200px] border border-slate-200 px-2 py-1.5 align-top text-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <span className="line-clamp-3 break-words">{r.processo}</span>
                  </td>
                  <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5 tabular-nums text-slate-800 dark:border-slate-700 dark:text-slate-200">
                    {r.valor != null ? formatBRL(r.valor) : "—"}
                  </td>
                  <td className="max-w-[180px] border border-slate-200 px-2 py-1.5 align-top text-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <span className="line-clamp-2 break-words">{ondeLabel(r)}</span>
                  </td>
                  <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5 tabular-nums text-slate-800 dark:border-slate-700 dark:text-slate-200">
                    {formatDataUltimaMovimentacaoBR(r.ultimaMovimentacao)}
                  </td>
                  <td className="whitespace-nowrap border border-slate-200 px-2 py-1.5 tabular-nums text-slate-800 dark:border-slate-700 dark:text-slate-200">
                    {formatStartProcessoBR(r.startProcesso)}
                  </td>
                  <td className="max-w-[160px] border border-slate-200 px-2 py-1.5 align-top text-slate-800 dark:border-slate-700 dark:text-slate-200">
                    <span className="line-clamp-2 break-words">{r.termoEnc?.trim() || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export type AlertaDonutDetalheKind = "alertas" | "alocacaoFocal" | "termoEnc" | "onde" | "endProcesso";

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
                    Processos com número oficial na categoria <strong className="font-semibold">{fatiaNome}</strong>{" "}
                    (coluna ALOCAÇÃO FOCAL),{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      separados por PILARES e PSI
                    </strong>{" "}
                    (total {rows.length} {rows.length === 1 ? "linha" : "linhas"}).
                  </>
                ) : (
                  <>
                    Processos com número oficial na categoria <strong className="font-semibold">{fatiaNome}</strong>{" "}
                    (coluna ALOCAÇÃO FOCAL): {rows.length} {rows.length === 1 ? "linha" : "linhas"}.
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
