import { useProductSource } from "./use-product-source";

/** The whole cached catalogue. Cart and wishlist use it to check live prices and stock in one request. */
export function useCatalog() {
  return useProductSource("");
}
