import { getMatchPayload } from "@/career/match";
import { startUserMatch } from "@/career/service";
import { AppError, errorResponse } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";

/** Inicia (ou retoma) a partida ao vivo do dia e devolve o payload para o campo. */
export async function POST(_: Request, ctx: RouteContext<"/api/careers/[id]/match">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Não autenticado", 401);
    const { id } = await ctx.params;
    const matchId = await startUserMatch(user, id);
    if (!matchId) return Response.json({ noMatch: true });
    return Response.json(await getMatchPayload(user, matchId));
  } catch (err) {
    return errorResponse(err);
  }
}
