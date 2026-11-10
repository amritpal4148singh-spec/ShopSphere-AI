import type { Product } from "@/types/product";
import { ProductCard } from "./product-card";

/** Responsive grid: 2 columns on mobile up to 5 on very wide screens (PRD 5.2). */
export function ProductGrid({ products }: { products: readonly Product[] }) {
  return (
    <>
      <h2 className="sr-only">Product results</h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </>
  );
}
