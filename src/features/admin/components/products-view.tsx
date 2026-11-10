"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalBadge } from "@/components/ui/local-badge";
import { Pagination } from "@/components/ui/pagination";
import { formatInr } from "@/lib/currency";
import { useAdminCatalogueStore } from "@/store/admin-catalogue-store";
import { useAdminOrdersStore } from "@/store/admin-orders-store";
import { ADMIN_SORT_LABELS, DEFAULT_FILTERS, filterAdminProducts, sortAdminProducts, type AdminProductFilters, type AdminSort, type StatusFilter } from "@/utils/admin-catalogue";
import { paginate } from "@/utils/discovery";
import { cn } from "@/lib/utils";
import type { AdminProduct } from "@/types/admin";
import { useAdminProducts } from "../hooks/use-admin-products";
import { AdminPage } from "./admin-page";
import { AdminError, AdminSkeleton, EmptyState } from "./admin-states";
import { StockBadge } from "./stock-badge";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All (except removed)" },
  { value: "active", label: "Active" },
  { value: "low-stock", label: "Low stock" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "archived", label: "Archived" },
  { value: "removed", label: "Removed locally" },
];
const SELECT = "h-10 w-full rounded-lg border border-input bg-card px-2 text-sm";

function RowActions({ product, onDelete, onRestore }: { product: AdminProduct; onDelete: () => void; onRestore: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (product.status !== "active") {
    return (
      <Button size="sm" variant="outline" onClick={onRestore}>
        Restore<span className="sr-only">{` ${product.title}`}</span>
      </Button>
    );
  }
  if (confirming) {
    return (
      <div role="group" aria-label={`Confirm deleting ${product.title}`} className="flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            setConfirming(false);
            onDelete();
          }}
        >
          Confirm delete
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      Delete<span className="sr-only">{` ${product.title}`}</span>
    </Button>
  );
}

/** Searchable, filterable product list with delete and restore (PRD 8.2). Deleting a product that orders reference archives it (edge case 27). */
export function ProductsView() {
  const { loading, error, retry, products, categories, referenced } = useAdminProducts();
  const orders = useAdminOrdersStore((state) => state.orders);
  const remove = useAdminCatalogueStore((state) => state.remove);
  const restore = useAdminCatalogueStore((state) => state.restore);
  const saveFailed = useAdminCatalogueStore((state) => state.saveFailed);
  const ids = useId();

  const [filters, setFilters] = useState<AdminProductFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<AdminSort>("title");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => sortAdminProducts(filterAdminProducts(products, filters), sort), [products, filters, sort]);
  const current = paginate(filtered, page, PAGE_SIZE);
  const categoryName = useMemo(() => new Map(categories.map((category) => [category.slug, category.name])), [categories]);

  function update(change: Partial<AdminProductFilters>) {
    setFilters((value) => ({ ...value, ...change }));
    setPage(1);
  }

  function handleDelete(product: AdminProduct) {
    const outcome = remove(product, referenced);
    if (outcome === "archived") {
      const count = orders.filter((entry) => entry.order.items.some((item) => item.productId === product.id)).length;
      setNotice(`"${product.title}" is in ${count} existing ${count === 1 ? "order" : "orders"}, so it was archived instead of deleted to keep order history intact (local simulation).`);
    } else {
      setNotice(`"${product.title}" was removed (local simulation). Use the "Removed locally" filter to restore it.`);
    }
  }

  const header = (
    <AdminPage
      title="Products"
      description="Search, filter and manage the catalogue. Edits, additions and deletions are local simulations: they are kept in this browser and do not change the storefront."
      actions={
        <span className="flex items-center gap-2">
          <LocalBadge />
          <Button asChild>
            <Link href="/admin/products/new">Add product</Link>
          </Button>
        </span>
      }
    >
      {loading ? (
        <AdminSkeleton label="Loading products" />
      ) : error ? (
        <AdminError error={error} onRetry={retry} />
      ) : (
        <>
          <form role="search" aria-label="Filter products" onSubmit={(event) => event.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-q`} className="text-sm font-medium">Find a product</label>
              <Input id={`${ids}-q`} type="search" value={filters.query} placeholder="Title, brand, tag or id" onChange={(event) => update({ query: event.target.value.slice(0, 100) })} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-c`} className="text-sm font-medium">Category</label>
              <select id={`${ids}-c`} className={SELECT} value={filters.category} onChange={(event) => update({ category: event.target.value })}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-s`} className="text-sm font-medium">Status</label>
              <select id={`${ids}-s`} className={SELECT} value={filters.status} onChange={(event) => update({ status: event.target.value as StatusFilter })}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-o`} className="text-sm font-medium">Sort by</label>
              <select id={`${ids}-o`} className={SELECT} value={sort} onChange={(event) => setSort(event.target.value as AdminSort)}>
                {(Object.keys(ADMIN_SORT_LABELS) as AdminSort[]).map((key) => (
                  <option key={key} value={key}>{ADMIN_SORT_LABELS[key]}</option>
                ))}
              </select>
            </div>
          </form>

          <p role="status" className="min-h-5 text-sm font-medium text-primary">{notice}</p>
          {saveFailed ? <p role="alert" className="text-sm text-destructive">Your browser would not save the last change, so it will be lost when you leave this page.</p> : null}

          {filtered.length === 0 ? (
            <EmptyState title="No products match these filters">
              <p>Try a different search or status.</p>
              <Button className="mt-3" variant="outline" onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}>Clear filters</Button>
            </EmptyState>
          ) : (
            <>
              <p aria-live="polite" className="text-sm text-muted-foreground">{`${filtered.length} ${filtered.length === 1 ? "product" : "products"}`}</p>
              <div className="relative overflow-x-auto rounded-xl border bg-card shadow-surface">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <caption className="sr-only">Products</caption>
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Product</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Category</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Price</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Stock</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {current.items.map((product) => (
                      <tr key={product.id} className={cn(product.status !== "active" && "bg-muted/40")}>
                        <th scope="row" className="px-3 py-2 font-medium">
                          <Link href={`/admin/products/${product.id}`} className="underline-offset-4 hover:underline">{product.title}</Link>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {`${product.brand ? `${product.brand} · ` : ""}#${product.id}`}
                            {product.origin === "local" ? " · created locally" : product.edited ? " · edited locally" : ""}
                          </span>
                        </th>
                        <td className="px-3 py-2">{categoryName.get(product.category) ?? product.category}</td>
                        <td className="px-3 py-2 text-right">{formatInr(product.finalPrice)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="mr-2">{product.stock}</span>
                          <StockBadge availability={product.availability} />
                        </td>
                        <td className="px-3 py-2 capitalize">{product.status}</td>
                        <td className="px-3 py-2">
                          <RowActions product={product} onDelete={() => handleDelete(product)} onRestore={() => { restore(product.id); setNotice(`"${product.title}" was restored (local simulation).`); }} />
                        </td>
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
  return header;
}
