import type { VariantGroup } from "@/types/product";

export function clampQuantity(quantity: number, max: number, min = 1): number {
  const upper = Math.max(min, Math.floor(max));
  const value = Number.isFinite(quantity) ? Math.floor(quantity) : min;
  return Math.min(Math.max(value, min), upper);
}

/** Default selection: the first in-stock option, otherwise the first option. */
export function getDefaultVariantId(group: VariantGroup | null): string | null {
  if (!group) return null;
  return (group.options.find((option) => option.stock > 0) ?? group.options[0])?.id ?? null;
}

/** Units available for the current selection: the chosen variant's stock, or the product's stock. */
export function getAvailableStock(productStock: number, group: VariantGroup | null, variantId: string | null): number {
  if (!group) return Math.max(0, productStock);
  return group.options.find((option) => option.id === variantId)?.stock ?? 0;
}

export type StockState = "in" | "low" | "out";

export const LOW_STOCK_LIMIT = 5;

export interface StockInfo {
  state: StockState;
  text: string;
  /** Why purchasing is disabled; only set when out of stock. */
  explanation?: string;
}

export function getStockInfo(stock: number, group: VariantGroup | null): StockInfo {
  if (stock <= 0) {
    const noun = group ? group.label.toLowerCase() : null;
    return {
      state: "out",
      text: noun ? `Out of stock in this ${noun}` : "Out of stock",
      explanation: noun
        ? `This ${noun} is out of stock. Choose another ${noun} to continue.`
        : "This product is currently out of stock.",
    };
  }
  if (stock <= LOW_STOCK_LIMIT) return { state: "low", text: `Only ${stock} left in stock` };
  return { state: "in", text: "In stock" };
}
