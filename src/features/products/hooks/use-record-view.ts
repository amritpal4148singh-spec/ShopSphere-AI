import { useEffect } from "react";

import { useAnalyticsStore } from "@/store/analytics-store";
import { useViewedStore } from "@/store/viewed-store";
import type { ProductDetail } from "@/types/product";

/** Records that this product was viewed (a recommendation signal, kept on this device). Once per product shown. */
export function useRecordView(product: Pick<ProductDetail, "id" | "category" | "brand" | "finalPrice" | "tags">): void {
  const record = useViewedStore((state) => state.record);
  const { id, category, brand, finalPrice, tags } = product;

  useEffect(() => {
    record({ productId: id, category, brand, price: finalPrice, tags });
    // Local analytics (PRD 8.4): product page views are the visits behind the simulated conversion rate.
    useAnalyticsStore.getState().productView();
    // Recorded once per product id; the other fields describe that product and do not change its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, record]);
}
