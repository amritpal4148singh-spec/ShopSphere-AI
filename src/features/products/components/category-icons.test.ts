import { Package, Smartphone } from "lucide-react";

import { categoryIcon } from "./category-icons";

describe("categoryIcon", () => {
  it("gives a known category its icon", () => {
    expect(categoryIcon("smartphones")).toBe(Smartphone);
  });

  it("falls back to a neutral icon for a category it has never seen, so a new category still renders", () => {
    expect(categoryIcon("something-new-from-the-api")).toBe(Package);
  });
});
