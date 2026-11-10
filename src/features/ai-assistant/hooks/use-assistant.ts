import { useCallback, useEffect, useRef } from "react";

import { useCatalog } from "@/features/products";
import { useRawSignals } from "@/features/recommendations";
import { assistantService } from "@/services/assistant";
import { useAssistantStore } from "@/store/assistant-store";
import { ERROR_TEXT, MIN_THINKING_MS } from "../constants";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * hook -> service -> provider (PRD 6.4, 7.3). Sends what the shopper typed, with the cached catalogue and the
 * shopper's local activity, to the assistant service, and puts the answer in the conversation. If the catalogue
 * cannot be loaded or the service fails, an inline error bubble with a retry is added and the history stays (PRD 16.1).
 */
export function useAssistant() {
  const catalog = useCatalog();
  const raw = useRawSignals();
  const messages = useAssistantStore((state) => state.messages);
  const thinking = useAssistantStore((state) => state.thinking);

  const rawRef = useRef(raw);
  useEffect(() => {
    rawRef.current = raw;
  }, [raw]);

  const catalogData = catalog.data;
  const refetchCatalog = catalog.refetch;

  const runTurn = useCallback(
    async (text: string) => {
      const store = useAssistantStore.getState();
      const epoch = store.epoch;
      const stale = () => useAssistantStore.getState().epoch !== epoch;
      store.setThinking(true);
      const started = Date.now();
      try {
        const products = catalogData ?? (await refetchCatalog()).data;
        if (!products) throw new Error("The catalogue is not available.");
        const response = await assistantService.respond({ text, context: useAssistantStore.getState().context, catalog: products, raw: rawRef.current });
        const remaining = MIN_THINKING_MS - (Date.now() - started);
        if (remaining > 0) await sleep(remaining);
        if (!stale()) useAssistantStore.getState().addAssistantResponse(response);
      } catch {
        if (!stale()) useAssistantStore.getState().addError(text, ERROR_TEXT);
      } finally {
        if (!stale()) useAssistantStore.getState().setThinking(false);
      }
    },
    [catalogData, refetchCatalog],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || useAssistantStore.getState().thinking) return;
      useAssistantStore.getState().addUserMessage(trimmed);
      void runTurn(trimmed);
    },
    [runTurn],
  );

  /** Retries a failed message without repeating it in the conversation. */
  const retry = useCallback(
    (errorId: string, text: string) => {
      if (useAssistantStore.getState().thinking) return;
      useAssistantStore.getState().removeMessage(errorId);
      void runTurn(text);
    },
    [runTurn],
  );

  const reset = useCallback(() => useAssistantStore.getState().reset(), []);

  return { messages, thinking, send, retry, reset };
}
