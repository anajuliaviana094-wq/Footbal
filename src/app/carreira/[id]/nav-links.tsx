export const NAV_ICONS = {
  painel: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  elenco: "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0M12 7a3 3 0 1 0 0-.01",
  jogar: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5l4 3-1.5 4.5h-5L8 10z",
  tatica: "M4 4h16v16H4zM12 4v16M4 12h4M16 12h4",
  tabela: "M4 6h16M4 12h16M4 18h16M8 4v16",
  mercado: "M3 7h18l-2 12H5L3 7zm5 0a4 4 0 0 1 8 0",
  financas: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  base: "M12 3l9 5-9 5-9-5 9-5zm-6 8v5c0 2 3 4 6 4s6-2 6-4v-5",
  copa: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM5 4H3v2a3 3 0 0 0 4 3M19 4h2v2a3 3 0 0 1-4 3",
  amigos: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6M3 20a6 6 0 0 1 12 0M15 14a6 6 0 0 1 6 6",
  mais: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export function careerLinks(multiplayer: boolean) {
  return [
    { href: "", label: "Painel", icon: NAV_ICONS.painel },
    { href: "/elenco", label: "Elenco", icon: NAV_ICONS.elenco },
    { href: "/tatica", label: "Tática", icon: NAV_ICONS.tatica },
    { href: "/partida", label: "Jogar", icon: NAV_ICONS.jogar, accent: true },
    { href: "/mercado", label: "Mercado", icon: NAV_ICONS.mercado },
    { href: "/financas", label: "Finanças", icon: NAV_ICONS.financas },
    { href: "/base", label: "Base", icon: NAV_ICONS.base },
    { href: "/tabela", label: "Tabela", icon: NAV_ICONS.tabela },
    { href: "/copa", label: "Copa", icon: NAV_ICONS.copa },
    ...(multiplayer ? [{ href: "/amigos", label: "Amigos", icon: NAV_ICONS.amigos }] : []),
  ];
}


export function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
