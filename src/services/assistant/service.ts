import { MAX_MESSAGE_LENGTH } from "./constants";
import { createMockAssistantProvider } from "./mock-assistant";
import type { AssistantProvider, AssistantRequest } from "./types";
import type { AssistantResponse } from "@/types/assistant";

export interface AssistantService {
  /** The id of the provider answering (for diagnostics and tests). */
  readonly providerId: string;
  respond(request: AssistantRequest): Promise<AssistantResponse>;
}

/** Collapses whitespace and cuts overlong input, so no message can break the layout or the parser. */
export function sanitizeMessage(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * The assistant service (PRD 9.2, services/assistant): the one thing the UI calls. The provider is injected, which is
 * what makes it replaceable by a language-model provider without touching the hook or the components (PRD 7.6).
 */
export function createAssistantService(provider: AssistantProvider): AssistantService {
  return {
    providerId: provider.id,
    respond: (request) => provider.respond({ ...request, text: sanitizeMessage(request.text) }),
  };
}

export const assistantService: AssistantService = createAssistantService(createMockAssistantProvider());
