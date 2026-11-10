"use client";

import Link from "next/link";
import { PackageX } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LocalBadge } from "@/components/ui/local-badge";
import { OrderInfoBlocks, OrderItemsList, OrderStatusBadge, OrderTimeline, OrderTotalsList } from "@/features/orders";
import { useNow } from "@/hooks/use-now";
import { formatDateTime } from "@/lib/format";
import { useAdminOrdersStore } from "@/store/admin-orders-store";
import { nextStatus } from "@/utils/admin-orders";
import { STATUS_LABELS, buildTimeline, getOrderStatus } from "@/utils/orders";
import { AdminPage } from "./admin-page";
import { AdminSkeleton } from "./admin-states";

/** One order with line items, customer and totals, and a control that simulates advancing its tracking status (PRD 8.3). */
export function AdminOrderDetailView({ orderId }: { orderId: string }) {
  const status = useAdminOrdersStore((state) => state.status);
  const entry = useAdminOrdersStore((state) => state.orders.find((candidate) => candidate.order.id === orderId));
  const saveFailed = useAdminOrdersStore((state) => state.saveFailed);
  const advance = useAdminOrdersStore((state) => state.advance);
  const now = useNow();
  const [notice, setNotice] = useState("");

  if (status === "idle") return <AdminPage title="Order"><AdminSkeleton label="Loading the order" /></AdminPage>;

  if (!entry) {
    return (
      <AdminPage title="Order not found">
        <div className="flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
          <PackageX aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="max-w-md text-muted-foreground">No order with that number exists on this device.</p>
          <Button asChild><Link href="/admin/orders">Back to orders</Link></Button>
        </div>
      </AdminPage>
    );
  }

  const { order, ownerId } = entry;
  const current = getOrderStatus(order, now);
  const next = nextStatus(order, now);

  return (
    <AdminPage
      title={`Order ${order.id}`}
      description={`Placed ${formatDateTime(order.placedAt)}`}
      actions={
        <span className="flex items-center gap-3">
          <OrderStatusBadge status={current} />
          <Button asChild variant="outline"><Link href="/admin/orders">Back to orders</Link></Button>
        </span>
      }
    >
      <section aria-labelledby="advance-heading" className="flex flex-wrap items-center gap-3 rounded-xl border bg-card shadow-surface p-4">
        <h2 id="advance-heading" className="section-title">Tracking status</h2>
        <LocalBadge />
        {next ? (
          <Button
            onClick={() => {
              const outcome = advance(ownerId, order.id);
              setNotice(outcome === "advanced" ? `Order moved to "${STATUS_LABELS[next]}" (local simulation). The customer sees it the next time they open their orders.` : "The order could not be advanced.");
            }}
          >
            {`Advance to ${STATUS_LABELS[next]}`}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">This order is delivered; there is no later stage.</p>
        )}
        <p role="status" className="basis-full text-sm font-medium text-primary empty:hidden">{notice}</p>
        {saveFailed ? <p role="alert" className="basis-full text-sm text-destructive">Your browser would not save this change.</p> : null}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="section-title">Tracking</h2>
          <div className="mt-4"><OrderTimeline stages={buildTimeline(order, now)} /></div>
        </section>
        <div className="space-y-6">
          <section aria-labelledby="customer-heading" className="rounded-xl border bg-card shadow-surface p-4 text-sm">
            <h2 id="customer-heading" className="section-title">Customer</h2>
            <dl className="mt-2 grid gap-1 sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">Name</dt><dd>{order.customer.name}</dd>
              <dt className="text-muted-foreground">Email</dt><dd>{order.customer.email}</dd>
              <dt className="text-muted-foreground">Mobile</dt><dd>{order.customer.phone}</dd>
              <dt className="text-muted-foreground">Account</dt><dd className="break-all">{ownerId}</dd>
            </dl>
          </section>
          <section aria-labelledby="items-heading">
            <h2 id="items-heading" className="mb-3 section-title">Items</h2>
            <OrderItemsList order={order} />
          </section>
          <OrderInfoBlocks order={order} />
          <OrderTotalsList order={order} />
        </div>
      </div>
    </AdminPage>
  );
}
