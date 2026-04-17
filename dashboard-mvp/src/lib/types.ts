export type Bloco = "PILARES" | "PSI";

export type AlertaNivel = "CRÍTICO" | "ATENÇÃO" | "OK";

export interface ProcessoRow {
  bloco: Bloco;
  processo: string;
  componente?: string | null;
  item: string;
  status?: string | null;
  valor: number | null;
  onde: string;
  ultimaMovimentacao: string;
  standByDias: number | null;
  alerta: AlertaNivel;
  startProcesso: string | null;
  endProcesso: string | null;
  diasEmCurso: number | null;
  termoEnc: string;
  dfd: string;
  trd: string;
  proximaDataAlvo?: string | null;
  responsavel: string | null;
  alocacaoFocal: string | null;
  situacao: string;
}
