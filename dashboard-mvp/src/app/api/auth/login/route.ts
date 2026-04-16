import { NextResponse } from "next/server";
import {
  buildSessionCookie,
  createSessionToken,
  isAuthEnvConfigured,
  isValidLogin,
  normalizeNextPath,
} from "@/lib/auth";

type LoginBody = {
  username?: string;
  password?: string;
  next?: string;
};

export async function POST(request: Request) {
  try {
    if (!isAuthEnvConfigured()) {
      return NextResponse.json(
        {
          message:
            "Autenticação não configurada no servidor. Defina AUTH_LOGIN_USERNAME, AUTH_LOGIN_PASSWORD e AUTH_SESSION_SECRET nas variáveis de ambiente (ex.: Vercel → Settings → Environment Variables).",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as LoginBody;
    const username = body.username?.trim() ?? "";
    const password = body.password ?? "";
    const next = normalizeNextPath(body.next);

    if (!(await isValidLogin(username, password))) {
      return NextResponse.json(
        { message: "Usuário ou senha inválidos." },
        { status: 401 },
      );
    }

    const token = await createSessionToken(username);
    const response = NextResponse.json({ ok: true, next });
    response.cookies.set(buildSessionCookie(token));
    return response;
  } catch {
    return NextResponse.json(
      { message: "Não foi possível iniciar a sessão." },
      { status: 500 },
    );
  }
}
