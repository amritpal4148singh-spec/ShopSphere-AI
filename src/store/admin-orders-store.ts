import { create } from "zustand";

import { listOrderOwnerIds, orderStorage } from "@/lib/order-storage";
import { SEED_CUSTOMER_ID } from "@/data/seed-data";
import { loadOrders } from "@/store/orders-store";
import { advanceOrder } from "@/utils/admin-orders";
import type { AdminOrder } from "@/types/admin";

/**
 * Orders of every customer on this device, for the administrator (PRD 8.3). Orders are stored per customer, so this
 * reads each customer's stored orders and writes back to that customer's own storage when a status is advanced.
 */
interface AdminOrdersState {
  status: "idle" | "ready";
  orders: AdminOrder[];
  saveFailed: boolean;
  load: () => void;
  /** Simulates the next tracking stage. Returns "missing" if the order is gone and "delivered" if there is no next stage. */
  advance: (ownerId: string, orderId: string) => "advanced" | "delivered" | "missing";
}

function loadEveryOrder(): AdminOrder[] {
  // The demo customer's sample orders exist once their account has been used or looked up; include them here too.
  const owners = new Set([SEED_CUSTOMER_ID, ...listOrderOwnerIds()]);
  return [...owners].flatMap((ownerId) => loadOrders(ownerId).map((order) => ({ ownerId, order }))).sort((a, b) => b.order.placedAt - a.order.placedAt);
}

export const useAdminOrdersStore = create<AdminOrdersState>()((set) => ({
  status: "idle",
  orders: [],
  saveFailed: false,

  load: () => set({ status: "ready", orders: loadEveryOrder() }),

  advance: (ownerId, orderId) => {
    const stored = orderStorage.load(ownerId) ?? loadOrders(ownerId);
    const order = stored.find((candidate) => candidate.id === orderId);
    if (!order) return "missing";
    const next = advanceOrder(order, Date.now());
    if (next === null) return "delivered";
    const saved = orderStorage.save(ownerId, stored.map((candidate) => (candidate.id === orderId ? next : candidate)));
    set({ status: "ready", orders: loadEveryOrder(), saveFailed: !saved });
    return "advanced";
  },
}));
