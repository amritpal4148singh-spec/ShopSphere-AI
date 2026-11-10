import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SEARCH_HISTORY_KEY } from "@/lib/search-history";
import { SearchHome } from "./search-home";

beforeEach(() => {
  localStorage.clear();
});

describe("SearchHome", () => {
  it("offers popular searches as links, and no recent section when there is no history", () => {
    render(<SearchHome />);

    expect(screen.getByRole("heading", { name: "Popular searches" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "laptops" })).toHaveAttribute("href", "/search?q=laptops");
    expect(screen.queryByRole("heading", { name: "Recent searches" })).not.toBeInTheDocument();
  });

  it("lists recent searches and clears them", async () => {
    const user = userEvent.setup();
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(["red shoes"]));
    render(<SearchHome />);

    expect(await screen.findByRole("link", { name: "red shoes" })).toHaveAttribute("href", "/search?q=red%20shoes");

    await user.click(screen.getByRole("button", { name: "Clear history" }));

    expect(screen.queryByRole("link", { name: "red shoes" })).not.toBeInTheDocument();
  });
});
