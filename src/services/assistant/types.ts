import type { RawSignals } from "@/services/recommendations";
import type { AssistantResponse, ConversationContext } from "@/types/assistant";
import type { Product } from "@/types/product";

export interface AssistantRequest {
  /** What the shopper typed. */
  text: string;
  /** What the conversation has settled so far. */
  context: ConversationContext;
  /** The catalogue the assistant searches (DummyJSON plus local data). */
  catalog: readonly Product[];
  /** The shopper's activity on this device, which personalises the ranking. */
  raw: RawSignals;
  /** How many product cards at most. */
  limit?: number;
}

/**
 * The contract boundary of the assistant (PRD 6.4, 7.6), the counterpart of the recommendation provider. Today the
 * rule-based mock implements it. A language-model provider would implement the same contract, so the service, the hook
 * and the UI would not change. It is asynchronous so a remote provider fits.
 */
export interface AssistantProvider {
  readonly id: string;
  respond(request: AssistantRequest): Promise<AssistantResponse>;
}
