import { makeProduct } from "@/test/fixtures";
import { frozenOrder } from "@/test/orders";
import type { AdminOrder, AdminProduct } from "@/types/admin";
import { applyOverlay, EMPTY_OVERLAY } from "./admin-catalogue";
import { LOW_STOCK_LIST_LIMIT, TOP_LIMIT, computeOverview } from "./admin-metrics";

const catalogue = [
  makeProduct({ id: 1, title: "Alpha Lamp", rating: 4.9, stock: 40 }),
  makeProduct({ id: 2, title: "Bravo Mug", rating: 4.2, stock: 2, availability: "low-stock" }),
  makeProduct({ id: 3, title: "Charlie Pen", rating: 3.0, stock: 0, availability: "out-of-stock" }),
  makeProduct({ id: 4, title: "Delta Bag", rating: 0, stock: 9 }),
];
const products: AdminProduct[] = applyOverlay(catalogue, { ...EMPTY_OVERLAY, archived: [4] });
const orders: AdminOrder[] = [
  { ownerId: "u1", order: frozenOrder("delivered") }, // Alpha Lamp x2 at 1000, Bravo Mug x1 at 500
  { ownerId: "u2", order: frozenOrder("packed", { id: "SS-2", items: [{ productId: 2, title: "Bravo Mug", thumbnail: null, variantLabel: null, quantity: 5, unitPrice: 500 }] }) },
];

describe("computeOverview (PRD 8.1)", () => {
  const overview = computeOverview({ products, orders, customerCount: 7, visits: 100 });

  it("counts active products, archived ones separately, orders and customers", () => {
    expect(overview).toMatchObject({ totalProducts: 3, archivedProducts: 1, totalOrders: 2, totalCustomers: 7 });
  });

  it("sums order totals as simulated revenue", () => {
    expect(overview.simulatedRevenue).toBe(orders[0]!.order.totals.total + orders[1]!.order.totals.total);
  });

  it("derives the simulated conversion rate from orders and visits, null without visits", () => {
    expect(overview.simulatedConversionRate).toBeCloseTo(0.02);
    expect(computeOverview({ products, orders, customerCount: 0, visits: 0 }).simulatedConversionRate).toBeNull();
  });

  it("ranks top sellers by units sold with their revenue", () => {
    expect(overview.topBySales.map((item) => [item.title, item.units, item.revenue])).toEqual([
      ["Bravo Mug", 6, 3000],
      ["Alpha Lamp", 2, 2000],
    ]);
  });

  it("ranks top-rated active products and skips unrated and archived ones", () => {
    expect(overview.topByRating.map((item) => item.title)).toEqual(["Alpha Lamp", "Bravo Mug", "Charlie Pen"]);
  });

  it("lists low-stock and out-of-stock active products, lowest first", () => {
    expect(overview.lowStock.map((product) => product.title)).toEqual(["Charlie Pen", "Bravo Mug"]);
    expect(overview.outOfStockCount).toBe(1);
  });

  it("caps its lists", () => {
    const many = Array.from({ length: 30 }, (_, index) => makeProduct({ id: 100 + index, title: `P${index}`, stock: 1, availability: "low-stock", rating: 4 }));
    const result = computeOverview({ products: applyOverlay(many, EMPTY_OVERLAY), orders: [], customerCount: 0, visits: 1 });
    expect(result.lowStock).toHaveLength(LOW_STOCK_LIST_LIMIT);
    expect(result.topByRating).toHaveLength(TOP_LIMIT);
  });

  it("copes with an empty shop", () => {
    expect(computeOverview({ products: [], orders: [], customerCount: 0, visits: 5 })).toMatchObject({ totalProducts: 0, totalOrders: 0, simulatedRevenue: 0, simulatedConversionRate: 0, topBySales: [], lowStock: [] });
  });
});
