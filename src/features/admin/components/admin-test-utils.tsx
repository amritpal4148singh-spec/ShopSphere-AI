import { fetchCatalog, fetchCategories } from "@/services/products";
import { useAdminCatalogueStore } from "@/store/admin-catalogue-store";
import { useAdminOrdersStore } from "@/store/admin-orders-store";
import { useAnalyticsStore } from "@/store/analytics-store";
import { useReviewsStore } from "@/store/reviews-store";
import { buildCatalog } from "@/test/catalog";
import { signInAs, ADMIN } from "@/test/session";
import { EMPTY_OVERLAY } from "@/utils/admin-catalogue";

/** Test catalogue plus the categories the product API would list for it. */
export const catalog = buildCatalog();
export const categoryList = [
  { slug: "mens-shoes", name: "Mens Shoes" },
  { slug: "womens-shoes", name: "Womens Shoes" },
  { slug: "smartphones", name: "Smartphones" },
  { slug: "mobile-accessories", name: "Mobile Accessories" },
  { slug: "laptops", name: "Laptops" },
  { slug: "beauty", name: "Beauty" },
  { slug: "fragrances", name: "Fragrances" },
  { slug: "groceries", name: "Groceries" },
];

/**
 * Resets everything the admin screens read and loads it the way AdminShell does. The tests mock "@/services/products"
 * (see each test file), so the catalogue request is served from `catalog`.
 */
export function resetAdminWorld() {
  localStorage.clear();
  sessionStorage.clear();
  signInAs(ADMIN);
  useAdminCatalogueStore.setState({ status: "idle", overlay: EMPTY_OVERLAY, saveFailed: false });
  useAdminOrdersStore.setState({ status: "idle", orders: [], saveFailed: false });
  useAnalyticsStore.setState({ status: "idle", since: 0, counts: {}, pending: [], productViews: 0 });
  useReviewsStore.setState({ status: "idle", reviews: [], votes: {}, hidden: {}, saveFailed: false });
  useAdminCatalogueStore.getState().hydrate();
  useAdminOrdersStore.getState().load();
  useAnalyticsStore.getState().hydrate();
  useReviewsStore.getState().hydrate();
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue(catalog);
  vi.mocked(fetchCategories).mockReset().mockResolvedValue(categoryList);
}
