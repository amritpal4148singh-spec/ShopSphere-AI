/**
 * Simulated delivery estimate (PRD 5.4: "simulated pin-code based estimate").
 * No courier service is contacted. The estimate is the item's handling time (parsed from the
 * data source's shipping text) plus a transit time derived from the first digit of the PIN code.
 */
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const DEFAULT_HANDLING_DAYS = 2;
const WINDOW_DAYS = 2;

export function isValidPincode(value: string): boolean {
  return PINCODE_PATTERN.test(value.trim());
}

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };

/** "Ships in 1-2 business days" -> 2, "Ships overnight" -> 1, "Ships in 1 week" -> 7, unknown -> 2. */
export function parseHandlingDays(shippingInformation: string | null): number {
  if (!shippingInformation) return DEFAULT_HANDLING_DAYS;
  const text = shippingInformation.toLowerCase();
  if (text.includes("overnight")) return 1;

  const match = text.match(/(\d+)(?:\s*-\s*(\d+))?\s*(?:business\s+)?(day|week|month)/);
  if (!match) return DEFAULT_HANDLING_DAYS;
  const amount = Number(match[2] ?? match[1]);
  return amount * (UNIT_DAYS[match[3] ?? "day"] ?? 1);
}

export function getTransitDays(pincode: string): number {
  const firstDigit = Number(pincode.trim().charAt(0));
  return 1 + (firstDigit % 4);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export interface DeliveryEstimate {
  earliest: Date;
  latest: Date;
}

export function estimateDelivery(pincode: string, shippingInformation: string | null, now: Date = new Date()): DeliveryEstimate | null {
  if (!isValidPincode(pincode)) return null;
  const earliest = addDays(now, parseHandlingDays(shippingInformation) + getTransitDays(pincode));
  return { earliest, latest: addDays(earliest, WINDOW_DAYS) };
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

export function formatDeliveryDate(date: Date): string {
  return dateFormatter.format(date);
}
