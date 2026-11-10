import type { Product } from "@/types/product";

/**
 * The structured filter the assistant extracts from a message (PRD 7.3), for example
 * { category: "smartphones", maxPrice: 30000, minRating: 4 }. `category` is a topic id: a product type such as
 * "headphones", or a catalogue category slug such as "mens-shoes".
 */
export interface AssistantIntent {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  /** Lower case, for example "blue". */
  colour?: string;
  /** A use-case word from "only for gaming". Matched against product text; the assistant says when it cannot filter by it. */
  useCase?: string;
  sort?: "relevance" | "rating";
}

/** What the assistant remembers between turns (PRD 7.4): the filters in force and which products were just shown. */
export interface ConversationContext {
  intent: AssistantIntent;
  /** Ids of the products shown by the latest answer, in the order shown ("the second one", "something cheaper"). */
  shownIds: number[];
}

export const EMPTY_CONTEXT: ConversationContext = { intent: {}, shownIds: [] };

export interface AssistantItem {
  product: Product;
  /** Plain-language reasons the product was chosen, strongest first. */
  reasons: string[];
}

export type AssistantReplyKind = "results" | "similar" | "no-results" | "clarify" | "help";

export interface AppliedFilter {
  id: "category" | "price" | "rating" | "colour" | "use-case" | "similar";
  label: string;
}

/** One answer of the assistant. */
export interface AssistantResponse {
  kind: AssistantReplyKind;
  /** The answer in plain language, including which filters were applied. */
  text: string;
  filters: AppliedFilter[];
  items: AssistantItem[];
  /** How many products matched before the display limit. */
  totalMatches: number;
  /** 2 to 3 follow-up prompts the shopper can click. */
  suggestions: string[];
  /** The context to use for the next turn. */
  context: ConversationContext;
  intent: AssistantIntent;
}

interface MessageBase {
  id: string;
}

export interface UserChatMessage extends MessageBase {
  role: "user";
  text: string;
}

export interface AssistantChatMessage extends MessageBase {
  role: "assistant";
  kind: AssistantReplyKind;
  text: string;
  filters: AppliedFilter[];
  items: AssistantItem[];
  totalMatches: number;
  suggestions: string[];
}

/** An inline error bubble (PRD 16.1): the history stays, and the failed message can be retried. */
export interface ErrorChatMessage extends MessageBase {
  role: "assistant";
  kind: "error";
  text: string;
  retryText: string;
}

export type ChatMessage = UserChatMessage | AssistantChatMessage | ErrorChatMessage;
