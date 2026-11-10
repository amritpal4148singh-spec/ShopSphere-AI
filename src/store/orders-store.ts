import { create } from "zustand";

import { orderStorage } from "@/lib/order-storage";
import { SEED_CUSTOMER_ID, createSeedOrders } from "@/data/seed-data";
import type { Order } from "@/types/order";

/** The signed-in customer's orders, newest first. The demo customer starts with one sample order per status. */
interface OrdersState {
  status: "idle" | "ready";
  ownerId: string | null;
  orders: Order[];
  switchOwner: (ownerId: string | null) => void;
  reload: () => void;
  addOrder: (order: Order) => void;
}

function newestFirst(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => b.placedAt - a.placedAt);
}

/** A customer's stored orders, newest first. The demo customer's sample orders are created on first use (also used by the admin order list). */
export function loadOrders(ownerId: string | null): Order[] {
  if (ownerId === null) return [];
  if (ownerId === SEED_CUSTOMER_ID && !orderStorage.has(ownerId)) orderStorage.save(ownerId, createSeedOrders());
  return newestFirst(orderStorage.load(ownerId) ?? []);
}

export const useOrdersStore = create<OrdersState>()((set, get) => ({
  status: "idle",
  ownerId: null,
  orders: [],

  switchOwner: (ownerId) => {
    const { status, ownerId: previous } = get();
    if (status === "ready" && previous === ownerId) return;
    set({ status: "ready", ownerId, orders: loadOrders(ownerId) });
  },

  reload: () => {
    const { status, ownerId } = get();
    if (status === "ready") set({ orders: loadOrders(ownerId) });
  },

  addOrder: (order) => {
    const { ownerId } = get();
    if (ownerId === null) return;
    // Re-read first so an order placed in another tab is never overwritten.
    const latest = orderStorage.load(ownerId) ?? [];
    const next = newestFirst([order, ...latest.filter((existing) => existing.id !== order.id)]);
    orderStorage.save(ownerId, next);
    set({ orders: next });
  },
}));
