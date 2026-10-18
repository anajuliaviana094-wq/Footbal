/**
 * Interface do provedor de pagamentos. Hoje: Stripe. Para trocar por Mercado Pago,
 * implemente esta interface em outro arquivo e altere `getBillingProvider()`.
 */
export interface BillingProvider {
  readonly name: string;
  isConfigured(): boolean;
  createCheckout(opts: { userId: string; email: string | null; customerId: string | null; successUrl: string; cancelUrl: string }): Promise<{ url: string; customerId: string }>;
  createPortal(opts: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  /** Valida a assinatura do webhook e devolve um evento normalizado (ou null se irrelevante). */
  parseWebhook(rawBody: string, signature: string | null): Promise<BillingEvent | null>;
}

export interface BillingEvent {
  subscriptionId: string;
  customerId: string;
  userId: string | null;
  status: string;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  /** true se a assinatura dá direito ao premium */
  active: boolean;
}
