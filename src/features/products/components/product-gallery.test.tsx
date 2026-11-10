import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProductGallery } from "./product-gallery";

const images = ["https://cdn.dummyjson.com/a.png", "https://cdn.dummyjson.com/b.png", "https://cdn.dummyjson.com/c.png"];

const mainImage = () => screen.getByRole("img", { name: "Trail Runner" });

describe("ProductGallery", () => {
  it("shows the first image and a thumbnail button per image", () => {
    render(<ProductGallery images={images} title="Trail Runner" />);

    expect(mainImage()).toHaveAttribute("src", images[0]);
    expect(screen.getAllByRole("button", { name: /Show image/ })).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Show image 1 of 3" })).toHaveAttribute("aria-current", "true");
  });

  it("switches the main image when a thumbnail is chosen", async () => {
    const user = userEvent.setup();
    render(<ProductGallery images={images} title="Trail Runner" />);

    await user.click(screen.getByRole("button", { name: "Show image 3 of 3" }));

    expect(mainImage()).toHaveAttribute("src", images[2]);
    expect(screen.getByRole("button", { name: "Show image 3 of 3" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Show image 1 of 3" })).not.toHaveAttribute("aria-current");
  });

  it("shows no thumbnail strip for a single image", () => {
    render(<ProductGallery images={[images[0]!]} title="Trail Runner" />);
    expect(screen.queryByRole("list", { name: "Product images" })).not.toBeInTheDocument();
  });

  it("shows a labelled placeholder when there are no images (edge case 20)", () => {
    render(<ProductGallery images={[]} title="Trail Runner" />);
    expect(screen.getByRole("img", { name: "Trail Runner (image unavailable)" })).toBeInTheDocument();
  });

  it("swaps a broken main image for the placeholder", () => {
    render(<ProductGallery images={images} title="Trail Runner" />);

    fireEvent.error(mainImage());

    expect(screen.getByRole("img", { name: "Trail Runner (image unavailable)" })).toBeInTheDocument();
  });

  it("tracks the pointer for hover zoom without re-rendering", () => {
    render(<ProductGallery images={images} title="Trail Runner" />);
    const main = screen.getByTestId("gallery-main");
    main.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.mouseMove(main, { clientX: 50, clientY: 100 });

    expect(main.style.getPropertyValue("--zoom-x")).toBe("25%");
    expect(main.style.getPropertyValue("--zoom-y")).toBe("50%");
  });
});
