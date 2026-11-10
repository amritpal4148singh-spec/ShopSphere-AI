import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { VariantGroup } from "@/types/product";
import { VariantSelector } from "./variant-selector";

const group: VariantGroup = {
  id: "size",
  label: "Size",
  options: [
    { id: "size-7", label: "7", stock: 4 },
    { id: "size-8", label: "8", stock: 0 },
    { id: "size-9", label: "9", stock: 12 },
  ],
};

describe("VariantSelector", () => {
  it("lists every option as a radio and shows the selected one in the legend", () => {
    render(<VariantSelector group={group} selectedId="size-9" onSelect={vi.fn()} />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "9" })).toBeChecked();
    expect(screen.getByRole("group", { name: /Size:\s*9/ })).toBeInTheDocument();
  });

  it("announces a sold-out option as out of stock but keeps it selectable (PRD MOD-04-001)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<VariantSelector group={group} selectedId="size-7" onSelect={onSelect} />);

    const soldOut = screen.getByRole("radio", { name: "8 (out of stock)" });
    expect(soldOut).toBeEnabled();

    await user.click(soldOut);
    expect(onSelect).toHaveBeenCalledWith("size-8");
  });

  it("does not mark in-stock options as out of stock", () => {
    render(<VariantSelector group={group} selectedId="size-7" onSelect={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "7" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "7 (out of stock)" })).not.toBeInTheDocument();
  });
});
