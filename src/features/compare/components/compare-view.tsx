
"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Scale, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductImage } from "@/features/products";
import { formatInr } from "@/lib/currency";
import { ApiError, fetchProduct } from "@/services/products";
import { getVariantGroup } from "@/services/products/variants";
import { useCartStore } from "@/store/cart-store";
import { useCompareStore } from "@/store/compare-store";
import {
  buildComparisonRows,
  canCompare,
  COMPARE_MIN,
  type CompareRow,
} from "@/utils/compare";
import type { ProductDetail } from "@/types/product";

type Column = {
  id: number;
  title: string;
  thumbnail: string | null;
  detail: ProductDetail | null;
  state: "ready" | "loading" | "error" | "gone";
};

const BEST_LABEL: Record<string, string> = {
  price: "Lowest price",
  rating: "Highest rated",
  discount: "Biggest discount",
};

/** Side-by-side comparison of 2 to 4 selected products (PRD 5.2). */
export function CompareView() {
  const status = useCompareStore((state) => state.status);
  const items = useCompareStore((state) => state.items);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const checkboxId = useId();

  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["product", item.productId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchProduct(item.productId, signal),
      staleTime: 5 * 60 * 1000,
      retry: (count: number, error: unknown) =>
        !(error instanceof ApiError && error.status === 404) && count < 1,
    })),
  });

  const columns: Column[] = items.map((item, index) => {
    const query = queries[index];
    const gone =
      query?.error instanceof ApiError && query.error.status === 404;

    return {
      id: item.productId,
      title: item.title,
      thumbnail: item.thumbnail,
      detail: query?.data ?? null,
      state: query?.data
        ? "ready"
        : gone
          ? "gone"
          : query?.isError
            ? "error"
            : "loading",
    };
  });

  const ready = columns.filter(
    (column): column is Column & { detail: ProductDetail } =>
      column.detail !== null
  );

  const rows = useMemo(
    () =>
      buildComparisonRows(
        ready.map((column) => column.detail),
        ready.map((column) => column.detail)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready.map((column) => column.id).join(",")]
  );

  const shown = differencesOnly
    ? rows.filter((row) => row.differs)
    : rows;

  if (status !== "ready") {
    return (
      <div
        aria-busy="true"
        className="mt-8 h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
      />
    );
  }

  if (!canCompare(items)) {
    return (
      <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
        <Scale
          aria-hidden="true"
          className="size-8 text-muted-foreground"
        />
        <h2 className="section-title">
          {items.length === 0
            ? "Nothing to compare yet"
            : "Choose one more product"}
        </h2>
        <p className="max-w-prose text-muted-foreground">
          {`Select at least ${COMPARE_MIN} products with the Compare button on any product card, then come back here.`}
        </p>
        <Button asChild>
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    );
  }

  function addToCart(detail: ProductDetail) {
    const outcome = addItem({
      productId: detail.id,
      variantId: null,
      variantLabel: null,
      quantity: 1,
      title: detail.title,
      brand: detail.brand,
      category: detail.category,
      thumbnail: detail.thumbnail ?? detail.images[0] ?? null,
      unitPrice: detail.finalPrice,
      knownStock: detail.stock,
    });

    setNotice(
      outcome.type === "out-of-stock"
        ? `${detail.title} is out of stock.`
        : `${detail.title} was added to your cart.`
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          htmlFor={checkboxId}
          className="flex items-center gap-2 text-sm"
        >
          <input
            id={checkboxId}
            type="checkbox"
            className="size-4 accent-primary"
            checked={differencesOnly}
            onChange={(event) =>
              setDifferencesOnly(event.target.checked)
            }
          />
          Show differences only
        </label>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => useCompareStore.getState().clear()}
        >
          Clear comparison
        </Button>
      </div>

      <p
        role="status"
        className={
          notice
            ? "mt-3 rounded-md border bg-accent px-3 py-2 text-sm"
            : "sr-only"
        }
      >
        {notice}
      </p>

      <div
        className="mt-4 overflow-x-auto rounded-xl border bg-card shadow-surface"
        tabIndex={0}
        role="region"
        aria-label="Comparison table, scroll sideways on small screens"
      >
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">
            Side-by-side comparison of the selected products. Rows marked
            Differs have different values.
          </caption>

          <colgroup>
            <col className="w-32 sm:w-40" />
            {columns.map((column) => (
              <col key={column.id} />
            ))}
          </colgroup>

          <thead>
            <tr>
              <td className="sticky left-0 z-10 bg-card p-3" />

              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className="border-l p-3 align-top font-normal"
                >
                  <div className="relative mx-auto aspect-square w-full max-w-40 overflow-hidden rounded-lg border bg-muted">
                    <ProductImage
                      src={
                        column.detail?.thumbnail ?? column.thumbnail
                      }
                      sizes="160px"
                    />
                  </div>

                  <p className="mt-3 font-semibold leading-snug">
                    {column.state === "gone" ? (
                      column.title
                    ) : (
                      <Link
                        href={`/products/${column.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {column.title}
                      </Link>
                    )}
                  </p>

                  {column.state === "loading" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Loading details…
                    </p>
                  ) : null}

                  {column.state === "gone" ? (
                    <p
                      role="alert"
                      className="mt-1 text-xs text-destructive"
                    >
                      No longer available.
                    </p>
                  ) : null}

                  {column.state === "error" ? (
                    <p
                      role="alert"
                      className="mt-1 text-xs text-destructive"
                    >
                      Could not load details. Reload to try again.
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      useCompareStore.getState().remove(column.id)
                    }
                    className="mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Remove ${column.title} from comparison`}
                  >
                    <X aria-hidden="true" className="size-3" />
                    Remove
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="border-t p-4 text-muted-foreground"
                >
                  These products have no differences in the attributes
                  we compare.
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  columns={ready}
                  allColumns={columns}
                />
              ))
            )}
          </tbody>

          <tfoot>
            <tr className="border-t">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-card p-3 font-medium"
              >
                Actions
              </th>

              {columns.map((column) => {
                const detail = column.detail;

                const variantGroup = detail
                  ? getVariantGroup({
                      id: detail.id,
                      category: detail.category,
                      stock: detail.stock,
                    })
                  : null;

                const hasVariants = variantGroup !== null;
                const soldOut = detail ? detail.stock <= 0 : false;

                // Temporary diagnostic for the failing Product 7 test.
                if (detail?.id === 7) {
                  console.log(
                    "[COMPARE DEBUG]",
                    JSON.stringify({
                      id: detail.id,
                      title: detail.title,
                      category: detail.category,
                      stock: detail.stock,
                      variantGroup,
                      hasVariants,
                    })
                  );
                }

                return (
                  <td
                    key={column.id}
                    className="border-l p-3 align-top"
                  >
                    <div className="flex flex-col gap-2">
                      {detail && !hasVariants ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="cta"
                          disabled={soldOut}
                          onClick={() => addToCart(detail)}
                          aria-label={
                            soldOut
                              ? `${column.title} is out of stock`
                              : `Add ${column.title} to cart`
                          }
                        >
                          {soldOut ? "Out of stock" : "Add to Cart"}
                        </Button>
                      ) : null}

                      {column.state !== "gone" ? (
                        <Button
                          asChild
                          size="sm"
                          variant={hasVariants ? "cta" : "outline"}
                        >
                          <Link
                            href={`/products/${column.id}`}
                            aria-label={`${
                              hasVariants
                                ? "Choose options for"
                                : "View"
                            } ${column.title}`}
                          >
                            {hasVariants
                              ? "Choose options"
                              : "View Product"}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  columns,
  allColumns,
}: {
  row: CompareRow;
  columns: Array<Column & { detail: ProductDetail }>;
  allColumns: Column[];
}) {
  const byId = new Map(
    columns.map((column, index) => [column.id, index])
  );

  return (
    <tr className={row.differs ? "border-t bg-accent/40" : "border-t"}>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card p-3 align-top font-medium"
      >
        {row.label}

        {row.differs ? (
          <span className="ml-2 rounded-full border border-gold-edge bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-ink">
            Differs
          </span>
        ) : null}
      </th>

      {allColumns.map((column) => {
        const index = byId.get(column.id);
        const value =
          index === undefined ? "—" : row.values[index];
        const best =
          index !== undefined && row.best.includes(index);

        return (
          <td
            key={column.id}
            className={`border-l p-3 align-top ${
              row.id === "description"
                ? "text-muted-foreground"
                : ""
            }`}
          >
            <span
              className={
                best ? "font-semibold text-foreground" : undefined
              }
            >
              {row.id === "price" && index !== undefined
                ? formatInr(columns[index]!.detail.finalPrice)
                : value}
            </span>

            {best ? (
              <span className="ml-2 inline-block rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
                {BEST_LABEL[row.id]}
              </span>
            ) : null}
          </td>
        );
      })}
    </tr>
  );
}
