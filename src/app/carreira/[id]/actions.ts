"use server";

import { revalidatePath } from "next/cache";
import { promoteYouth, releaseYouth, upgradeAcademy } from "@/career/academy";
import { makeBid, respondOffer, setTransferListed } from "@/career/market";
import { saveTactics, setReady, startNewSeason } from "@/career/service";
import { playRound } from "@/career/matchday";
import type { Tactics } from "@/engine/types";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

type Result = { ok: boolean; message?: string; error?: string; counterFee?: number };

async function run(careerId: string, fn: () => Promise<string | void | Result>): Promise<Result> {
  try {
    const r = await fn();
    revalidatePath(`/carreira/${careerId}`, "layout");
    if (r && typeof r === "object") return r;
    return { ok: true, message: r ?? undefined };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function newSeasonAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("careerId"));
  await startNewSeason(user, id);
  revalidatePath(`/carreira/${id}`, "layout");
}

export async function saveTacticsAction(careerId: string, tactics: Tactics, lineup: { starters: number[]; bench: number[] }) {
  const user = await requireUser();
  return run(careerId, () => saveTactics(user, careerId, tactics, lineup));
}

export async function bidAction(careerId: string, playerId: number, fee: number, wage: number) {
  const user = await requireUser();
  return run(careerId, async () => {
    const r = await makeBid(user, careerId, playerId, fee, wage);
    return { ok: r.accepted || r.pending, message: r.message, error: r.accepted || r.pending ? undefined : r.message, counterFee: r.counterFee };
  });
}

export async function respondOfferAction(careerId: string, offerId: number, accept: boolean) {
  const user = await requireUser();
  return run(careerId, async () => (await respondOffer(user, careerId, offerId, accept)).message);
}

export async function listPlayerAction(careerId: string, playerId: number, listed: boolean, askingPrice: number | null) {
  const user = await requireUser();
  return run(careerId, async () => {
    await setTransferListed(user, careerId, playerId, listed, askingPrice);
    return listed ? "Jogador colocado na lista de transferências." : "Jogador retirado da lista.";
  });
}

export async function promoteYouthAction(careerId: string, playerId: number) {
  const user = await requireUser();
  return run(careerId, async () => {
    await promoteYouth(user, careerId, playerId);
    return "Promovido ao elenco principal!";
  });
}

export async function releaseYouthAction(careerId: string, playerId: number) {
  const user = await requireUser();
  return run(careerId, async () => {
    await releaseYouth(user, careerId, playerId);
    return "Jogador dispensado.";
  });
}

export async function upgradeAcademyAction(careerId: string) {
  const user = await requireUser();
  return run(careerId, async () => {
    await upgradeAcademy(user, careerId);
    return "Investimento feito! As próximas levas da base serão melhores.";
  });
}

export async function readyAction(careerId: string, ready: boolean) {
  const user = await requireUser();
  return run(careerId, async () => {
    const r = await setReady(user, careerId, ready);
    return r.processed ? "Todos prontos: rodada processada!" : ready ? "Você está pronto. Aguardando os outros técnicos." : "Marcação de pronto removida.";
  });
}

export async function forceRoundAction(careerId: string) {
  const user = await requireUser();
  return run(careerId, async () => {
    await playRound(user, careerId);
    return "Rodada processada!";
  });
}
