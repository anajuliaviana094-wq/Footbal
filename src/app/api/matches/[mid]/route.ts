import { getMatchPayload } from "@/career/match";
import { AppError, errorResponse } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";

export async function GET(_: Request, ctx: RouteContext<"/api/matches/[mid]">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Não autenticado", 401);
    const { mid } = await ctx.params;
    return Response.json(await getMatchPayload(user, Number(mid)));
  } catch (err) {
    return errorResponse(err);
  }
}
