import type { Bloco, ProcessoRow } from "./types";

export function filterByBloco(rows: ProcessoRow[], bloco: Bloco | "ALL"): ProcessoRow[] {
  if (bloco === "ALL") return rows;
  return rows.filter((r) => r.bloco === bloco);
}

/**
 * Padrão típico na coluna PROCESSO (ex.: 00071.004462/2025-29).
 * Se existir, a linha conta como criada mesmo que ainda haja texto residual na célula (export/merge).
 */
function pareceNumeroOficialProcesso(raw: string): boolean {
  const t = raw.trim();
  return /\d{3,}\.\d+\/\d{4}-\d+/i.test(t);
}

/**
 * Processo sem número oficial na coluna PROCESSO (planilha: "Pendente Criação", variações de maiúsculas).
 * Não entra no total "com processo criado".
 */
export function isPendenteCriacaoProcesso(row: Pick<ProcessoRow, "processo">): boolean {
  const raw = (row.processo ?? "").trim();
  if (pareceNumeroOficialProcesso(raw)) return false;
  const t = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return t === "pendente criacao";
}

export function apenasProcessosComNumeroOficial(rows: ProcessoRow[]): ProcessoRow[] {
  return rows.filter((r) => !isPendenteCriacaoProcesso(r));
}

export function contarPendentesCriacao(rows: ProcessoRow[]): number {
  return rows.filter(isPendenteCriacaoProcesso).length;
}

/** Cores estáveis para barras — alinhadas ao tema do painel. */
const ONDE_PALETTE = [
  "#2563eb",
  "#22c55e",
  "#ef4444",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#64748b",
  "#ec4899",
];

export interface OndeBarRow {
  name: string;
  /** % do total de processos no card */
  v: number;
  fill: string;
  count: number;
  /** Soma da coluna VALOR (`valor`) naquele local */
  valorTotal: number;
  /** % do valor monetário total do card */
  pctValor: number;
}

type OndeAgg = { count: number; valor: number };

/** Rótulo no gráfico quando a coluna "ONDE ESTÁ O PROCESSO?" está vazia na planilha. */
export const ONDE_VAZIO_LABEL = "vazio";

const ONDE_VAZIO_FILL = "#94a3b8";

/**
 * Soma dos valores (`valor`) de todos os processos do conjunto (ex.: card PILARES).
 */
export function valorTotalProcessos(rows: ProcessoRow[]): number {
  return rows.reduce((s, r) => s + (r.valor ?? 0), 0);
}

function normalizeOndeKey(onde: string): string {
  const t = onde.trim();
  return t.length > 0 ? t : ONDE_VAZIO_LABEL;
}

/**
 * Agrupa por coluna "ONDE ESTÁ O PROCESSO?" (campo `onde`).
 * Células vazias viram uma única fatia "vazio".
 * Mostra até `maxRotulos` rótulos; o restante entra em "Demais".
 */
export function distribuicaoPorOnde(rows: ProcessoRow[], maxRotulos = 8): OndeBarRow[] {
  const map = new Map<string, OndeAgg>();
  for (const r of rows) {
    const key = normalizeOndeKey(r.onde ?? "");
    const cur = map.get(key) ?? { count: 0, valor: 0 };
    cur.count += 1;
    cur.valor += r.valor ?? 0;
    map.set(key, cur);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  const totalProc = rows.length || 1;
  const somaValores = valorTotalProcessos(rows);

  let entries: [string, OndeAgg][];
  if (sorted.length <= maxRotulos) {
    entries = sorted.map(([k, agg]) => [k, agg]);
  } else {
    const top = sorted.slice(0, maxRotulos - 1);
    const rest = sorted.slice(maxRotulos - 1);
    const restAgg: OndeAgg = rest.reduce(
      (acc, [, a]) => ({
        count: acc.count + a.count,
        valor: acc.valor + a.valor,
      }),
      { count: 0, valor: 0 },
    );
    entries = [...top, ["Demais", restAgg]];
  }

  let paletteIdx = 0;
  return entries.map(([name, agg]) => {
    const isVazio = name === ONDE_VAZIO_LABEL;
    const fill = isVazio ? ONDE_VAZIO_FILL : ONDE_PALETTE[paletteIdx++ % ONDE_PALETTE.length];
    return {
      name,
      v: pct(agg.count, totalProc),
      fill,
      count: agg.count,
      valorTotal: agg.valor,
      pctValor: somaValores > 0 ? pct(agg.valor, somaValores) : 0,
    };
  });
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export interface HealthSlice {
  name: string;
  value: number;
  color: string;
}

export function healthDonut(rows: ProcessoRow[]): HealthSlice[] {
  let c = 0,
    a = 0,
    ok = 0;
  for (const r of rows) {
    if (r.alerta === "CRÍTICO") c++;
    else if (r.alerta === "ATENÇÃO") a++;
    else ok++;
  }
  const t = rows.length || 1;
  return [
    { name: "Crítico", value: pct(c, t), color: "#dc2626" },
    { name: "Atenção", value: pct(a, t), color: "#eab308" },
    { name: "OK", value: pct(ok, t), color: "#16a34a" },
  ];
}

export interface KpiGlobal {
  /** Processos com número oficial (exclui "Pendente Criação"). */
  totalProcessos: number;
  /** Linhas com PROCESSO = pendente de criação (só legenda / contexto). */
  pendenteCriacao: number;
  /** Processos criados com alerta CRÍTICO (base do % em relação ao total de criados). */
  alertasCriticos: number;
  /** Todas as linhas com ALERTA = CRÍTICO (inclui pendentes de criação). */
  criticosTotal: number;
  /** Entre as linhas críticas, quantas ainda não têm número de processo ("Pendente Criação"). */
  criticosSemProcessoCriado: number;
  pctCriticos: number;
  standbyMedio: number;
  diasEmCursoMedio: number;
  semEnd: number;
}

export function kpisGlobais(rows: ProcessoRow[]): KpiGlobal {
  const criados = apenasProcessosComNumeroOficial(rows);
  const total = criados.length;
  const pendenteCriacao = contarPendentesCriacao(rows);
  const criticos = criados.filter((r) => r.alerta === "CRÍTICO").length;
  const linhasCriticas = rows.filter((r) => r.alerta === "CRÍTICO");
  const criticosTotal = linhasCriticas.length;
  const criticosSemProcessoCriado = linhasCriticas.filter((r) => isPendenteCriacaoProcesso(r)).length;
  const standbyVals = criados.map((r) => r.standByDias).filter((n): n is number => n != null);
  const standbyMedio =
    standbyVals.length > 0
      ? Math.round(standbyVals.reduce((s, n) => s + n, 0) / standbyVals.length)
      : 0;
  const diasVals = criados.map((r) => r.diasEmCurso).filter((n): n is number => n != null);
  const diasEmCursoMedio =
    diasVals.length > 0
      ? Math.round(diasVals.reduce((s, n) => s + n, 0) / diasVals.length)
      : 0;
  const semEnd = criados.filter((r) => !r.endProcesso).length;
  return {
    totalProcessos: total,
    pendenteCriacao,
    alertasCriticos: criticos,
    criticosTotal,
    criticosSemProcessoCriado,
    pctCriticos: pct(criticos, total),
    standbyMedio,
    diasEmCursoMedio,
    semEnd,
  };
}

export interface BlocoResumo {
  /** Com número de processo (exclui "Pendente Criação"). */
  total: number;
  pendenteCriacao: number;
  pctCriticos: number;
  standbyMedio: number;
  diasEmCursoMedio: number;
}

export function resumoBloco(rows: ProcessoRow[]): BlocoResumo {
  const criados = apenasProcessosComNumeroOficial(rows);
  const total = criados.length;
  const pendenteCriacao = contarPendentesCriacao(rows);
  const crit = criados.filter((r) => r.alerta === "CRÍTICO").length;
  const standbyVals = criados.map((r) => r.standByDias).filter((n): n is number => n != null);
  const standbyMedio =
    standbyVals.length > 0
      ? Math.round(standbyVals.reduce((s, n) => s + n, 0) / standbyVals.length)
      : 0;
  const diasVals = criados.map((r) => r.diasEmCurso).filter((n): n is number => n != null);
  const diasEmCursoMedio =
    diasVals.length > 0
      ? Math.round(diasVals.reduce((s, n) => s + n, 0) / diasVals.length)
      : 0;
  return {
    total,
    pendenteCriacao,
    pctCriticos: pct(crit, total),
    standbyMedio,
    diasEmCursoMedio,
  };
}

/** Score 0–100: maior = melhor desempenho (menos dias, menos alertas, menos standby). */
export function scoreResponsavel(rows: ProcessoRow[], nome: string): number {
  const mine = rows.filter(
    (r) => (r.responsavel || "").trim().toLowerCase() === nome.toLowerCase(),
  );
  if (mine.length === 0) return 50;
  const diasList = mine.map((r) => r.diasEmCurso).filter((n): n is number => n != null);
  const avgDias =
    diasList.length > 0 ? diasList.reduce((a, b) => a + b, 0) / diasList.length : 90;
  const crit = mine.filter((r) => r.alerta === "CRÍTICO").length;
  const aten = mine.filter((r) => r.alerta === "ATENÇÃO").length;
  const sbAvg =
    mine.map((r) => r.standByDias ?? 0).reduce((a, b) => a + b, 0) / mine.length;
  let score = 100;
  score -= Math.min(avgDias / 5, 48);
  score -= crit * 10;
  score -= aten * 3;
  score -= Math.min(sbAvg * 0.8, 18);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankingResponsaveis(
  rows: ProcessoRow[],
  order: "worst" | "best",
): { nome: string; score: number; processos: number; avgDias: number }[] {
  const map = new Map<string, ProcessoRow[]>();
  for (const r of rows) {
    const n = (r.responsavel || "").trim();
    if (!n) continue;
    const k = n;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  const list = [...map.entries()].map(([nome, rs]) => {
    const dias = rs.map((x) => x.diasEmCurso).filter((x): x is number => x != null);
    const avgDias =
      dias.length > 0 ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : 0;
    return {
      nome,
      score: scoreResponsavel(rows, nome),
      processos: rs.length,
      avgDias,
    };
  });
  list.sort((a, b) => (order === "worst" ? a.score - b.score : b.score - a.score));
  return list;
}

export function topAtrasados(rows: ProcessoRow[], n = 3): ProcessoRow[] {
  return [...rows]
    .filter((r) => r.diasEmCurso != null)
    .sort((a, b) => (b.diasEmCurso ?? 0) - (a.diasEmCurso ?? 0))
    .slice(0, n);
}

export function searchRows(rows: ProcessoRow[], q: string): ProcessoRow[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter(
    (r) =>
      r.processo.toLowerCase().includes(s) ||
      r.item.toLowerCase().includes(s) ||
      (r.responsavel || "").toLowerCase().includes(s) ||
      r.onde.toLowerCase().includes(s),
  );
}
