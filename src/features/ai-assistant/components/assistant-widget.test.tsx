import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError, fetchCatalog } from "@/services/products";
import { useAssistantStore } from "@/store/assistant-store";
import { useAuthStore } from "@/store/auth-store";
import { buildAssistantCatalog } from "@/test/assistant-catalog";
import { resetRecommendationWorld } from "@/test/recommendations";
import { renderWithClient } from "@/test/render";
import { EMPTY_CONTEXT } from "@/types/assistant";
import { AssistantWidget } from "./assistant-widget";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const catalog = buildAssistantCatalog();

beforeEach(() => {
  resetRecommendationWorld(catalog);
  useAssistantStore.setState({ status: "idle", isOpen: false, messages: [], context: EMPTY_CONTEXT, thinking: false, epoch: 0 });
  useAuthStore.setState({ status: "unauthenticated", session: null });
});

async function openAssistant() {
  const user = userEvent.setup();
  const view = renderWithClient(<AssistantWidget />);
  await user.click(screen.getByRole("button", { name: "Open shopping assistant" }));
  const dialog = await screen.findByRole(
    "dialog",
    { name: "Shopping Assistant" },
    { timeout: 5000 },
  );
  return { user, dialog, view };
}

async function say(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole("textbox", { name: "Message the shopping assistant" }), `${text}{Enter}`);
}

const cardTitles = (scope: HTMLElement) => within(scope).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

describe("AssistantWidget: entry point and panel", () => {
  it("shows a launcher on every page, and the panel only after it is opened", async () => {
    renderWithClient(<AssistantWidget />);
    const launcher = screen.getByRole("button", { name: "Open shopping assistant" });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchCatalog).not.toHaveBeenCalled();

    await userEvent.setup().click(launcher);
    expect(
      await screen.findByRole(
        "dialog",
        { name: "Shopping Assistant" },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close shopping assistant" })).toHaveAttribute("aria-expanded", "true");
  });

  it("states plainly that it is rule-based, in the panel and in the About text (PRD 7.1)", async () => {
    const { user, dialog } = await openAssistant();
    expect(within(dialog).getByText("Rule-based")).toBeInTheDocument();
    expect(within(dialog).getByText(/it is not a language model/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "About this assistant" }));
    expect(within(dialog).getByText(/rule-based, mock shopping assistant, not a language model/)).toBeVisible();
  });

  it("moves focus to the message box on open, and back to the launcher on Escape", async () => {
    const { user } = await openAssistant();

    const textbox = await screen.findByRole(
      "textbox",
      { name: "Message the shopping assistant" },
      { timeout: 5000 },
    );

    await waitFor(() => expect(textbox).toHaveFocus());

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open shopping assistant" })).toHaveFocus();
    });
  });

  it("closes with the close button and keeps the conversation for next time", async () => {
    const { user, dialog } = await openAssistant();
    await say(user, "Show me headphones under 5000");
    await within(dialog).findByText(/Here are all 4 matches/);

    await user.click(within(dialog).getByRole("button", { name: "Close assistant" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open shopping assistant" }));
    expect(await screen.findByText(/Here are all 4 matches/)).toBeInTheDocument();
  });

  it("is not offered to an administrator (PRD 4.3)", () => {
    act(() => {
      useAuthStore.setState({ status: "authenticated", session: { token: "t", issuedAt: 0, expiresAt: Date.now() + 1e6, user: { id: "a", name: "Admin", email: "a@x.test", role: "admin" } } });
    });
    renderWithClient(<AssistantWidget />);
    expect(screen.queryByRole("button", { name: /shopping assistant/ })).toBeNull();
  });

  it("restores the session's conversation after a reload", async () => {
    const first = await openAssistant();
    await say(first.user, "Show me headphones under 5000");
    await within(first.dialog).findByText(/Here are all 4 matches/);

    // A reload: every component and the in-memory store are gone, session storage stays.
    first.view.unmount();
    useAssistantStore.setState({ status: "idle", isOpen: false, messages: [], context: EMPTY_CONTEXT, thinking: false });

    const user = userEvent.setup();
    renderWithClient(<AssistantWidget />);
    await user.click(screen.getByRole("button", { name: "Open shopping assistant" }));
    expect(await screen.findByText(/Here are all 4 matches for headphones/)).toBeInTheDocument();
    expect(screen.getByText("Show me headphones under 5000")).toBeInTheDocument();
    expect(useAssistantStore.getState().context.intent).toEqual({ category: "headphones", maxPrice: 5000 });
  });
});

describe("AssistantWidget: starting and conversing", () => {
  it("offers starter prompts to a first-time user, and answers one when clicked", async () => {
    const { user, dialog } = await openAssistant();
    const starters = within(within(dialog).getByRole("list", { name: "Starter prompts" })).getAllByRole("button");
    expect(starters).toHaveLength(3);

    await user.click(within(dialog).getByRole("button", { name: "Smartphones with good ratings" }));
    expect(await within(dialog).findByText(/matches? for smartphones/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("list", { name: "Starter prompts" })).toBeNull();
  });

  it("MOD-AI-001: shows what it understood and the matching product cards inline", async () => {
    const { user, dialog } = await openAssistant();
    await say(user, "Show me headphones under 5000");

    const log = within(dialog).getByRole("log", { name: "Conversation" });
    expect(await within(log).findByText(/Here are all 4 matches for headphones priced up to ₹5,000/)).toBeInTheDocument();

    const filters = within(log).getByRole("list", { name: "Filters applied" });
    expect(within(filters).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Category: Headphones", "Price: up to ₹5,000"]);

    const products = within(log).getByRole("list", { name: "Products found" });
    expect(cardTitles(products).sort()).toEqual(["Budget Headphones", "Pro Headphones", "Sky Blue Headset", "Studio Headphones"]);
    expect(within(products).getByText("Result 1")).toBeInTheDocument();
    expect(within(products).getAllByText(/within your ₹5,000 budget|Highly rated/).length).toBeGreaterThan(0);
  });

  it("gives the shopper's messages and the assistant's replies distinct, labelled treatment", async () => {
    const { user, dialog } = await openAssistant();
    await say(user, "Show me headphones under 5000");
    await within(dialog).findByText(/Here are all 4 matches/);
    const log = within(dialog).getByRole("log", { name: "Conversation" });
    expect(within(log).getByText("You said:")).toBeInTheDocument();
    expect(within(log).getByText("Assistant:")).toBeInTheDocument();
  });

  it("MOD-AI-002: a follow-up refines the same search without repeating category or price", async () => {
    const { user, dialog } = await openAssistant();
    await say(user, "Show me headphones under 5000");
    await within(dialog).findByText(/Here are all 4 matches/);

    await user.click(within(dialog).getByRole("button", { name: "Something with better ratings" }));
    const refined = await within(dialog).findByText(/raised the minimum rating to 4 stars/);
    expect(refined).toBeInTheDocument();

    const lists = within(dialog).getAllByRole("list", { name: "Filters applied" });
    const latest = lists[lists.length - 1] as HTMLElement;
    expect(within(latest).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Category: Headphones", "Price: up to ₹5,000", "Rating: 4+ stars"]);
    const products = within(dialog).getAllByRole("list", { name: "Products found" }).at(-1) as HTMLElement;
    expect(cardTitles(products)).toEqual(["Pro Headphones", "Studio Headphones", "Sky Blue Headset"]);
  });

  it("offers follow-up prompts only after the latest answer", async () => {
    const { user, dialog } = await openAssistant();
    await say(user, "Show me headphones under 5000");
    await within(dialog).findByText(/Here are all 4 matches/);
    await user.click(within(dialog).getByRole("button", { name: "Show me something cheaper" }));
    await within(dialog).findByText(/lowered the price limit/);
    expect(within(dialog).getAllByRole("list", { name: "Suggested prompts" })).toHaveLength(1);
  });

  it("MOD-AI-003: unclear input gets a clarifying message and 2-3 prompts, and no products", async () => {
    const { user, dialog } = await openAssistant();
    await say(user, "hmm not sure");

    expect(await within(dialog).findByText(/not sure what you're looking for/)).toBeInTheDocument();
    const prompts = within(within(dialog).getByRole("list", { name: "Suggested prompts" })).getAllByRole("button");
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.length).toBeLessThanOrEqual(3);
    expect(within(dialog).queryByRole("list", { name: "Products found" })).toBeNull();
  });

  it("answers a similarity request about a numbered result", async () => {
    const { user, dialog } = await openAssistant();
    await say(user, "Show me headphones under 5000");
    await within(dialog).findByText(/Here are all 4 matches/);
    await user.click(within(dialog).getByRole("button", { name: "Show me more like the second one" }));
    expect(await within(dialog).findByText(/products? like .* \(result 2\)/)).toBeInTheDocument();
  });

  it("does not send an empty message, and limits the length of a long one", async () => {
    const { user, dialog } = await openAssistant();
    const send = within(dialog).getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();
    const box = within(dialog).getByRole("textbox", { name: "Message the shopping assistant" });
    expect(box).toHaveAttribute("maxlength", "300");
    await user.type(box, "   ");
    expect(send).toBeDisabled();
  });

  it("New chat clears the conversation and brings back the starter prompts", async () => {
    const { user, dialog } = await openAssistant();
    await say(user, "Show me headphones under 5000");
    await within(dialog).findByText(/Here are all 4 matches/);

    await user.click(within(dialog).getByRole("button", { name: "Start a new chat" }));
    expect(within(dialog).queryByText(/Here are all 4 matches/)).toBeNull();
    expect(within(dialog).getByRole("list", { name: "Starter prompts" })).toBeInTheDocument();
    expect(useAssistantStore.getState().context).toEqual(EMPTY_CONTEXT);
  });
});

describe("AssistantWidget: loading and failure (PRD 16.1)", () => {
  it("shows a typing indicator while the answer is being prepared", async () => {
    vi.mocked(fetchCatalog).mockReturnValue(new Promise(() => undefined));
    const { user, dialog } = await openAssistant();
    await say(user, "Show me headphones under 5000");
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Assistant is typing");
    expect(within(dialog).getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("shows an inline error bubble with Retry, keeps the history, and recovers without repeating the message", async () => {
    // An earlier conversation exists, then the catalogue cannot be loaded.
    useAssistantStore.getState().addUserMessage("Show me headphones under 5000");
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("network", "offline"));
    const { user, dialog } = await openAssistant();
    expect(within(dialog).getByText("Show me headphones under 5000")).toBeInTheDocument();

    await say(user, "something cheaper");
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load the products just now/);
    expect(alert).toHaveTextContent(/conversation is still here/);
    expect(within(dialog).getByText("Show me headphones under 5000")).toBeInTheDocument();
    expect(within(dialog).getByText("something cheaper")).toBeInTheDocument();
    expect(within(dialog).queryByRole("status")).toBeNull();

    vi.mocked(fetchCatalog).mockResolvedValue(catalog);
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(within(dialog).queryByRole("alert")).toBeNull());
    expect(within(dialog).getAllByText("something cheaper")).toHaveLength(1);
    expect(await within(dialog).findByText(/make a search first|haven't shown you any products yet|Which kind of product/)).toBeInTheDocument();
  });

  it("keeps the error bubble when the retry fails too", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("network", "offline"));
    const { user, dialog } = await openAssistant();
    await say(user, "headphones");
    await user.click(await within(dialog).findByRole("button", { name: "Retry" }));
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(within(dialog).getAllByText("headphones")).toHaveLength(1);
  });

  it("an answer that arrives after New chat is discarded", async () => {
    let release: (value: typeof catalog) => void = () => undefined;
    vi.mocked(fetchCatalog).mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { user, dialog } = await openAssistant();
    await say(user, "headphones under 5000");
    await user.click(within(dialog).getByRole("button", { name: "Start a new chat" }));

    await act(async () => {
      release(catalog);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(within(dialog).queryByText(/matches? for headphones/)).toBeNull();
    expect(useAssistantStore.getState().messages).toEqual([]);
  });
});
