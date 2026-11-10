import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { ApiError, fetchCatalog } from "@/services/products";
import { buildCatalog } from "@/test/catalog";
import { resetRecommendationWorld } from "@/test/recommendations";
import { renderWithClient } from "@/test/render";
import { HeroShowcase } from "./hero-showcase";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const catalog = buildCatalog();

beforeEach(() => resetRecommendationWorld(catalog));

describe("HeroShowcase", () => {
  it("shows the top featured products from the real catalogue, each linking to its product page", async () => {
    renderWithClient(<HeroShowcase />);

    const list = screen.getByRole("list", { name: "Featured picks" });
    const links = await within(list).findAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/products\/\d+$/);
      expect(link).toHaveAccessibleName(/^Featured: .+, ₹/);
    }
  });

  it("shows the recommendation engine's own reason rather than invented copy", async () => {
    renderWithClient(<HeroShowcase />);

    const list = screen.getByRole("list", { name: "Featured picks" });
    await within(list).findAllByRole("link");
    // The first tile carries the engine's first reason and its second one (the rating line).
    expect(within(list).getByText(/^Rated \d(\.\d)? out of 5$/)).toBeInTheDocument();
  });

  it("holds its footprint with an inert placeholder while the catalogue loads", () => {
    vi.mocked(fetchCatalog).mockReturnValue(new Promise(() => undefined));
    renderWithClient(<HeroShowcase />);

    const list = screen.getByRole("list", { name: "Featured picks" });
    expect(within(list).queryAllByRole("link")).toHaveLength(0);
    expect(list.querySelectorAll('li[aria-hidden="true"]')).toHaveLength(3);
  });

  it("falls back to the decorative orbit alone when the catalogue cannot load, with no fake products", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("network", "The catalogue could not be loaded."));
    renderWithClient(<HeroShowcase />);

    await waitFor(() => expect(screen.queryByRole("list", { name: "Featured picks" })).not.toBeInTheDocument());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("ignores touch input and reduced-motion, so parallax only ever follows a mouse that is welcome to move things", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = renderWithClient(<HeroShowcase />);
    await within(screen.getByRole("list", { name: "Featured picks" })).findAllByRole("link");
    const stage = container.querySelector<HTMLElement>(".hero-stage")!;

    fireEvent.pointerMove(stage, { pointerType: "touch", clientX: 50, clientY: 50 });
    fireEvent.pointerMove(stage, { pointerType: "mouse", clientX: 50, clientY: 50 });

    expect(stage.style.getPropertyValue("--px")).toBe("");
  });
});
