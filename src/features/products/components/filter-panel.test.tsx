import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DEFAULT_DISCOVERY_STATE } from "@/utils/discovery";
import type { DiscoveryState } from "@/types/product";
import { FilterPanel } from "./filter-panel";

const categories = [
  { slug: "mens-shoes", name: "Mens Shoes" },
  { slug: "laptops", name: "Laptops" },
];

function setup(overrides: Partial<DiscoveryState> = {}, props: { showCategories?: boolean; hasActiveFilters?: boolean } = {}) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(
    <FilterPanel
      state={{ ...DEFAULT_DISCOVERY_STATE, ...overrides }}
      bounds={{ min: 0, max: 10000 }}
      brands={["Apple", "Nike"]}
      categories={categories}
      showCategories={props.showCategories ?? true}
      hasActiveFilters={props.hasActiveFilters ?? false}
      onChange={onChange}
      onClear={onClear}
    />,
  );
  return { onChange, onClear, user: userEvent.setup() };
}

describe("FilterPanel", () => {
  it("offers every filter group required by the PRD", () => {
    setup();
    for (const legend of ["Price", "Minimum rating", "Availability", "Deals", "Category", "Brand"]) {
      expect(screen.getByRole("group", { name: legend })).toBeInTheDocument();
    }
  });

  it("selects a minimum rating", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("radio", { name: "4 stars and up" }));
    expect(onChange).toHaveBeenCalledWith({ minRating: 4 });
  });

  it("removes the rating filter with Any rating", async () => {
    const { onChange, user } = setup({ minRating: 4 });
    expect(screen.getByRole("radio", { name: "4 stars and up" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Any rating" }));
    expect(onChange).toHaveBeenCalledWith({ minRating: undefined });
  });

  it("selects availability", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("radio", { name: "In stock" }));
    expect(onChange).toHaveBeenCalledWith({ availability: "in" });
  });

  it("toggles the on-sale filter", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("checkbox", { name: "On sale (10% off or more)" }));
    expect(onChange).toHaveBeenCalledWith({ onSale: true });
  });

  it("adds and removes brands in a multi-select", async () => {
    const { onChange, user } = setup({ brands: ["Nike"] });
    expect(screen.getByRole("checkbox", { name: "Nike" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Apple" }));
    expect(onChange).toHaveBeenLastCalledWith({ brands: ["Nike", "Apple"] });

    await user.click(screen.getByRole("checkbox", { name: "Nike" }));
    expect(onChange).toHaveBeenLastCalledWith({ brands: [] });
  });

  it("adds a category to the multi-select", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("checkbox", { name: "Mens Shoes" }));
    expect(onChange).toHaveBeenCalledWith({ categories: ["mens-shoes"] });
  });

  it("hides the category group on a category page", () => {
    setup({}, { showCategories: false });
    expect(screen.queryByRole("group", { name: "Category" })).not.toBeInTheDocument();
  });

  it("shows Clear filters only when filters are active", () => {
    setup({}, { hasActiveFilters: false });
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("clears filters on request", async () => {
    const { onClear, user } = setup({ minRating: 4 }, { hasActiveFilters: true });
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
