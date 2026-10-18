import { applyBillingEvent, getBillingProvider } from "@/billing";

// Webhook do provedor: única fonte de verdade para users.plan.
export async function POST(req: Request) {
  const provider = getBillingProvider();
  const body = await req.text();
  let event;
  try {
    event = await provider.parseWebhook(body, req.headers.get("stripe-signature"));
  } catch (err) {
    console.warn("[billing] webhook inválido", err);
    return new Response("assinatura inválida", { status: 400 });
  }
  if (event) await applyBillingEvent(event, provider.name);
  return Response.json({ received: true });
}
