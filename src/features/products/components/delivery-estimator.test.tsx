import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeProductDetail } from "@/test/fixtures";
import { DeliveryEstimator } from "./delivery-estimator";

const product = makeProductDetail();

describe("DeliveryEstimator", () => {
  it("rejects an invalid PIN code with an inline message tied to the field", async () => {
    const user = userEvent.setup();
    render(<DeliveryEstimator product={product} available />);

    await user.type(screen.getByLabelText("PIN code"), "123");
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByLabelText("PIN code")).toHaveAccessibleDescription("Enter a valid 6-digit PIN code.");
    expect(screen.queryByText(/Estimated delivery/)).not.toBeInTheDocument();
  });

  it("shows a labelled simulated estimate for a valid PIN code", async () => {
    const user = userEvent.setup();
    render(<DeliveryEstimator product={product} available />);

    await user.type(screen.getByLabelText("PIN code"), "110001");
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByRole("status")).toHaveTextContent(/Estimated delivery:/);
    expect(screen.getByText("Simulated estimate for this demo.")).toBeInTheDocument();
  });

  it("accepts only digits and at most six characters", async () => {
    const user = userEvent.setup();
    render(<DeliveryEstimator product={product} available />);

    await user.type(screen.getByLabelText("PIN code"), "11a0b0012345");

    expect(screen.getByLabelText("PIN code")).toHaveValue("110001");
  });

  it("clears an old error after a valid check", async () => {
    const user = userEvent.setup();
    render(<DeliveryEstimator product={product} available />);

    await user.type(screen.getByLabelText("PIN code"), "12");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(screen.getByLabelText("PIN code")).toHaveAttribute("aria-invalid", "true");

    await user.clear(screen.getByLabelText("PIN code"));
    await user.type(screen.getByLabelText("PIN code"), "560001");
    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(screen.getByLabelText("PIN code")).not.toHaveAttribute("aria-invalid");
  });

  it("lists the shipping, return and warranty information from the data source", () => {
    render(<DeliveryEstimator product={product} available />);

    expect(screen.getByText("Ships in 1-2 business days")).toBeInTheDocument();
    expect(screen.getByText("30 days return policy")).toBeInTheDocument();
    expect(screen.getByText("1 year warranty")).toBeInTheDocument();
  });

  it("offers no estimate when the item is out of stock", () => {
    render(<DeliveryEstimator product={product} available={false} />);

    expect(screen.queryByLabelText("PIN code")).not.toBeInTheDocument();
    expect(screen.getByText(/available once this item is back in stock/)).toBeInTheDocument();
  });
});
