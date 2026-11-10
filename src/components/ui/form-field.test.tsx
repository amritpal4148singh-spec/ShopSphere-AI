import { render, screen } from "@testing-library/react";

import { FormField } from "./form-field";

describe("FormField", () => {
  it("associates the label with the input", () => {
    render(<FormField label="Email" name="email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("describes the input with its hint", () => {
    render(<FormField label="Password" hint="At least 8 characters." />);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("At least 8 characters.");
  });

  it("marks the input invalid and describes it with the error text", () => {
    render(<FormField label="Email" error="Enter your email address." hint="Not shown while invalid." />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter your email address.");
  });
});
