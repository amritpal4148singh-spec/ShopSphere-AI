import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DEMO_ACCOUNTS } from "@/services/auth";
import { useAuthStore } from "@/store/auth-store";
import { RegisterForm } from "./register-form";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/register",
}));

beforeEach(() => {
  router.replace.mockClear();
  localStorage.clear();
  useAuthStore.getState().logout();
});

afterAll(() => {
  useAuthStore.getState().logout();
});

async function fillValid(user: ReturnType<typeof userEvent.setup>, email = "asha@example.com") {
  await user.type(screen.getByLabelText("Name"), "Asha Rao");
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), "Password123");
  await user.type(screen.getByLabelText("Confirm password"), "Password123");
}

describe("RegisterForm", () => {
  it("validates every field and focuses the first invalid one", async () => {
    const user = userEvent.setup();
    render(<RegisterForm nextPath="/" />);

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Enter your name.");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter your email address.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Create a password.");
    expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription("Confirm your password.");
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("flags mismatched passwords", async () => {
    const user = userEvent.setup();
    render(<RegisterForm nextPath="/" />);

    await user.type(screen.getByLabelText("Name"), "Asha Rao");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123");
    await user.type(screen.getByLabelText("Confirm password"), "Different123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription("Passwords do not match.");
  });

  it("reports an email that is already registered on the email field", async () => {
    const user = userEvent.setup();
    render(<RegisterForm nextPath="/" />);

    await fillValid(user, DEMO_ACCOUNTS.customer.email);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("creates the account, signs in, and redirects", async () => {
    const user = userEvent.setup();
    render(<RegisterForm nextPath="/" />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(useAuthStore.getState().session?.user.role).toBe("customer");
  });
});
