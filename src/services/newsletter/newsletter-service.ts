import { safeGetItem, safeSetItem } from "@/lib/safe-storage";
import { validateEmail } from "@/utils/validation";

/**
 * Newsletter signup (PRD 5.1: "non-functional simulation acceptable"). Nothing is sent anywhere: the address is kept in
 * this browser so a repeat signup can be recognised. The service is async so the UI exercises real loading and failure states.
 */
export const NEWSLETTER_STORAGE_KEY = "shopsphere.newsletter.v1";
export const NEWSLETTER_DELAY_MS = 700;

export type NewsletterResult = { status: "subscribed" | "already-subscribed" };

export class NewsletterError extends Error {
  constructor(public readonly kind: "invalid" | "storage", message: string) {
    super(message);
    this.name = "NewsletterError";
  }
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function readSubscribers(): string[] {
  const raw = safeGetItem(NEWSLETTER_STORAGE_KEY, "local");
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function isSubscribed(email: string): boolean {
  return readSubscribers().includes(normalizeEmail(email));
}

export async function subscribeToNewsletter(email: string, options: { delayMs?: number } = {}): Promise<NewsletterResult> {
  const problem = validateEmail(email);
  if (problem) throw new NewsletterError("invalid", problem);

  await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? NEWSLETTER_DELAY_MS));

  const address = normalizeEmail(email);
  const subscribers = readSubscribers();
  if (subscribers.includes(address)) return { status: "already-subscribed" };
  if (!safeSetItem(NEWSLETTER_STORAGE_KEY, JSON.stringify([...subscribers, address]), "local")) {
    throw new NewsletterError("storage", "Your browser would not save the signup. Check that storage is allowed and try again.");
  }
  return { status: "subscribed" };
}
