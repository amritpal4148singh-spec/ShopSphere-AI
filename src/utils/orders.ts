import { computeCheckoutTotals, getDeliveryMethod, getDeliveryWindow, getPaymentMethod, normalizePhone } from "@/utils/checkout";
import type { AddressFields, CustomerInfo, DeliveryId, PaymentMethodId } from "@/types/checkout";
import type { Order, OrderItem, OrderStageRecord, OrderStatus, TimelineStage } from "@/types/order";

export const ORDER_STATUSES: readonly OrderStatus[] = ["placed", "confirmed", "packed", "shipped", "out-for-delivery", "delivered"];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  "out-for-delivery": "Out for Delivery",
  delivered: "Delivered",
};

/**
 * Simulated progression for new orders (PRD 5.8 allows time-based simulation): stages complete this long after
 * the order is placed. Deliberately fast so the timeline can be watched during a demo.
 */
export const AUTO_PROGRESS_OFFSETS_MS: Record<OrderStatus, number> = {
  placed: 0,
  confirmed: 30_000,
  packed: 2 * 60_000,
  shipped: 5 * 60_000,
  "out-for-delivery": 8 * 60_000,
  delivered: 12 * 60_000,
};

/** Stages completed at `now`, with their timestamps. */
export function getCompletedStages(order: Order, now: number): OrderStageRecord[] {
  if (!order.autoProgress) return order.history;

  const elapsed = now - order.placedAt;
  return ORDER_STATUSES.filter((status) => elapsed >= AUTO_PROGRESS_OFFSETS_MS[status]).map((status) => ({
    status,
    at: order.placedAt + AUTO_PROGRESS_OFFSETS_MS[status],
  }));
}

export function getOrderStatus(order: Order, now: number): OrderStatus {
  const completed = getCompletedStages(order, now);
  return completed[completed.length - 1]?.status ?? "placed";
}

/** The full six-stage timeline: completed with timestamps, the current stage, and upcoming stages (PRD MOD-08-001). */
export function buildTimeline(order: Order, now: number): TimelineStage[] {
  const completed = getCompletedStages(order, now);
  const times = new Map(completed.map((record) => [record.status, record.at]));
  const currentIndex = completed.length === 0 ? 0 : ORDER_STATUSES.indexOf(completed[completed.length - 1]?.status ?? "placed");

  return ORDER_STATUSES.map((status, index) => {
    const at = times.get(status) ?? null;
    const state = index < currentIndex || (index === currentIndex && status === "delivered") ? "completed" : index === currentIndex ? "current" : "upcoming";
    return { status, label: STATUS_LABELS[status], state, at: state === "upcoming" ? null : at };
  });
}

export interface BuildOrderInput {
  id: string;
  now: number;
  items: OrderItem[];
  customer: CustomerInfo;
  address: AddressFields;
  deliveryId: DeliveryId;
  paymentMethod: PaymentMethodId;
  couponCode: string | null;
}

/** Builds the order record from what was actually in the cart and chosen at checkout. */
export function buildOrder(input: BuildOrderInput): Order {
  const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totals = computeCheckoutTotals(subtotal, input.couponCode, input.deliveryId, new Date(input.now));
  const method = getDeliveryMethod(input.deliveryId);
  const window = getDeliveryWindow(method, new Date(input.now));

  return {
    id: input.id,
    placedAt: input.now,
    items: input.items,
    customer: { ...input.customer, name: input.customer.name.trim(), email: input.customer.email.trim(), phone: normalizePhone(input.customer.phone) },
    address: {
      line1: input.address.line1.trim(),
      line2: input.address.line2.trim(),
      city: input.address.city.trim(),
      state: input.address.state.trim(),
      pincode: input.address.pincode.trim(),
    },
    delivery: { id: method.id, label: method.label, fee: totals.shipping },
    payment: { method: input.paymentMethod, label: getPaymentMethod(input.paymentMethod).label },
    totals: {
      subtotal,
      discount: totals.discount,
      shipping: totals.shipping,
      tax: totals.tax,
      total: totals.total,
      couponCode: totals.coupon?.ok ? totals.coupon.coupon.code : null,
    },
    expectedDelivery: window.latest.getTime(),
    history: [{ status: "placed", at: input.now }],
    autoProgress: true,
  };
}
