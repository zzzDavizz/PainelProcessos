"use client";

import { useMemo, useState, useTransition, type InputHTMLAttributes } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Layers,
  Lock,
  RefreshCw,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";

function normalizeClientNextPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/login")) {
    return "/";
  }

  return path;
}

const highlights = [
  {
    title: "Visão rápida",
    description: "KPIs, alertas críticos e leitura dos blocos PILARES e PSI.",
    Icon: BarChart3,
  },
  {
    title: "Acompanhamento",
    description: "Localização dos processos, filtros de foco e andamento consolidado.",
    Icon: Layers,
  },
  {
    title: "Base segura",
    description: "Atualização controlada e exportação do resumo operacional.",
    Icon: FileSpreadsheet,
  },
] as const;

type LoginFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  Icon: LucideIcon;
  error?: string;
  rightSlot?: React.ReactNode;
};

function LoginField({ label, Icon, error, className, rightSlot, ...props }: LoginFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <div
        className={`flex items-center rounded-2xl border bg-slate-900/80 transition duration-200 ${
          error
            ? "border-red-400/40 ring-2 ring-red-400/10"
            : "border-white/10 focus-within:border-emerald-300/50 focus-within:ring-2 focus-within:ring-emerald-300/20"
        }`}
      >
        <span className="pl-4 text-slate-500">
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </span>
        <input
          {...props}
          className={`login-field w-full bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-slate-500 ${className ?? ""}`}
          aria-invalid={error ? "true" : "false"}
        />
        {rightSlot ? <div className="pr-2">{rightSlot}</div> : null}
      </div>
      {error ? <p className="mt-1.5 text-sm text-red-200">{error}</p> : null}
    </label>
  );
}

type LoginButtonProps = {
  isPending: boolean;
};

function LoginButton({ isPending }: LoginButtonProps) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-cyan-400 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.22em] text-slate-950 shadow-[0_18px_42px_rgba(16,185,129,0.38)] transition duration-150 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.985] disabled:cursor-wait disabled:opacity-80"
    >
      {isPending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {isPending ? "Entrando..." : "Entrar no painel"}
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => normalizeClientNextPath(searchParams.get("next")), [searchParams]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const nextFieldErrors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      nextFieldErrors.username = "Informe o usuário.";
    }
    if (!password) {
      nextFieldErrors.password = "Informe a senha.";
    }

    if (nextFieldErrors.username || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});

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
    <div className="flex min-h-screen items-center justify-center bg-[#0f1724] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-emerald-300/10 bg-slate-950/60 shadow-[0_30px_80px_rgba(2,6,23,0.55)] backdrop-blur md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.10),_transparent_35%),linear-gradient(180deg,_rgba(15,23,36,0.92),_rgba(17,24,39,0.88))] p-7 opacity-80 md:block lg:p-10">
          <div className="absolute inset-0 opacity-25">
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
                Consulte os indicadores, acompanhe os processos e exporte o resumo do painel em um só lugar.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:mt-10">
              {highlights.map(({ title, description, Icon }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.04] p-4 shadow-inner shadow-emerald-950/10"
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
              Acesso controlado com uma credencial única do sistema.
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[linear-gradient(180deg,_rgba(15,23,42,0.92),_rgba(17,24,39,0.98))] p-4 sm:p-8 md:p-10">
          <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-emerald-300/20 bg-white/[0.07] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.55),0_0_0_1px_rgba(52,211,153,0.08),0_0_32px_rgba(16,185,129,0.10)] backdrop-blur-xl sm:p-8">
            <div className="mb-6 md:hidden">
              <Image
                src="/interpi-45-anos-logo-wide.png"
                alt="Logo INTERPI"
                width={1024}
                height={270}
                className="h-12 w-auto rounded-2xl object-contain"
              />
            </div>
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-200/85">Login</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Entrar no painel</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Use seu acesso padrão para continuar.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <LoginField
                label="Usuário"
                Icon={User}
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setFieldErrors((current) => ({ ...current, username: undefined }));
                  if (error) setError("");
                }}
                placeholder="Digite seu usuário"
                error={fieldErrors.username}
                required
              />

              <LoginField
                label="Senha"
                Icon={Lock}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                  if (error) setError("");
                }}
                placeholder="Digite sua senha"
                error={fieldErrors.password}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </button>
                }
                required
              />

              {error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <LoginButton isPending={isPending} />
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
