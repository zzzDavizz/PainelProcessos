import type { AlertaNivel, Bloco, ProcessoRow } from "./types";

/** Divide o ficheiro em linhas de campos (delimitador `;`, aspas RFC4180). */
export function parseCsvSemicolon(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ";") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      cur = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function parseNumDias(s: string): number | null {
  const m = (s || "").trim().match(/^(\d+)\s*Dias?$/i);
  if (!m) return null;
  return parseInt(m[1], 10);
}

function parseValorCell(s: string): number | null {
  const t = (s || "").trim();
  if (t === "" || t === "-" || t === "—") return null;
  const n = parseFloat(t.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDataIso(s: string): string | null {
  const t = (s || "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  return t;
}

function mapAlerta(raw: string): AlertaNivel {
  const u = (raw || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (u === "CRÍTICO" || u === "CRITICO") return "CRÍTICO";
  if (u === "ATENÇÃO" || u === "ATENCAO") return "ATENÇÃO";
  if (u === "SEM DATA" || u === "SEM_DATA") return "ATENÇÃO";
  if (u === "OK") return "OK";
  return "OK";
}

function isHeaderRow(cols: string[]): boolean {
  const a = (cols[0] || "").trim().toUpperCase();
  const b = (cols[1] || "").toUpperCase();
  return a === "PROCESSO" && b.includes("ITEM");
}

/** Linha só com totais (ex.: `;;;117943909.94`). */
function isTotalRow(cols: string[]): boolean {
  const p = (cols[0] || "").trim();
  const it = (cols[1] || "").trim();
  if (p || it) return false;
  const v = (cols[3] || "").trim();
  if (!v) return false;
  return /^-?\d+(\.\d+)?$/.test(v.replace(",", "."));
}

/** Título PSI em célula mesclada (texto longo mas contém só "PSI" como secção). */
function isPsiSectionBanner(cols: string[]): boolean {
  const a = (cols[0] || "").trim();
  if (/^PSI$/i.test(a)) return false;
  return /\bPSI\b/i.test(a) && !isHeaderRow(cols);
}

function rowToProcesso(cols: string[], bloco: Bloco): ProcessoRow | null {
  const pad = (i: number) => (cols[i] ?? "").trim();
  const processo = pad(0);
  const item = pad(1);
  if (!processo && !item) return null;
  if (/^PILARES$/i.test(processo) || /^PSI$/i.test(processo)) return null;
  if (isHeaderRow(cols) || isTotalRow(cols)) return null;

  const valor = parseValorCell(pad(3));
  const onde = pad(4);
  const ultimaMovimentacao = parseDataIso(pad(5)) ?? "";
  const standByDias = parseNumDias(pad(6));
  const alerta = mapAlerta(pad(7));
  const startProcesso = parseDataIso(pad(8));
  const endProcesso = parseDataIso(pad(9));
  const diasEmCurso = parseNumDias(pad(10));
  const termoEnc = pad(11) || "—";
  const responsavel = pad(12) || null;
  const alocacaoFocal = pad(13) || null;
  const situacao = pad(14) || "";

  return {
    bloco,
    processo: processo || "—",
    item: item || "—",
    valor,
    onde,
    ultimaMovimentacao,
    standByDias,
    alerta,
    startProcesso,
    endProcesso,
    diasEmCurso,
    termoEnc,
    responsavel,
    alocacaoFocal,
    situacao,
  };
}

/**
 * Converte o CSV exportado da aba RESUMO (blocos PILARES e PSI) em `ProcessoRow[]`.
 */
export function parseResumoPainelCsv(text: string): ProcessoRow[] {
  const matrix = parseCsvSemicolon(text);
  const out: ProcessoRow[] = [];
  let bloco: Bloco = "PILARES";

  for (const cols of matrix) {
    if (cols.length < 8) continue;

    const titulo = (cols[0] ?? "").trim();
    if (/^PILARES$/i.test(titulo)) {
      bloco = "PILARES";
      continue;
    }
    if (/^PSI$/i.test(titulo) || isPsiSectionBanner(cols)) {
      bloco = "PSI";
      continue;
    }

    if (isHeaderRow(cols)) {
      continue;
    }

    if (isTotalRow(cols)) continue;

    const row = rowToProcesso(cols, bloco);
    if (row) out.push(row);
  }

  return out;
}
