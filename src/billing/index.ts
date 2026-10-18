import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { BillingEvent, BillingProvider } from "./provider";
import { stripeProvider } from "./stripe";

export function getBillingProvider(): BillingProvider {
  return stripeProvider;
}

/** Aplica um evento de assinatura: grava a assinatura e atualiza `users.plan`. */
export async function applyBillingEvent(ev: BillingEvent, provider: string): Promise<void> {
  const db = getDb();
  let userId = ev.userId;
  if (!userId) {
    const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.stripeCustomerId, ev.customerId));
    userId = u?.id ?? null;
  }
  if (!userId) {
    console.warn("[billing] evento sem usuário associado", ev.subscriptionId);
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.subscriptions)
      .values({
        id: ev.subscriptionId,
        userId: userId!,
        provider,
        status: ev.status,
        priceId: ev.priceId,
        currentPeriodEnd: ev.currentPeriodEnd,
      })
      .onConflictDoUpdate({
        target: schema.subscriptions.id,
        set: { status: ev.status, priceId: ev.priceId, currentPeriodEnd: ev.currentPeriodEnd, updatedAt: new Date() },
      });
    await tx
      .update(schema.users)
      .set({ plan: ev.active ? "premium" : "free", stripeCustomerId: ev.customerId })
      .where(eq(schema.users.id, userId!));
  });
}
