import { ORDER_STATUSES, buildOrder } from "@/utils/orders";
import type { DeliveryId, PaymentMethodId } from "@/types/checkout";
import type { Order, OrderStatus } from "@/types/order";

export interface SeedOrder {
  id: string;
  status: OrderStatus;
  placedHoursAgo: number;
  delivery: DeliveryId;
  payment: PaymentMethodId;
  items: Array<{ productId: number; title: string; unitPrice: number; quantity: number }>;
}

const HOUR_MS = 3_600_000;

/** Turns a compact sample record into a full order that stays at its status (no auto-progress). */
export function buildOrderFromSeed(seed: SeedOrder, stageOffsetHours: Record<string, number>, now: number): Order {
  const placedAt = now - seed.placedHoursAgo * HOUR_MS;
  const order = buildOrder({
    id: seed.id,
    now: placedAt,
    items: seed.items.map((item) => ({ ...item, thumbnail: null, variantLabel: null })),
    customer: { name: "Demo Customer", email: "customer@shopsphere.test", phone: "9876543210" },
    address: { line1: "12 Demo Street", line2: "Near Central Park", city: "New Delhi", state: "Delhi", pincode: "110001" },
    deliveryId: seed.delivery,
    paymentMethod: seed.payment,
    couponCode: null,
  });

  const reached = ORDER_STATUSES.slice(0, ORDER_STATUSES.indexOf(seed.status) + 1);
  return {
    ...order,
    autoProgress: false,
    history: reached.map((status) => ({ status, at: placedAt + (stageOffsetHours[status] ?? 0) * HOUR_MS })),
  };
}
