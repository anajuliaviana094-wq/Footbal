import { getScoutReport } from "@/ai/scout";
import { getPlayerProfile } from "@/career/queries";
import { getCareer } from "@/career/service";
import { AppError, errorResponse } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request, ctx: RouteContext<"/api/players/[pid]/scout">) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Não autenticado", 401);
    const { pid } = await ctx.params;
    const careerId = new URL(req.url).searchParams.get("careerId") ?? "";
    await getCareer(user, careerId);
    const profile = await getPlayerProfile(careerId, Number(pid));
    if (!profile) throw new AppError("Jogador não encontrado", 404);
    const p = profile.player;
    const report = await getScoutReport(user.id, {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      age: p.age,
      position: p.position,
      archetype: p.archetype,
      overall: p.overall,
      attrs: p.attrs,
      traits: p.traits,
      foot: p.foot,
      height: p.height,
    });
    return Response.json(report);
  } catch (err) {
    return errorResponse(err);
  }
}
