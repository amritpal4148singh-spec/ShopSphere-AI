import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { loadAnalytics } from "@/lib/analytics-storage";
import { fetchCatalog } from "@/services/products";
import { buildCatalog } from "@/test/catalog";
import { resetRecommendationWorld } from "@/test/recommendations";
import { renderWithClient } from "@/test/render";
import { useAnalyticsStore } from "@/store/analytics-store";
import { RecommendationRail } from "./recommendation-rail";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const catalog = buildCatalog();

beforeEach(() => {
  resetRecommendationWorld(catalog);
  useAnalyticsStore.setState({ status: "idle", since: 0, counts: {}, pending: [], productViews: 0 });
});

describe("RecommendationRail local analytics (PRD 8.4)", () => {
  it("counts one impression per product card shown, once per rail view", async () => {
    const first = renderWithClient(<RecommendationRail strategy="featured" />);
    const rail = await screen.findByRole("region", { name: "Featured Products" });
    const shown = within(rail).getAllByRole("heading", { level: 3 }).length;
    expect(loadAnalytics().counts.featured?.impressions).toBe(shown);

    // Re-rendering with the same cards does not count again; showing the rail again on a new page does.
    first.unmount();
    renderWithClient(<RecommendationRail strategy="featured" />);
    await screen.findByRole("region", { name: "Featured Products" });
    expect(loadAnalytics().counts.featured?.impressions).toBe(shown * 2);
  });

  it("records nothing for a rail that shows nothing", async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([]);
    renderWithClient(<RecommendationRail strategy="trending" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(loadAnalytics().counts.trending).toBeUndefined();
  });

  it("counts a click on a product card's link and remembers it for conversion tracking", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecommendationRail strategy="featured" />);
    const rail = await screen.findByRole("region", { name: "Featured Products" });

    await user.click(within(rail).getAllByRole("link")[0]!);
    expect(loadAnalytics().counts.featured?.clicks).toBe(1);
    expect(loadAnalytics().pending).toHaveLength(1);
  });

  it("does not count a click on the wishlist heart as a click-through", async () => {
    const user = userEvent.setup();
    renderWithClient(<RecommendationRail strategy="featured" />);
    const rail = await screen.findByRole("region", { name: "Featured Products" });

    await user.click(within(rail).getAllByRole("button", { name: /wishlist/i })[0]!);
    expect(loadAnalytics().counts.featured?.clicks ?? 0).toBe(0);
    expect(loadAnalytics().pending).toEqual([]);
  });
});
