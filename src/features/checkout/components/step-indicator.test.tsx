import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StepIndicator } from "./step-indicator";

describe("StepIndicator", () => {
  it("lists the six PRD steps and marks the current one", () => {
    render(<StepIndicator current={2} maxStep={2} onSelect={vi.fn()} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    for (const label of ["Customer", "Address", "Delivery", "Summary", "Payment", "Confirmation"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(items[1]).toHaveAttribute("aria-current", "step");
  });

  it("lets the shopper go back to a completed step, but not skip ahead", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<StepIndicator current={3} maxStep={3} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /Customer/ }));
    expect(onSelect).toHaveBeenCalledWith(1);

    expect(screen.queryByRole("button", { name: /Summary/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Payment/ })).not.toBeInTheDocument();
  });

  it("allows returning to a later step that was already reached", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<StepIndicator current={2} maxStep={4} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: /Summary/ }));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it("never offers the confirmation step as a button", () => {
    render(<StepIndicator current={5} maxStep={5} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Confirmation/ })).not.toBeInTheDocument();
  });
});
