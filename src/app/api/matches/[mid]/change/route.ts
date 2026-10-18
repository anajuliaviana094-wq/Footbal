import { applyMatchChange } from "@/career/match";
import { AppError, errorResponse } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";

/** Substituições / mudança de tática durante o jogo: re-simula do tick em diante. */
export async function POST(req: Request, ctx: RouteContext<"/api/matches/[mid]/change">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Não autenticado", 401);
    const { mid } = await ctx.params;
    return Response.json(await applyMatchChange(user, Number(mid), await req.json()));
  } catch (err) {
    return errorResponse(err);
  }
}
