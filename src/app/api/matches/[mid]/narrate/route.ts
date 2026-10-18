import { narrateMatch } from "@/career/match";
import { getCurrentUser } from "@/lib/session";

/** Narração por IA. Nunca falha para o cliente: em erro devolve {} e o jogo segue com templates. */
export async function POST(_: Request, ctx: RouteContext<"/api/matches/[mid]/narrate">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ narrations: {} }, { status: 401 });
  try {
    const { mid } = await ctx.params;
    return Response.json({ narrations: await narrateMatch(user, Number(mid)) });
  } catch (err) {
    console.warn("[narrate]", err);
    return Response.json({ narrations: {} });
  }
}
