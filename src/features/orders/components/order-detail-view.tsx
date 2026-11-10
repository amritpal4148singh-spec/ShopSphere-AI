"use client";

import Link from "next/link";
import { PackageX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { formatDateTime } from "@/lib/format";
import { useOrdersStore } from "@/store/orders-store";
import { buildTimeline, getOrderStatus } from "@/utils/orders";
import { OrderInfoBlocks, OrderItemsList, OrderTotalsList } from "./order-sections";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderTimeline } from "./order-timeline";

export function OrderNotFound() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
      <PackageX aria-hidden="true" className="size-10 text-muted-foreground" />
      <h1 className="mt-4 page-title">Order not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">We could not find an order with that number on your account.</p>
      <Button asChild className="mt-6">
        <Link href="/orders">Go to your orders</Link>
      </Button>
    </section>
  );
}

/** One order with its tracking timeline, items, delivery details and totals (PRD 5.8, MOD-08-001). */
export function OrderDetailView({ orderId }: { orderId: string }) {
  const status = useOrdersStore((state) => state.status);
  const order = useOrdersStore((state) => state.orders.find((candidate) => candidate.id === orderId));
  const now = useNow();

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
    <article className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm">
        <Link href="/orders" className="text-primary underline-offset-4 hover:underline">
          Your orders
        </Link>
      </p>
      <header className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">{`Order ${order.id}`}</h1>
          <p className="text-sm text-muted-foreground">{`Placed ${formatDateTime(order.placedAt)}`}</p>
        </div>
        <OrderStatusBadge status={getOrderStatus(order, now)} />
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-labelledby="tracking-heading">
          <h2 id="tracking-heading" className="section-title">
            Tracking
          </h2>
          <div className="mt-4">
            <OrderTimeline stages={buildTimeline(order, now)} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Tracking is simulated for this demo
            {order.autoProgress ? ", and moves forward over a few minutes." : "."}
          </p>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="items-heading">
            <h2 id="items-heading" className="mb-3 section-title">
              Items
            </h2>
            <OrderItemsList order={order} />
          </section>
          <OrderInfoBlocks order={order} />
          <OrderTotalsList order={order} />
        </div>
      </div>
    </article>
  );
}
