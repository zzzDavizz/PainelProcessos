/**
 * Na Vercel, com a raiz do Git = monorepo, o output do Next fica em `dashboard-mvp/.next`,
 * mas a plataforma valida `.next` e `public` na raiz do checkout (modo estático vs Next).
 * Copia artefactos para a raiz só em ambiente Vercel.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

if (process.env.VERCEL !== "1") {
  process.exit(0);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "dashboard-mvp");
const nextSrc = path.join(app, ".next");
const nextDest = path.join(root, ".next");
const pubSrc = path.join(app, "public");
const pubDest = path.join(root, "public");

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function cpDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(nextSrc)) {
  console.error("[vercel-monorepo-sync] Falta dashboard-mvp/.next");
  process.exit(1);
}

rmrf(nextDest);
cpDir(nextSrc, nextDest);
console.log("[vercel-monorepo-sync] Copiado dashboard-mvp/.next -> .next");

if (fs.existsSync(pubSrc)) {
  rmrf(pubDest);
  cpDir(pubSrc, pubDest);
  console.log("[vercel-monorepo-sync] Copiado dashboard-mvp/public -> public");
}
