"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCareer, deleteCareer, joinCareer } from "@/career/service";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export async function createCareerAction(_: { error?: string } | undefined, formData: FormData) {
  const user = await requireUser();
  let id: string;
  try {
    id = await createCareer(user, String(formData.get("leagueId")), Number(formData.get("clubId")), {
      multiplayer: formData.get("multiplayer") === "on",
    });
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    throw err;
  }
  redirect(`/carreira/${id}`);
}

export async function joinCareerAction(_: { error?: string } | undefined, formData: FormData) {
  const user = await requireUser();
  let id: string;
  try {
    id = await joinCareer(user, String(formData.get("code") ?? ""), Number(formData.get("clubId")));
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    throw err;
  }
  redirect(`/carreira/${id}`);
}

export async function deleteCareerAction(formData: FormData) {
  const user = await requireUser();
  await deleteCareer(user, String(formData.get("careerId")));
  revalidatePath("/carreiras");
}
