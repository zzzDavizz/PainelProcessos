import type { Bloco, ProcessoRow } from "@/lib/types";
import { ONDE_VAZIO_LABEL } from "@/lib/aggregations";
import { formatBRL, formatDataUltimaMovimentacaoBR } from "@/lib/format";

/** Cabeçalhos alinhados à aba RESUMO + coluna BLOCO. */
const HEADERS = [
  "BLOCO",
  "PROCESSO",
  "ITEM/OBJETO - SIMPLIFICADO",
  "",
  "VALOR TOTAL",
  "ONDE ESTÁ O PROCESSO?",
  "ÚLTIMA MOVIMENTAÇÃO",
  "STANDBY (DIAS)",
  "ALERTA",
  "START PROCESSO",
  "END PROCESSO",
  "DIAS EM CURSO",
  "TERMO ENC.",
  "DFD",
  "TRD",
  "RESPONSÁVEL",
  "ALOCAÇÃO FOCAL",
  "SITUAÇÃO DOS PROCESSOS",
] as const;

const COL_COUNT = HEADERS.length;

function cellStandby(r: ProcessoRow): string {
  if (r.standByDias == null) return "—";
  return `${r.standByDias}`;
}

function cellDiasEmCurso(r: ProcessoRow): string {
  if (r.diasEmCurso == null) return "—";
  return `${r.diasEmCurso}`;
}

function cellData(iso: string | null | undefined): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
  return formatDataUltimaMovimentacaoBR(s);
}

function cellOnde(r: ProcessoRow): string {
  const t = (r.onde ?? "").trim();
  return t ? t : ONDE_VAZIO_LABEL;
}

function cellText(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t || "—";
}

function rowToCells(r: ProcessoRow): string[] {
  return [
    r.bloco,
    cellText(r.processo),
    cellText(r.item),
    "",
    r.valor != null ? formatBRL(r.valor) : "—",
    cellOnde(r),
    cellData(r.ultimaMovimentacao),
    cellStandby(r),
    r.alerta,
    cellData(r.startProcesso),
    cellData(r.endProcesso),
    cellDiasEmCurso(r),
    cellText(r.termoEnc),
    cellText(r.dfd),
    cellText(r.trd),
    cellText(r.responsavel),
    cellText(r.alocacaoFocal),
    cellText(r.situacao),
  ];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sortByProcesso(a: ProcessoRow, b: ProcessoRow): number {
  return (a.processo || "").localeCompare(b.processo || "", "pt-BR");
}

function rowsForBloco(rows: ProcessoRow[], bloco: Bloco): ProcessoRow[] {
  return rows.filter((r) => r.bloco === bloco).sort(sortByProcesso);
}

function headerRowHtml(): string {
  const ths = HEADERS.map((h) => `<th class="th">${escapeHtml(h)}</th>`).join("");
  return `<tr class="hdr">${ths}</tr>`;
}

function bandRowHtml(titulo: "PILARES" | "PSI"): string {
  return `<tr><td colspan="${COL_COUNT}" class="band">${titulo}</td></tr>`;
}

function spacerRowHtml(): string {
  return `<tr><td colspan="${COL_COUNT}" class="spacer"></td></tr>`;
}

function dataRowsHtml(sectionRows: ProcessoRow[]): string {
  if (sectionRows.length === 0) {
    return `<tr class="tr0"><td colspan="${COL_COUNT}" class="td td-empty">Nenhum registo neste bloco.</td></tr>`;
  }
  return sectionRows
    .map((r, idx) => {
      const cells = rowToCells(r)
        .map((c) => `<td class="td">${escapeHtml(c)}</td>`)
        .join("");
      const cls = idx % 2 === 0 ? "tr0" : "tr1";
      return `<tr class="${cls}">${cells}</tr>`;
    })
    .join("");
}

function sectionHtml(bloco: Bloco, rows: ProcessoRow[]): string {
  const subset = rowsForBloco(rows, bloco);
  const titulo = bloco === "PILARES" ? "PILARES" : "PSI";
  return `${bandRowHtml(titulo)}${headerRowHtml()}${dataRowsHtml(subset)}`;
}

/**
 * Exporta para `.xls` (HTML + Excel) com **dois blocos**: faixa vermelha + cabeçalhos + dados
 * para PILARES e, em seguida, o mesmo para PSI (como na planilha RESUMO).
 */
export function exportResumoPlanilhaComoExcel(rows: ProcessoRow[]): void {
  const pilaresPart = sectionHtml("PILARES", rows);
  const psiPart = sectionHtml("PSI", rows);
  const spacer = spacerRowHtml();

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>RESUMO</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; width: 100%; }
.band {
  background: #dc2626;
  color: #ffffff;
  font-weight: bold;
  text-align: center;
  padding: 12px 10px;
  font-size: 14pt;
  letter-spacing: 0.06em;
  border: 1px solid #991b1b;
  mso-number-format:'\\@';
}
.th {
  background: #bfdbfe;
  color: #0f172a;
  border: 1px solid #64748b;
  padding: 8px 10px;
  text-align: left;
  font-weight: bold;
  font-size: 10pt;
  white-space: nowrap;
}
.td {
  border: 1px solid #cbd5e1;
  padding: 6px 10px;
  vertical-align: top;
  color: #0f172a;
  mso-number-format:'\\@';
}
.td-empty { text-align: center; font-style: italic; color: #64748b; }
.tr0 .td { background: #ffffff; }
.tr1 .td { background: #f1f5f9; }
.spacer { height: 8px; padding: 0; border: none; background: #ffffff; }
</style>
</head>
<body>
<table>
<tbody>
${pilaresPart}
${spacer}
${psiPart}
</tbody>
</table>
</body>
</html>`;

  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").slice(0, 12);
  a.href = url;
  a.download = `INTERPI_resumo_processos_${stamp}.xls`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
