import "server-only";
import Stripe from "stripe";
import type { BillingEvent, BillingProvider } from "./provider";

let stripe: Stripe | null = null;
function client(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurada");
  return (stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);

function periodEnd(sub: Stripe.Subscription): Date | null {
  // Nas versões recentes da API o fim do período fica nos itens da assinatura.
  const end = sub.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

function toEvent(sub: Stripe.Subscription): BillingEvent {
  return {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    userId: (sub.metadata?.userId as string | undefined) ?? null,
    status: sub.status,
    priceId: sub.items?.data?.[0]?.price?.id ?? null,
    currentPeriodEnd: periodEnd(sub),
    active: ACTIVE.has(sub.status),
  };
}

export const stripeProvider: BillingProvider = {
  name: "stripe",
  isConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_PREMIUM);
  },
  async createCheckout({ userId, email, customerId, successUrl, cancelUrl }) {
    const s = client();
    let customer = customerId;
    if (!customer) {
      const c = await s.customers.create({ email: email ?? undefined, metadata: { userId } });
      customer = c.id;
    }
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PREMIUM!, quantity: 1 }],
      client_reference_id: userId,
      subscription_data: { metadata: { userId } },
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: "pt-BR",
    });
    if (!session.url) throw new Error("Stripe não retornou URL de checkout");
    return { url: session.url, customerId: customer };
  },
  async createPortal({ customerId, returnUrl }) {
    const session = await client().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return { url: session.url };
  },
  async parseWebhook(rawBody, signature) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) throw new Error("Webhook sem assinatura/segredo");
    const s = client();
    const event = s.webhooks.constructEvent(rawBody, signature, secret);
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) return null;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await s.subscriptions.retrieve(subId);
        const ev = toEvent(sub);
        return { ...ev, userId: ev.userId ?? session.client_reference_id ?? null };
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        return toEvent(event.data.object);
      default:
        return null;
    }
  },
};
