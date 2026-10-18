export const PLANS = {
  free: {
    id: "free",
    name: "Grátis",
    priceLabel: "R$ 0",
    features: ["2 ligas: Pindorama — Acesso e Deserto Dourado", "Até 3 carreiras salvas", "Narração e relatórios com IA (com limite diário)"],
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceLabel: "R$ 19,90/mês",
    features: ["Todas as 8 ligas liberadas", "Até 3 carreiras salvas", "Narração e relatórios com IA", "Novas ligas e recursos primeiro"],
  },
} as const;

export type PlanId = keyof typeof PLANS;
