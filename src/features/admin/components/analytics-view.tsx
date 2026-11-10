"use client";

import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { LocalBadge } from "@/components/ui/local-badge";
import { BASELINE_COUNTS } from "@/data/analytics-data";
import { formatDateTime } from "@/lib/format";
import { useAnalyticsStore } from "@/store/analytics-store";
import { STRATEGY_LABELS, formatPercent, summarizeAnalytics } from "@/utils/analytics";
import { AdminPage } from "./admin-page";
import { AdminSkeleton } from "./admin-states";
import { MetricCard } from "./metric-card";

/**
 * Recommendation analytics (PRD 8.4): impressions, clicks, simulated conversion and the engagement of each strategy.
 * Every figure is derived from local data and labelled "Local Analytics". The seeded sample baseline can be switched off.
 */
export function AnalyticsView() {
  const status = useAnalyticsStore((state) => state.status);
  const counts = useAnalyticsStore((state) => state.counts);
  const since = useAnalyticsStore((state) => state.since);
  const reset = useAnalyticsStore((state) => state.reset);
  const baselineId = useId();
  const [includeBaseline, setIncludeBaseline] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");

  const summary = useMemo(() => summarizeAnalytics(counts, includeBaseline ? BASELINE_COUNTS : null), [counts, includeBaseline]);
  const topClicks = Math.max(1, ...summary.rows.map((row) => row.clicks));

  const description = (
    <>
      How the recommendation rails perform. <strong>Local Analytics:</strong> every figure comes from events recorded in this browser (and optional simulated sample data), not from an analytics service.
    </>
  );

  if (status === "idle") {
    return (
      <AdminPage title="Recommendation analytics" description={description}>
        <AdminSkeleton label="Loading analytics" />
      </AdminPage>
    );
  }

  const { totals } = summary;
  const noData = totals.impressions === 0;

  return (
    <AdminPage
      title="Recommendation analytics"
      description={description}
      actions={<span className="rounded-full border px-3 py-1 text-xs font-semibold">Local Analytics</span>}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card shadow-surface p-4">
        <label htmlFor={baselineId} className="flex items-center gap-2 text-sm">
          <input id={baselineId} type="checkbox" checked={includeBaseline} onChange={(event) => setIncludeBaseline(event.target.checked)} className="size-4" />
          Include simulated sample baseline
        </label>
        <p className="text-sm text-muted-foreground">{`Tracking on this device since ${formatDateTime(since)}.`}</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <LocalBadge />
          {confirming ? (
            <div role="group" aria-label="Confirm resetting tracked analytics" className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Erase the events tracked on this device?</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  reset();
                  setConfirming(false);
                  setNotice("Tracked events were erased (local simulation). The sample baseline is unaffected.");
                }}
              >
                Confirm reset
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              Reset tracked events
            </Button>
          )}
        </div>
      </div>
      <p role="status" className="min-h-5 text-sm font-medium text-primary">
        {notice}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Impressions" value={totals.impressions.toLocaleString("en-IN")} note="Product cards shown in recommendation rails" />
        <MetricCard label="Clicks" value={totals.clicks.toLocaleString("en-IN")} note={`Click-through rate ${formatPercent(totals.clickThroughRate)}`} />
        <MetricCard label="Conversions" value={totals.conversions.toLocaleString("en-IN")} note="Clicked recommendations later added to the cart" />
        <MetricCard label="Conversion rate" tag="Simulated" value={formatPercent(totals.conversionRate)} note="Conversions divided by clicks" />
      </div>

      {noData ? (
        <div className="rounded-xl border bg-card shadow-surface p-6">
          <h2 className="section-title">No recommendation activity tracked yet</h2>
          <p className="mt-1 text-muted-foreground">Browse the storefront and open a recommended product to record events, or switch the simulated sample baseline back on.</p>
        </div>
      ) : (
        <section aria-labelledby="types-heading">
          <h2 id="types-heading" className="section-title">
            Popular recommendation types
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Ordered by engagement (clicks). The nine PRD strategies are listed with the editorial Featured rail.</p>
          <div className="mt-3 overflow-x-auto rounded-xl border bg-card shadow-surface">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Recommendation engagement by strategy</caption>
              <thead className="border-b bg-muted/50">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Strategy</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Impressions</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Clicks</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Click-through</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Conversions</th>
                  <th scope="col" className="w-40 px-3 py-2 font-semibold">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.rows.map((row) => (
                  <tr key={row.strategy} data-strategy={row.strategy}>
                    <th scope="row" className="px-3 py-2 font-medium">{STRATEGY_LABELS[row.strategy]}</th>
                    <td className="px-3 py-2 text-right">{row.impressions.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right">{row.clicks.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-right">{formatPercent(row.clickThroughRate)}</td>
                    <td className="px-3 py-2 text-right">{row.conversions.toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2">
                      <span aria-hidden="true" className="block h-2.5 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((row.clicks / topClicks) * 100)}%` }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminPage>
  );
}
