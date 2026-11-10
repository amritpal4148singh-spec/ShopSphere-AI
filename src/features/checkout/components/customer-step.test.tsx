import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import type { CustomerInfo } from "@/types/checkout";
import { CustomerStep } from "./customer-step";

function Harness({ initial, onNext }: { initial: CustomerInfo; onNext: () => void }) {
  const [customer, setCustomer] = useState(initial);
  return <CustomerStep customer={customer} onChange={setCustomer} onNext={onNext} />;
}

const valid = { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" };

describe("CustomerStep", () => {
  it("shows the details entered so far", () => {
    render(<Harness initial={valid} onNext={vi.fn()} />);
    expect(screen.getByLabelText("Full name")).toHaveValue("Asha Rao");
    expect(screen.getByLabelText("Mobile number")).toHaveValue("9876543210");
  });

  it("continues when everything is valid", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness initial={valid} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "Continue to address" }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("blocks with an inline error per field and focuses the first invalid one", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness initial={{ name: "", email: "bad", phone: "" }} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "Continue to address" }));

    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Full name")).toHaveAccessibleDescription("Enter your name.");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter a valid email address, like name@example.com.");
    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription("Enter your mobile number.");
    expect(screen.getByLabelText("Full name")).toHaveFocus();
  });

  it("rejects a mobile number that is not ten digits", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness initial={{ ...valid, phone: "12345" }} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "Continue to address" }));

    expect(screen.getByLabelText("Mobile number")).toHaveAccessibleDescription("Enter a valid 10-digit mobile number.");
    expect(screen.getByLabelText("Mobile number")).toHaveFocus();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("reports every change so it can be saved as the shopper types", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomerStep customer={{ name: "", email: "", phone: "" }} onChange={onChange} onNext={vi.fn()} />);

    await user.type(screen.getByLabelText("Mobile number"), "9");

    expect(onChange).toHaveBeenLastCalledWith({ name: "", email: "", phone: "9" });
  });
});
