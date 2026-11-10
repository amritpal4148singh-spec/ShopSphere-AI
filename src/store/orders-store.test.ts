import { SEED_CUSTOMER_ID } from "@/data/seed-data";
import { orderStorage } from "@/lib/order-storage";
import { buildOrder, getOrderStatus, ORDER_STATUSES } from "@/utils/orders";
import { useOrdersStore } from "./orders-store";

const make = (id: string, now: number) =>
  buildOrder({
    id,
    now,
    items: [{ productId: 1, title: "Lamp", thumbnail: null, variantLabel: null, quantity: 1, unitPrice: 1000 }],
    customer: { name: "Asha", email: "asha@example.com", phone: "9876543210" },
    address: { line1: "12 St", line2: "", city: "Delhi", state: "Delhi", pincode: "110001" },
    deliveryId: "standard",
    paymentMethod: "mock-cod",
    couponCode: null,
  });

beforeEach(() => {
  useOrdersStore.setState({ status: "idle", ownerId: null, orders: [] });
  localStorage.clear();
});

describe("useOrdersStore", () => {
  it("has no orders for a visitor who is not signed in", () => {
    useOrdersStore.getState().switchOwner(null);
    expect(useOrdersStore.getState()).toMatchObject({ status: "ready", orders: [] });
  });

  it("starts a new customer with an empty order history (edge case 13)", () => {
    useOrdersStore.getState().switchOwner("brand-new-user");
    expect(useOrdersStore.getState().orders).toEqual([]);
  });

  it("gives the demo customer one sample order per tracking status, newest first", () => {
    useOrdersStore.getState().switchOwner(SEED_CUSTOMER_ID);

    const orders = useOrdersStore.getState().orders;
    expect(orders).toHaveLength(6);
    const statuses = new Set(orders.map((order) => getOrderStatus(order, Date.now())));
    expect(statuses).toEqual(new Set(ORDER_STATUSES));
    expect(orders.map((order) => order.placedAt)).toEqual([...orders.map((order) => order.placedAt)].sort((a, b) => b - a));
  });

  it("creates the sample orders only once", () => {
    useOrdersStore.getState().switchOwner(SEED_CUSTOMER_ID);
    const first = orderStorage.load(SEED_CUSTOMER_ID)?.map((order) => order.placedAt);

    useOrdersStore.setState({ status: "idle", ownerId: null, orders: [] });
    useOrdersStore.getState().switchOwner(SEED_CUSTOMER_ID);

    expect(orderStorage.load(SEED_CUSTOMER_ID)?.map((order) => order.placedAt)).toEqual(first);
  });

  it("adds an order to the top of the history and persists it", () => {
    useOrdersStore.getState().switchOwner("u1");
    useOrdersStore.getState().addOrder(make("SS-1", 1000));
    useOrdersStore.getState().addOrder(make("SS-2", 2000));

    expect(useOrdersStore.getState().orders.map((order) => order.id)).toEqual(["SS-2", "SS-1"]);
    expect(orderStorage.load("u1")?.map((order) => order.id)).toEqual(["SS-2", "SS-1"]);
  });

  it("does not record the same order twice", () => {
    useOrdersStore.getState().switchOwner("u1");
    useOrdersStore.getState().addOrder(make("SS-1", 1000));
    useOrdersStore.getState().addOrder(make("SS-1", 1000));
    expect(useOrdersStore.getState().orders).toHaveLength(1);
  });

  it("keeps an order placed in another tab when adding one here", () => {
    useOrdersStore.getState().switchOwner("u1");
    orderStorage.save("u1", [make("SS-OTHER-TAB", 500)]);

    useOrdersStore.getState().addOrder(make("SS-1", 1000));

    expect(useOrdersStore.getState().orders.map((order) => order.id)).toEqual(["SS-1", "SS-OTHER-TAB"]);
  });

  it("shows each customer only their own orders", () => {
    useOrdersStore.getState().switchOwner("u1");
    useOrdersStore.getState().addOrder(make("SS-1", 1000));

    useOrdersStore.getState().switchOwner("u2");

    expect(useOrdersStore.getState().orders).toEqual([]);
  });

  it("ignores an order when nobody is signed in", () => {
    useOrdersStore.getState().switchOwner(null);
    useOrdersStore.getState().addOrder(make("SS-1", 1000));
    expect(useOrdersStore.getState().orders).toEqual([]);
  });

  it("reload picks up changes made elsewhere", () => {
    useOrdersStore.getState().switchOwner("u1");
    orderStorage.save("u1", [make("SS-9", 9000)]);
    useOrdersStore.getState().reload();
    expect(useOrdersStore.getState().orders.map((order) => order.id)).toEqual(["SS-9"]);
  });
});
