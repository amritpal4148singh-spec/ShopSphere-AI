import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError, fetchCatalog } from "@/services/products";
import { createSession } from "@/services/auth";
import { simulatePayment } from "@/services/checkout/payment";
import { useAddressStore } from "@/store/address-store";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import { useCheckoutStore } from "@/store/checkout-store";
import { useOrdersStore } from "@/store/orders-store";
import { checkoutStorage } from "@/lib/checkout-storage";
import { makeProduct } from "@/test/fixtures";
import { replace, resetNavigation } from "@/test/navigation-mock";
import { renderWithClient } from "@/test/render";
import type { NewCartItem } from "@/types/cart";
import { emptyDraft } from "@/utils/checkout";
import { CheckoutView } from "./checkout-view";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);
vi.mock("@/services/checkout/payment", () => ({ simulatePayment: vi.fn(), PAYMENT_DELAY_MS: 0 }));
vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const lamp = makeProduct({ id: 1, title: "Alpha Lamp", category: "groceries", stock: 10, price: 1000, finalPrice: 1000 });
const mug = makeProduct({ id: 2, title: "Bravo Mug", category: "groceries", stock: 3, price: 500, finalPrice: 500 });

const customer = { id: "u1", name: "Casey Customer", email: "casey@example.com", role: "customer" as const };

function cartItem(overrides: Partial<NewCartItem> = {}): NewCartItem {
  return { productId: 1, variantId: null, variantLabel: null, quantity: 2, title: "Alpha Lamp", brand: null, category: "groceries", thumbnail: null, unitPrice: 1000, knownStock: 10, ...overrides };
}
const mugItem = () => cartItem({ productId: 2, title: "Bravo Mug", quantity: 1, unitPrice: 500, knownStock: 3 });

/** Signs in and readies every store, as the sync components do in the app. */
function setup(items: NewCartItem[] = [cartItem(), mugItem()]) {
  useAuthStore.setState({ status: "authenticated", session: createSession(customer) });
  useCartStore.getState().switchOwner("u1");
  useCheckoutStore.getState().switchOwner("u1");
  useOrdersStore.getState().switchOwner("u1");
  useAddressStore.getState().switchOwner("u1");
  for (const item of items) useCartStore.getState().addItem(item);
}

const total = () => screen.getByTestId("checkout-total");

async function completeCustomer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByLabelText("Mobile number"),
    "9876543210",
  );

  const continueButton = screen.getAllByRole("button", {
    name: "Continue to address",
  })[0];

  if (!continueButton) {
    throw new Error("Continue to address button not found");
  }

  await user.click(continueButton);
}

async function completeAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Street address"), "12 Demo Street");
  await user.type(screen.getByLabelText("City"), "New Delhi");
  await user.type(screen.getByLabelText("State"), "Delhi");
  await user.type(screen.getByLabelText("PIN code"), "110001");
  await user.click(screen.getByRole("button", { name: "Continue to delivery" }));
}

async function goToPayment(user: ReturnType<typeof userEvent.setup>) {
  await completeCustomer(user);
  await completeAddress(user);
  await user.click(await screen.findByRole("button", { name: "Continue to summary" }));
  await user.click(await screen.findByRole("button", { name: "Continue to payment" }));
  await screen.findByRole("heading", { name: "Payment" });
}

async function payWithApprovedCard(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: /Mock Card/ }));
  await user.click(screen.getByRole("radio", { name: /Approve the payment/ }));
  await user.click(screen.getByRole("checkbox", { name: /I understand this is a simulated test payment/ }));
  await user.click(screen.getByRole("button", { name: /Place order \(test mode\)/ }));
}

beforeEach(() => {
  resetNavigation();
  localStorage.clear();
  sessionStorage.clear();
  useAuthStore.setState({ status: "idle", session: null });
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
  useCheckoutStore.setState({ status: "idle", ownerId: null, draft: null });
  useOrdersStore.setState({ status: "idle", ownerId: null, orders: [] });
  useAddressStore.setState({ status: "idle", ownerId: null, addresses: [] });
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue([lamp, mug]);
  vi.mocked(simulatePayment).mockReset().mockResolvedValue({ ok: true, reference: "TEST-00000001" });
});

describe("CheckoutView: starting", () => {
  it("shows a skeleton until the cart, draft, orders and addresses are ready", () => {
    renderWithClient(<CheckoutView />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading checkout");
  });

  it("says there is nothing to check out when the cart is empty", () => {
    setup([]);
    renderWithClient(<CheckoutView />);

    expect(screen.getByRole("heading", { name: "There is nothing to check out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse Products" })).toHaveAttribute("href", "/products");
  });

  it("does not start checkout while the cart needs attention, and says what to fix (PRD 5.5)", async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([makeProduct({ ...lamp, stock: 0, availability: "out-of-stock" }), mug]);
    setup();
    renderWithClient(<CheckoutView />);

    expect(await screen.findByRole("heading", { name: "Review your cart before checking out" })).toBeInTheDocument();
    expect(screen.getByText("Alpha Lamp is out of stock.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your cart" })).toHaveAttribute("href", "/cart");
  });

  it("starts at step 1 with the customer's name and email filled in", async () => {
    setup();
    renderWithClient(<CheckoutView />);

    expect(await screen.findByRole("heading", { name: "Your details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Casey Customer");
    expect(screen.getByLabelText("Email")).toHaveValue("casey@example.com");
    expect(screen.getByLabelText("Mobile number")).toHaveValue("");
    expect(screen.getByRole("navigation", { name: "Checkout progress" })).toBeInTheDocument();
  });

  it("warns when live prices cannot be re-checked, but still lets checkout proceed", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("network", "down"));
    setup();
    renderWithClient(<CheckoutView />);

    expect(await screen.findByText(/could not re-check the latest prices/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();
  });
});

describe("CheckoutView: the six steps", () => {
  it("blocks step 1 until the details are valid, then moves on", async () => {
    const user = userEvent.setup();
    setup();
    renderWithClient(<CheckoutView />);

    await user.click(await screen.findByRole("button", { name: "Continue to address" }));
    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription("Enter your mobile number.");
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();

    await completeCustomer(user);
    expect(await screen.findByRole("heading", { name: "Delivery address" })).toBeInTheDocument();
  });

  it("blocks step 2 until the address is valid", async () => {
    const user = userEvent.setup();
    setup();
    renderWithClient(<CheckoutView />);
    await completeCustomer(user);

    await user.click(await screen.findByRole("button", { name: "Continue to delivery" }));

    expect(screen.getByLabelText("PIN code")).toHaveAccessibleDescription("Enter your PIN code.");
    expect(screen.getByRole("heading", { name: "Delivery address" })).toBeInTheDocument();
  });

  it("updates the order total when a faster delivery method is chosen", async () => {
    const user = userEvent.setup();
    setup();
    renderWithClient(<CheckoutView />);
    await completeCustomer(user);
    await completeAddress(user);

    expect(total()).toHaveTextContent("₹2,950");

    await user.click(await screen.findByRole("radio", { name: /Express delivery/ }));

    expect(total()).toHaveTextContent("₹3,099");
    expect(useCheckoutStore.getState().draft?.deliveryId).toBe("express");
  });

  it("applies the cart's coupon to the checkout total", async () => {
    setup();
    useCartStore.getState().applyCoupon("SAVE10");
    renderWithClient(<CheckoutView />);

    // 2,500 - 250 = 2,250 + free shipping + 405 tax
    expect(await screen.findByTestId("checkout-total")).toHaveTextContent("₹2,655");
  });

  it("shows a review of items and details at step 4, with links back to edit", async () => {
    const user = userEvent.setup();
    setup();
    renderWithClient(<CheckoutView />);
    await completeCustomer(user);
    await completeAddress(user);
    await user.click(await screen.findByRole("button", { name: "Continue to summary" }));

    const items = within(await screen.findByRole("list", { name: "Items in your order" }));
    expect(items.getByText("Alpha Lamp")).toBeInTheDocument();
    expect(items.getByText("2 × ₹1,000")).toBeInTheDocument();
    expect(screen.getByText("12 Demo Street")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit address" }));
    expect(await screen.findByRole("heading", { name: "Delivery address" })).toBeInTheDocument();
    expect(screen.getByLabelText("Street address")).toHaveValue("12 Demo Street");
  });

  it("uses a saved address when the customer has one (PRD 5.6)", async () => {
    const user = userEvent.setup();
    setup();
    useAddressStore.getState().add({ line1: "99 Home Road", line2: "", city: "Pune", state: "Maharashtra", pincode: "411001" }, "Home");
    renderWithClient(<CheckoutView />);
    await completeCustomer(user);

    await user.click(await screen.findByRole("radio", { name: /Home/ }));
    expect(screen.getByLabelText("City")).toHaveValue("Pune");
    await user.click(screen.getByRole("button", { name: "Continue to delivery" }));

    expect(await screen.findByRole("heading", { name: "Delivery method" })).toBeInTheDocument();
    expect(useCheckoutStore.getState().draft?.address.savedAddressId).not.toBeNull();
  });
});

describe("CheckoutView: placing the order", () => {
  it("places the order, records it with the totals the customer saw, empties the cart and shows the confirmation", async () => {
    const user = userEvent.setup();
    setup();
    renderWithClient(<CheckoutView />);
    await completeCustomer(user);
    await completeAddress(user);
    await user.click(await screen.findByRole("radio", { name: /Express delivery/ }));
    await user.click(screen.getByRole("button", { name: "Continue to summary" }));
    await user.click(await screen.findByRole("button", { name: "Continue to payment" }));

    expect(total()).toHaveTextContent("₹3,099");
    await payWithApprovedCard(user);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const orders = useOrdersStore.getState().orders;
    expect(orders).toHaveLength(1);
    const [order] = orders;
    expect(order).toMatchObject({
      customer: { name: "Casey Customer", email: "casey@example.com", phone: "9876543210" },
      address: { line1: "12 Demo Street", city: "New Delhi", state: "Delhi", pincode: "110001" },
      delivery: { id: "express", fee: 149 },
      payment: { method: "mock-card" },
      totals: { subtotal: 2500, shipping: 149, tax: 450, total: 3099 },
      autoProgress: true,
    });
    expect(order?.items.map((item) => [item.title, item.quantity, item.unitPrice])).toEqual([
      ["Alpha Lamp", 2, 1000],
      ["Bravo Mug", 1, 500],
    ]);
    expect(order?.id).toMatch(/^SS-\d{8}-[A-Z0-9]{5}$/);

    expect(replace).toHaveBeenCalledWith(`/checkout/confirmation/${order?.id}`);
    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().couponCode).toBeNull();
    expect(useCheckoutStore.getState().draft).toBeNull();
    expect(checkoutStorage.has("u1")).toBe(false);
    expect(vi.mocked(simulatePayment)).toHaveBeenCalledTimes(1);
  });

  it("saves a new address for next time when the customer asked to", async () => {
    const user = userEvent.setup();
    setup();
    renderWithClient(<CheckoutView />);
    await completeCustomer(user);
    await user.type(await screen.findByLabelText("Street address"), "12 Demo Street");
    await user.type(screen.getByLabelText("City"), "New Delhi");
    await user.type(screen.getByLabelText("State"), "Delhi");
    await user.type(screen.getByLabelText("PIN code"), "110001");
    await user.click(screen.getByRole("checkbox", { name: "Save this address for next time" }));
    await user.click(screen.getByRole("button", { name: "Continue to delivery" }));
    await user.click(await screen.findByRole("button", { name: "Continue to summary" }));
    await user.click(await screen.findByRole("button", { name: "Continue to payment" }));
    await screen.findByRole("heading", { name: "Payment" });

    await payWithApprovedCard(user);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(useAddressStore.getState().addresses).toHaveLength(1);
    expect(useAddressStore.getState().addresses[0]).toMatchObject({ line1: "12 Demo Street", pincode: "110001" });
  });

  it("will not place the order until a payment method and the test-mode confirmation are chosen", async () => {
    const user = userEvent.setup();
    setup();
    renderWithClient(<CheckoutView />);
    await goToPayment(user);

    await user.click(screen.getByRole("button", { name: /Place order \(test mode\)/ }));

    expect(screen.getByText("Choose a test payment method.")).toBeInTheDocument();
    expect(vi.mocked(simulatePayment)).not.toHaveBeenCalled();
    expect(useOrdersStore.getState().orders).toEqual([]);
  });

  it("keeps everything and offers a retry when the test payment is declined (PRD edge case 14)", async () => {
    const user = userEvent.setup();
    vi.mocked(simulatePayment)
      .mockResolvedValueOnce({ ok: false, message: "The test Mock Card payment was declined (simulated). No money was taken." })
      .mockResolvedValue({ ok: true, reference: "TEST-1" });
    setup();
    renderWithClient(<CheckoutView />);
    await goToPayment(user);

    await user.click(screen.getByRole("radio", { name: /Mock Card/ }));
    await user.click(screen.getByRole("radio", { name: /Decline the payment/ }));
    await user.click(screen.getByRole("checkbox", { name: /I understand this is a simulated test payment/ }));
    await user.click(screen.getByRole("button", { name: /Place order \(test mode\)/ }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Payment failed.");
    expect(alert).toHaveTextContent("No money was taken.");
    expect(useOrdersStore.getState().orders).toEqual([]);
    expect(useCartStore.getState().items).toHaveLength(2);
    expect(useCheckoutStore.getState().draft?.customer.phone).toBe("9876543210");
    expect(replace).not.toHaveBeenCalled();

    // Earlier steps keep their data, and the customer can retry from payment.
    await user.click(screen.getByRole("button", { name: "Try payment again" }));
    await user.click(screen.getByRole("radio", { name: /Approve the payment/ }));
    await user.click(screen.getByRole("button", { name: /Place order \(test mode\)/ }));

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(useOrdersStore.getState().orders).toHaveLength(1);
  });

  it("places an order only once even if the button is pressed twice", async () => {
    const user = userEvent.setup();
    let release: (result: { ok: true; reference: string }) => void = () => undefined;
    vi.mocked(simulatePayment).mockImplementation(() => new Promise((resolve) => (release = resolve)));
    setup();
    renderWithClient(<CheckoutView />);
    await goToPayment(user);
    await user.click(screen.getByRole("radio", { name: /Mock Cash on Delivery/ }));
    await user.click(screen.getByRole("checkbox", { name: /I understand this is a simulated test payment/ }));

    const button = screen.getByRole("button", { name: /Place order \(test mode\)/ });
    await user.click(button);
    await user.click(button);

    expect(vi.mocked(simulatePayment)).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Processing test payment..." })).toBeDisabled();

    release({ ok: true, reference: "TEST-1" });
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(useOrdersStore.getState().orders).toHaveLength(1);
  });
});

describe("CheckoutView: refresh and restore (PRD MOD-06-002, MOD-06-001)", () => {
  /** A page refresh loses in-memory state; local storage remains. */
  function simulateRefresh() {
    useCheckoutStore.setState({ status: "idle", ownerId: null, draft: null });
    useCheckoutStore.getState().switchOwner("u1");
  }

  it("returns to the same step with the entered data after a refresh", async () => {
    const user = userEvent.setup();
    setup();
    const first = renderWithClient(<CheckoutView />);
    await completeCustomer(user);
    await user.type(await screen.findByLabelText("Street address"), "12 Demo Street");
    first.unmount();

    simulateRefresh();
    renderWithClient(<CheckoutView />);

    expect(await screen.findByRole("heading", { name: "Delivery address" })).toBeInTheDocument();
    expect(screen.getByLabelText("Street address")).toHaveValue("12 Demo Street");
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Address");
  });

  it("restores the payment step and the chosen test payment after the session expired and the customer signed back in", async () => {
    const user = userEvent.setup();
    setup();
    const first = renderWithClient(<CheckoutView />);
    await goToPayment(user);
    await user.click(screen.getByRole("radio", { name: /Mock UPI/ }));
    await user.click(screen.getByRole("radio", { name: /Approve the payment/ }));
    first.unmount();

    simulateRefresh();
    renderWithClient(<CheckoutView />);

    expect(await screen.findByRole("heading", { name: "Payment" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Mock UPI/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Approve the payment/ })).toBeChecked();
  });

  it("never shows a step whose earlier steps are incomplete, even from a tampered draft", async () => {
    setup();
    checkoutStorage.save("u1", { ...emptyDraft(), step: 5, maxStep: 5 });
    simulateRefresh();
    renderWithClient(<CheckoutView />);

    expect(await screen.findByRole("heading", { name: "Your details" })).toBeInTheDocument();
  });

  it("lets the customer revisit a completed step with the progress bar", async () => {
    const user = userEvent.setup();
    setup();
    renderWithClient(<CheckoutView />);
    await completeCustomer(user);
    await completeAddress(user);
    await screen.findByRole("heading", { name: "Delivery method" });

    await user.click(within(screen.getByRole("navigation", { name: "Checkout progress" })).getByRole("button", { name: /Customer/ }));

    expect(await screen.findByRole("heading", { name: "Your details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile number")).toHaveValue("9876543210");
  });
});
