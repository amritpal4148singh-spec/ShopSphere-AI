
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SEARCH_HISTORY_KEY } from "@/lib/search-history";
import { fetchCategories, fetchSuggestions } from "@/services/products";
import { push, resetNavigation, setNavigation } from "@/test/navigation-mock";
import { renderWithClient } from "@/test/render";

import { SearchBar } from "./search-bar";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return {
    ...actual,
    fetchCatalog: vi.fn(),
    searchProducts: vi.fn(),
    fetchCategories: vi.fn(),
    fetchSuggestions: vi.fn(),
  };
});

const input = () => screen.getByRole("combobox", { name: "Search products" });

beforeEach(() => {
  resetNavigation();
  localStorage.clear();

  vi.mocked(fetchSuggestions).mockReset().mockResolvedValue([
    { id: 1, title: "Phone Alpha", category: "smartphones", thumbnail: null },
  ]);

  vi.mocked(fetchCategories).mockReset().mockResolvedValue([
    { slug: "smartphones", name: "Smartphones" },
  ]);
});

describe("SearchBar debounce (PRD MOD-03-001)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  function typeValue(value: string) {
    fireEvent.change(input(), {
      target: { value },
    });
  }

  it("fires no request while typing is still within the debounce window", async () => {
    renderWithClient(<SearchBar />);

    typeValue("ph");
    await advance(299);

    expect(fetchSuggestions).not.toHaveBeenCalled();
  });

  it("fires exactly one request once typing pauses", async () => {
    renderWithClient(<SearchBar />);

    typeValue("ph");
    await advance(350);

    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchSuggestions).mock.calls[0]?.[0]).toBe("ph");
  });

  it("restarts the wait on each keystroke, so a burst of typing makes one request for the final text", async () => {
    renderWithClient(<SearchBar />);

    typeValue("p");
    await advance(200);

    typeValue("ph");
    await advance(200);

    expect(fetchSuggestions).not.toHaveBeenCalled();

    await advance(150);

    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchSuggestions).mock.calls[0]?.[0]).toBe("ph");
  });

  it("does not request suggestions for a single character", async () => {
    renderWithClient(<SearchBar />);

    typeValue("p");
    await advance(1000);

    expect(fetchSuggestions).not.toHaveBeenCalled();
  });
});

describe("SearchBar", () => {
  it("shows popular searches when focused and empty, without any request", async () => {
    const user = userEvent.setup();
    renderWithClient(<SearchBar />);

    await user.click(input());

    expect(screen.getByRole("listbox", { name: "Search suggestions" })).toBeInTheDocument();
    expect(screen.getByText("Popular searches")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "smartphones" })).toBeInTheDocument();
    expect(fetchSuggestions).not.toHaveBeenCalled();
  });

  it("fires no request and does not navigate when an empty search is submitted (edge case 5)", async () => {
    const user = userEvent.setup();
    renderWithClient(<SearchBar />);

    await user.click(input());
    await user.keyboard("{Enter}");

    expect(push).not.toHaveBeenCalled();
    expect(fetchSuggestions).not.toHaveBeenCalled();
    expect(screen.getByText("Popular searches")).toBeInTheDocument();
  });

  it("searches on Enter, updates the URL and records the search in history", async () => {
    const user = userEvent.setup();
    renderWithClient(<SearchBar />);

    await user.type(input(), "running shoes{Enter}");

    expect(push).toHaveBeenCalledWith("/search?q=running%20shoes");
    expect(JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? "[]")).toEqual([
      "running shoes",
    ]);
  });

  it("lists recent searches first and can clear them", async () => {
    const user = userEvent.setup();
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(["laptops", "watches"]));
    renderWithClient(<SearchBar />);

    await user.click(input());
    expect(await screen.findByText("Recent searches")).toBeInTheDocument();
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("laptops");

    await user.click(screen.getByRole("button", { name: "Clear history" }));

    expect(screen.queryByText("Recent searches")).not.toBeInTheDocument();
    expect(localStorage.getItem(SEARCH_HISTORY_KEY)).toBeNull();
  });

  it("shows matching categories and products as suggestions", async () => {
    const user = userEvent.setup();
    renderWithClient(<SearchBar />);

    await user.type(input(), "phone");

    expect(await screen.findByRole("option", { name: /Search for “phone”/ })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Smartphones" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /Phone Alpha/ })).toBeInTheDocument();
  });

  it("goes straight to a product or category when a suggestion is chosen", async () => {
    const user = userEvent.setup();
    renderWithClient(<SearchBar />);

    await user.type(input(), "phone");
    await user.click(await screen.findByRole("option", { name: /Phone Alpha/ }));
    expect(push).toHaveBeenLastCalledWith("/products/1");

    await user.clear(input());
    await user.type(input(), "smart");
    await user.click(await screen.findByRole("option", { name: "Smartphones" }));
    expect(push).toHaveBeenLastCalledWith("/category/smartphones");
  });

  it("supports keyboard navigation with ARIA active descendant", async () => {
    const user = userEvent.setup();
    renderWithClient(<SearchBar />);

    await user.click(input());
    await user.keyboard("{ArrowDown}");

    const first = screen.getAllByRole("option")[0] as HTMLElement;
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(input()).toHaveAttribute("aria-activedescendant", first.id);
    expect(input()).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/search?q=smartphones");
  });

  it("closes the suggestions with Escape", async () => {
    const user = userEvent.setup();
    renderWithClient(<SearchBar />);

    await user.click(input());
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("limits the input length so extremely long queries cannot break the layout (edge case 22)", () => {
    renderWithClient(<SearchBar />);
    expect(input()).toHaveAttribute("maxlength", "100");
  });

  it("reflects the URL query on the search page, including back/forward changes", async () => {
    setNavigation("/search?q=laptops");
    renderWithClient(<SearchBar />);
    expect(input()).toHaveValue("laptops");

    act(() => setNavigation("/search?q=watches"));
    expect(await screen.findByDisplayValue("watches")).toBeInTheDocument();
  });

  it("says so when suggestions fail but still lets the visitor search", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchSuggestions).mockRejectedValue(new Error("down"));
    renderWithClient(<SearchBar />);

    await user.type(input(), "phone");

    expect(await screen.findByText(/Suggestions are unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Search for “phone”/ })).toBeInTheDocument();
  });
});
