// src/lib/services/notification/email.utils.ts
import { formatMoney } from "@/lib/fx/convert";
import { Resend } from "resend";

// Lazily initialise the Resend client (works at build time without environment variables)
let resend: Resend | null = null;

export function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY || "dummy-key-for-build";
    resend = new Resend(apiKey);
  }
  return resend;
}

/**
 * E-mail configuration
 */
export const EmailConfig = {
  fromEmail: process.env.EMAIL_FROM || "noreply@subhub.local",
  fromName: process.env.EMAIL_FROM_NAME || "SubHub",
  get from() {
    return `${this.fromName} <${this.fromEmail}>`;
  },
};

/**
 * Formats an amount
 */
export function formatCurrency(amount: number, currency: string): string {
  return formatMoney(amount, currency, "en-US");
}

/**
 * Formats a date
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Returns the base URL
 */
export function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}
