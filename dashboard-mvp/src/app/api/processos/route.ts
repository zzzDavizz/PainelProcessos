import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { parseResumoPainelCsv } from "@/lib/parseResumoCsv";

/** Esta rota só devolve dados em tempo real; nunca resposta estática em cache. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lê o CSV do painel (Drive ou URL HTTP). Configure `PAINEL_CSV_URL` no servidor.
 * Resposta: `{ rows: ProcessoRow[] | null, source, message? }` — `rows: null` → cliente usa mock.
 */
const nowIso = () => new Date().toISOString();

/** Evita que browser ou proxy guarde a resposta JSON — cada GET é uma leitura nova. */
const API_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
} as const;

function jsonResponse(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: API_NO_STORE_HEADERS,
  });
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return jsonResponse({ message: "Não autorizado." }, { status: 401 });
  }

  const url = process.env.PAINEL_CSV_URL?.trim();
  if (!url) {
    return jsonResponse({
      rows: null,
      source: "mock" as const,
      message: "PAINEL_CSV_URL não definida — dashboard usa dados locais.",
      updatedAt: nowIso(),
    });
  }

  try {
    // Parâmetro único por pedido: o CDN do Drive pode reutilizar o mesmo URL; isto não é cache da app, é obter o ficheiro atualizado.
    let fetchUrl = url;
    try {
      const u = new URL(url);
      u.searchParams.set("_t", String(Date.now()));
      fetchUrl = u.toString();
    } catch {
      fetchUrl = `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
    }

    const res = await fetch(fetchUrl, {
      cache: "no-store",
      headers: {
        Accept: "text/csv,text/plain,*/*",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (!res.ok) {
      return jsonResponse({
        rows: null,
        source: "error" as const,
        message: `Falha ao obter CSV (${res.status} ${res.statusText}).`,
        updatedAt: nowIso(),
      });
    }
    const text = await res.text();
    if (text.trimStart().startsWith("<!")) {
      return jsonResponse({
        rows: null,
        source: "error" as const,
        message:
          "A URL devolveu HTML (comum no Drive sem partilha pública). Use uc?export=download&id=… ou ficheiro público.",
        updatedAt: nowIso(),
      });
    }
    const rows = parseResumoPainelCsv(text);
    if (rows.length === 0) {
      return jsonResponse({
        rows: null,
        source: "error" as const,
        message: "CSV vazio ou formato não reconhecido.",
        updatedAt: nowIso(),
      });
    }
    return jsonResponse({
      rows,
      source: "csv" as const,
      updatedAt: nowIso(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return jsonResponse({
      rows: null,
      source: "error" as const,
      message: msg,
      updatedAt: nowIso(),
    });
  }
}
