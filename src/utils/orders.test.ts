import { SEED_CUSTOMER_ID, createSeedOrders } from "@/data/seed-data";
import type { Order } from "@/types/order";
import {
  AUTO_PROGRESS_OFFSETS_MS,
  ORDER_STATUSES,
  STATUS_LABELS,
  buildOrder,
  buildTimeline,
  getCompletedStages,
  getOrderStatus,
} from "./orders";

const placedAt = Date.UTC(2026, 9, 14, 10, 0, 0);
const MINUTE = 60_000;

const items = [
  { productId: 1, title: "Lamp", thumbnail: null, variantLabel: null, quantity: 2, unitPrice: 1000 },
  { productId: 2, title: "Mug", thumbnail: null, variantLabel: "Size: M", quantity: 1, unitPrice: 500 },
];

const input = {
  id: "SS-20261014-ABCDE",
  now: placedAt,
  items,
  customer: { name: " Asha Rao ", email: "asha@example.com ", phone: "+91 98765 43210" },
  address: { line1: " 12 Demo Street ", line2: "", city: "New Delhi", state: "Delhi", pincode: "110001" },
  deliveryId: "express" as const,
  paymentMethod: "mock-card" as const,
  couponCode: "SAVE10",
};

function order(overrides: Partial<Order> = {}): Order {
  return { ...buildOrder(input), ...overrides };
}

describe("buildOrder", () => {
  it("records what was bought, with totals computed from the items", () => {
    const built = buildOrder(input);
    expect(built.totals).toEqual({ subtotal: 2500, discount: 250, shipping: 149, tax: 405, total: 2250 + 149 + 405, couponCode: "SAVE10" });
    expect(built.items).toBe(items);
  });

  it("cleans the customer and address, storing the phone as ten digits", () => {
    const built = buildOrder(input);
    expect(built.customer).toEqual({ name: "Asha Rao", email: "asha@example.com", phone: "9876543210" });
    expect(built.address.line1).toBe("12 Demo Street");
  });

  it("starts at Order Placed, auto-progressing, with a delivery window end date", () => {
    const built = buildOrder(input);
    expect(built.history).toEqual([{ status: "placed", at: placedAt }]);
    expect(built.autoProgress).toBe(true);
    expect(built.delivery).toEqual({ id: "express", label: "Express delivery", fee: 149 });
    expect(built.payment).toEqual({ method: "mock-card", label: "Mock Card" });
    expect(new Date(built.expectedDelivery).getDate()).toBe(new Date(placedAt + 3 * 86_400_000).getDate());
  });

  it("drops a coupon that does not qualify instead of recording it", () => {
    expect(buildOrder({ ...input, items: [items[1]!], couponCode: "WELCOME200" }).totals.couponCode).toBeNull();
  });
});

describe("tracking for new orders (simulated over time)", () => {
  const fresh = order();

  it("is just Order Placed at first", () => {
    expect(getOrderStatus(fresh, placedAt)).toBe("placed");
    expect(getCompletedStages(fresh, placedAt)).toEqual([{ status: "placed", at: placedAt }]);
  });

  it("advances stage by stage at the documented offsets", () => {
    expect(getOrderStatus(fresh, placedAt + 30_000)).toBe("confirmed");
    expect(getOrderStatus(fresh, placedAt + 2 * MINUTE)).toBe("packed");
    expect(getOrderStatus(fresh, placedAt + 5 * MINUTE)).toBe("shipped");
    expect(getOrderStatus(fresh, placedAt + 8 * MINUTE)).toBe("out-for-delivery");
    expect(getOrderStatus(fresh, placedAt + 12 * MINUTE)).toBe("delivered");
    expect(getOrderStatus(fresh, placedAt + 999 * MINUTE)).toBe("delivered");
  });

  it("timestamps each completed stage at placement plus its offset", () => {
    const completed = getCompletedStages(fresh, placedAt + 5 * MINUTE);
    expect(completed.map((stage) => stage.status)).toEqual(["placed", "confirmed", "packed", "shipped"]);
    expect(completed[3]?.at).toBe(placedAt + AUTO_PROGRESS_OFFSETS_MS.shipped);
  });
});

describe("buildTimeline (PRD MOD-08-001)", () => {
  const shipped = order({
    autoProgress: false,
    history: [
      { status: "placed", at: 1000 },
      { status: "confirmed", at: 2000 },
      { status: "packed", at: 3000 },
      { status: "shipped", at: 4000 },
    ],
  });

  it("shows every one of the six stages in order, with the PRD's labels", () => {
    const timeline = buildTimeline(shipped, 10_000);
    expect(timeline.map((stage) => stage.label)).toEqual([
      "Order Placed",
      "Confirmed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
    ]);
  });

  it("marks a Shipped order: four stages done with timestamps, the later two upcoming", () => {
    const timeline = buildTimeline(shipped, 10_000);
    expect(timeline.map((stage) => stage.state)).toEqual(["completed", "completed", "completed", "current", "upcoming", "upcoming"]);
    expect(timeline.slice(0, 4).map((stage) => stage.at)).toEqual([1000, 2000, 3000, 4000]);
    expect(timeline.slice(4).map((stage) => stage.at)).toEqual([null, null]);
  });

  it("does not move a sample order on its own", () => {
    expect(getOrderStatus(shipped, 999_999_999)).toBe("shipped");
  });

  it("marks a delivered order as completely done", () => {
    const delivered = order({ autoProgress: false, history: ORDER_STATUSES.map((status, index) => ({ status, at: index })) });
    expect(buildTimeline(delivered, 100).every((stage) => stage.state === "completed")).toBe(true);
  });

  it("shows a brand new order with Order Placed as the current stage", () => {
    const timeline = buildTimeline(order(), placedAt + 1000);
    expect(timeline[0]).toMatchObject({ state: "current", at: placedAt });
    expect(timeline.slice(1).every((stage) => stage.state === "upcoming")).toBe(true);
  });
});

describe("sample orders (PRD 10.3: every tracking status)", () => {
  const now = Date.UTC(2026, 9, 14, 12, 0, 0);
  const seeds = createSeedOrders(now);

  it("includes one order for each of the six statuses", () => {
    expect(seeds.map((seed) => getOrderStatus(seed, now))).toEqual([
      "delivered",
      "out-for-delivery",
      "shipped",
      "packed",
      "confirmed",
      "placed",
    ]);
    expect(new Set(seeds.map((seed) => getOrderStatus(seed, now)))).toEqual(new Set(ORDER_STATUSES));
  });

  it("keeps every sample order at its status, however much time passes", () => {
    const later = now + 1000 * 86_400_000;
    expect(seeds.map((seed) => getOrderStatus(seed, later))).toEqual(seeds.map((seed) => getOrderStatus(seed, now)));
  });

  it("has consistent timestamps: ascending, never in the future, and totals that add up", () => {
    for (const seed of seeds) {
      const times = seed.history.map((record) => record.at);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(Math.max(...times)).toBeLessThanOrEqual(now);
      expect(seed.totals.total).toBe(seed.totals.subtotal - seed.totals.discount + seed.totals.shipping + seed.totals.tax);
      expect(seed.autoProgress).toBe(false);
    }
  });

  it("uses unique order IDs and labels for every status", () => {
    expect(new Set(seeds.map((seed) => seed.id)).size).toBe(seeds.length);
    expect(Object.keys(STATUS_LABELS)).toEqual([...ORDER_STATUSES]);
  });

  it("belongs to the demo customer", () => {
    expect(SEED_CUSTOMER_ID).toBe("user-seed-customer");
  });
});
