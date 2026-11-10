
import type { Page, Route } from "@playwright/test";

/**
 * Deterministic stand-in for the DummyJSON endpoints the app uses (products, search, categories),
 * so end-to-end tests do not depend on the live service. Shapes follow the real API.
 */
const IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#dde1e8"/></svg>',
)}`;

interface RawProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand: string;
  thumbnail: string;
  availabilityStatus: string;
  meta: { createdAt: string };
}

function raw(
  id: number,
  category: string,
  priceUsd: number,
  rating: number,
  extra: Partial<RawProduct> = {},
): RawProduct {
  return {
    id,
    title: `Test Product ${id}`,
    description: `Description ${id}`,
    category,
    price: priceUsd,
    discountPercentage: 0,
    rating,
    stock: 25,
    tags: [],
    brand: id % 2 === 0 ? "Acme" : "Zenith",
    thumbnail: IMAGE,
    availabilityStatus: "In Stock",
    meta: {
      createdAt: `2024-01-${String((id % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    },
    ...extra,
  };
}

/** Prices are USD; the app converts at 85 INR per USD. */
export const PRODUCTS: RawProduct[] = [
  raw(1, "mens-shoes", 40, 4.5),
  raw(2, "mens-shoes", 55, 4.2),
  raw(3, "mens-shoes", 20, 4.8),
  raw(4, "mens-shoes", 60, 4.6),
  raw(5, "womens-shoes", 45, 4.1),
  raw(6, "womens-shoes", 35, 3.5),
  raw(7, "smartphones", 300, 4.7, { title: "Test Phone Seven" }),
  raw(8, "smartphones", 500, 4.9, { title: "Test Phone Eight" }),
  raw(9, "smartphones", 150, 4.4, {
    title: "Test Phone Nine",
    stock: 0,
    availabilityStatus: "Out of Stock",
  }),
  raw(10, "laptops", 900, 4.3),
  raw(11, "laptops", 1200, 4.6),
  raw(12, "laptops", 700, 4.0),
  ...Array.from({ length: 18 }, (_, index) =>
    raw(13 + index, "beauty", 10 + index, 3.9)
  ),
];

/** Products that exist only on the detail endpoint. */
const DETAIL_ONLY: RawProduct[] = [
  raw(100, "groceries", 2, 4.0, {
    title: "Test Pantry Item",
    stock: 3,
    availabilityStatus: "Low Stock",
  }),
];

/** Phone accessories, added only when a test asks for them. */
const EXTRAS: RawProduct[] = [
  raw(31, "mobile-accessories", 10, 4.5, {
    title: "Test Accessory Case",
    tags: ["case", "phone"],
  }),
  raw(32, "mobile-accessories", 18, 4.2, {
    title: "Test Accessory Charger",
    tags: ["charger", "phone"],
  }),
  raw(33, "mobile-accessories", 8, 3.9, {
    title: "Test Accessory Cable",
    tags: ["cable"],
  }),
];

/** Headphones, added only when a test asks for them. */
const AUDIO: RawProduct[] = [
  raw(41, "mobile-accessories", 25, 4.5, {
    title: "Test Headphones Alpha",
    tags: ["headphones", "audio"],
  }),
  raw(42, "mobile-accessories", 45, 4.2, {
    title: "Test Headphones Bravo",
    tags: ["headphones", "audio"],
  }),
  raw(43, "mobile-accessories", 55, 4.8, {
    title: "Test Headphones Charlie",
    tags: ["headphones", "audio"],
  }),
  raw(44, "mobile-accessories", 120, 4.6, {
    title: "Test Headphones Delta",
    tags: ["headphones", "audio"],
  }),
  raw(45, "mobile-accessories", 40, 4.0, {
    title: "Test Blue Headset",
    tags: ["headset", "audio"],
  }),
];

const COLORS = ["#cfe8e4", "#e8d9cf", "#d9cfe8"];

function detailImages(id: number): string[] {
  return COLORS.map((color, index) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/><text x="20" y="40">p${id}-${index + 1}</text></svg>`,
    )}`,
  );
}

function toDetail(product: RawProduct) {
  return {
    ...product,
    images: detailImages(product.id),
    reviews: [1, 2, 3].map((n) => ({
      rating: 4,
      comment: `Review ${n}`,
      date: "2024-05-01T00:00:00.000Z",
      reviewerName: `Reviewer ${n}`,
      reviewerEmail: `r${n}@example.test`,
    })),
    sku: `SKU-${product.id}`,
    warrantyInformation: "1 year warranty",
    shippingInformation: "Ships in 1-2 business days",
    returnPolicy: "30 days return policy",
    minimumOrderQuantity: 1,
  };
}

export const CATEGORIES = [
  { slug: "beauty", name: "Beauty", url: "x" },
  { slug: "laptops", name: "Laptops", url: "x" },
  { slug: "mens-shoes", name: "Mens Shoes", url: "x" },
  { slug: "smartphones", name: "Smartphones", url: "x" },
  { slug: "womens-shoes", name: "Womens Shoes", url: "x" },
];

export interface MockApi {
  /** Requests received per endpoint, for asserting on debounce behaviour. */
  requests: {
    search: string[];
    suggestions: string[];
    products: number;
    categories: number;
  };
  /** While true, product list requests fail with a network error. */
  failProducts: boolean;
  /** While true, product detail requests fail with a network error. */
  failProduct: boolean;
  /** Whether optional extra products are part of the catalogue. */
  extras: boolean;
  /** Whether optional headphones are part of the catalogue. */
  audio: boolean;
  /** Live changes to the catalogue. */
  overrides: {
    removed: Set<number>;
    priceUsd: Record<number, number>;
    stock: Record<number, number>;
  };
}

function applyOverrides(api: MockApi, product: RawProduct): RawProduct | null {
  const { removed, priceUsd, stock } = api.overrides;

  if (removed.has(product.id)) return null;

  const next = { ...product };

  if (priceUsd[product.id] !== undefined) {
    next.price = priceUsd[product.id] as number;
  }

  if (stock[product.id] !== undefined) {
    next.stock = stock[product.id] as number;
    next.availabilityStatus =
      next.stock === 0
        ? "Out of Stock"
        : next.stock <= 5
          ? "Low Stock"
          : "In Stock";
  }

  return next;
}

function visible(api: MockApi): RawProduct[] {
  return [
    ...PRODUCTS,
    ...(api.extras ? EXTRAS : []),
    ...(api.audio ? AUDIO : []),
  ]
    .map((product) => applyOverrides(api, product))
    .filter((product): product is RawProduct => product !== null);
}

export async function mockDummyJson(
  page: Page,
  options: { extras?: boolean; audio?: boolean } = {},
): Promise<MockApi> {
  const api: MockApi = {
    requests: {
      search: [],
      suggestions: [],
      products: 0,
      categories: 0,
    },
    failProducts: false,
    failProduct: false,
    extras: options.extras ?? false,
    audio: options.audio ?? false,
    overrides: {
      removed: new Set<number>(),
      priceUsd: {},
      stock: {},
    },
  };

  await page.route("https://dummyjson.com/**", async (route: Route) => {
    const url = new URL(route.request().url());

    const json = (body: unknown) =>
      route.fulfill({
        json: body,
        headers: { "access-control-allow-origin": "*" },
      });

    if (url.pathname === "/products/categories") {
      api.requests.categories += 1;
      return json(CATEGORIES);
    }

    if (url.pathname === "/products/search") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const limit = Number(url.searchParams.get("limit") ?? 0);

      (limit === 5 ? api.requests.suggestions : api.requests.search).push(q);

      const matches = visible(api).filter((product) =>
        `${product.title} ${product.category} ${product.brand}`
          .toLowerCase()
          .includes(q)
      );

      return json({
        products: limit > 0 ? matches.slice(0, limit) : matches,
        total: matches.length,
        skip: 0,
        limit,
      });
    }

    if (url.pathname === "/products") {
      api.requests.products += 1;

      if (api.failProducts) return route.abort("failed");

      const products = visible(api);

      return json({
        products,
        total: products.length,
        skip: 0,
        limit: 0,
      });
    }

    const detail = url.pathname.match(/^\/products\/(\d+)$/);

    if (detail) {
      if (api.failProduct) return route.abort("failed");

      const id = Number(detail[1]);

      const base = [
        ...PRODUCTS,
        ...DETAIL_ONLY,
        ...(api.extras ? EXTRAS : []),
        ...(api.audio ? AUDIO : []),
      ].find((product) => product.id === id);

      const found = base ? applyOverrides(api, base) : null;

      if (!found) {
        return route.fulfill({
          status: 404,
          json: { message: `Product with id '${id}' not found` },
          headers: { "access-control-allow-origin": "*" },
        });
      }

      return json(toDetail(found));
    }

    return route.fulfill({ status: 404, body: "not mocked" });
  });

  return api;
}
