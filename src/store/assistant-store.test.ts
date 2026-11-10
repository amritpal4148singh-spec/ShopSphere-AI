import { ASSISTANT_STORAGE_KEY } from "@/lib/assistant-storage";
import { makeProduct } from "@/test/fixtures";
import { EMPTY_CONTEXT, type AssistantResponse } from "@/types/assistant";
import { useAssistantStore } from "./assistant-store";

const response: AssistantResponse = {
  kind: "results",
  text: "Here are 1 headphones.",
  filters: [],
  items: [{ product: makeProduct({ id: 7 }), reasons: ["Highly rated"] }],
  totalMatches: 1,
  suggestions: ["Show me something cheaper"],
  context: { intent: { category: "headphones" }, shownIds: [7] },
  intent: { category: "headphones" },
};

beforeEach(() => {
  sessionStorage.clear();
  useAssistantStore.setState({ status: "idle", isOpen: false, messages: [], context: EMPTY_CONTEXT, thinking: false, epoch: 0 });
});

describe("assistant store", () => {
  it("opens, closes and toggles the panel", () => {
    const store = useAssistantStore.getState();
    store.open();
    expect(useAssistantStore.getState().isOpen).toBe(true);
    store.close();
    expect(useAssistantStore.getState().isOpen).toBe(false);
    store.toggle();
    expect(useAssistantStore.getState().isOpen).toBe(true);
  });

  it("records the conversation and the context of the latest answer", () => {
    const store = useAssistantStore.getState();
    store.addUserMessage("headphones");
    store.addAssistantResponse(response);
    const state = useAssistantStore.getState();
    expect(state.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(state.context).toEqual(response.context);
  });

  it("keeps the history and the context when an error bubble is added, and removes only that bubble", () => {
    const store = useAssistantStore.getState();
    store.addUserMessage("headphones");
    store.addAssistantResponse(response);
    store.addUserMessage("cheaper");
    store.addError("cheaper", "Sorry");
    const error = useAssistantStore.getState().messages.at(-1)!;
    expect(error).toMatchObject({ kind: "error", retryText: "cheaper" });
    expect(useAssistantStore.getState().context).toEqual(response.context);

    store.removeMessage(error.id);
    expect(useAssistantStore.getState().messages).toHaveLength(3);
  });

  it("persists to session storage and restores on hydrate", () => {
    const store = useAssistantStore.getState();
    store.addUserMessage("headphones");
    store.addAssistantResponse(response);
    expect(sessionStorage.getItem(ASSISTANT_STORAGE_KEY)).not.toBeNull();

    useAssistantStore.setState({ status: "idle", messages: [], context: EMPTY_CONTEXT });
    useAssistantStore.getState().hydrate();
    const state = useAssistantStore.getState();
    expect(state.status).toBe("ready");
    expect(state.messages).toHaveLength(2);
    expect(state.context).toEqual(response.context);
  });

  it("reset clears the conversation, the context and the stored copy, and invalidates in-flight answers", () => {
    const store = useAssistantStore.getState();
    store.addUserMessage("headphones");
    store.addAssistantResponse(response);
    store.setThinking(true);
    store.reset();
    const state = useAssistantStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.context).toEqual(EMPTY_CONTEXT);
    expect(state.thinking).toBe(false);
    expect(state.epoch).toBe(1);
    expect(sessionStorage.getItem(ASSISTANT_STORAGE_KEY)).toBeNull();
  });

  it("does not hydrate twice", () => {
    useAssistantStore.getState().hydrate();
    useAssistantStore.getState().addUserMessage("hi");
    useAssistantStore.getState().hydrate();
    expect(useAssistantStore.getState().messages).toHaveLength(1);
  });
});
