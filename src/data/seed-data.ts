import seed from "./seed-orders.json";
import { buildOrderFromSeed, type SeedOrder } from "@/utils/seed-orders";
import type { SavedAddress } from "@/types/checkout";
import type { Order } from "@/types/order";

/** The demo customer (src/services/auth/seed-users.ts) starts with sample orders and one saved address. */
export const SEED_CUSTOMER_ID = "user-seed-customer";

export const SEED_ADDRESSES: readonly SavedAddress[] = [
  { id: "addr-seed-home", label: "Home", line1: "12 Demo Street", line2: "Near Central Park", city: "New Delhi", state: "Delhi", pincode: "110001" },
];

/** Sample orders, one per tracking status, with times relative to `now`. */
export function createSeedOrders(now: number = Date.now()): Order[] {
  return (seed.orders as SeedOrder[]).map((order) => buildOrderFromSeed(order, seed.stageOffsetHours, now));
}
