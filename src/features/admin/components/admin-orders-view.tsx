"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { useNow } from "@/hooks/use-now";
import { formatInr } from "@/lib/currency";
import { formatDateTime } from "@/lib/format";
import { OrderStatusBadge } from "@/features/orders";
import { useAdminOrdersStore } from "@/store/admin-orders-store";
import { DEFAULT_ORDER_FILTERS, customerOptions, filterAdminOrders, type AdminOrderFilters } from "@/utils/admin-orders";
import { paginate } from "@/utils/discovery";
import { ORDER_STATUSES, STATUS_LABELS, getOrderStatus } from "@/utils/orders";
import type { OrderStatus } from "@/types/order";
import { AdminPage } from "./admin-page";
import { AdminSkeleton, EmptyState } from "./admin-states";

const PAGE_SIZE = 15;
const SELECT = "h-10 w-full rounded-lg border border-input bg-card px-2 text-sm";

/** Order list across all customers, filterable by status, customer and date range (PRD 8.3). */
export function AdminOrdersView() {
  const status = useAdminOrdersStore((state) => state.status);
  const orders = useAdminOrdersStore((state) => state.orders);
  const now = useNow();
  const ids = useId();
  const [filters, setFilters] = useState<AdminOrderFilters>(DEFAULT_ORDER_FILTERS);
  const [page, setPage] = useState(1);

  const customers = useMemo(() => customerOptions(orders), [orders]);
  const filtered = useMemo(() => filterAdminOrders(orders, filters, now), [orders, filters, now]);
  const current = paginate(filtered, page, PAGE_SIZE);
  const rangeInvalid = filters.from !== "" && filters.to !== "" && filters.from > filters.to;

  function update(change: Partial<AdminOrderFilters>) {
    setFilters((value) => ({ ...value, ...change }));
    setPage(1);
  }

  return (
    <AdminPage title="Orders" description="Every order placed on this device, with the customer who placed it. Open an order to simulate moving it along the tracking timeline.">
      {status === "idle" ? (
        <AdminSkeleton label="Loading orders" />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet">Orders appear here as soon as a customer places one.</EmptyState>
      ) : (
        <>
          <form role="search" aria-label="Filter orders" onSubmit={(event) => event.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-q`} className="text-sm font-medium">Order number</label>
              <Input id={`${ids}-q`} type="search" value={filters.query} placeholder="SS-..." onChange={(event) => update({ query: event.target.value.slice(0, 40) })} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-s`} className="text-sm font-medium">Status</label>
              <select id={`${ids}-s`} className={SELECT} value={filters.status} onChange={(event) => update({ status: event.target.value as OrderStatus | "all" })}>
                <option value="all">All statuses</option>
                {ORDER_STATUSES.map((value) => (
                  <option key={value} value={value}>{STATUS_LABELS[value]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-c`} className="text-sm font-medium">Customer</label>
              <select id={`${ids}-c`} className={SELECT} value={filters.customer} onChange={(event) => update({ customer: event.target.value })}>
                <option value="">All customers</option>
                {customers.map((customer) => (
                  <option key={customer.email} value={customer.email}>{`${customer.name} (${customer.email})`}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-f`} className="text-sm font-medium">Placed from</label>
              <Input id={`${ids}-f`} type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-t`} className="text-sm font-medium">Placed until</label>
              <Input id={`${ids}-t`} type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} aria-invalid={rangeInvalid ? true : undefined} aria-describedby={rangeInvalid ? `${ids}-range` : undefined} />
            </div>
          </form>
          {rangeInvalid ? <p id={`${ids}-range`} role="alert" className="text-sm text-destructive">The start date is after the end date, so no orders can match.</p> : null}

          {filtered.length === 0 ? (
            <EmptyState title="No orders match these filters">
              <Button className="mt-2" variant="outline" onClick={() => { setFilters(DEFAULT_ORDER_FILTERS); setPage(1); }}>Clear filters</Button>
            </EmptyState>
          ) : (
            <>
              <p aria-live="polite" className="text-sm text-muted-foreground">{`${filtered.length} ${filtered.length === 1 ? "order" : "orders"}`}</p>
              <div className="relative overflow-x-auto rounded-xl border bg-card shadow-surface">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <caption className="sr-only">Orders</caption>
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Order</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Customer</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Placed</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {current.items.map(({ order }) => (
                      <tr key={order.id}>
                        <th scope="row" className="px-3 py-2 font-medium">
                          <Link href={`/admin/orders/${order.id}`} className="underline-offset-4 hover:underline">{order.id}</Link>
                        </th>
                        <td className="px-3 py-2">{order.customer.name}<span className="block text-xs text-muted-foreground">{order.customer.email}</span></td>
                        <td className="px-3 py-2">{formatDateTime(order.placedAt)}</td>
                        <td className="px-3 py-2"><OrderStatusBadge status={getOrderStatus(order, now)} /></td>
                        <td className="px-3 py-2 text-right">{formatInr(order.totals.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={current.page} totalPages={current.totalPages} onPageChange={setPage} />
            </>
          )}
        </>
      )}
    </AdminPage>
  );
}
