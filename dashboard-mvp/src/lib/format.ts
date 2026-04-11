/** Formata valor monetário no padrão brasileiro (BRL). */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Exibe data da última movimentação em dd/MM/yyyy.
 * Aceita ISO `YYYY-MM-DD` (como vindo do CSV após parse) ou já `d/m/yyyy`.
 */
export function formatDataUltimaMovimentacaoBR(value: string): string {
  const s = (value || "").trim();
  if (!s || s === "—") return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split("-");
    return `${da}/${mo}/${y}`;
  }
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
  return s;
}
