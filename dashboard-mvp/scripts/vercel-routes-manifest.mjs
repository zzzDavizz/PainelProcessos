/**
 * Next.js 16.2.x (webpack) não gera `routes-manifest-deterministic.json`; a Vercel faz `lstat` a esse ficheiro.
 * Garante cópia a partir de `routes-manifest.json` em todos os `.next` relevantes (cwd, app, paths Vercel).
 * @see https://github.com/vercel/next.js/discussions/91609
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { setTimeout as delay } from "timers/promises";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(scriptDir, "..");

/** Pastas `.next` onde o Next pode ter escrito o manifest. */
function candidateNextDirs() {
  const set = new Set();
  set.add(path.join(appRoot, ".next"));
  set.add(path.join(process.cwd(), ".next"));
  if (process.env.VERCEL) {
    set.add("/vercel/path0/.next");
    set.add("/vercel/output/.next");
  }
  return [...set];
}

function ensureDeterministic(nextDir) {
  if (!fs.existsSync(nextDir)) return false;
  const regular = path.join(nextDir, "routes-manifest.json");
  const deterministic = path.join(nextDir, "routes-manifest-deterministic.json");
  if (fs.existsSync(deterministic)) return true;
  if (!fs.existsSync(regular)) return false;
  fs.copyFileSync(regular, deterministic);
  console.log(`[vercel-routes-manifest] Copiado em ${nextDir}`);
  return true;
}

async function main() {
  for (let i = 0; i < 40; i++) {
    let anySynced = false;
    for (const dir of candidateNextDirs()) {
      if (ensureDeterministic(dir)) anySynced = true;
    }
    if (anySynced) {
      process.exit(0);
    }
    await delay(100);
  }
  console.error(
    "[vercel-routes-manifest] Falhou: nenhum routes-manifest.json encontrado em .next após espera.",
  );
  process.exit(1);
}

await main();
