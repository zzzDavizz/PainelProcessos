/**
 * A Vercel corre `onBuildComplete` *durante* `next build`, antes do processo terminar,
 * e faz `lstat` em `routes-manifest-deterministic.json`. Um `&& node` após o build chega tarde.
 * Este wrapper mantém o manifest sincronizado enquanto o Next corre (poll + sync final).
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.join(appRoot, ".next");
const regular = path.join(nextDir, "routes-manifest.json");
const deterministic = path.join(nextDir, "routes-manifest-deterministic.json");

function sync() {
  try {
    if (!fs.existsSync(regular)) return;
    let need = !fs.existsSync(deterministic);
    if (!need) {
      need = fs.statSync(regular).mtimeMs > fs.statSync(deterministic).mtimeMs;
    }
    if (need) {
      fs.copyFileSync(regular, deterministic);
      console.log("[vercel-routes-manifest] Copiado (durante o build)");
    }
  } catch {
    /* ignorar corridas de escrita do Next */
  }
}

fs.mkdirSync(nextDir, { recursive: true });

const poll = setInterval(sync, 40);

let watch = null;
try {
  watch = fs.watch(nextDir, (event, name) => {
    if (name === "routes-manifest.json" || name === null) sync();
  });
} catch {
  /* .next pode ainda não existir de todo */
}

const binDir = path.join(appRoot, "node_modules", ".bin");
const env = {
  ...process.env,
  PATH: fs.existsSync(binDir)
    ? `${binDir}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH,
};
const child = spawn("next", ["build", "--webpack"], {
  cwd: appRoot,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

child.on("close", (code) => {
  clearInterval(poll);
  if (watch) try { watch.close(); } catch { /* empty */ }
  sync();
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  clearInterval(poll);
  if (watch) try { watch.close(); } catch { /* empty */ }
  console.error(err);
  process.exit(1);
});
