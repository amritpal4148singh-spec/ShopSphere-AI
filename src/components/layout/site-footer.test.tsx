import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { existsSync } from "node:fs";
import path from "node:path";

import { NEWSLETTER_STORAGE_KEY } from "@/services/newsletter/newsletter-service";
import { POLICIES, getPolicy } from "@/lib/policies";
import { SiteFooter } from "./site-footer";

beforeEach(() => localStorage.clear());

describe("SiteFooter (PRD 5.1)", () => {
  it("has labelled sitemap, account and policy navigation groups", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    for (const name of ["Shop", "Account", "Policies"]) expect(screen.getByRole("navigation", { name })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Policies" })).getAllByRole("link").map((l) => l.textContent)).toEqual(POLICIES.map((p) => p.title));
  });

  it("only links to pages that exist in the app", () => {
    render(<SiteFooter />);
    const appDir = path.join(process.cwd(), "src", "app");
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href")!;
      expect(href.startsWith("/")).toBe(true);
      const segments = href.split("/").filter(Boolean);
      if (segments[0] === "policies") {
        expect(getPolicy(segments[1] ?? "")).toBeDefined();
        continue;
      }
      const candidates = [path.join(appDir, ...segments, "page.tsx"), path.join(appDir, "(protected)", ...segments, "page.tsx"), path.join(appDir, "(shop)", ...segments, "page.tsx")];
      const exists = segments.length === 0 ? existsSync(path.join(appDir, "page.tsx")) : candidates.some(existsSync);
      expect(exists, `${href} has no page`).toBe(true);
    }
  });
});

describe("policy content", () => {
  it("covers shipping, returns, privacy and terms with real content and no unsupported promises", () => {
    expect(POLICIES.map((p) => p.slug)).toEqual(["shipping", "returns", "privacy", "terms"]);
    for (const policy of POLICIES) {
      expect(policy.sections.length).toBeGreaterThan(1);
      const text = policy.sections.flatMap((s) => s.paragraphs).join(" ");
      expect(text).not.toMatch(/guarantee|money-back|legally binding/i);
    }
    expect(getPolicy("shipping")?.sections[1]?.paragraphs.join(" ")).toMatch(/Express delivery: 2 to 3 days, ₹149/);
  });
});

describe("NewsletterForm (simulated)", () => {
  it("shows a field error for an invalid address and does not submit", async () => {
    const user = userEvent.setup();
    render(<SiteFooter />);
    await user.type(screen.getByLabelText("Address for newsletter updates"), "nope");
    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(screen.getByRole("alert")).toHaveTextContent("valid email");
    expect(screen.getByLabelText("Address for newsletter updates")).toHaveAttribute("aria-invalid", "true");
    expect(localStorage.getItem(NEWSLETTER_STORAGE_KEY)).toBeNull();
  });

  it("shows loading then success, clears the field, and says it is a demo", async () => {
    const user = userEvent.setup();
    render(<SiteFooter />);
    expect(screen.getByText(/Demo only: no emails are sent/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Address for newsletter updates"), "uma@example.com");
    await user.click(screen.getByRole("button", { name: "Subscribe" }));

    expect(screen.getByRole("button", { name: "Subscribing…" })).toBeDisabled();
    expect(await screen.findByText("Thanks! You are subscribed (demo).")).toBeInTheDocument();
    expect(screen.getByLabelText("Address for newsletter updates")).toHaveValue("");
    expect(JSON.parse(localStorage.getItem(NEWSLETTER_STORAGE_KEY)!)).toEqual(["uma@example.com"]);
  });

  it("recognises a repeat signup", async () => {
    localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify(["uma@example.com"]));
    const user = userEvent.setup();
    render(<SiteFooter />);
    await user.type(screen.getByLabelText("Address for newsletter updates"), "UMA@example.com");
    await user.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(await screen.findByText("You are already subscribed with that address.")).toBeInTheDocument();
  });

  it("reports a storage failure", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const user = userEvent.setup();
    render(<SiteFooter />);
    await user.type(screen.getByLabelText("Address for newsletter updates"), "uma@example.com");
    await user.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(await screen.findByText(/would not save the signup/)).toBeInTheDocument();
    spy.mockRestore();
  });

  it("ignores a second submit while the first is in flight", async () => {
    const user = userEvent.setup();
    render(<SiteFooter />);
    await user.type(screen.getByLabelText("Address for newsletter updates"), "uma@example.com{Enter}{Enter}");
    await screen.findByText("Thanks! You are subscribed (demo).");
    expect(JSON.parse(localStorage.getItem(NEWSLETTER_STORAGE_KEY)!)).toHaveLength(1);
  });
});
