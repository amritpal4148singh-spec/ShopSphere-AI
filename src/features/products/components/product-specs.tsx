import { titleCase } from "@/utils/text";
import type { ProductDetail } from "@/types/product";

const AVAILABILITY_TEXT = { "in-stock": "In stock", "low-stock": "Low stock", "out-of-stock": "Out of stock" } as const;

/** Specification table. Weight and dimensions are left out: the data source gives no units for them. */
export function ProductSpecs({ product }: { product: ProductDetail }) {
  const rows: Array<[string, string]> = [
    ["Brand", product.brand ?? "Not specified"],
    ["Category", titleCase(product.category)],
    ["SKU", product.sku ?? "Not specified"],
    ["Availability", AVAILABILITY_TEXT[product.availability]],
    ["Rating", product.rating > 0 ? `${product.rating.toFixed(1)} out of 5` : "Not rated yet"],
    ["Minimum order quantity", String(product.minimumOrderQuantity)],
    ["Warranty", product.warrantyInformation ?? "Not specified"],
  ];
  if (product.tags.length > 0) rows.push(["Tags", product.tags.join(", ")]);

  return (
    <dl className="grid max-w-2xl grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-3 text-sm">
      {rows.map(([term, detail]) => (
        <div key={term} className="contents">
          <dt className="font-medium">{term}</dt>
          <dd className="text-muted-foreground">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
