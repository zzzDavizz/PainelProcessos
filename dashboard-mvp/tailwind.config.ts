import type { Config } from "tailwindcss";

const config: Config = {
  /** Só ativa `dark:` dentro de `[data-dashboard-theme="dark"]` — evita html/body com `.dark` preso. */
  darkMode: ["selector", '[data-dashboard-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
