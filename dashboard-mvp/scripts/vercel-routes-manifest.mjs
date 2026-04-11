/**
 * Next.js 16.2.x (webpack) emite `routes-manifest.json`, mas o fluxo da Vercel
 * após o build faz `lstat` em `routes-manifest-deterministic.json` e falha com ENOENT.
 * Copia o manifest existente quando o arquivo “deterministic” não foi gerado.
 * @see https://github.com/vercel/next.js/discussions/91609
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.join(root, ".next");
const deterministic = path.join(nextDir, "routes-manifest-deterministic.json");
const regular = path.join(nextDir, "routes-manifest.json");

if (fs.existsSync(deterministic)) {
  process.exit(0);
}
if (!fs.existsSync(regular)) {
  console.error(
    "[vercel-routes-manifest] .next/routes-manifest.json não encontrado; nada a fazer.",
  );
  process.exit(0);
}
fs.copyFileSync(regular, deterministic);
console.log("[vercel-routes-manifest] Copiado routes-manifest.json → routes-manifest-deterministic.json");
