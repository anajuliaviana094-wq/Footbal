import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O app é quase todo dinâmico por usuário (sessão), então usamos o modelo de
  // renderização dinâmica padrão em vez de Cache Components.
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
