import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CartLine } from "@/types/cart";
import { emptyDraft } from "@/utils/checkout";
import { SummaryStep } from "./summary-step";

const line = (overrides: Partial<CartLine["item"]> = {}, quantity = 2): CartLine => ({
  item: { key: "1:-", productId: 1, variantId: null, variantLabel: "Size: M", quantity, title: "Alpha Lamp", brand: null, category: "x", thumbnail: null, unitPrice: 1000, knownStock: 9, addedAt: 1, ...overrides },
  status: "ok",
  availableStock: 9,
  unitPrice: 1000,
  priceChange: null,
  quantity,
  lineTotal: 1000 * quantity,
  stale: false,
});

const draft = {
  ...emptyDraft(),
  customer: { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" },
  address: { line1: "12 Demo Street", line2: "Near Park", city: "New Delhi", state: "Delhi", pincode: "110001", savedAddressId: null, saveAddress: false },
  deliveryId: "express" as const,
};

describe("SummaryStep", () => {
  it("lists the items with quantity, variant and line total", () => {
    render(<SummaryStep draft={draft} lines={[line()]} onEdit={vi.fn()} onBack={vi.fn()} onNext={vi.fn()} />);

    const items = within(screen.getByRole("list", { name: "Items in your order" }));
    expect(items.getByText("Alpha Lamp")).toBeInTheDocument();
    expect(items.getByText("Size: M")).toBeInTheDocument();
    expect(items.getByText("2 × ₹1,000")).toBeInTheDocument();
    expect(items.getByText("₹2,000")).toBeInTheDocument();
  });

  it("recaps the customer, the address and the delivery method", () => {
    render(<SummaryStep draft={draft} lines={[line()]} onEdit={vi.fn()} onBack={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText("asha@example.com")).toBeInTheDocument();
    expect(screen.getByText("12 Demo Street, Near Park")).toBeInTheDocument();
    expect(screen.getByText("New Delhi, Delhi 110001")).toBeInTheDocument();
    expect(screen.getByText("Express delivery")).toBeInTheDocument();
  });

  it("lets the shopper jump back to edit each part", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<SummaryStep draft={draft} lines={[line()]} onEdit={onEdit} onBack={vi.fn()} onNext={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await user.click(screen.getByRole("button", { name: "Edit address" }));
    await user.click(screen.getByRole("button", { name: "Change delivery" }));

    expect(onEdit.mock.calls.map((call) => call[0])).toEqual([1, 2, 3]);
  });

  it("goes back and on to payment", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNext = vi.fn();
    render(<SummaryStep draft={draft} lines={[line()]} onEdit={vi.fn()} onBack={onBack} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Continue to payment" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
