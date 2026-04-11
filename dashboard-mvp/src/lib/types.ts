export type Bloco = "PILARES" | "PSI";

export type AlertaNivel = "CRÍTICO" | "ATENÇÃO" | "OK";

export interface ProcessoRow {
  bloco: Bloco;
  processo: string;
  item: string;
  valor: number | null;
  onde: string;
  ultimaMovimentacao: string;
  standByDias: number | null;
  alerta: AlertaNivel;
  startProcesso: string | null;
  endProcesso: string | null;
  diasEmCurso: number | null;
  termoEnc: string;
  responsavel: string | null;
  alocacaoFocal: string | null;
  situacao: string;
}
