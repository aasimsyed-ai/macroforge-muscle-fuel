import { WhatsAppDisabledError, type WhatsAppMessage, type WhatsAppProvider } from "./types";

/**
 * Development provider. It NEVER sends a real message. `sendTemplateMessage`
 * rejects with a clear disabled error and logs that delivery is off; webhook
 * verification always fails closed.
 *
 * A real provider must: use secure server-side credentials, use approved
 * WhatsApp templates, verify webhooks, store provider message ids, handle
 * delivery/read/failure statuses, be idempotent, prevent duplicates, and
 * respect opt-out + quiet hours.
 */
export class DevelopmentWhatsAppProvider implements WhatsAppProvider {
  async sendTemplateMessage(message: WhatsAppMessage): Promise<{ providerMessageId: string }> {
    console.info(
      `[whatsapp] delivery is disabled — not sending template "${message.templateName}" to a recipient.`,
    );
    throw new WhatsAppDisabledError();
  }

  verifyWebhook(): boolean {
    return false;
  }

  async processWebhook(): Promise<void> {
    // No-op: no real webhooks are received while delivery is disabled.
  }
}

export const whatsappProvider: WhatsAppProvider = new DevelopmentWhatsAppProvider();

/** Production WhatsApp sending is not active in this build. */
export const WHATSAPP_DELIVERY_ENABLED = false;
