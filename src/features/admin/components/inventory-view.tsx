"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalBadge } from "@/components/ui/local-badge";
import { Pagination } from "@/components/ui/pagination";
import { useAdminCatalogueStore } from "@/store/admin-catalogue-store";
import { LIMITS, valuesOf } from "@/utils/admin-catalogue";
import { paginate } from "@/utils/discovery";
import type { AdminProduct } from "@/types/admin";
import { useAdminProducts } from "../hooks/use-admin-products";
import { AdminPage } from "./admin-page";
import { AdminError, AdminSkeleton, EmptyState } from "./admin-states";
import { StockBadge } from "./stock-badge";

const PAGE_SIZE = 20;
type Show = "all" | "attention" | "low" | "out";

function StockRow({ product, onSave }: { product: AdminProduct; onSave: (product: AdminProduct, stock: number) => void }) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [value, setValue] = useState(String(product.stock));
  const [error, setError] = useState("");

  function submit() {
    const text = value.trim();
    if (!/^\d+$/.test(text) || Number(text) > LIMITS.stock) {
      setError(`Enter a whole number from 0 to ${LIMITS.stock.toLocaleString("en-IN")}.`);
      return;
    }
    setError("");
    onSave(product, Number(text));
  }

  return (
    <tr>
      <th scope="row" className="px-3 py-2 font-medium">
        <Link href={`/admin/products/${product.id}`} className="underline-offset-4 hover:underline">{product.title}</Link>
        <span className="block text-xs font-normal text-muted-foreground">{`#${product.id}`}</span>
      </th>
      <td className="px-3 py-2 text-right">{product.stock}</td>
      <td className="px-3 py-2"><StockBadge availability={product.availability} /></td>
      <td className="px-3 py-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex flex-wrap items-start gap-2"
        >
          <div>
            <label htmlFor={inputId} className="sr-only">{`Set stock for ${product.title}`}</label>
            <Input id={inputId} inputMode="numeric" value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} className="h-9 w-24" />
            {error ? <p id={errorId} className="mt-1 max-w-48 text-xs text-destructive">{error}</p> : null}
          </div>
          <Button type="submit" size="sm" variant="outline">
            Set stock<span className="sr-only">{` for ${product.title}`}</span>
          </Button>
        </form>
      </td>
    </tr>
  );
}

/** Inventory view (PRD 8.2): stock levels with low-stock indicators and simulated stock adjustments. */
export function InventoryView() {
  const { loading, error, retry, products } = useAdminProducts();
  const save = useAdminCatalogueStore((state) => state.save);
  const ids = useId();
  const [show, setShow] = useState<Show>("attention");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return products
      .filter((product) => product.status === "active")
      .filter((product) => (show === "all" ? true : show === "low" ? product.availability === "low-stock" : show === "out" ? product.availability === "out-of-stock" : product.availability !== "in-stock"))
      .filter((product) => text === "" || `${product.title} ${product.brand ?? ""} ${product.id}`.toLowerCase().includes(text))
      .sort((a, b) => a.stock - b.stock || a.title.localeCompare(b.title));
  }, [products, show, query]);
  const current = paginate(rows, page, PAGE_SIZE);
  const counts = useMemo(() => {
    const active = products.filter((product) => product.status === "active");
    return { low: active.filter((p) => p.availability === "low-stock").length, out: active.filter((p) => p.availability === "out-of-stock").length };
  }, [products]);

  return (
    <AdminPage
      title="Inventory"
      description="Stock levels with low-stock indicators. Adjusting stock here is a local simulation and does not change what shoppers can buy."
      actions={<LocalBadge />}
    >
      {loading ? (
        <AdminSkeleton label="Loading inventory" />
      ) : error ? (
        <AdminError error={error} onRetry={retry} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{`${counts.low} low on stock and ${counts.out} out of stock among active products.`}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-show`} className="text-sm font-medium">Show</label>
              <select id={`${ids}-show`} value={show} onChange={(event) => { setShow(event.target.value as Show); setPage(1); }} className="h-10 rounded-lg border border-input bg-card px-2 text-sm">
                <option value="attention">Needs attention (low or out)</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
                <option value="all">All active products</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-q`} className="text-sm font-medium">Search inventory</label>
              <Input id={`${ids}-q`} type="search" value={query} onChange={(event) => { setQuery(event.target.value.slice(0, 100)); setPage(1); }} placeholder="Title, brand or id" />
            </div>
          </div>

          <p role="status" className="min-h-5 text-sm font-medium text-primary">{notice}</p>

          {rows.length === 0 ? (
            <EmptyState title="Nothing to show">No active products match this view.</EmptyState>
          ) : (
            <>
              <div className="relative overflow-x-auto rounded-xl border bg-card shadow-surface">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <caption className="sr-only">Inventory</caption>
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Product</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Units</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Level</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Adjust stock (simulated)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {current.items.map((product) => (
                      <StockRow
                        key={`${product.id}-${product.stock}`}
                        product={product}
                        onSave={(target, stock) => {
                          save(target, { ...valuesOf(target), stock });
                          setNotice(`Stock for "${target.title}" set to ${stock} (local simulation).`);
                        }}
                      />
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
