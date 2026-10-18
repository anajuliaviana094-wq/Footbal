"use server";

import { revalidatePath } from "next/cache";
import { saveTactics, startNewSeason } from "@/career/service";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import type { Tactics } from "@/engine/types";

export async function newSeasonAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("careerId"));
  await startNewSeason(user, id);
  revalidatePath(`/carreira/${id}`, "layout");
}

export async function saveTacticsAction(
  careerId: string,
  tactics: Tactics,
  lineup: { starters: number[]; bench: number[] },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  try {
    await saveTactics(user, careerId, tactics, lineup);
  } catch (err) {
    if (err instanceof AppError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/carreira/${careerId}`, "layout");
  return { ok: true };
}
