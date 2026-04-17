import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { parseGestaoComponentesCsv } from "@/lib/parseGestaoComponentesCsv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const nowIso = () => new Date().toISOString();

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

  const url = process.env.PAINEL_COMPONENTES_CSV_URL?.trim();
  if (!url) {
    return jsonResponse({
      rows: null,
      source: "mock" as const,
      message: "PAINEL_COMPONENTES_CSV_URL não definida.",
      updatedAt: nowIso(),
    });
  }

  try {
    if (!/^https?:\/\//i.test(url)) {
      const text = await readFile(url, "utf-8");
      const rows = parseGestaoComponentesCsv(text);
      if (rows.length === 0) {
        return jsonResponse({
          rows: null,
          source: "error" as const,
          message: "CSV de componentes vazio ou formato não reconhecido.",
          updatedAt: nowIso(),
        });
      }
      return jsonResponse({
        rows,
        source: "csv" as const,
        updatedAt: nowIso(),
      });
    }

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
        message: "A URL do CSV de componentes devolveu HTML em vez de CSV.",
        updatedAt: nowIso(),
      });
    }

    const rows = parseGestaoComponentesCsv(text);
    if (rows.length === 0) {
      return jsonResponse({
        rows: null,
        source: "error" as const,
        message: "CSV de componentes vazio ou formato não reconhecido.",
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
