
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Pagination } from "./pagination";

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("marks the current page and disables Previous on the first page", () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 2" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("disables Next on the last page", () => {
    render(<Pagination page={3} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("reports the chosen page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "Page 4" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));

    expect(onPageChange.mock.calls.map((call) => call[0])).toEqual([4, 4, 2]);
  });
});
