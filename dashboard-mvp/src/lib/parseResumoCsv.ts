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

type ProcessoField = Exclude<keyof ProcessoRow, "bloco">;

type HeaderMap = Partial<Record<ProcessoField, number>> & {
  situacaoFallback: number | null;
};

const HEADER_ALIASES: Record<ProcessoField, string[]> = {
  processo: ["PROCESSO"],
  item: ["ITEM OBJETO SIMPLIFICADO"],
  valor: ["VALOR"],
  onde: ["ONDE ESTA O PROCESSO"],
  ultimaMovimentacao: ["ULTIMA MOVIMENTACAO"],
  standByDias: ["STAND BY", "STANDBY", "STAND BY DIAS"],
  alerta: ["ALERTA CRIT", "ALERTA", "ALERTA CRITICO"],
  startProcesso: ["START PROCESSO"],
  endProcesso: ["END PROCESSO"],
  diasEmCurso: ["DIAS EM CURSO"],
  termoEnc: ["TERMO ENC", "TERMO ENCERRAMENTO"],
  responsavel: ["RESPONSAVEL"],
  alocacaoFocal: ["ALOCACAO FOCAL"],
  situacao: ["SITUACAO DOS PROCESSOS", "SITUACAO"],
};

function normalizeHeaderCell(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulCells(cols: string[]): string[] {
  return cols.map((cell) => normalizeHeaderCell(cell)).filter(Boolean);
}

function findHeaderIndex(normalizedCols: string[], aliases: string[]): number | null {
  for (let i = 0; i < normalizedCols.length; i++) {
    if (aliases.includes(normalizedCols[i])) return i;
  }
  return null;
}

function isHeaderRow(cols: string[]): boolean {
  const normalized = meaningfulCells(cols);
  return normalized.includes("PROCESSO") && normalized.includes("ITEM OBJETO SIMPLIFICADO");
}

function buildHeaderMap(cols: string[]): HeaderMap {
  const normalized = cols.map((cell) => normalizeHeaderCell(cell));
  const map: HeaderMap = { situacaoFallback: null };

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[ProcessoField, string[]]>) {
    const index = findHeaderIndex(normalized, aliases);
    if (index != null) map[field] = index;
  }

  if (map.situacao == null && map.valor != null) {
    for (let i = map.valor - 1; i >= 0; i--) {
      if ((cols[i] ?? "").trim() === "") {
        map.situacaoFallback = i;
        break;
      }
    }
  }

  return map;
}

function detectSectionBanner(cols: string[]): Bloco | null {
  const normalized = meaningfulCells(cols);
  if (normalized.length === 0) return null;
  if (normalized.length <= 2 && normalized.includes("PILARES")) return "PILARES";
  if (normalized.length <= 2 && normalized.includes("PSI")) return "PSI";
  return null;
}

/** Linha só com totais (ex.: `;;;117943909.94`). */
function isTotalRow(cols: string[], headerMap: HeaderMap | null): boolean {
  const pad = (i: number | null | undefined) => (i == null ? "" : (cols[i] ?? "").trim());
  const processo = pad(headerMap?.processo);
  const item = pad(headerMap?.item);
  if (processo || item) return false;

  const valor = pad(headerMap?.valor);
  const nonEmpty = cols.map((cell) => cell.trim()).filter(Boolean);
  if (!valor) return nonEmpty.length === 1 && parseValorCell(nonEmpty[0]) != null;
  return parseValorCell(valor) != null && nonEmpty.length <= 2;
}

function rowToProcesso(cols: string[], bloco: Bloco, headerMap: HeaderMap): ProcessoRow | null {
  const pad = (field: ProcessoField) => {
    const index = headerMap[field];
    return index == null ? "" : (cols[index] ?? "").trim();
  };

  const processo = pad("processo");
  const item = pad("item");
  if (!processo && !item) return null;
  if (/^PILARES$/i.test(processo) || /^PSI$/i.test(processo)) return null;
  if (isHeaderRow(cols) || isTotalRow(cols, headerMap)) return null;

  const valor = parseValorCell(pad("valor"));
  const onde = pad("onde");
  const ultimaMovimentacao = parseDataIso(pad("ultimaMovimentacao")) ?? "";
  const standByDias = parseNumDias(pad("standByDias"));
  const alerta = mapAlerta(pad("alerta"));
  const startProcesso = parseDataIso(pad("startProcesso"));
  const endProcesso = parseDataIso(pad("endProcesso"));
  const diasEmCurso = parseNumDias(pad("diasEmCurso"));
  const termoEnc = pad("termoEnc") || "—";
  const responsavel = pad("responsavel") || null;
  const alocacaoFocal = pad("alocacaoFocal") || null;
  const situacaoExplicit = pad("situacao");
  const situacaoFallback =
    headerMap.situacaoFallback == null ? "" : (cols[headerMap.situacaoFallback] ?? "").trim();
  const situacao = situacaoExplicit || situacaoFallback || "";

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
  let headerMap: HeaderMap | null = null;

  for (const cols of matrix) {
    const detectedBloco = detectSectionBanner(cols);
    if (detectedBloco) {
      bloco = detectedBloco;
      headerMap = null;
      continue;
    }

    if (isHeaderRow(cols)) {
      headerMap = buildHeaderMap(cols);
      continue;
    }

    if (!headerMap) continue;
    if (isTotalRow(cols, headerMap)) continue;

    const row = rowToProcesso(cols, bloco, headerMap);
    if (row) out.push(row);
  }

  return out;
}
