"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  FileSpreadsheet,
  Layers,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-react";

function normalizeClientNextPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/login")) {
    return "/";
  }

  return path;
}

const highlights = [
  {
    title: "Visão executiva",
    description: "KPIs, alertas críticos e acompanhamento dos blocos PILARES e PSI.",
    Icon: BarChart3,
  },
  {
    title: "Leitura operacional",
    description: "Ranking de localização dos processos, filtros de foco e andamento consolidado.",
    Icon: Layers,
  },
  {
    title: "Base controlada",
    description: "Exportação do resumo e atualização segura a partir da planilha oficial.",
    Icon: FileSpreadsheet,
  },
] as const;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => normalizeClientNextPath(searchParams.get("next")), [searchParams]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
            next: nextPath,
          }),
        });

        const data = (await response.json().catch(() => null)) as { message?: string; next?: string } | null;
        if (!response.ok) {
          setError(data?.message || "Não foi possível autenticar.");
          return;
        }

        router.replace(data?.next && data.next !== "/login" ? data.next : nextPath);
        router.refresh();
      } catch {
        setError("Falha de conexão ao validar o acesso.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1724] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-emerald-300/10 bg-slate-950/60 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.16),_transparent_35%),linear-gradient(180deg,_rgba(15,23,36,0.98),_rgba(17,24,39,0.92))] p-7 sm:p-10">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute left-[-4rem] top-[-5rem] h-52 w-52 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="absolute bottom-[-6rem] right-[-2rem] h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          </div>
          <div className="relative z-10 flex h-full flex-col">
            <div className="max-w-xl">
              <Image
                src="/interpi-45-anos-logo-wide.png"
                alt="Logo INTERPI"
                width={1024}
                height={270}
                className="h-14 w-auto rounded-2xl object-contain sm:h-16"
              />
              <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/90">
                <Sparkles className="h-3.5 w-3.5" />
                Dashboard
              </p>
              <h1 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-5xl">
                Painel gerencial de contratos
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
                Ambiente interno para consulta do indicadores de contratos, com foco em andamento dos processos,
                criticidade, foco responsável e exportação do resumo operacional.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:mt-10">
              {highlights.map(({ title, description, Icon }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-emerald-950/20"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300/20 to-cyan-300/20 text-emerald-200">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-emerald-300/10 bg-slate-900/55 px-4 py-3 text-xs text-slate-300 sm:mt-auto">
              <Lock className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
              A autenticação usa credencial única do sistema e não possui criação de novos usuários.
            </div>
          </div>
        </section>

        <section className="flex items-center bg-[linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(17,24,39,0.98))] p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white/5 p-6 shadow-[0_25px_60px_rgba(15,23,42,0.38)] backdrop-blur-xl sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-200/85">Login</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Validação de acesso</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Informe a credencial padrão do painel para liberar a visualização do dashboard.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Usuário
                </span>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
                  placeholder="Usuário do sistema"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Senha
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/20"
                  placeholder="Senha de acesso"
                  required
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-cyan-400 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.22em] text-slate-950 shadow-[0_16px_36px_rgba(16,185,129,0.35)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-80"
              >
                {isPending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {isPending ? "Validando..." : "Entrar no painel"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
