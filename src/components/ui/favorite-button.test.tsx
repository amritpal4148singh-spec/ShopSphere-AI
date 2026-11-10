import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FavoriteButton } from "./favorite-button";

describe("FavoriteButton", () => {
  it("names the product and announces the unsaved state", () => {
    render(<FavoriteButton name="Trail Runner" pressed={false} onToggle={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Add Trail Runner to wishlist" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("announces the saved state", () => {
    render(<FavoriteButton name="Trail Runner" pressed onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Remove Trail Runner from wishlist" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onToggle when pressed", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<FavoriteButton name="Trail Runner" pressed={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
