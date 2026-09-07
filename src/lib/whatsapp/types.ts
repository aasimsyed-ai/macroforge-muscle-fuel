/**
 * WhatsApp delivery architecture (preparation only).
 *
 * This targets the official WhatsApp Business Cloud API. No personal WhatsApp
 * number is used. Access tokens and the real sender live server-side only —
 * never in this React bundle. The only provider wired up today is a disabled
 * development stub (see `provider.ts`).
 */

export interface WhatsAppMessage {
  recipientPhone: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
  notificationId?: string;
}

export interface WhatsAppProvider {
  sendTemplateMessage(message: WhatsAppMessage): Promise<{ providerMessageId: string }>;
  verifyWebhook(signature: string | null, rawBody: string): boolean;
  processWebhook(payload: unknown): Promise<void>;
}

export class WhatsAppDisabledError extends Error {
  constructor() {
    super(
      "WhatsApp delivery will be available after the WhatsApp Business connection and message-template approval are completed.",
    );
    this.name = "WhatsAppDisabledError";
  }
}

export interface WhatsAppPreferencesView {
  phoneNumber: string | null;
  phoneVerified: boolean;
  notificationsEnabled: boolean;
  enableProgress: boolean;
  enableWorkoutGuidance: boolean;
  enableRecovery: boolean;
  enableSafety: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  consentedAt: string | null;
  revokedAt: string | null;
}
