"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ProcessoRow } from "@/lib/types";
import { ONDE_VAZIO_LABEL } from "@/lib/aggregations";
import { formatBRL } from "@/lib/format";

function formatDataBR(iso: string): string {
  if (!iso?.trim()) return "—";
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

const DEFAULT_COLS = [
  { key: "processo" as const, label: "Processo" },
  { key: "item" as const, label: "ITEM/OBJETO - SIMPLIFICADO" },
  { key: "valor" as const, label: "VALOR TOTAL" },
  { key: "onde" as const, label: "ONDE ESTÁ O PROCESSO?" },
  { key: "ultimaMovimentacao" as const, label: "ÚLTIMA MOVIMENTAÇÃO" },
  { key: "responsavel" as const, label: "RESPONSÁVEL" },
  { key: "situacao" as const, label: "SITUAÇÃO DOS PROCESSOS" },
];

const DIAS_EM_CURSO_COLS = [
  { key: "processo" as const, label: "Processo" },
  { key: "valor" as const, label: "VALOR TOTAL" },
  { key: "onde" as const, label: "ONDE ESTÁ O PROCESSO?" },
  { key: "ultimaMovimentacao" as const, label: "ÚLTIMA MOVIMENTAÇÃO" },
  { key: "startProcesso" as const, label: "START PROCESSO" },
  { key: "diasEmCurso" as const, label: "DIAS EM CURSO" },
  { key: "termoEnc" as const, label: "TERMO ENC." },
] as const;

type ModalColumn = (typeof DEFAULT_COLS)[number] | (typeof DIAS_EM_CURSO_COLS)[number];

function cellValue(row: ProcessoRow, key: ModalColumn["key"]): string {
  switch (key) {
    case "valor":
      return row.valor != null ? formatBRL(row.valor) : "—";
    case "ultimaMovimentacao":
      return formatDataBR(row.ultimaMovimentacao);
    case "startProcesso":
      return row.startProcesso ? formatDataBR(row.startProcesso) : "—";
    case "diasEmCurso":
      return row.diasEmCurso != null ? `${row.diasEmCurso}` : "—";
    case "responsavel":
      return row.responsavel?.trim() || "—";
    case "onde":
      return row.onde?.trim() ? row.onde.trim() : ONDE_VAZIO_LABEL;
    default:
      return String(row[key] ?? "—").trim() || "—";
  }
}

function BlocoTable({
  title,
  accent,
  rows,
  columns,
}: {
  title: string;
  accent: string;
  rows: ProcessoRow[];
  columns: readonly ModalColumn[];
}) {
  return (
    <div className="mb-8 last:mb-0">
      <h3
        className="mb-2 border-b-2 pb-1 text-sm font-bold uppercase tracking-wide"
        style={{ borderColor: accent, color: accent }}
      >
        {title}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
        <table className="w-full min-w-[980px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="whitespace-nowrap border border-slate-300 px-2 py-2 font-semibold dark:border-slate-600"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="border border-slate-200 px-3 py-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400"
                >
                  Nenhum processo nesta categoria.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr
                  key={`${r.bloco}-${r.processo}-${idx}`}
                  className={
                    idx % 2 === 0
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-50/80 dark:bg-slate-900/80"
                  }
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className="max-w-[220px] border border-slate-200 px-2 py-1.5 align-top text-slate-800 dark:border-slate-700 dark:text-slate-200"
                    >
                      <span className="line-clamp-3 break-words">{cellValue(r, c.key)}</span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type KpiDetailModalProps = {
  open: boolean;
  onClose: () => void;
  heading: string;
  subheading?: string;
  pilares: ProcessoRow[];
  psi: ProcessoRow[];
  columns?: readonly ModalColumn[];
};

export function KpiDetailModal({
  open,
  onClose,
  heading,
  subheading,
  pilares,
  psi,
  columns = DEFAULT_COLS,
}: KpiDetailModalProps) {
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
        aria-labelledby="kpi-detail-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:shadow-black/40"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/90 sm:px-5 sm:py-4">
          <div className="min-w-0 pr-2">
            <h2
              id="kpi-detail-title"
              className="text-base font-bold text-slate-900 dark:text-white sm:text-lg"
            >
              {heading}
            </h2>
            {subheading ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">{subheading}</p>
            ) : null}
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
          <BlocoTable title="PILARES" accent="#2563eb" rows={pilares} columns={columns} />
          <BlocoTable title="PSI" accent="#dc2626" rows={psi} columns={columns} />
        </div>
      </div>
    </div>
  );
}
