import type { AlertaNivel, Bloco, ProcessoRow } from "./types";
import { parseDataIso } from "./parseResumoCsv";

export function filterByBloco(rows: ProcessoRow[], bloco: Bloco | "ALL"): ProcessoRow[] {
  if (bloco === "ALL") return rows;
  return rows.filter((r) => r.bloco === bloco);
}

/**
 * Padrão típico na coluna PROCESSO (ex.: 00071.004462/2025-29).
 * Se existir, a linha conta como criada mesmo que ainda haja texto residual na célula (export/merge).
 */
export function temNumeroOficialProcesso(row: Pick<ProcessoRow, "processo">): boolean {
  return pareceNumeroOficialProcesso(row.processo ?? "");
}

function pareceNumeroOficialProcesso(raw: string): boolean {
  const t = raw.trim();
  return /\d{3,}\.\d+\/\d{4}-\d+/i.test(t);
}

/**
 * Linha sem número oficial na coluna PROCESSO.
 * A planilha costuma usar "Pendente Criação", mas também pode vir vazia, com traço ou texto residual.
 * Tudo o que não tiver número oficial entra como "não criado".
 */
export function isPendenteCriacaoProcesso(row: Pick<ProcessoRow, "processo">): boolean {
  const raw = (row.processo ?? "").trim();
  if (temNumeroOficialProcesso(row)) return false;
  const t = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t || t === "-" || t === "—") return true;
  if (t === "pendente criacao") return true;
  if (t.includes("pendente") && t.includes("cria")) return true;
  if (t === "pendente" || t === "pendente de criacao" || t === "pendente de criação") return true;
  return true;
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

function incluirNoRankingOnde(r: ProcessoRow): boolean {
  const status = classificarStatus(r.status);
  return status !== "Efetivado" && status !== "Efetivado/Recorrente";
}

export function formatOndeBucketLabel(name: string): string {
  return name === ONDE_VAZIO_LABEL ? "(sem local definido)" : name;
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
  const rowsFiltradas = rows.filter(incluirNoRankingOnde);
  const map = new Map<string, OndeAgg>();
  for (const r of rowsFiltradas) {
    const key = normalizeOndeKey(r.onde ?? "");
    const cur = map.get(key) ?? { count: 0, valor: 0, pendenteCriacao: 0 };
    if (isPendenteCriacaoProcesso(r)) cur.pendenteCriacao += 1;
    else cur.count += 1;
    cur.valor += r.valor ?? 0;
    map.set(key, cur);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  const totalCriados = apenasProcessosComNumeroOficial(rowsFiltradas).length;
  const totalProc = totalCriados > 0 ? totalCriados : 1;
  const somaValores = valorTotalProcessos(rowsFiltradas);

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

/** Linhas do bucket clicado no ranking «Onde está o processo?». */
export function processosPorBucketOnde(rows: ProcessoRow[], bucketNome: string, maxRotulos = 8): ProcessoRow[] {
  const normalizedRows = rows
    .filter(incluirNoRankingOnde)
    .map((r) => ({ row: r, ondeKey: normalizeOndeKey(r.onde ?? "") }));
  if (bucketNome !== "Demais") {
    return normalizedRows
      .filter(({ ondeKey }) => ondeKey === bucketNome)
      .map(({ row }) => row);
  }

  const topBuckets = distribuicaoPorOnde(rows, maxRotulos)
    .map((r) => r.name)
    .filter((name) => name !== "Demais");
  const topSet = new Set(topBuckets);

  return normalizedRows
    .filter(({ ondeKey }) => !topSet.has(ondeKey))
    .map(({ row }) => row);
}

export type StatusCategoria =
  | "Efetivado"
  | "Efetivado/Recorrente"
  | "Pendente/Andamento"
  | "Outros"
  | "Não informado";

export interface StatusBarRow {
  name: StatusCategoria;
  v: number;
  count: number;
  total: number;
  fill: string;
}

function classificarStatus(raw: string | null | undefined): StatusCategoria {
  const t = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t || t === "-" || t === "—") return "Não informado";
  if (t === "efetivado") return "Efetivado";
  if (t === "efetivado/recorrente" || t === "efetivado / recorrente") return "Efetivado/Recorrente";
  if (t === "pendente/andamento" || t === "pendente / andamento") return "Pendente/Andamento";
  return "Outros";
}

const STATUS_BASE_ORDER: readonly StatusCategoria[] = [
  "Efetivado",
  "Efetivado/Recorrente",
  "Pendente/Andamento",
] as const;

const STATUS_COLORS: Record<StatusCategoria, string> = {
  Efetivado: "#16a34a",
  "Efetivado/Recorrente": "#2563eb",
  "Pendente/Andamento": "#ea580c",
  Outros: "#7c3aed",
  "Não informado": "#94a3b8",
};

export function distribuicaoPorStatus(rows: ProcessoRow[]): StatusBarRow[] {
  const oficiais = apenasProcessosComNumeroOficial(rows);
  if (oficiais.length === 0) return [];
  const counts: Record<StatusCategoria, number> = {
    Efetivado: 0,
    "Efetivado/Recorrente": 0,
    "Pendente/Andamento": 0,
    Outros: 0,
    "Não informado": 0,
  };
  for (const r of oficiais) counts[classificarStatus(r.status)] += 1;
  const total = oficiais.length;
  const out: StatusBarRow[] = STATUS_BASE_ORDER.map((name) => ({
    name,
    v: pct(counts[name], total),
    count: counts[name],
    total,
    fill: STATUS_COLORS[name],
  }));
  if (counts.Outros > 0) {
    out.push({
      name: "Outros",
      v: pct(counts.Outros, total),
      count: counts.Outros,
      total,
      fill: STATUS_COLORS.Outros,
    });
  }
  if (counts["Não informado"] > 0) {
    out.push({
      name: "Não informado",
      v: pct(counts["Não informado"], total),
      count: counts["Não informado"],
      total,
      fill: STATUS_COLORS["Não informado"],
    });
  }
  return out;
}

const STATUS_BUCKETS = new Set<StatusCategoria>([
  "Efetivado",
  "Efetivado/Recorrente",
  "Pendente/Andamento",
  "Outros",
  "Não informado",
]);

export function processosPorStatus(rows: ProcessoRow[], nomeStatus: string): ProcessoRow[] {
  if (!STATUS_BUCKETS.has(nomeStatus as StatusCategoria)) return [];
  return apenasProcessosComNumeroOficial(rows).filter((r) => classificarStatus(r.status) === nomeStatus);
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Média de dias em STAND BY só entre processos com número oficial.
 * Linhas "Pendente Criação" não entram no cálculo.
 */
export function mediaStandbyPainel(rows: ProcessoRow[]): number {
  const criados = apenasProcessosComNumeroOficial(rows);
  if (criados.length === 0) return 0;
  const sum = criados.reduce((s, r) => s + (r.standByDias ?? 0), 0);
  return Math.round(sum / criados.length);
}

export interface StandbyMedioPorOndeRow {
  /** Valor agregado da coluna «ONDE ESTÁ O PROCESSO?»; vazio → `ONDE_VAZIO_LABEL`. */
  onde: string;
  quantidade: number;
  standbyMedio: number;
}

/**
 * Por local («ONDE ESTÁ O PROCESSO?»), só processos com número oficial: quantidade e média de dias em stand-by.
 * Ordenação: maior standby médio primeiro. Limita a `maxLocais` linhas para leitura em gráfico.
 */
export function rankingStandbyMedioPorOnde(rows: ProcessoRow[], maxLocais = 20): StandbyMedioPorOndeRow[] {
  const criados = apenasProcessosComNumeroOficial(rows);
  const map = new Map<string, { sumSb: number; n: number }>();
  for (const r of criados) {
    const key = normalizeOndeKey(r.onde ?? "");
    const cur = map.get(key) ?? { sumSb: 0, n: 0 };
    cur.sumSb += r.standByDias ?? 0;
    cur.n += 1;
    map.set(key, cur);
  }
  const list: StandbyMedioPorOndeRow[] = [...map.entries()].map(([onde, { sumSb, n }]) => ({
    onde,
    quantidade: n,
    standbyMedio: n > 0 ? Math.round(sumSb / n) : 0,
  }));
  list.sort((a, b) => b.standbyMedio - a.standbyMedio || b.quantidade - a.quantidade);
  return list.slice(0, maxLocais);
}

export interface StandbyMedioPorOndePilaresPsiRow {
  onde: string;
  quantidadePilares: number;
  /** Média arredondada; 0 se não houver processos PILARES neste local. */
  standbyMedioPilares: number;
  quantidadePsi: number;
  /** Média arredondada; 0 se não houver processos PSI neste local. */
  standbyMedioPsi: number;
}

/**
 * Por local («ONDE ESTÁ O PROCESSO?»), média de stand-by separada para PILARES e para PSI (só processos criados).
 * Ordenação: maior valor entre as duas médias; empate por soma de quantidades. Limita a `maxLocais`.
 */
export function rankingStandbyMedioPorOndePilaresPsi(
  rows: ProcessoRow[],
  maxLocais = 20,
): StandbyMedioPorOndePilaresPsiRow[] {
  const criados = apenasProcessosComNumeroOficial(rows);
  type Agg = { sumSb: number; n: number };
  const mapPilares = new Map<string, Agg>();
  const mapPsi = new Map<string, Agg>();

  for (const r of criados) {
    const key = normalizeOndeKey(r.onde ?? "");
    const map = r.bloco === "PILARES" ? mapPilares : mapPsi;
    const cur = map.get(key) ?? { sumSb: 0, n: 0 };
    cur.sumSb += r.standByDias ?? 0;
    cur.n += 1;
    map.set(key, cur);
  }

  const keys = new Set<string>([...mapPilares.keys(), ...mapPsi.keys()]);
  const list: StandbyMedioPorOndePilaresPsiRow[] = [...keys].map((onde) => {
    const p = mapPilares.get(onde);
    const s = mapPsi.get(onde);
    const qp = p?.n ?? 0;
    const qs = s?.n ?? 0;
    return {
      onde,
      quantidadePilares: qp,
      standbyMedioPilares: qp > 0 ? Math.round(p!.sumSb / qp) : 0,
      quantidadePsi: qs,
      standbyMedioPsi: qs > 0 ? Math.round(s!.sumSb / qs) : 0,
    };
  });

  list.sort((a, b) => {
    const maxA = Math.max(a.standbyMedioPilares, a.standbyMedioPsi);
    const maxB = Math.max(b.standbyMedioPilares, b.standbyMedioPsi);
    if (maxB !== maxA) return maxB - maxA;
    const totA = a.quantidadePilares + a.quantidadePsi;
    const totB = b.quantidadePilares + b.quantidadePsi;
    return totB - totA;
  });

  return list.slice(0, maxLocais);
}

export interface HealthSlice {
  name: string;
  value: number;
  color: string;
  count: number;
  total: number;
}

export function healthDonut(rows: ProcessoRow[]): HealthSlice[] {
  const criados = apenasProcessosComNumeroOficial(rows);
  let c = 0,
    a = 0,
    ok = 0;
  for (const r of criados) {
    if (r.alerta === "CRÍTICO") c++;
    else if (r.alerta === "ATENÇÃO") a++;
    else ok++;
  }
  const t = criados.length;
  if (t === 0) {
    return [{ name: "Sem dados", value: 100, color: "#94a3b8", count: 0, total: 0 }];
  }
  return [
    { name: "Crítico", value: pct(c, t), color: "#dc2626", count: c, total: t },
    { name: "Atenção", value: pct(a, t), color: "#eab308", count: a, total: t },
    { name: "OK", value: pct(ok, t), color: "#16a34a", count: ok, total: t },
  ];
}

const FATIA_ALERTA_PARA_NIVEL: Record<string, AlertaNivel> = {
  Crítico: "CRÍTICO",
  Atenção: "ATENÇÃO",
  OK: "OK",
};

/** Processos criados (nº oficial) com o nível de alerta da fatia clicada no donut «Alertas críticos». */
export function processosCriadosPorFatiaAlerta(rows: ProcessoRow[], nomeFatia: string): ProcessoRow[] {
  const nivel = FATIA_ALERTA_PARA_NIVEL[nomeFatia];
  if (!nivel) return [];
  return apenasProcessosComNumeroOficial(rows).filter((r) => r.alerta === nivel);
}

/** Classifica texto da coluna ALOCAÇÃO FOCAL (planilha). */
function classificarAlocacaoFocal(raw: string | null): "Interno" | "Externo" | "Não informado" | "Outros" {
  const t = (raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t || t === "-" || t === "—") return "Não informado";
  if (t.includes("interno")) return "Interno";
  if (t.includes("externo")) return "Externo";
  return "Outros";
}

/**
 * Distribuição da **ALOCAÇÃO FOCAL** entre processos com número oficial (exclui "Pendente Criação").
 * Percentagens sobre esse total.
 */
const FATIA_ALOCACAO_FOCAL = new Set(["Interno", "Externo", "Não informado", "Outros"]);

/** Processos criados (nº oficial) na fatia clicada no gráfico «Alocação focal». */
export function processosCriadosPorFatiaAlocacaoFocal(rows: ProcessoRow[], nomeFatia: string): ProcessoRow[] {
  if (nomeFatia === "Sem dados" || !FATIA_ALOCACAO_FOCAL.has(nomeFatia)) return [];
  const criados = apenasProcessosComNumeroOficial(rows);
  return criados.filter((r) => classificarAlocacaoFocal(r.alocacaoFocal) === nomeFatia);
}

export function alocacaoFocalPie(rows: ProcessoRow[]): HealthSlice[] {
  const criados = apenasProcessosComNumeroOficial(rows);
  const t = criados.length;
  if (t === 0) {
    return [{ name: "Sem dados", value: 100, color: "#94a3b8", count: 0, total: 0 }];
  }
  let interno = 0;
  let externo = 0;
  let naoInfo = 0;
  let outros = 0;
  for (const r of criados) {
    const b = classificarAlocacaoFocal(r.alocacaoFocal);
    if (b === "Interno") interno++;
    else if (b === "Externo") externo++;
    else if (b === "Não informado") naoInfo++;
    else outros++;
  }
  const slices: HealthSlice[] = [
    { name: "Interno", value: pct(interno, t), color: "#2563eb", count: interno, total: t },
    { name: "Externo", value: pct(externo, t), color: "#ea580c", count: externo, total: t },
    { name: "Não informado", value: pct(naoInfo, t), color: "#94a3b8", count: naoInfo, total: t },
  ];
  if (outros > 0) {
    slices.push({ name: "Outros", value: pct(outros, t), color: "#7c3aed", count: outros, total: t });
  }
  return slices;
}

function classificarTermoEnc(raw: string | null): "Incluso" | "Ausente" | "Não se aplica" | "Outros" {
  const t = (raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t || t === "-" || t === "—") return "Outros";
  if (t === "incluso") return "Incluso";
  if (t === "ausente") return "Ausente";
  if (t === "nao se aplica" || t === "n/a" || t === "na") return "Não se aplica";
  return "Outros";
}

const FATIA_TERMO_ENC = new Set(["Incluso", "Ausente", "Não se aplica", "Outros"]);

/** Processos criados (nº oficial) na fatia clicada no gráfico «Distribuição termo enc.». */
export function processosCriadosPorFatiaTermoEnc(rows: ProcessoRow[], nomeFatia: string): ProcessoRow[] {
  if (nomeFatia === "Sem dados" || !FATIA_TERMO_ENC.has(nomeFatia)) return [];
  const criados = apenasProcessosComNumeroOficial(rows);
  return criados.filter((r) => classificarTermoEnc(r.termoEnc) === nomeFatia);
}

export interface DfdTrdBarPoint {
  /** "Incluso" | "Ausente" | "Não se aplica" */
  name: string;
  dfd: number;
  dfdCount: number;
  trd: number;
  trdCount: number;
  total: number;
}

export type DfdTrdColuna = "DFD" | "TRD";
const DFD_TRD_BUCKETS = new Set(["Incluso", "Ausente", "Não se aplica"]);

/**
 * Distribuição das colunas **DFD** e **TRD** apenas para processos criados do bloco.
 * Para cada opção (Incluso / Ausente / Não se aplica) retorna o percentual
 * representado em DFD e em TRD em relação ao total de processos com número oficial.
 */
export function dfdTrdBars(rows: ProcessoRow[]): DfdTrdBarPoint[] {
  const criados = apenasProcessosComNumeroOficial(rows);
  const t = criados.length;
  if (t === 0) return [];
  const classify = classificarTermoEnc;
  let dIncl = 0, dAus = 0, dNa = 0;
  let tIncl = 0, tAus = 0, tNa = 0;
  for (const r of criados) {
    const bd = classify(r.dfd);
    if (bd === "Incluso") dIncl++;
    else if (bd === "Ausente") dAus++;
    else if (bd === "Não se aplica") dNa++;
    const bt = classify(r.trd);
    if (bt === "Incluso") tIncl++;
    else if (bt === "Ausente") tAus++;
    else if (bt === "Não se aplica") tNa++;
  }
  return [
    { name: "Incluso",       dfd: pct(dIncl, t), dfdCount: dIncl, trd: pct(tIncl, t), trdCount: tIncl, total: t },
    { name: "Ausente",       dfd: pct(dAus,  t), dfdCount: dAus,  trd: pct(tAus,  t), trdCount: tAus,  total: t },
    { name: "Não se aplica", dfd: pct(dNa,   t), dfdCount: dNa,   trd: pct(tNa,   t), trdCount: tNa,   total: t },
  ];
}

export function processosCriadosPorBucketDfdTrd(
  rows: ProcessoRow[],
  coluna: DfdTrdColuna,
  bucketNome: string,
): ProcessoRow[] {
  if (!DFD_TRD_BUCKETS.has(bucketNome)) return [];
  const criados = apenasProcessosComNumeroOficial(rows);
  return criados.filter((r) => {
    const valor = coluna === "DFD" ? r.dfd : r.trd;
    return classificarTermoEnc(valor) === bucketNome;
  });
}

/**
 * Distribuição da coluna **TERMO ENC.** entre processos com número oficial.
 * Normaliza maiúsculas/minúsculas e trata "Não se aplica" também como "N/A" ou "n/a".
 */
export function termoEncPie(rows: ProcessoRow[]): HealthSlice[] {
  const criados = apenasProcessosComNumeroOficial(rows);
  const t = criados.length;
  if (t === 0) {
    return [{ name: "Sem dados", value: 100, color: "#94a3b8", count: 0, total: 0 }];
  }
  let incluso = 0;
  let ausente = 0;
  let naoSeAplica = 0;
  let outros = 0;
  for (const r of criados) {
    const bucket = classificarTermoEnc(r.termoEnc);
    if (bucket === "Incluso") incluso++;
    else if (bucket === "Ausente") ausente++;
    else if (bucket === "Não se aplica") naoSeAplica++;
    else outros++;
  }
  const slices: HealthSlice[] = [
    { name: "Incluso", value: pct(incluso, t), color: "#16a34a", count: incluso, total: t },
    { name: "Ausente", value: pct(ausente, t), color: "#ea580c", count: ausente, total: t },
    { name: "Não se aplica", value: pct(naoSeAplica, t), color: "#2563eb", count: naoSeAplica, total: t },
  ];
  if (outros > 0) {
    slices.push({ name: "Outros", value: pct(outros, t), color: "#94a3b8", count: outros, total: t });
  }
  return slices;
}

export type AlocacaoFocalFiltro = "todos" | "Interno" | "Externo";

/** Filtra linhas pela classificação da coluna ALOCAÇÃO FOCAL (interno / externo). */
export function filterByAlocacaoFocal(rows: ProcessoRow[], filtro: AlocacaoFocalFiltro): ProcessoRow[] {
  if (filtro === "todos") return rows;
  return rows.filter((r) => classificarAlocacaoFocal(r.alocacaoFocal) === filtro);
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
    { name: "Com END", value: pct(comEnd, t), color: "#16a34a", count: comEnd, total: criados.length },
    { name: "Sem END", value: pct(semEnd, t), color: "#ea580c", count: semEnd, total: criados.length },
  ];
}

const FATIA_END_PROCESSO = new Set(["Com END", "Sem END"]);

/** Processos criados (nº oficial) na fatia clicada do gráfico «END processo». */
export function processosCriadosPorFatiaEndProcesso(rows: ProcessoRow[], nomeFatia: string): ProcessoRow[] {
  if (nomeFatia === "Sem dados" || !FATIA_END_PROCESSO.has(nomeFatia)) return [];
  const criados = apenasProcessosComNumeroOficial(rows);
  return criados.filter((r) => {
    const temEnd = (r.endProcesso ?? "").trim().length > 0;
    return nomeFatia === "Com END" ? temEnd : !temEnd;
  });
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
  /** (alertasCriticos / totalProcessos) × 100 — só processos criados entram no cálculo. */
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
    pctCriticos: total > 0 ? pct(criticos, total) : 0,
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
  /** Linhas CRÍTICO sem número oficial de processo; não entram no percentual. */
  criticosForaCalculo: number;
  /** (linhas CRÍTICO com processo criado / processos criados no bloco) × 100. */
  pctCriticos: number;
  standbyMedio: number;
  diasEmCursoMedio: number;
}

export function resumoBloco(rows: ProcessoRow[]): BlocoResumo {
  const criados = apenasProcessosComNumeroOficial(rows);
  const total = criados.length;
  const pendenteCriacao = contarPendentesCriacao(rows);
  const criticosCriadosBloco = criados.filter((r) => r.alerta === "CRÍTICO").length;
  const criticosForaCalculo = rows.filter(
    (r) => r.alerta === "CRÍTICO" && isPendenteCriacaoProcesso(r),
  ).length;
  const standbyMedio = mediaStandbyPainel(rows);
  const diasVals = criados.map((r) => r.diasEmCurso).filter((n): n is number => n != null);
  const diasEmCursoMedio =
    diasVals.length > 0
      ? Math.round(diasVals.reduce((s, n) => s + n, 0) / diasVals.length)
      : 0;
  return {
    total,
    pendenteCriacao,
    criticosForaCalculo,
    pctCriticos: total > 0 ? pct(criticosCriadosBloco, total) : 0,
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
  /** Total de processos com número oficial (exclui “Pendente criação”). */
  quantidadeProcessos: number;
  /** Soma da coluna VALOR em todos os processos oficiais do responsável. */
  valorAcumulado: number;
  /** Processos oficiais sem data em END PROCESSO (quanto mais, pior). */
  processosSemEnd: number;
}

/**
 * Pior performance (PILARES / PSI): entre responsáveis com pelo menos um processo **sem END**,
 * ordena por **mais processos sem END**; em empate, **menos processos** no total;
 * depois por **maior valor acumulado** (todos os oficiais).
 */
export function rankingPiorPerformanceSemEnd(rows: ProcessoRow[]): RankingPiorPerformanceItem[] {
  const oficiais = apenasProcessosComNumeroOficial(rows);
  const mapAll = new Map<string, ProcessoRow[]>();
  for (const r of oficiais) {
    const nome = (r.responsavel || "").trim();
    if (!nome) continue;
    if (!mapAll.has(nome)) mapAll.set(nome, []);
    mapAll.get(nome)!.push(r);
  }

  const list: RankingPiorPerformanceItem[] = [];
  for (const [nome, rs] of mapAll) {
    const processosSemEnd = rs.filter(isProcessoOficialSemEnd).length;
    if (processosSemEnd === 0) continue;
    list.push({
      nome,
      quantidadeProcessos: rs.length,
      valorAcumulado: rs.reduce((s, x) => s + (x.valor ?? 0), 0),
      processosSemEnd,
    });
  }
  list.sort((a, b) => {
    if (b.processosSemEnd !== a.processosSemEnd) return b.processosSemEnd - a.processosSemEnd;
    if (a.quantidadeProcessos !== b.quantidadeProcessos) return a.quantidadeProcessos - b.quantidadeProcessos;
    return b.valorAcumulado - a.valorAcumulado;
  });
  return list;
}

export interface RankingMelhorPerformanceItem {
  nome: string;
  /** Total de processos com número oficial (exclui “Pendente criação”). */
  quantidadeProcessos: number;
  /** Soma da coluna VALOR só em processos oficiais **com** END. */
  valorAcumulado: number;
  /** Processos oficiais com END PROCESSO preenchido (quanto mais, melhor). */
  processosComEnd: number;
}

/**
 * Melhor performance: responsáveis com pelo menos um processo **com END**;
 * ordena por **mais processos com END**; em empate, **mais processos** no total;
 * depois por **maior valor acumulado** (soma de VALOR nas linhas com END).
 */
export function rankingMelhorPerformanceComEnd(rows: ProcessoRow[]): RankingMelhorPerformanceItem[] {
  const oficiais = apenasProcessosComNumeroOficial(rows);
  const mapAll = new Map<string, ProcessoRow[]>();
  for (const r of oficiais) {
    const nome = (r.responsavel || "").trim();
    if (!nome) continue;
    if (!mapAll.has(nome)) mapAll.set(nome, []);
    mapAll.get(nome)!.push(r);
  }

  const list: RankingMelhorPerformanceItem[] = [];
  for (const [nome, rs] of mapAll) {
    const comEnd = rs.filter(isProcessoOficialComEnd);
    if (comEnd.length === 0) continue;
    list.push({
      nome,
      quantidadeProcessos: rs.length,
      valorAcumulado: comEnd.reduce((s, x) => s + (x.valor ?? 0), 0),
      processosComEnd: comEnd.length,
    });
  }
  list.sort((a, b) => {
    if (b.processosComEnd !== a.processosComEnd) return b.processosComEnd - a.processosComEnd;
    if (b.quantidadeProcessos !== a.quantidadeProcessos) return b.quantidadeProcessos - a.quantidadeProcessos;
    return b.valorAcumulado - a.valorAcumulado;
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
    const s = parseDataIso((r.startProcesso ?? "").trim());
    if (!s || !DATA_ISO.test(s)) return false;
    if (hasFrom && s < f) return false;
    if (hasTo && s > t) return false;
    return true;
  });
}

export interface ProcessoInicioResumo {
  processo: string;
  onde: string;
}

export interface StartProcessoEvolucaoPonto {
  /** `YYYY-MM-DD` (agrupamento por dia) ou `YYYY-MM` (por mês). */
  sortKey: string;
  label: string;
  /** Total de linhas neste período com START PROCESSO válido, com ou sem número oficial. */
  quantidadeTotal: number;
  /** Processos com número oficial neste período. */
  quantidade: number;
  detalhes: ProcessoInicioResumo[];
  /** Linhas «Pendente Criação» com START PROCESSO neste mesmo período (sem número oficial). */
  quantidadePendentesCriacao: number;
  detalhesPendentesCriacao: ProcessoInicioResumo[];
}

function labelDiaStartIso(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function labelMesStartYm(ym: string): string {
  const [y, mo] = ym.split("-");
  return `${mo}/${y}`;
}

/**
 * Evolução por START PROCESSO (ISO válido): processos **criados** (nº oficial) e, no mesmo bucket,
 * linhas **Pendente Criação** (sem número oficial) que também tenham START PROCESSO preenchido.
 * Se existirem até 45 datas distintas no conjunto, agrupa por dia; caso contrário, por mês.
 * Linhas «Pendente Criação» sem START PROCESSO não entram no gráfico.
 */
export function evolucaoIniciosPorStartProcesso(rows: ProcessoRow[]): StartProcessoEvolucaoPonto[] {
  const startIso = (r: ProcessoRow): string | null => {
    const v = parseDataIso((r.startProcesso ?? "").trim());
    return v && DATA_ISO.test(v) ? v : null;
  };

  const criados = apenasProcessosComNumeroOficial(rows).filter((r) => startIso(r) != null);
  const pendentes = rows.filter(isPendenteCriacaoProcesso).filter((r) => startIso(r) != null);

  if (criados.length === 0 && pendentes.length === 0) return [];

  const diasUnicos = new Set<string>();
  for (const r of criados) {
    const iso = startIso(r);
    if (iso) diasUnicos.add(iso);
  }
  for (const r of pendentes) {
    const iso = startIso(r);
    if (iso) diasUnicos.add(iso);
  }
  const porDia = diasUnicos.size <= 45;

  const map = new Map<
    string,
    { sortKey: string; label: string; detalhes: ProcessoInicioResumo[]; detalhesPendentes: ProcessoInicioResumo[] }
  >();

  for (const r of criados) {
    const iso = startIso(r)!;
    const bucketKey = porDia ? iso : iso.slice(0, 7);
    const label = porDia ? labelDiaStartIso(iso) : labelMesStartYm(iso.slice(0, 7));
    const ondeRaw = (r.onde ?? "").trim();
    const onde = ondeRaw.length > 0 ? ondeRaw : ONDE_VAZIO_LABEL;
    const cur =
      map.get(bucketKey) ?? { sortKey: bucketKey, label, detalhes: [], detalhesPendentes: [] };
    cur.detalhes.push({ processo: (r.processo ?? "").trim(), onde });
    map.set(bucketKey, cur);
  }

  for (const r of pendentes) {
    const iso = startIso(r)!;
    const bucketKey = porDia ? iso : iso.slice(0, 7);
    const label = porDia ? labelDiaStartIso(iso) : labelMesStartYm(iso.slice(0, 7));
    const ondeRaw = (r.onde ?? "").trim();
    const onde = ondeRaw.length > 0 ? ondeRaw : ONDE_VAZIO_LABEL;
    const cur =
      map.get(bucketKey) ?? { sortKey: bucketKey, label, detalhes: [], detalhesPendentes: [] };
    cur.detalhesPendentes.push({ processo: (r.processo ?? "").trim(), onde });
    map.set(bucketKey, cur);
  }

  const out: StartProcessoEvolucaoPonto[] = [...map.values()].map((v) => ({
    sortKey: v.sortKey,
    label: v.label,
    quantidadeTotal: v.detalhes.length + v.detalhesPendentes.length,
    quantidade: v.detalhes.length,
    detalhes: [...v.detalhes].sort((a, b) => a.processo.localeCompare(b.processo, "pt-BR")),
    quantidadePendentesCriacao: v.detalhesPendentes.length,
    detalhesPendentesCriacao: [...v.detalhesPendentes].sort((a, b) =>
      a.processo.localeCompare(b.processo, "pt-BR"),
    ),
  }));
  out.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return out;
}
