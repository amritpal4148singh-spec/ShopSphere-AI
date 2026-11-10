
"use client";

import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductImage } from "@/features/products";
import { useCompareStore } from "@/store/compare-store";
import { canCompare, COMPARE_MAX, COMPARE_MIN } from "@/utils/compare";

/**
 * Persistent comparison tray.
 * The assistant launcher moves above this tray when it is visible.
 */
export function CompareTray() {
  const items = useCompareStore((state) => state.items);
  const status = useCompareStore((state) => state.status);
  const lastOutcome = useCompareStore((state) => state.lastOutcome);

  const pathname = usePathname();
  const router = useRouter();

  if (status !== "ready" || items.length === 0 || pathname === "/compare") {
    return null;
  }

  const ready = canCompare(items);

  return (
    <section
      aria-label="Product comparison"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gold-edge bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-lift backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">

        <p className="shrink-0 text-sm font-semibold">
          {`Compare (${items.length}/${COMPARE_MAX})`}
        </p>

        <ul className="flex min-w-0 flex-1 items-center gap-2">
          {items.map((item) => (
            <li
              key={item.productId}
              className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
            >
              <ProductImage src={item.thumbnail} sizes="48px" />

              <button
                type="button"
                onClick={() =>
                  useCompareStore.getState().remove(item.productId)
                }
                aria-label={`Remove ${item.title} from comparison`}
                className="absolute right-0 top-0 inline-flex size-5 items-center justify-center rounded-bl-md bg-primary text-primary-foreground transition-colors hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>

        <p
          role="status"
          className="basis-full text-xs text-muted-foreground sm:basis-auto"
        >
          {`${items.length} ${
            items.length === 1 ? "product" : "products"
          } selected. `}
          {lastOutcome === "full"
            ? `You can compare up to ${COMPARE_MAX} products. Remove one to add another.`
            : ready
              ? "Ready to compare."
              : `Select at least ${COMPARE_MIN} products to compare.`}
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => useCompareStore.getState().clear()}
          >
            Clear
          </Button>

          <Button
            type="button"
            size="sm"
            variant="cta"
            disabled={!ready}
            onClick={() => router.push("/compare")}
          >
            Compare now
          </Button>
        </div>
      </div>
    </section>
  );
}
