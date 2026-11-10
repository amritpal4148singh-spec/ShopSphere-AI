"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOrdersStore } from "@/store/orders-store";
import { OrderNotFound } from "./order-detail-view";
import { OrderInfoBlocks, OrderItemsList, OrderTotalsList } from "./order-sections";

/** Step 6 of checkout. Reads the stored order, so a refresh shows the same confirmation (PRD 5.6). */
export function OrderConfirmation({ orderId }: { orderId: string }) {
  const status = useOrdersStore((state) => state.status);
  const order = useOrdersStore((state) => state.orders.find((candidate) => candidate.id === orderId));

  if (status === "idle") {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <p role="status" className="sr-only">
          Loading your order
        </p>
        <div aria-hidden="true" className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }
  if (!order) return <OrderNotFound />;

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div role="status" className="flex items-start gap-3 rounded-xl border border-primary bg-accent p-5">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
        <div>
          <h1 className="page-title">Thank you, your order is placed</h1>
          <p className="mt-1">
            Your order number is <strong data-testid="confirmation-order-id">{order.id}</strong>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">This was a test-mode order: no real payment was made and nothing will be shipped.</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <OrderItemsList order={order} />
        <OrderInfoBlocks order={order} />
        <OrderTotalsList order={order} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/orders/${order.id}`}>Track this order</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>
    </section>
  );
}
