import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { Dialog } from "./dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Sample dialog">
        <button>First action</button>
        <button>Last action</button>
      </Dialog>
    </>
  );
}

describe("Dialog (PRD 14 accessible modals)", () => {
  it("is a named modal dialog and moves focus inside when opened", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open it" }));

    const dialog = screen.getByRole("dialog", { name: "Sample dialog" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("keeps Tab and Shift+Tab inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open it" }));

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Last action" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last action" })).toHaveFocus();
  });

  it("closes on Escape and returns focus to the opener, restoring page scroll", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open it" });
    await user.click(opener);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("closes from the Close button and from a backdrop click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open it" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open it" }));
    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
