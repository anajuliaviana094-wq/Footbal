import "server-only";
import { cache } from "react";
import { getCareer } from "@/career/service";
import { AppError } from "@/lib/errors";
import { requireUser } from "@/lib/session";

/**
 * Usuário + carreira (deduplicado por requisição entre layout e página).
 * Retorna null se a carreira não existe ou exige Premium — o layout mostra a mensagem.
 */
export const loadCareer = cache(async (id: string) => {
  const user = await requireUser();
  try {
    const ctx = await getCareer(user, id);
    return { user, ...ctx };
  } catch (err) {
    if (err instanceof AppError) return null;
    throw err;
  }
});
