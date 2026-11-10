import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuantityStepper } from "./quantity-stepper";

const input = () => screen.getByRole("textbox", { name: "Quantity" });

describe("QuantityStepper", () => {
  it("increases and decreases by one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuantityStepper value={2} max={5} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    await user.click(screen.getByRole("button", { name: "Decrease quantity" }));

    expect(onChange.mock.calls.map((call) => call[0])).toEqual([3, 1]);
  });

  it("cannot go below 1 or above the available stock", () => {
    const { rerender } = render(<QuantityStepper value={1} max={3} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeEnabled();

    rerender(<QuantityStepper value={3} max={3} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  it("clamps a typed value to the stock when committed on blur", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuantityStepper value={1} max={3} onChange={onChange} />);

    await user.clear(input());
    await user.type(input(), "9");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it("commits on Enter and strips non-digit characters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuantityStepper value={1} max={10} onChange={onChange} />);

    await user.clear(input());
    await user.type(input(), "a4b{Enter}");

    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it("keeps the current quantity when the field is left empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuantityStepper value={2} max={5} onChange={onChange} />);

    await user.clear(input());
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it("tells the caller when a typed value was reduced to the limit (PRD MOD-05-001)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClamp = vi.fn();
    render(<QuantityStepper value={1} max={3} onChange={onChange} onClamp={onClamp} />);

    await user.clear(input());
    await user.type(input(), "9{Enter}");

    expect(onClamp).toHaveBeenCalledWith(9, 3);
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it("does not report a clamp when the typed value is within the limit", async () => {
    const user = userEvent.setup();
    const onClamp = vi.fn();
    render(<QuantityStepper value={1} max={5} onChange={vi.fn()} onClamp={onClamp} />);

    await user.clear(input());
    await user.type(input(), "4{Enter}");

    expect(onClamp).not.toHaveBeenCalled();
  });

  it("can be disabled entirely", () => {
    render(<QuantityStepper value={1} max={0} disabled onChange={vi.fn()} />);

    expect(input()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
  });
});
