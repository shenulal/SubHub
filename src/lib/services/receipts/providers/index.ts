// src/lib/services/receipts/providers/index.ts
import type { MailboxProviderId } from "@/types/receipts";
import { gmailProvider } from "./gmail";
import { outlookProvider } from "./outlook";
import type { MailboxProvider } from "./types";

export {
  getProviderAvailability,
  MailboxProviderError,
  type MailboxProvider,
} from "./types";

const PROVIDERS: Record<MailboxProviderId, MailboxProvider> = {
  GMAIL: gmailProvider,
  OUTLOOK: outlookProvider,
};

export function getProvider(id: MailboxProviderId): MailboxProvider {
  return PROVIDERS[id];
}

export function providerIdFromParam(param: string): MailboxProviderId | null {
  const upper = param.toUpperCase();
  return upper === "GMAIL" || upper === "OUTLOOK" ? upper : null;
}
