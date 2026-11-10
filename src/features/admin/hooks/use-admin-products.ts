import { useMemo } from "react";

import { useCatalog, useCategories } from "@/features/products";
import { useAdminCatalogueStore } from "@/store/admin-catalogue-store";
import { useAdminOrdersStore } from "@/store/admin-orders-store";
import { applyOverlay, buildCategoryRows, referencedProductIds } from "@/utils/admin-catalogue";
import type { AdminProduct, CategoryRow } from "@/types/admin";

export interface AdminProducts {
  /** True while the catalogue or the local data is still loading. */
  loading: boolean;
  error: unknown;
  retry: () => void;
  /** Every product with local changes applied, including archived and removed ones (callers filter by status). */
  products: AdminProduct[];
  categories: CategoryRow[];
  /** Ids of products that existing orders reference (they may be archived but never silently removed). */
  referenced: Set<number>;
}

/** The catalogue (one cached request, shared with the storefront) merged with this browser's admin changes (PRD 8.2). */
export function useAdminProducts(): AdminProducts {
  const catalog = useCatalog();
  const categoryQuery = useCategories();
  const status = useAdminCatalogueStore((state) => state.status);
  const overlay = useAdminCatalogueStore((state) => state.overlay);
  const orders = useAdminOrdersStore((state) => state.orders);

  const products = useMemo(() => (catalog.data ? applyOverlay(catalog.data, overlay) : []), [catalog.data, overlay]);
  const categories = useMemo(() => buildCategoryRows(categoryQuery.data ?? [], overlay, products), [categoryQuery.data, overlay, products]);
  const referenced = useMemo(() => referencedProductIds(orders.map((entry) => entry.order)), [orders]);

  return {
    loading: status === "idle" || catalog.isPending,
    error: catalog.data ? null : catalog.error,
    retry: () => void catalog.refetch(),
    products,
    categories,
    referenced,
  };
}
