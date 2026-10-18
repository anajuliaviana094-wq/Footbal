import { eq } from "drizzle-orm";
import { getBillingProvider } from "@/billing";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { appUrl } from "@/lib/url";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(appUrl("/login"), 303);
  const provider = getBillingProvider();
  if (!provider.isConfigured()) return Response.redirect(appUrl("/planos"), 303);
  const { url, customerId } = await provider.createCheckout({
    userId: user.id,
    email: user.email,
    customerId: user.stripeCustomerId,
    successUrl: appUrl("/planos?status=sucesso"),
    cancelUrl: appUrl("/planos?status=cancelado"),
  });
  if (customerId !== user.stripeCustomerId) {
    await getDb().update(schema.users).set({ stripeCustomerId: customerId }).where(eq(schema.users.id, user.id));
  }
  return Response.redirect(url, 303);
}
