import type { AddressFields, CustomerInfo, DeliveryId, PaymentMethodId } from "@/types/checkout";

/** PRD 5.8: Order Placed -> Confirmed -> Packed -> Shipped -> Out for Delivery -> Delivered. */
export type OrderStatus = "placed" | "confirmed" | "packed" | "shipped" | "out-for-delivery" | "delivered";

export interface OrderItem {
  productId: number;
  title: string;
  thumbnail: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
}

export interface OrderStageRecord {
  status: OrderStatus;
  /** Epoch milliseconds. */
  at: number;
}

export interface Order {
  id: string;
  placedAt: number;
  items: OrderItem[];
  customer: CustomerInfo;
  address: AddressFields;
  delivery: { id: DeliveryId; label: string; fee: number };
  payment: { method: PaymentMethodId; label: string };
  totals: OrderTotals;
  /** Epoch milliseconds: the end of the simulated delivery window. */
  expectedDelivery: number;
  /** Stages completed so far, with timestamps. For auto-progressing orders this is derived from time instead. */
  history: OrderStageRecord[];
  /** New orders advance on their own over a few minutes (simulated); sample orders stay at their status. */
  autoProgress: boolean;
}

export type StageState = "completed" | "current" | "upcoming";

export interface TimelineStage {
  status: OrderStatus;
  label: string;
  state: StageState;
  /** Epoch ms when the stage completed, or null if it has not happened yet. */
  at: number | null;
}
