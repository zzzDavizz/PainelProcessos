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

/**
 * Normaliza células de data para `YYYY-MM-DD` (ou `null` se não for reconhecível).
 * Aceita ISO com hora, `DD/MM/AAAA` (planilha PT) e `MM/DD/AAAA` quando o 2.º grupo > 12.
 */
export function parseDataIso(s: string): string | null {
  const t = (s || "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const isoPrefix = t.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (isoPrefix) return isoPrefix[1];
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const y = m[3];
    let day: string;
    let month: string;
    if (a > 12) {
      day = m[1].padStart(2, "0");
      month = m[2].padStart(2, "0");
    } else if (b > 12) {
      month = m[1].padStart(2, "0");
      day = m[2].padStart(2, "0");
    } else {
      day = m[1].padStart(2, "0");
      month = m[2].padStart(2, "0");
    }
    const mm = parseInt(month, 10);
    const dd = parseInt(day, 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${y}-${month}-${day}`;
  }
  return null;
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
  contabilizar: number | null;
};

const HEADER_ALIASES: Record<ProcessoField, string[]> = {
  processo: ["PROCESSO"],
  componente: ["COMPONENTE", "ATIVIDADE"],
  item: ["ITEM OBJETO SIMPLIFICADO"],
  status: ["STATUS"],
  valor: ["VALOR TOTAL", "VALOR"],
  onde: ["ONDE ESTA O PROCESSO"],
  proximaDataAlvo: ["PROXIMA DATA ALVO"],
  ultimaMovimentacao: ["ULTIMA MOVIMENTACAO"],
  standByDias: ["STAND BY", "STANDBY", "STAND BY DIAS"],
  alerta: ["ALERTA CRIT", "ALERTA", "ALERTA CRITICO"],
  startProcesso: ["START PROCESSO"],
  endProcesso: ["END PROCESSO"],
  diasEmCurso: ["DIAS EM CURSO"],
  termoEnc: ["TERMO ENC", "TERMO ENCERRAMENTO"],
  dfd: ["DFD"],
  trd: ["TRD", "TDR"],
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
  for (const alias of aliases) {
    for (let i = 0; i < normalizedCols.length; i++) {
      if (normalizedCols[i] === alias) return i;
    }
  }
  return null;
}

function isHeaderRow(cols: string[]): boolean {
  const normalized = meaningfulCells(cols);
  return normalized.includes("PROCESSO") && normalized.includes("ITEM OBJETO SIMPLIFICADO");
}

function buildHeaderMap(cols: string[]): HeaderMap {
  const normalized = cols.map((cell) => normalizeHeaderCell(cell));
  const map: HeaderMap = { situacaoFallback: null, contabilizar: null };

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[ProcessoField, string[]]>) {
    const index = findHeaderIndex(normalized, aliases);
    if (index != null) map[field] = index;
  }

  map.contabilizar = findHeaderIndex(normalized, [
    "DADOS DEVEM CONTABILIZAR",
    "DADOS DEVEM CONTABILIZAR ?",
    "DADOS DEVEM CONTABILIZAR?",
  ]);

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

function shouldIncludeRow(cols: string[], headerMap: HeaderMap): boolean {
  const idx = headerMap.contabilizar;
  if (idx == null) return true;
  const raw = (cols[idx] ?? "").trim();
  if (!raw) return true;
  const normalized = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return normalized !== "nao";
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
  const componente = pad("componente") || null;
  const item = pad("item");
  if (!processo && !item) return null;
  if (/^PILARES$/i.test(processo) || /^PSI$/i.test(processo)) return null;
  if (isHeaderRow(cols) || isTotalRow(cols, headerMap)) return null;

  const status = pad("status") || null;
  const valor = parseValorCell(pad("valor"));
  const onde = pad("onde");
  const ultimaMovimentacao = parseDataIso(pad("ultimaMovimentacao")) ?? "";
  const standByDias = parseNumDias(pad("standByDias"));
  const alerta = mapAlerta(pad("alerta"));
  const startProcesso = parseDataIso(pad("startProcesso"));
  const endProcesso = parseDataIso(pad("endProcesso"));
  const diasEmCurso = parseNumDias(pad("diasEmCurso"));
  const termoEnc = pad("termoEnc") || "—";
  const dfd = pad("dfd") || "—";
  const trd = pad("trd") || "—";
  const proximaDataAlvo = parseDataIso(pad("proximaDataAlvo")) ?? (pad("proximaDataAlvo") || null);
  const responsavel = pad("responsavel") || null;
  const alocacaoFocal = pad("alocacaoFocal") || null;
  const situacaoExplicit = pad("situacao");
  const situacaoFallback =
    headerMap.situacaoFallback == null ? "" : (cols[headerMap.situacaoFallback] ?? "").trim();
  const situacao = situacaoExplicit || situacaoFallback || "";

  return {
    bloco,
    processo: processo || "—",
    componente,
    item: item || "—",
    status,
    valor,
    onde,
    ultimaMovimentacao,
    standByDias,
    alerta,
    startProcesso,
    endProcesso,
    diasEmCurso,
    termoEnc,
    dfd,
    trd,
    proximaDataAlvo,
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
    if (!shouldIncludeRow(cols, headerMap)) continue;

    const row = rowToProcesso(cols, bloco, headerMap);
    if (row) out.push(row);
  }

  return out;
}
