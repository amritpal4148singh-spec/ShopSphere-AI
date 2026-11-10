"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { BASELINE_COUNTS } from "@/data/analytics-data";
import { SIMULATED_VISITS } from "@/data/analytics-data";
import { SignedInAs } from "@/features/auth";
import { formatInr } from "@/lib/currency";
import { listUsers } from "@/services/auth";
import { useAdminOrdersStore } from "@/store/admin-orders-store";
import { useAnalyticsStore } from "@/store/analytics-store";
import { formatPercent, summarizeAnalytics } from "@/utils/analytics";
import { computeOverview } from "@/utils/admin-metrics";
import { cn } from "@/lib/utils";
import { useAdminProducts } from "../hooks/use-admin-products";
import { AdminError, AdminSkeleton } from "./admin-states";
import { AdminPage } from "./admin-page";
import { MetricCard } from "./metric-card";

type TopView = "sales" | "rating";

/** Dashboard overview (PRD 8.1): totals, simulated revenue and conversion, top products, low-stock alerts, recommendation click-through. */
export function OverviewView() {
  const { loading, error, retry, products } = useAdminProducts();
  const orderStatus = useAdminOrdersStore((state) => state.status);
  const orders = useAdminOrdersStore((state) => state.orders);
  const counts = useAnalyticsStore((state) => state.counts);
  const productViews = useAnalyticsStore((state) => state.productViews);
  const [topView, setTopView] = useState<TopView>("sales");

  const customerCount = useMemo(() => listUsers().filter((user) => user.role === "customer").length, []);
  const recommendation = useMemo(() => summarizeAnalytics(counts, BASELINE_COUNTS).totals, [counts]);
  const metrics = useMemo(
    () => computeOverview({ products, orders, customerCount, visits: SIMULATED_VISITS + productViews }),
    [products, orders, customerCount, productViews],
  );

  const intro = (
    <>
      A snapshot of the catalogue, orders and recommendation engine. Figures marked <strong>Simulated</strong> or <strong>Local Analytics</strong> come from local demo data, not a live system.
    </>
  );

  if (loading || orderStatus === "idle") {
    return (
      <AdminPage title="Admin dashboard" description={intro}>
        <AdminSkeleton label="Loading the dashboard" />
      </AdminPage>
    );
  }

  return (
    <AdminPage title="Admin dashboard" description={intro}>
      <SignedInAs />

      {error ? (
        <AdminError error={error} onRetry={retry} />
      ) : (
        <>
          <section aria-labelledby="totals-heading">
            <h2 id="totals-heading" className="sr-only">
              Key figures
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard label="Total products" value={metrics.totalProducts} note={metrics.archivedProducts > 0 ? `${metrics.archivedProducts} archived, not counted` : "Active products"} />
              <MetricCard label="Total orders" value={metrics.totalOrders} note="Across every customer on this device" />
              <MetricCard label="Total customers" value={metrics.totalCustomers} note="Customer accounts in the local user store" />
              <MetricCard label="Revenue" tag="Simulated" value={formatInr(metrics.simulatedRevenue)} note="Sum of simulated order totals" />
              <MetricCard
                label="Conversion rate"
                tag="Simulated"
                value={formatPercent(metrics.simulatedConversionRate)}
                note={`Orders divided by ${metrics.simulatedVisits.toLocaleString("en-IN")} visits (sample baseline plus product pages viewed on this device)`}
              />
              <MetricCard label="Recommendation click-through" tag="Local Analytics" value={formatPercent(recommendation.clickThroughRate)} note={`${recommendation.clicks.toLocaleString("en-IN")} clicks from ${recommendation.impressions.toLocaleString("en-IN")} impressions`} />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="top-heading" className="rounded-xl border bg-card shadow-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="top-heading" className="section-title">
                  Top-performing products
                </h2>
                <div role="group" aria-label="Rank products by" className="flex gap-1">
                  {(["sales", "rating"] as const).map((view) => (
                    <Button key={view} size="sm" variant="outline" aria-pressed={topView === view} onClick={() => setTopView(view)} className={cn(topView === view && "border-primary bg-accent text-accent-foreground")}>
                      {view === "sales" ? "By simulated sales" : "By rating"}
                    </Button>
                  ))}
                </div>
              </div>
              {topView === "sales" ? (
                metrics.topBySales.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No orders yet, so there are no sales to rank.</p>
                ) : (
                  <ol aria-label="Top products by simulated sales" className="mt-4 space-y-2">
                    {metrics.topBySales.map((item) => (
                      <li key={item.productId} className="flex items-baseline justify-between gap-3 text-sm">
                        <Link href={`/admin/products/${item.productId}`} className="min-w-0 truncate underline-offset-4 hover:underline">
                          {item.title}
                        </Link>
                        <span className="shrink-0 text-muted-foreground">{`${item.units} sold · ${formatInr(item.revenue)}`}</span>
                      </li>
                    ))}
                  </ol>
                )
              ) : (
                <ol aria-label="Top products by rating" className="mt-4 space-y-2">
                  {metrics.topByRating.map((item) => (
                    <li key={item.productId} className="flex items-baseline justify-between gap-3 text-sm">
                      <Link href={`/admin/products/${item.productId}`} className="min-w-0 truncate underline-offset-4 hover:underline">
                        {item.title}
                      </Link>
                      <span className="shrink-0 text-muted-foreground">{`${item.rating.toFixed(1)} out of 5`}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="stock-heading" className="rounded-xl border bg-card shadow-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="stock-heading" className="section-title">
                  Low-stock alerts
                </h2>
                <Link href="/admin/inventory" className="text-sm text-primary underline-offset-4 hover:underline">
                  Open inventory
                </Link>
              </div>
              {metrics.lowStock.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Every active product has healthy stock.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">{`${metrics.outOfStockCount} out of stock. Showing the lowest ${metrics.lowStock.length}.`}</p>
                  <ul aria-label="Products running low" className="mt-3 space-y-2">
                    {metrics.lowStock.map((product) => (
                      <li key={product.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <Link href={`/admin/products/${product.id}`} className="min-w-0 truncate underline-offset-4 hover:underline">
                          {product.title}
                        </Link>
                        <span className={cn("shrink-0 font-medium", product.stock === 0 && "text-destructive")}>{product.stock === 0 ? "Out of stock" : `${product.stock} left`}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </AdminPage>
  );
}
