import { create } from "zustand";

import { loadConversation, saveConversation, MAX_STORED_MESSAGES } from "@/lib/assistant-storage";
import { EMPTY_CONTEXT, type AssistantResponse, type ChatMessage, type ConversationContext } from "@/types/assistant";

/**
 * Global client state of the shopping assistant (Zustand, PRD 9.1): whether the panel is open, the conversation, and
 * the context the next message is interpreted in. The conversation is kept in session storage. It starts "idle" on
 * the server and on the first client render so hydration matches; `hydrate()` restores it in an effect.
 */
interface AssistantState {
  status: "idle" | "ready";
  isOpen: boolean;
  messages: ChatMessage[];
  context: ConversationContext;
  /** True while the assistant is working out an answer. */
  thinking: boolean;
  /** Changes whenever the conversation is cleared, so an answer that arrives afterwards is discarded. */
  epoch: number;
  hydrate: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addUserMessage: (text: string) => void;
  addAssistantResponse: (response: AssistantResponse) => void;
  addError: (retryText: string, text: string) => void;
  removeMessage: (id: string) => void;
  setThinking: (thinking: boolean) => void;
  /** "New chat": clears the conversation and the context. */
  reset: () => void;
}

let counter = 0;
const nextId = () => `m${Date.now().toString(36)}-${(counter += 1)}`;

function persist(messages: ChatMessage[], context: ConversationContext): void {
  saveConversation({ messages, context });
}

export const useAssistantStore = create<AssistantState>()((set, get) => ({
  status: "idle",
  isOpen: false,
  messages: [],
  context: EMPTY_CONTEXT,
  thinking: false,
  epoch: 0,

  hydrate: () => {
    if (get().status === "ready") return;
    const stored = loadConversation();
    set({ status: "ready", messages: stored.messages, context: stored.context });
  },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  addUserMessage: (text) => {
    const messages = [...get().messages, { id: nextId(), role: "user" as const, text }].slice(-MAX_STORED_MESSAGES);
    set({ messages });
    persist(messages, get().context);
  },

  addAssistantResponse: (response) => {
    const message: ChatMessage = {
      id: nextId(),
      role: "assistant",
      kind: response.kind,
      text: response.text,
      filters: response.filters,
      items: response.items,
      totalMatches: response.totalMatches,
      suggestions: response.suggestions,
    };
    const messages = [...get().messages, message].slice(-MAX_STORED_MESSAGES);
    set({ messages, context: response.context });
    persist(messages, response.context);
  },

  addError: (retryText, text) => {
    const messages = [...get().messages, { id: nextId(), role: "assistant" as const, kind: "error" as const, text, retryText }].slice(-MAX_STORED_MESSAGES);
    set({ messages });
    persist(messages, get().context);
  },

  removeMessage: (id) => {
    const messages = get().messages.filter((message) => message.id !== id);
    set({ messages });
    persist(messages, get().context);
  },

  setThinking: (thinking) => set({ thinking }),

  reset: () => {
    set((state) => ({ messages: [], context: EMPTY_CONTEXT, thinking: false, epoch: state.epoch + 1 }));
    persist([], EMPTY_CONTEXT);
  },
}));
