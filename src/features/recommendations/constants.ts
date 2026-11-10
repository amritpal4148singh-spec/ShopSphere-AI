/** The PDP rails and the strategy each will use (PRD section 6; logic arrives in PHASE-07). */
export const RAIL_STRATEGIES = {
  related: {
    title: "Related products",
    description: "Products from the same category that share tags with this one.",
  },
  similar: {
    title: "Similar products",
    description: "Products with a similar price band and attributes.",
  },
  "frequently-bought-together": {
    title: "Frequently bought together",
    description: "Products that other shoppers often buy alongside this one.",
  },
} as const;

export type RailStrategy = keyof typeof RAIL_STRATEGIES;
