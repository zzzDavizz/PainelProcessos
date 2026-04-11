import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Evita confusão quando existe package-lock na pasta pai (scripts na raiz do repositório).
  outputFileTracingRoot: configDir,
  // Remove o ícone "N" do Next.js no canto da página em desenvolvimento.
  devIndicators: false,
};

export default nextConfig;
