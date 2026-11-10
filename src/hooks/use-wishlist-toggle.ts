import { useWishlistStore } from "@/store/wishlist-store";
import type { Product } from "@/types/product";

type WishlistableProduct = Pick<Product, "id" | "title" | "brand" | "category" | "thumbnail" | "finalPrice" | "availability">;

/** Whether a product is wishlisted, and a toggle that saves a snapshot of it. Safe before the wishlist is ready. */
export function useWishlistToggle(product: WishlistableProduct) {
  const pressed = useWishlistStore((state) => state.items.some((item) => item.productId === product.id));
  const toggle = useWishlistStore((state) => state.toggle);

  return {
    pressed,
    toggle: () =>
      toggle({
        productId: product.id,
        title: product.title,
        brand: product.brand,
        category: product.category,
        thumbnail: product.thumbnail,
        price: product.finalPrice,
        availability: product.availability,
      }),
  };
}
