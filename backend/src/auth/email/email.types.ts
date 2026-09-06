export type EmailTemplate = "verify-email" | "reset-password" | "password-changed";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export interface EmailProviderResult {
  messageId?: string;
}

export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly temporary: boolean
  ) {
    super(message);
  }
}

export interface EmailProvider {
  send(message: EmailMessage, dedupeKey: string): Promise<EmailProviderResult>;
}
