import type { VariantGroup } from "@/types/product";
import { clampQuantity, getAvailableStock, getDefaultVariantId, getStockInfo } from "./purchase";

const group: VariantGroup = {
  id: "size",
  label: "Size",
  options: [
    { id: "size-s", label: "S", stock: 0 },
    { id: "size-m", label: "M", stock: 3 },
    { id: "size-l", label: "L", stock: 40 },
  ],
};

describe("clampQuantity", () => {
  it("keeps the quantity between 1 and the available stock", () => {
    expect(clampQuantity(5, 3)).toBe(3);
    expect(clampQuantity(0, 3)).toBe(1);
    expect(clampQuantity(-4, 3)).toBe(1);
    expect(clampQuantity(2, 3)).toBe(2);
  });

  it("handles fractions, NaN and no stock without breaking", () => {
    expect(clampQuantity(2.9, 5)).toBe(2);
    expect(clampQuantity(Number.NaN, 5)).toBe(1);
    expect(clampQuantity(3, 0)).toBe(1);
  });
});

describe("getDefaultVariantId", () => {
  it("prefers the first in-stock option", () => {
    expect(getDefaultVariantId(group)).toBe("size-m");
  });

  it("falls back to the first option when everything is sold out, and null without a group", () => {
    expect(getDefaultVariantId({ ...group, options: group.options.map((option) => ({ ...option, stock: 0 })) })).toBe("size-s");
    expect(getDefaultVariantId(null)).toBeNull();
  });
});

describe("getAvailableStock", () => {
  it("uses the selected variant's stock when there are variants", () => {
    expect(getAvailableStock(43, group, "size-m")).toBe(3);
    expect(getAvailableStock(43, group, "size-s")).toBe(0);
    expect(getAvailableStock(43, group, "missing")).toBe(0);
  });

  it("uses the product's stock when there are no variants", () => {
    expect(getAvailableStock(12, null, null)).toBe(12);
    expect(getAvailableStock(-3, null, null)).toBe(0);
  });
});

describe("getStockInfo", () => {
  it("describes in-stock, low-stock and out-of-stock states", () => {
    expect(getStockInfo(40, group)).toEqual({ state: "in", text: "In stock" });
    expect(getStockInfo(3, group)).toEqual({ state: "low", text: "Only 3 left in stock" });
    expect(getStockInfo(5, null).state).toBe("low");
    expect(getStockInfo(6, null).state).toBe("in");
  });

  it("explains an out-of-stock variant by name (PRD MOD-04-001)", () => {
    const info = getStockInfo(0, group);
    expect(info.state).toBe("out");
    expect(info.text).toBe("Out of stock in this size");
    expect(info.explanation).toBe("This size is out of stock. Choose another size to continue.");
  });

  it("explains an out-of-stock product without variants", () => {
    const info = getStockInfo(0, null);
    expect(info.text).toBe("Out of stock");
    expect(info.explanation).toBe("This product is currently out of stock.");
  });
});
