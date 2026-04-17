import { parseCsvSemicolon } from "./parseResumoCsv";

export type ComponentesBloco = "PILARES" | "PSI";

export interface ComponenteGestaoRow {
  bloco: ComponentesBloco;
  componente: string;
  disponibilizado: number | null;
  contrapartida: number | null;
  disponTotal: number | null;
  comprometido: number | null;
  jaExecutado: number | null;
  saldoReal: number | null;
  saldoProj: number | null;
}

function parseNumCell(s: string): number | null {
  const t = (s || "").trim();
  if (!t || t === "-" || t === "—") return null;
  const normalized = t.replace(/\s/g, "");
  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");

  let canonical = normalized;
  if (hasDot && hasComma) {
    canonical = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    canonical = normalized.replace(",", ".");
  } else {
    canonical = normalized;
  }

  const n = Number(canonical);
  return Number.isFinite(n) ? n : null;
}

function meaningful(cols: string[]): string[] {
  return cols.map((c) => (c || "").trim()).filter(Boolean);
}

function detectBloco(cols: string[]): ComponentesBloco | null {
  const m = meaningful(cols).map((s) => s.toUpperCase());
  if (m.length === 1 && m[0] === "PSI") return "PSI";
  if (m.length === 1 && m[0] === "PILARES") return "PILARES";
  return null;
}

function isHeader(cols: string[]): boolean {
  const m = meaningful(cols).map((s) => s.toUpperCase());
  return m.includes("COMPONENTE") && m.includes("DISPONIBILIZADO") && m.includes("COMPROMETIDO");
}

function rowToComponente(cols: string[], bloco: ComponentesBloco): ComponenteGestaoRow | null {
  const componente = (cols[2] ?? "").trim();
  if (!componente) return null;
  return {
    bloco,
    componente,
    disponibilizado: parseNumCell(cols[3] ?? ""),
    contrapartida: parseNumCell(cols[4] ?? ""),
    disponTotal: parseNumCell(cols[5] ?? ""),
    comprometido: parseNumCell(cols[6] ?? ""),
    jaExecutado: parseNumCell(cols[7] ?? ""),
    saldoReal: parseNumCell(cols[8] ?? ""),
    saldoProj: parseNumCell(cols[9] ?? ""),
  };
}

export function parseGestaoComponentesCsv(text: string): ComponenteGestaoRow[] {
  const matrix = parseCsvSemicolon(text);
  const out: ComponenteGestaoRow[] = [];
  let bloco: ComponentesBloco | null = null;
  let insideTable = false;

  for (const cols of matrix) {
    const detected = detectBloco(cols);
    if (detected) {
      bloco = detected;
      insideTable = false;
      continue;
    }
    if (!bloco) continue;
    if (isHeader(cols)) {
      insideTable = true;
      continue;
    }
    if (!insideTable) continue;

    const row = rowToComponente(cols, bloco);
    if (!row) continue;
    out.push(row);
  }

  return out;
}
