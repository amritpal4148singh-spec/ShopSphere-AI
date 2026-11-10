import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import type { CheckoutDraft, SavedAddress } from "@/types/checkout";
import { AddressStep } from "./address-step";

type AddressDraft = CheckoutDraft["address"];

const blank: AddressDraft = { line1: "", line2: "", city: "", state: "", pincode: "", savedAddressId: null, saveAddress: false };
const filled: AddressDraft = { line1: "12 Demo Street", line2: "", city: "New Delhi", state: "Delhi", pincode: "110001", savedAddressId: null, saveAddress: false };
const home: SavedAddress = { id: "a1", label: "Home", line1: "99 Home Road", line2: "Flat 4", city: "Pune", state: "Maharashtra", pincode: "411001" };

function Harness({ initial, saved = [], onNext = vi.fn(), onBack = vi.fn() }: { initial: AddressDraft; saved?: SavedAddress[]; onNext?: () => void; onBack?: () => void }) {
  const [address, setAddress] = useState(initial);
  return <AddressStep address={address} savedAddresses={saved} onChange={setAddress} onBack={onBack} onNext={onNext} />;
}

describe("AddressStep", () => {
  it("continues with a valid address", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness initial={filled} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "Continue to delivery" }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("treats the second address line as optional", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness initial={{ ...filled, line2: "" }} onNext={onNext} />);
    await user.click(screen.getByRole("button", { name: "Continue to delivery" }));
    expect(onNext).toHaveBeenCalled();
  });

  it("blocks an incomplete address with inline errors and focuses the first one", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness initial={blank} onNext={onNext} />);

    await user.click(screen.getByRole("button", { name: "Continue to delivery" }));

    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Street address")).toHaveAccessibleDescription("Enter your street address.");
    expect(screen.getByLabelText("City")).toHaveAccessibleDescription("Enter your city.");
    expect(screen.getByLabelText("State")).toHaveAccessibleDescription("Enter your state.");
    expect(screen.getByLabelText("PIN code")).toHaveAccessibleDescription("Enter your PIN code.");
    expect(screen.getByLabelText("Street address")).toHaveFocus();
  });

  it("rejects an invalid PIN code and accepts only digits", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness initial={{ ...filled, pincode: "" }} onNext={onNext} />);

    await user.type(screen.getByLabelText("PIN code"), "11a0b0");
    expect(screen.getByLabelText("PIN code")).toHaveValue("1100");

    await user.click(screen.getByRole("button", { name: "Continue to delivery" }));
    expect(screen.getByLabelText("PIN code")).toHaveAccessibleDescription("Enter a valid 6-digit PIN code.");
    expect(onNext).not.toHaveBeenCalled();
  });

  it("goes back", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<Harness initial={filled} onBack={onBack} />);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("offers no saved-address choice when there are none", () => {
    render(<Harness initial={blank} />);
    expect(screen.queryByRole("group", { name: "Saved addresses" })).not.toBeInTheDocument();
  });

  it("offers saved addresses (PRD 5.6) and fills the form when one is chosen", async () => {
    const user = userEvent.setup();
    render(<Harness initial={blank} saved={[home]} />);

    await user.click(screen.getByRole("radio", { name: /Home/ }));

    expect(screen.getByLabelText("Street address")).toHaveValue("99 Home Road");
    expect(screen.getByLabelText("City")).toHaveValue("Pune");
    expect(screen.getByLabelText("PIN code")).toHaveValue("411001");
    expect(screen.queryByRole("checkbox", { name: /Save this address/ })).not.toBeInTheDocument();
  });

  it("turns an edited saved address into a new one instead of changing the saved address", async () => {
    const user = userEvent.setup();
    render(<Harness initial={blank} saved={[home]} />);
    await user.click(screen.getByRole("radio", { name: /Home/ }));

    await user.type(screen.getByLabelText("City"), "e");

    expect(screen.getByRole("radio", { name: /Use a new address/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Save this address/ })).toBeInTheDocument();
  });

  it("clears the form when 'Use a new address' is chosen", async () => {
    const user = userEvent.setup();
    render(<Harness initial={blank} saved={[home]} />);
    await user.click(screen.getByRole("radio", { name: /Home/ }));

    await user.click(screen.getByRole("radio", { name: /Use a new address/ }));

    expect(screen.getByLabelText("Street address")).toHaveValue("");
  });

  it("lets the shopper choose to save a new address", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AddressStep address={filled} savedAddresses={[]} onChange={onChange} onBack={vi.fn()} onNext={vi.fn()} />);

    await user.click(screen.getByRole("checkbox", { name: "Save this address for next time" }));

    expect(onChange).toHaveBeenCalledWith({ ...filled, saveAddress: true });
  });
});
