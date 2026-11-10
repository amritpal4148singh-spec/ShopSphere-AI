import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tabs } from "./tabs";

const tabs = [
  { id: "one", label: "One", content: <p>First panel</p> },
  { id: "two", label: "Two", content: <p>Second panel</p> },
  { id: "three", label: "Three", content: <p>Third panel</p> },
];

describe("Tabs", () => {
  it("shows the first tab by default with correct roles and relationships", () => {
    render(<Tabs label="Info" tabs={tabs} />);

    expect(screen.getByRole("tablist", { name: "Info" })).toBeInTheDocument();
    const first = screen.getByRole("tab", { name: "One" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("One");
    expect(screen.getByText("First panel")).toBeInTheDocument();
    expect(screen.queryByText("Second panel")).not.toBeInTheDocument();
  });

  it("switches panels on click", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Info" tabs={tabs} />);

    await user.click(screen.getByRole("tab", { name: "Two" }));

    expect(screen.getByText("Second panel")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
  });

  it("uses a roving tabindex so only the active tab is in the tab order", () => {
    render(<Tabs label="Info" tabs={tabs} />);

    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves between tabs with the arrow, Home and End keys, wrapping around", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Info" tabs={tabs} />);

    await user.click(screen.getByRole("tab", { name: "One" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByText("Second panel")).toBeInTheDocument();

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
  });
});
