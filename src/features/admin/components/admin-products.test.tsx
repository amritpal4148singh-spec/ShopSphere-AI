import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError, fetchCatalog } from "@/services/products";
import { renderWithClient } from "@/test/render";
import { useAdminCatalogueStore } from "@/store/admin-catalogue-store";
import { loadOverlay } from "@/lib/admin-storage";
import { resetAdminWorld } from "./admin-test-utils";
import { CategoriesView } from "./categories-view";
import { InventoryView } from "./inventory-view";
import { EditProductView, NewProductView } from "./product-form-view";
import { ProductsView } from "./products-view";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

beforeEach(resetAdminWorld);

const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const rowOf = (title: string) => screen.getByRole("row", { name: new RegExp(`^${title}\\b`) });

describe("ProductsView (PRD 8.2)", () => {
  it("shows a loading state, then the product table with the local-simulation label", async () => {
    renderWithClient(<ProductsView />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading products");
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Products" })).toBeInTheDocument();
    expect(screen.getAllByText("Local simulation").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Add product" })).toHaveAttribute("href", "/admin/products/new");
  });

  it("pages the table at 20 products", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductsView />);
    await screen.findByRole("table");
    expect(rows()).toHaveLength(20);
    expect(screen.getByText("23 products")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(rows()).toHaveLength(3);
  });

  it("searches by title, brand, tag or id, and says so when nothing matches", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductsView />);
    await screen.findByRole("table");

    await user.type(screen.getByLabelText("Find a product"), "samsung");
    expect(rows()).toHaveLength(2);
    await user.clear(screen.getByLabelText("Find a product"));
    await user.type(screen.getByLabelText("Find a product"), "no such product");
    expect(screen.getByRole("heading", { name: "No products match these filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rows()).toHaveLength(20);
  });

  it("filters by category and by stock status", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductsView />);
    await screen.findByRole("table");

    await user.selectOptions(screen.getByLabelText("Category"), "laptops");
    expect(rows()).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText("Category"), "");
    await user.selectOptions(screen.getByLabelText("Status"), "out-of-stock");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("P11");
  });

  it("sorts by price", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductsView />);
    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText("Sort by"), "price-desc");
    expect(rows()[0]).toHaveTextContent("P15");
  });

  it("removes an unreferenced product locally after confirming, and restores it", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductsView />);
    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Find a product"), "P22");

    await user.click(screen.getByRole("button", { name: "Delete P22" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("status")).toHaveTextContent('"P22" was removed (local simulation)');
    expect(loadOverlay().removed).toEqual([22]);
    expect(screen.queryByRole("table")).toBeNull();

    await user.selectOptions(screen.getByLabelText("Status"), "removed");
    await user.click(screen.getByRole("button", { name: "Restore P22" }));
    expect(loadOverlay().removed).toEqual([]);
  });

  it("can cancel a delete", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductsView />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Delete P20" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete P20" })).toBeInTheDocument();
    expect(loadOverlay().removed).toEqual([]);
  });

  it("archives instead of deleting a product that an existing order references (PRD edge case 27)", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductsView />);
    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Find a product"), "P1");

    await user.click(screen.getByRole("button", { name: "Delete P1" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("status")).toHaveTextContent(/is in \d+ existing orders?, so it was archived instead of deleted/);
    expect(loadOverlay().archived).toEqual([1]);
    expect(loadOverlay().removed).toEqual([]);
    expect(rowOf("P1")).toHaveTextContent("archived");
    await user.click(screen.getByRole("button", { name: "Restore P1" }));
    expect(loadOverlay().archived).toEqual([]);
  });

  it("shows a retryable error when the catalogue cannot be loaded, and tells offline apart", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("network", "offline"));
    renderWithClient(<ProductsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("You seem to be offline");

    vi.mocked(fetchCatalog).mockResolvedValue((await import("./admin-test-utils")).catalog);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("shows a generic error for other failures", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("http", "boom", 500));
    renderWithClient(<ProductsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not load the product catalogue");
  });
});

describe("NewProductView and EditProductView (PRD 8.2)", () => {
  async function fillNew(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Title"), "Brand New Lamp");
    await user.selectOptions(screen.getByLabelText("Category"), "beauty");
    await user.type(screen.getByLabelText("List price (INR)"), "1999");
    await user.type(screen.getByLabelText("Stock (units)"), "12");
  }

  it("validates every field inline and focuses the first problem", async () => {
    const user = userEvent.setup();
    renderWithClient(<NewProductView />);
    await screen.findByRole("form", { name: "Product details" });
    await user.click(screen.getByRole("button", { name: "Create product (local)" }));

    expect(screen.getByText(/Enter a title of 2 to 120 characters/)).toBeInTheDocument();
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();
    expect(screen.getByText(/whole-rupee price/)).toBeInTheDocument();
    expect(screen.getByText(/whole number of units/)).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveFocus();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(loadOverlay().added).toEqual([]);
  });

  it("creates a product locally and confirms it is simulated", async () => {
    const user = userEvent.setup();
    renderWithClient(<NewProductView />);
    await screen.findByRole("form", { name: "Product details" });
    await fillNew(user);
    await user.click(screen.getByRole("button", { name: "Create product (local)" }));

    expect(screen.getByRole("status")).toHaveTextContent('"Brand New Lamp" was created locally (simulation)');
    expect(loadOverlay().added).toMatchObject([{ id: 1_000_001, title: "Brand New Lamp", price: 1999, stock: 12, category: "beauty" }]);
    expect(screen.getByRole("link", { name: "Open it" })).toHaveAttribute("href", "/admin/products/1000001");
    expect(screen.getByLabelText("Title")).toHaveValue("");
  });

  it("edits a catalogue product, then discards the local edits", async () => {
    const user = userEvent.setup();
    renderWithClient(<EditProductView productId="12" />);
    expect(await screen.findByRole("heading", { level: 1, name: "P12" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("P12");

    await user.clear(screen.getByLabelText("Stock (units)"));
    await user.type(screen.getByLabelText("Stock (units)"), "2");
    await user.click(screen.getByRole("button", { name: "Save changes (local)" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved locally (simulation). The storefront is unchanged.");
    expect(loadOverlay().edits[12]?.stock).toBe(2);
    expect(screen.getAllByText("Low stock").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Discard local edits" }));
    expect(loadOverlay().edits).toEqual({});
  });

  it("explains an archived-on-delete outcome on the edit page, and restores", async () => {
    const user = userEvent.setup();
    renderWithClient(<EditProductView productId="2" />);
    await screen.findByRole("heading", { level: 1, name: "P2" });
    expect(screen.getByText(/Existing orders include this product/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete product" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("status")).toHaveTextContent(/archived instead of deleted/);
    await user.click(screen.getByRole("button", { name: "Restore product" }));
    expect(loadOverlay().archived).toEqual([]);
  });

  it("confirms the removal of a locally created product instead of showing a not-found page", async () => {
    const user = userEvent.setup();
    const id = useAdminCatalogueStore.getState().create({ title: "Temp Lamp", brand: null, category: "beauty", price: 100, discountPercentage: 0, stock: 5, description: "", tags: [] });
    renderWithClient(<EditProductView productId={String(id)} />);
    await screen.findByRole("heading", { level: 1, name: "Temp Lamp" });
    await user.click(screen.getByRole("button", { name: "Delete product" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("heading", { name: "Product removed" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent('"Temp Lamp" was removed (local simulation).');
    expect(loadOverlay().added).toEqual([]);
  });

  it("says a product does not exist", async () => {
    renderWithClient(<EditProductView productId="99999" />);
    expect(await screen.findByRole("heading", { name: "Product not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to products" })).toBeInTheDocument();
  });

  it("treats an id that is not a number as not found", async () => {
    renderWithClient(<EditProductView productId="abc" />);
    expect(await screen.findByRole("heading", { name: "Product not found" })).toBeInTheDocument();
  });
});

describe("InventoryView (PRD 8.2)", () => {
  it("lists products that need attention first, with a low-stock indicator", async () => {
    renderWithClient(<InventoryView />);
    await screen.findByRole("table");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("P11");
    expect(rows()[0]).toHaveTextContent("Out of stock");
    expect(screen.getByText("0 low on stock and 1 out of stock among active products.")).toBeInTheDocument();
  });

  it("adjusts stock locally and the product leaves the attention list", async () => {
    const user = userEvent.setup();
    renderWithClient(<InventoryView />);
    await screen.findByRole("table");

    await user.clear(screen.getByLabelText("Set stock for P11"));
    await user.type(screen.getByLabelText("Set stock for P11"), "40");
    await user.click(screen.getByRole("button", { name: "Set stock for P11" }));
    expect(screen.getByRole("status")).toHaveTextContent('Stock for "P11" set to 40 (local simulation).');
    expect(loadOverlay().edits[11]?.stock).toBe(40);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Nothing to show" })).toBeInTheDocument());
  });

  it("rejects stock that is not a whole number", async () => {
    const user = userEvent.setup();
    renderWithClient(<InventoryView />);
    await screen.findByRole("table");
    await user.clear(screen.getByLabelText("Set stock for P11"));
    await user.type(screen.getByLabelText("Set stock for P11"), "-3");
    await user.click(screen.getByRole("button", { name: "Set stock for P11" }));
    expect(screen.getByText(/Enter a whole number from 0 to/)).toBeInTheDocument();
    expect(loadOverlay().edits).toEqual({});
  });

  it("shows low-stock products once their stock is lowered", async () => {
    useAdminCatalogueStore.getState().save({ id: 3, origin: "catalogue" }, { title: "P3", brand: "Puma", category: "mens-shoes", price: 2800, discountPercentage: 0, stock: 2, description: "", tags: [] });
    const user = userEvent.setup();
    renderWithClient(<InventoryView />);
    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText("Show"), "low");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Low stock");
  });
});

describe("CategoriesView (PRD 8.2)", () => {
  it("lists categories with product counts", async () => {
    renderWithClient(<CategoriesView />);
    const list = await screen.findByRole("list", { name: "Categories" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(within(list).getByText("laptops · 2 products")).toBeInTheDocument();
  });

  it("creates a category, and refuses a duplicate with a reason", async () => {
    const user = userEvent.setup();
    renderWithClient(<CategoriesView />);
    await screen.findByRole("list", { name: "Categories" });

    await user.type(screen.getByLabelText("New category name"), "Garden Tools");
    await user.click(screen.getByRole("button", { name: "Add category (local)" }));
    expect(screen.getByRole("status")).toHaveTextContent('Category "Garden Tools" created locally (simulation)');
    expect(loadOverlay().addedCategories).toEqual([{ slug: "garden-tools", name: "Garden Tools" }]);
    expect(await screen.findByText("garden-tools · 0 products")).toBeInTheDocument();

    await user.type(screen.getByLabelText("New category name"), "laptops");
    await user.click(screen.getByRole("button", { name: "Add category (local)" }));
    expect(screen.getByText("A category with this name already exists.")).toBeInTheDocument();
  });

  it("renames a category's display name locally", async () => {
    const user = userEvent.setup();
    renderWithClient(<CategoriesView />);
    await screen.findByRole("list", { name: "Categories" });

    await user.click(screen.getByRole("button", { name: "Rename Laptops" }));
    const field = screen.getByLabelText("Name for laptops");
    await user.clear(field);
    await user.type(field, "Notebooks");
    await user.click(screen.getByRole("button", { name: "Save name (local)" }));
    expect(screen.getByText("Notebooks", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("(renamed locally)")).toBeInTheDocument();
    expect(loadOverlay().renamedCategories).toEqual({ laptops: "Notebooks" });
  });

  it("keeps the rename form open with an error for an empty name", async () => {
    const user = userEvent.setup();
    renderWithClient(<CategoriesView />);
    await screen.findByRole("list", { name: "Categories" });
    await user.click(screen.getByRole("button", { name: "Rename Beauty" }));
    await user.clear(screen.getByLabelText("Name for beauty"));
    await user.click(screen.getByRole("button", { name: "Save name (local)" }));
    expect(screen.getByText(/Enter a name of 2 to 40 characters/)).toBeInTheDocument();
    expect(loadOverlay().renamedCategories).toEqual({});
  });
});
