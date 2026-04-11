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
  /** % do total de processos criados no card (exclui "Pendente Criação") */
  v: number;
  fill: string;
  count: number;
  /** Linhas "Pendente Criação" naquele local (`onde`) — não entram em `count` nem no % da barra */
  pendenteCriacao: number;
  /** Soma da coluna VALOR (`valor`) naquele local */
  valorTotal: number;
  /** % do valor monetário total do card */
  pctValor: number;
}

type OndeAgg = { count: number; valor: number; pendenteCriacao: number };

/** Rótulo no gráfico quando a coluna "ONDE ESTÁ O PROCESSO?" está vazia na planilha. */
export const ONDE_VAZIO_LABEL = "vazio";

const ONDE_VAZIO_FILL = "#94a3b8";

/**
 * Soma dos valores (`valor`) de todos os processos do conjunto (ex.: card PILARES).
 */
export function valorTotalProcessos(rows: ProcessoRow[]): number {
  return rows.reduce((s, r) => s + (r.valor ?? 0), 0);
}

/** Soma da coluna VALOR só nas linhas “Pendente Criação” (ainda sem processo oficial). */
export function valorTotalPendentesCriacao(rows: ProcessoRow[]): number {
  return rows.reduce((s, r) => s + (isPendenteCriacaoProcesso(r) ? (r.valor ?? 0) : 0), 0);
}

function normalizeOndeKey(onde: string): string {
  const t = onde.trim();
  return t.length > 0 ? t : ONDE_VAZIO_LABEL;
}

export interface DistribuicaoPorOndeOpts {
  /** Uma única cor para todas as barras (ex.: por bloco PILARES/PSI/CONSOLIDADO). */
  uniformBarFill?: string;
}

/**
 * Agrupa por coluna "ONDE ESTÁ O PROCESSO?" (campo `onde`).
 * Células vazias viram uma única fatia "vazio".
 * Mostra até `maxRotulos` rótulos; o restante entra em "Demais".
 */
export function distribuicaoPorOnde(
  rows: ProcessoRow[],
  maxRotulos = 8,
  opts?: DistribuicaoPorOndeOpts,
): OndeBarRow[] {
  const map = new Map<string, OndeAgg>();
  for (const r of rows) {
    const key = normalizeOndeKey(r.onde ?? "");
    const cur = map.get(key) ?? { count: 0, valor: 0, pendenteCriacao: 0 };
    if (isPendenteCriacaoProcesso(r)) cur.pendenteCriacao += 1;
    else cur.count += 1;
    cur.valor += r.valor ?? 0;
    map.set(key, cur);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  const totalCriados = apenasProcessosComNumeroOficial(rows).length;
  const totalProc = totalCriados > 0 ? totalCriados : 1;
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
        pendenteCriacao: acc.pendenteCriacao + a.pendenteCriacao,
      }),
      { count: 0, valor: 0, pendenteCriacao: 0 },
    );
    entries = [...top, ["Demais", restAgg]];
  }

  let paletteIdx = 0;
  return entries.map(([name, agg]) => {
    const isVazio = name === ONDE_VAZIO_LABEL;
    const fill = opts?.uniformBarFill
      ? opts.uniformBarFill
      : isVazio
        ? ONDE_VAZIO_FILL
        : ONDE_PALETTE[paletteIdx++ % ONDE_PALETTE.length];
    return {
      name,
      v: pct(agg.count, totalProc),
      fill,
      count: agg.count,
      pendenteCriacao: agg.pendenteCriacao,
      valorTotal: agg.valor,
      pctValor: somaValores > 0 ? pct(agg.valor, somaValores) : 0,
    };
  });
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Média de dias em STAND BY: soma (valor ou 0 se vazio) / número de linhas do conjunto.
 * Inclui "Pendente Criação"; vazio → 0, para não inflar a média ao excluir essas linhas só do denominador.
 */
export function mediaStandbyPainel(rows: ProcessoRow[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((s, r) => s + (r.standByDias ?? 0), 0);
  return Math.round(sum / rows.length);
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

/**
 * % entre processos com número oficial: coluna END PROCESSO preenchida vs. vazia.
 * Exclui linhas "Pendente Criação" do denominador (mesma base de `kpisGlobais.comDataFim` / `semEnd`).
 */
export function endProcessoDonut(rows: ProcessoRow[]): HealthSlice[] {
  const criados = apenasProcessosComNumeroOficial(rows);
  const t = criados.length || 1;
  let comEnd = 0;
  for (const r of criados) {
    if ((r.endProcesso ?? "").trim()) comEnd++;
  }
  const semEnd = criados.length - comEnd;
  return [
    { name: "Com END", value: pct(comEnd, t), color: "#16a34a" },
    { name: "Sem END", value: pct(semEnd, t), color: "#ea580c" },
  ];
}

export interface KpiGlobal {
  /** Processos com número oficial (exclui "Pendente Criação"). */
  totalProcessos: number;
  /** Linhas com PROCESSO = pendente de criação (só legenda / contexto). */
  pendenteCriacao: number;
  /** Processos criados com alerta CRÍTICO (subconjunto de `criticosTotal`). */
  alertasCriticos: number;
  /** Todas as linhas com ALERTA = CRÍTICO (inclui pendentes de criação). */
  criticosTotal: number;
  /** Entre as linhas críticas, quantas ainda não têm número de processo ("Pendente Criação"). */
  criticosSemProcessoCriado: number;
  /** (criticosTotal / totalProcessos) × 100 — numerador inclui críticos em pendentes. */
  pctCriticos: number;
  standbyMedio: number;
  diasEmCursoMedio: number;
  semEnd: number;
  /** Processos criados com END PROCESSO preenchido. */
  comDataFim: number;
}

export function kpisGlobais(rows: ProcessoRow[]): KpiGlobal {
  const criados = apenasProcessosComNumeroOficial(rows);
  const total = criados.length;
  const pendenteCriacao = contarPendentesCriacao(rows);
  const criticos = criados.filter((r) => r.alerta === "CRÍTICO").length;
  const linhasCriticas = rows.filter((r) => r.alerta === "CRÍTICO");
  const criticosTotal = linhasCriticas.length;
  const criticosSemProcessoCriado = linhasCriticas.filter((r) => isPendenteCriacaoProcesso(r)).length;
  const standbyMedio = mediaStandbyPainel(rows);
  const diasVals = criados.map((r) => r.diasEmCurso).filter((n): n is number => n != null);
  const diasEmCursoMedio =
    diasVals.length > 0
      ? Math.round(diasVals.reduce((s, n) => s + n, 0) / diasVals.length)
      : 0;
  const semEnd = criados.filter((r) => !r.endProcesso).length;
  const comDataFim = criados.filter((r) => !!r.endProcesso).length;
  return {
    totalProcessos: total,
    pendenteCriacao,
    alertasCriticos: criticos,
    criticosTotal,
    criticosSemProcessoCriado,
    pctCriticos: total > 0 ? pct(criticosTotal, total) : 0,
    standbyMedio,
    diasEmCursoMedio,
    semEnd,
    comDataFim,
  };
}

export interface BlocoResumo {
  /** Com número de processo (exclui "Pendente Criação"). */
  total: number;
  pendenteCriacao: number;
  /** (linhas CRÍTICO no bloco / processos criados no bloco) × 100. */
  pctCriticos: number;
  standbyMedio: number;
  diasEmCursoMedio: number;
}

export function resumoBloco(rows: ProcessoRow[]): BlocoResumo {
  const criados = apenasProcessosComNumeroOficial(rows);
  const total = criados.length;
  const pendenteCriacao = contarPendentesCriacao(rows);
  const criticosTotalBloco = rows.filter((r) => r.alerta === "CRÍTICO").length;
  const standbyMedio = mediaStandbyPainel(rows);
  const diasVals = criados.map((r) => r.diasEmCurso).filter((n): n is number => n != null);
  const diasEmCursoMedio =
    diasVals.length > 0
      ? Math.round(diasVals.reduce((s, n) => s + n, 0) / diasVals.length)
      : 0;
  return {
    total,
    pendenteCriacao,
    pctCriticos: total > 0 ? pct(criticosTotalBloco, total) : 0,
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

/** Processo criado (nº oficial) sem data em END PROCESSO. */
function isProcessoOficialSemEnd(r: ProcessoRow): boolean {
  if (isPendenteCriacaoProcesso(r)) return false;
  return !(r.endProcesso ?? "").trim();
}

/** Processo criado com END PROCESSO preenchido. */
function isProcessoOficialComEnd(r: ProcessoRow): boolean {
  if (isPendenteCriacaoProcesso(r)) return false;
  return !!(r.endProcesso ?? "").trim();
}

export interface RankingPiorPerformanceItem {
  nome: string;
  /** Quantidade de processos oficiais sem END. */
  processosSemEnd: number;
  /** Maior `diasEmCurso` entre esses processos (0 se nenhum tiver dias). */
  maxDiasEmCurso: number;
  /** Soma dos dias em curso (só linhas com número). */
  somaDiasSemEnd: number;
}

/**
 * Pior performance: responsáveis com processos **sem END**;
 * ordenação por maior pico de dias em curso, depois quantidade sem END, depois soma dos dias.
 */
export function rankingPiorPerformanceSemEnd(rows: ProcessoRow[]): RankingPiorPerformanceItem[] {
  const map = new Map<string, ProcessoRow[]>();
  for (const r of rows) {
    const nome = (r.responsavel || "").trim();
    if (!nome || !isProcessoOficialSemEnd(r)) continue;
    if (!map.has(nome)) map.set(nome, []);
    map.get(nome)!.push(r);
  }
  const list: RankingPiorPerformanceItem[] = [...map.entries()].map(([nome, rs]) => {
    const diasVals = rs.map((x) => x.diasEmCurso).filter((n): n is number => n != null);
    const maxDiasEmCurso = diasVals.length > 0 ? Math.max(...diasVals) : 0;
    const somaDiasSemEnd = diasVals.reduce((a, b) => a + b, 0);
    return {
      nome,
      processosSemEnd: rs.length,
      maxDiasEmCurso,
      somaDiasSemEnd,
    };
  });
  list.sort((a, b) => {
    if (b.maxDiasEmCurso !== a.maxDiasEmCurso) return b.maxDiasEmCurso - a.maxDiasEmCurso;
    if (b.processosSemEnd !== a.processosSemEnd) return b.processosSemEnd - a.processosSemEnd;
    return b.somaDiasSemEnd - a.somaDiasSemEnd;
  });
  return list;
}

export interface RankingMelhorPerformanceItem {
  nome: string;
  /** Soma da coluna VALOR em processos oficiais **com** END. */
  valorComEnd: number;
  processosComEnd: number;
}

/**
 * Melhor performance: responsáveis com processos **com END**;
 * ordenação por maior soma de VALOR, depois quantidade de processos com END.
 */
export function rankingMelhorPerformanceComEnd(rows: ProcessoRow[]): RankingMelhorPerformanceItem[] {
  const map = new Map<string, ProcessoRow[]>();
  for (const r of rows) {
    const nome = (r.responsavel || "").trim();
    if (!nome || !isProcessoOficialComEnd(r)) continue;
    if (!map.has(nome)) map.set(nome, []);
    map.get(nome)!.push(r);
  }
  const list: RankingMelhorPerformanceItem[] = [...map.entries()].map(([nome, rs]) => ({
    nome,
    valorComEnd: rs.reduce((s, x) => s + (x.valor ?? 0), 0),
    processosComEnd: rs.length,
  }));
  list.sort((a, b) => {
    if (b.valorComEnd !== a.valorComEnd) return b.valorComEnd - a.valorComEnd;
    return b.processosComEnd - a.processosComEnd;
  });
  return list;
}

export function topAtrasados(rows: ProcessoRow[], n = 5): ProcessoRow[] {
  return [...rows]
    .filter((r) => r.diasEmCurso != null)
    .sort((a, b) => (b.diasEmCurso ?? 0) - (a.diasEmCurso ?? 0))
    .slice(0, n);
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function sortUltimosNoDia(a: ProcessoRow, b: ProcessoRow): number {
  const dd = (b.diasEmCurso ?? 0) - (a.diasEmCurso ?? 0);
  if (dd !== 0) return dd;
  return (a.processo || "").localeCompare(b.processo || "", "pt-BR");
}

/**
 * Prioriza a data de `ultimaMovimentacao` mais recente: nesse dia, ordena por `diasEmCurso` (maior primeiro).
 * Se não houver `n` processos nesse dia, completa com o dia anterior (e assim por diante), mantendo a mesma ordenação por dia.
 * Ignora linhas sem data ISO válida ou sem dias em curso.
 */
export function topUltimosMovimentados(rows: ProcessoRow[], n = 5): ProcessoRow[] {
  const candidatos = rows.filter(
    (r) => DATA_ISO.test((r.ultimaMovimentacao ?? "").trim()) && r.diasEmCurso != null,
  );
  if (candidatos.length === 0) return [];

  const byDate = new Map<string, ProcessoRow[]>();
  for (const r of candidatos) {
    const d = r.ultimaMovimentacao.trim();
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }
  const datesDesc = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  const out: ProcessoRow[] = [];
  for (const d of datesDesc) {
    const sorted = [...(byDate.get(d) ?? [])].sort(sortUltimosNoDia);
    for (const r of sorted) {
      out.push(r);
      if (out.length >= n) return out;
    }
  }
  return out;
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

/**
 * Filtra por intervalo na coluna START PROCESSO (`startProcesso` em ISO `YYYY-MM-DD`).
 * Linhas sem data não entram quando qualquer limite está definido.
 * Se "de" > "até", os limites são invertidos para o cálculo.
 */
export function filterByStartProcessoRange(
  rows: ProcessoRow[],
  fromIso: string,
  toIso: string,
): ProcessoRow[] {
  let f = fromIso.trim();
  let t = toIso.trim();
  if (f && t && f > t) [f, t] = [t, f];
  const hasFrom = f.length > 0;
  const hasTo = t.length > 0;
  if (!hasFrom && !hasTo) return rows;
  return rows.filter((r) => {
    const s = (r.startProcesso ?? "").trim();
    if (!s) return false;
    if (hasFrom && s < f) return false;
    if (hasTo && s > t) return false;
    return true;
  });
}
