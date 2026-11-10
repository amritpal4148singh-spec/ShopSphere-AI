import type { AdminOrder, AdminProduct } from "@/types/admin";

export interface TopSeller {
  productId: number;
  title: string;
  units: number;
  revenue: number;
}

export interface OverviewMetrics {
  totalProducts: number;
  archivedProducts: number;
  totalOrders: number;
  totalCustomers: number;
  /** Sum of order totals. Orders are simulated, so this is simulated revenue (PRD 8.1). */
  simulatedRevenue: number;
  simulatedVisits: number;
  /** Orders divided by visits, or null with no visits (PRD 8.1: labelled simulated). */
  simulatedConversionRate: number | null;
  topBySales: TopSeller[];
  topByRating: Array<{ productId: number; title: string; rating: number }>;
  lowStock: AdminProduct[];
  outOfStockCount: number;
}

export const TOP_LIMIT = 5;
export const LOW_STOCK_LIST_LIMIT = 8;

export function computeOverview(input: {
  products: readonly AdminProduct[];
  orders: readonly AdminOrder[];
  customerCount: number;
  /** Visits behind the simulated conversion rate: the seed baseline plus product pages viewed on this device. */
  visits: number;
}): OverviewMetrics {
  const { products, orders, customerCount, visits } = input;
  const sellable = products.filter((product) => product.status === "active");

  const sales = new Map<number, TopSeller>();
  let revenue = 0;
  for (const { order } of orders) {
    revenue += order.totals.total;
    for (const item of order.items) {
      const entry = sales.get(item.productId) ?? { productId: item.productId, title: item.title, units: 0, revenue: 0 };
      entry.units += item.quantity;
      entry.revenue += item.unitPrice * item.quantity;
      sales.set(item.productId, entry);
    }
  }

  const needsStock = sellable.filter((product) => product.availability !== "in-stock").sort((a, b) => a.stock - b.stock || a.title.localeCompare(b.title));

  return {
    totalProducts: sellable.length,
    archivedProducts: products.filter((product) => product.status === "archived").length,
    totalOrders: orders.length,
    totalCustomers: customerCount,
    simulatedRevenue: revenue,
    simulatedVisits: visits,
    simulatedConversionRate: visits > 0 ? orders.length / visits : null,
    topBySales: [...sales.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue || a.title.localeCompare(b.title)).slice(0, TOP_LIMIT),
    topByRating: sellable
      .filter((product) => product.rating > 0)
      .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title))
      .slice(0, TOP_LIMIT)
      .map((product) => ({ productId: product.id, title: product.title, rating: product.rating })),
    lowStock: needsStock.slice(0, LOW_STOCK_LIST_LIMIT),
    outOfStockCount: needsStock.filter((product) => product.availability === "out-of-stock").length,
  };
}
