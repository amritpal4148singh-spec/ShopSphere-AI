import { useCompareStore } from "@/store/compare-store";
import { isFull, toCompareItem } from "@/utils/compare";
import type { Product } from "@/types/product";

/** Whether a product is in the comparison, whether the comparison is full, and a toggle. Mirrors useWishlistToggle. */
export function useCompareToggle(product: Pick<Product, "id" | "title" | "thumbnail" | "category">) {
  const pressed = useCompareStore((state) => state.items.some((item) => item.productId === product.id));
  const limitReached = useCompareStore((state) => isFull(state.items));
  const toggle = useCompareStore((state) => state.toggle);
  return { pressed, limitReached, toggle: () => void toggle(toCompareItem(product)) };
}
