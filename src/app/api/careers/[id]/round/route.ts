import { playRound } from "@/career/service";
import { AppError, errorResponse } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";

/** Encerra a rodada atual (partida do usuário + demais jogos). */
export async function POST(_: Request, ctx: RouteContext<"/api/careers/[id]/round">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Não autenticado", 401);
    const { id } = await ctx.params;
    return Response.json(await playRound(user, id));
  } catch (err) {
    return errorResponse(err);
  }
}
