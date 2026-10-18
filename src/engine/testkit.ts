import { generateWorld, type SeedPlayer } from "@/seed/generate";
import { pickBestXI } from "./lineup";
import { DEFAULT_TACTICS, type EnginePlayer, type Formation, type TeamInput } from "./types";

let cache: ReturnType<typeof generateWorld> | null = null;
export function world() {
  return (cache ??= generateWorld());
}

export function toEnginePlayer(p: SeedPlayer): EnginePlayer {
  return {
    id: p.id,
    name: p.shortName,
    shirt: p.shirtNumber,
    position: p.position,
    attrs: p.attrs,
    traits: p.traits,
    condition: 100,
    morale: 60,
  };
}

export function teamFor(clubId: number, autoSubs = true, formation?: Formation): TeamInput {
  const w = world();
  const club = w.clubs.find((c) => c.id === clubId)!;
  const squad = w.players.filter((p) => p.clubId === clubId).map(toEnginePlayer);
  const f = formation ?? club.defaultFormation;
  const { starters, bench } = pickBestXI(squad, f);
  return {
    clubId,
    name: club.name,
    shortName: club.shortName,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    tactics: { ...DEFAULT_TACTICS, formation: f },
    starters,
    bench,
    autoSubs,
  };
}
