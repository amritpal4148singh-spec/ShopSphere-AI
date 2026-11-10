import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeliveryStep } from "./delivery-step";

function setup(overrides: Partial<React.ComponentProps<typeof DeliveryStep>> = {}) {
  const props = { deliveryId: "standard" as const, subtotal: 2500, couponCode: null, onChange: vi.fn(), onBack: vi.fn(), onNext: vi.fn(), ...overrides };
  render(<DeliveryStep {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe("DeliveryStep", () => {
  it("offers the three simulated methods with their costs", () => {
    setup();
    expect(screen.getByRole("radio", { name: /Standard delivery/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Express delivery.*₹149/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Priority next-day.*₹299/ })).toBeInTheDocument();
  });

  it("shows standard delivery as free on a large order and charged on a small one", () => {
    const { unmount } = render(<DeliveryStep deliveryId="standard" subtotal={2500} couponCode={null} onChange={vi.fn()} onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /Standard delivery.*Free$/ })).toBeInTheDocument();
    unmount();

    render(<DeliveryStep deliveryId="standard" subtotal={500} couponCode={null} onChange={vi.fn()} onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /Standard delivery.*₹99$/ })).toBeInTheDocument();
  });

  it("labels each estimate as simulated", () => {
    setup();
    expect(screen.getAllByText(/Estimated delivery: .*\(simulated\)/)).toHaveLength(3);
  });

  it("marks the chosen method and reports a change", async () => {
    const { user, onChange } = setup({ deliveryId: "express" });
    expect(screen.getByRole("radio", { name: /Express delivery/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /Priority next-day/ }));

    expect(onChange).toHaveBeenCalledWith("priority");
  });

  it("goes back and forward", async () => {
    const { user, onBack, onNext } = setup();
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Continue to summary" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
