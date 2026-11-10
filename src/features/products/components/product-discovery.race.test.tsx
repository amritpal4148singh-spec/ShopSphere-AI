import { act, fireEvent, screen } from "@testing-library/react";

import { fetchCatalog, fetchCategories, searchProducts } from "@/services/products";
import { makeProduct } from "@/test/fixtures";
import { replace, resetNavigation, setNavigation } from "@/test/navigation-mock";
import { renderWithClient } from "@/test/render";
import { PRICE_COMMIT_DELAY_MS } from "./price-range-filter";
import { ProductDiscovery } from "./product-discovery";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);
vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const catalogue = [
  makeProduct({ id: 1, title: "Alpha", finalPrice: 1500, price: 1500, rating: 4.5 }),
  makeProduct({ id: 2, title: "Bravo", finalPrice: 6000, price: 6000, rating: 4.1 }),
  makeProduct({ id: 3, title: "Charlie", finalPrice: 9000, price: 9000, rating: 3.0 }),
  makeProduct({ id: 4, title: "Delta", finalPrice: 60000, price: 60000, rating: 4.9 }),
];

describe("ProductDiscovery filter race (regression)", () => {
  beforeEach(() => {
    resetNavigation();
    vi.mocked(fetchCatalog).mockReset().mockResolvedValue(catalogue);
    vi.mocked(searchProducts).mockReset().mockResolvedValue([]);
    vi.mocked(fetchCategories).mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a rating chosen while a price change is still pending", async () => {
    setNavigation("/products");
    renderWithClient(<ProductDiscovery basePath="/products" />);
    await screen.findByText("4 products");

    // Only the slider's delayed commit uses fake timers.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    fireEvent.change(screen.getByLabelText("Minimum price"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("radio", { name: "4 stars and up" }));

    act(() => {
      vi.advanceTimersByTime(PRICE_COMMIT_DELAY_MS);
    });

    const lastUrl = String(replace.mock.calls[replace.mock.calls.length - 1]?.[0]);
    expect(lastUrl).toContain("minPrice=5000");
    expect(lastUrl).toContain("rating=4");
  });

  it("keeps a sort chosen while a price change is still pending", async () => {
    setNavigation("/products");
    renderWithClient(<ProductDiscovery basePath="/products" />);
    await screen.findByText("4 products");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    fireEvent.change(screen.getByLabelText("Maximum price"), { target: { value: "20000" } });
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "price-desc" } });

    act(() => {
      vi.advanceTimersByTime(PRICE_COMMIT_DELAY_MS);
    });

    const lastUrl = String(replace.mock.calls[replace.mock.calls.length - 1]?.[0]);
    expect(lastUrl).toContain("maxPrice=20000");
    expect(lastUrl).toContain("sort=price-desc");
  });
});
