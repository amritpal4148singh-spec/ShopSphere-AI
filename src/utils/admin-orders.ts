import { ORDER_STATUSES, getCompletedStages, getOrderStatus } from "@/utils/orders";
import type { AdminOrder } from "@/types/admin";
import type { Order, OrderStatus } from "@/types/order";

export interface AdminOrderFilters {
  status: OrderStatus | "all";
  /** A customer's email (lower case), or empty for everyone. */
  customer: string;
  /** Inclusive dates as YYYY-MM-DD, or empty. */
  from: string;
  to: string;
  /** Matches the order number. */
  query: string;
}

export const DEFAULT_ORDER_FILTERS: AdminOrderFilters = { status: "all", customer: "", from: "", to: "", query: "" };

function startOfDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const time = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  return Number.isFinite(time) ? time : null;
}

const DAY_MS = 86_400_000;

/** Filters by status, customer, date range (PRD 8.3) and order number. `now` decides the status of auto-progressing orders. */
export function filterAdminOrders(orders: readonly AdminOrder[], filters: AdminOrderFilters, now: number): AdminOrder[] {
  const from = startOfDay(filters.from);
  const to = startOfDay(filters.to);
  const query = filters.query.trim().toLowerCase();
  return orders.filter(({ order }) => {
    if (filters.status !== "all" && getOrderStatus(order, now) !== filters.status) return false;
    if (filters.customer && order.customer.email.toLowerCase() !== filters.customer) return false;
    if (from !== null && order.placedAt < from) return false;
    if (to !== null && order.placedAt >= to + DAY_MS) return false;
    return query === "" || order.id.toLowerCase().includes(query);
  });
}

/** The customers that appear in the orders, for the customer filter. */
export function customerOptions(orders: readonly AdminOrder[]): Array<{ email: string; name: string }> {
  const byEmail = new Map<string, string>();
  for (const { order } of orders) byEmail.set(order.customer.email.toLowerCase(), order.customer.name);
  return [...byEmail].map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function nextStatus(order: Order, now: number): OrderStatus | null {
  return ORDER_STATUSES[ORDER_STATUSES.indexOf(getOrderStatus(order, now)) + 1] ?? null;
}

/**
 * Simulates moving an order to its next tracking stage (PRD 8.3). A time-driven order is frozen first: the stages
 * it has reached by `now` become its history, so the stage the administrator chose stays put. Null when delivered.
 */
export function advanceOrder(order: Order, now: number): Order | null {
  const next = nextStatus(order, now);
  if (next === null) return null;
  return { ...order, autoProgress: false, history: [...getCompletedStages(order, now), { status: next, at: now }] };
}
