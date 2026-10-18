import { getBillingProvider } from "@/billing";
import { getCurrentUser } from "@/lib/session";
import { appUrl } from "@/lib/url";

export async function POST() {
  const user = await getCurrentUser();
  if (!user?.stripeCustomerId) return Response.redirect(appUrl("/planos"), 303);
  const { url } = await getBillingProvider().createPortal({ customerId: user.stripeCustomerId, returnUrl: appUrl("/planos") });
  return Response.redirect(url, 303);
}
