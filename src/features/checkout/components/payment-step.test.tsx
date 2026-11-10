import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { PaymentSelection } from "@/types/checkout";
import { PaymentStep } from "./payment-step";

const empty: PaymentSelection = { method: null, outcome: null, acknowledged: false };

function setup(overrides: Partial<React.ComponentProps<typeof PaymentStep>> = {}) {
  const props = {
    payment: empty,
    total: 3099,
    placing: false,
    failure: null,
    showErrors: false,
    onChange: vi.fn(),
    onDismissFailure: vi.fn(),
    onBack: vi.fn(),
    onPlaceOrder: vi.fn(),
    ...overrides,
  };
  const view = render(<PaymentStep {...props} />);
  return { ...props, view, user: userEvent.setup() };
}

describe("PaymentStep (PRD 5.6 mock payment)", () => {
  it("is clearly labelled as test mode", () => {
    setup();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Test mode");
    expect(note).toHaveTextContent("No real money moves");
  });

  it("has no field that asks for a card number, CVV, bank login or UPI PIN", () => {
    const { view } = setup({ payment: { method: "mock-card", outcome: "approve", acknowledged: false } });

    const inputs = Array.from(view.container.querySelectorAll("input"));
    expect(inputs.length).toBeGreaterThan(0);
    // Only radios and one checkbox: nothing that can hold typed financial details.
    expect(inputs.every((input) => input.type === "radio" || input.type === "checkbox")).toBe(true);
    expect(view.container.querySelector("textarea, input[type=text], input[type=tel], input[type=number], input[type=password]")).toBeNull();

    // The test-mode banner correctly says what is NOT asked for, so it is excluded from this check.
    const clone = view.container.cloneNode(true) as HTMLElement;
    clone.querySelector("[role=note]")?.remove();
    const text = (clone.textContent ?? "") + inputs.map((input) => `${input.name} ${input.getAttribute("aria-label") ?? ""}`).join(" ");
    expect(text).not.toMatch(/card number|cvv|cvc|expiry date|upi id|vpa|net.?banking|bank login|password/i);
  });

  it("offers the three mock methods", () => {
    setup();
    expect(screen.getByRole("radio", { name: /Mock Card/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Mock UPI/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Mock Cash on Delivery/ })).toBeInTheDocument();
  });

  it("reports the chosen method", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("radio", { name: /Mock Card/ }));
    expect(onChange).toHaveBeenCalledWith({ method: "mock-card", outcome: null, acknowledged: false });
  });

  it("asks for a simulated result for card and UPI, but not for Cash on Delivery", () => {
    const { view } = setup({ payment: { method: "mock-card", outcome: null, acknowledged: false } });
    expect(screen.getByRole("group", { name: "Test result to simulate" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Approve the payment/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Decline the payment/ })).toBeInTheDocument();

    view.rerender(<PaymentStep payment={{ method: "mock-upi", outcome: null, acknowledged: false }} total={3099} placing={false} failure={null} showErrors={false} onChange={vi.fn()} onDismissFailure={vi.fn()} onBack={vi.fn()} onPlaceOrder={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Test result to simulate" })).toBeInTheDocument();

    view.rerender(<PaymentStep payment={{ method: "mock-cod", outcome: null, acknowledged: false }} total={3099} placing={false} failure={null} showErrors={false} onChange={vi.fn()} onDismissFailure={vi.fn()} onBack={vi.fn()} onPlaceOrder={vi.fn()} />);
    expect(screen.queryByRole("group", { name: "Test result to simulate" })).not.toBeInTheDocument();
  });

  it("drops a leftover test result when switching to Cash on Delivery", async () => {
    const { user, onChange } = setup({ payment: { method: "mock-card", outcome: "decline", acknowledged: true } });
    await user.click(screen.getByRole("radio", { name: /Mock Cash on Delivery/ }));
    expect(onChange).toHaveBeenCalledWith({ method: "mock-cod", outcome: null, acknowledged: true });
  });

  it("records the acknowledgement", async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole("checkbox", { name: /I understand this is a simulated test payment/ }));
    expect(onChange).toHaveBeenCalledWith({ method: null, outcome: null, acknowledged: true });
  });

  it("shows no validation messages until the shopper tries to place the order", () => {
    setup();
    expect(screen.queryByText("Choose a test payment method.")).not.toBeInTheDocument();
  });

  it("explains every missing choice after a failed attempt", () => {
    setup({ showErrors: true });
    expect(screen.getByText("Choose a test payment method.")).toBeInTheDocument();
    expect(screen.getByText("Confirm that you understand this is a test payment.")).toBeInTheDocument();
  });

  it("explains a missing test result", () => {
    setup({ showErrors: true, payment: { method: "mock-card", outcome: null, acknowledged: true } });
    expect(screen.getByText("Choose the test result to simulate.")).toBeInTheDocument();
  });

  it("explains the Cash on Delivery limit", () => {
    setup({ showErrors: true, total: 60000, payment: { method: "mock-cod", outcome: null, acknowledged: true } });
    expect(screen.getByText(/Cash on Delivery is not available for orders above ₹50,000/)).toBeInTheDocument();
  });

  it("shows a payment failure with a way to try again, without losing anything (PRD edge case 14)", async () => {
    const { user, onDismissFailure } = setup({
      failure: "The test Mock Card payment was declined (simulated). No money was taken.",
      payment: { method: "mock-card", outcome: "decline", acknowledged: true },
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Payment failed.");
    expect(alert).toHaveTextContent("No money was taken.");
    expect(alert).toHaveTextContent("Your details are saved.");

    await user.click(screen.getByRole("button", { name: "Try payment again" }));
    expect(onDismissFailure).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("radio", { name: /Mock Card/ })).toBeChecked();
  });

  it("places the order with the total on the button, and disables everything while processing", async () => {
    const { user, onPlaceOrder, view } = setup({ payment: { method: "mock-card", outcome: "approve", acknowledged: true } });
    await user.click(screen.getByRole("button", { name: "Place order (test mode) · ₹3,099" }));
    expect(onPlaceOrder).toHaveBeenCalledTimes(1);

    view.rerender(<PaymentStep payment={{ method: "mock-card", outcome: "approve", acknowledged: true }} total={3099} placing failure={null} showErrors={false} onChange={vi.fn()} onDismissFailure={vi.fn()} onBack={vi.fn()} onPlaceOrder={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Processing test payment..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });
});
