"use client";

import Link from "next/link";
import { PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { formatInr } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { useOrdersStore } from "@/store/orders-store";
import { getOrderStatus } from "@/utils/orders";
import { OrderStatusBadge } from "./order-status-badge";

function OrdersSkeleton() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <p role="status" className="sr-only">
        Loading your orders
      </p>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

/** Order history, newest first, with each order's current simulated status (PRD 5.8). */
export function OrdersView() {
  const status = useOrdersStore((state) => state.status);
  const orders = useOrdersStore((state) => state.orders);
  const now = useNow();

  if (status === "idle") return <OrdersSkeleton />;

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="page-title">Your orders</h1>

      {orders.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
          <PackageOpen aria-hidden="true" className="size-8 text-muted-foreground" />
          <h2 className="section-title">You have no orders yet</h2>
          <p className="max-w-md text-muted-foreground">When you place an order, you can follow it here.</p>
          <Button asChild>
            <Link href="/products">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <>
          <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">{`${orders.length} ${orders.length === 1 ? "order" : "orders"}`}</p>
          <ul className="mt-4 space-y-3">
            {orders.map((order) => {
              const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <li key={order.id}>
                  <Link href={`/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border p-4 transition-colors hover:bg-accent/50">
                    <div className="min-w-0">
                      <p className="font-semibold">{order.id}</p>
                      <p className="text-sm text-muted-foreground">{`Placed ${formatDateTime(order.placedAt)}`}</p>
                      <p className="text-sm text-muted-foreground">{`${units} ${units === 1 ? "item" : "items"}`}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <OrderStatusBadge status={getOrderStatus(order, now)} />
                      <span className="font-semibold">{formatInr(order.totals.total)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
