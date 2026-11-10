import { Button } from "@/components/ui/button";
import { ProductCard } from "@/features/products";
import type { AssistantChatMessage, ChatMessage } from "@/types/assistant";

interface MessageBubbleProps {
  message: ChatMessage;
  /** Whether this is the latest answer, which is the only one that offers follow-up prompts. */
  latest: boolean;
  busy: boolean;
  onSend: (text: string) => void;
  onRetry: (id: string, text: string) => void;
}

function Products({ message }: { message: AssistantChatMessage }) {
  return (
    <ul aria-label="Products found" className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {message.items.map((item, index) => (
        <li key={item.product.id} className="w-40 shrink-0 snap-start">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">{`Result ${index + 1}`}</p>
          <ProductCard product={item.product} {...(item.reasons.length ? { reason: item.reasons.join(" · ") } : {})} />
        </li>
      ))}
    </ul>
  );
}

/** One message of the conversation. User and assistant messages differ by side, colour and a hidden speaker label (PRD 7.2, 14). */
export function MessageBubble({ message, latest, busy, onSend, onRetry }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] break-words rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
          <span className="sr-only">You said: </span>
          {message.text}
        </p>
      </div>
    );
  }

  if (message.kind === "error") {
    return (
      <div className="flex justify-start">
        <div role="alert" className="max-w-[90%] rounded-2xl rounded-bl-sm border border-destructive bg-background px-3 py-2 text-sm">
          <p>
            <span className="sr-only">Assistant: </span>
            {message.text}
          </p>
          <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={() => onRetry(message.id, message.retryText)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-full rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
        <p className="break-words">
          <span className="sr-only">Assistant: </span>
          {message.text}
        </p>

        {message.filters.length > 0 ? (
          <ul aria-label="Filters applied" className="mt-2 flex flex-wrap gap-1.5">
            {message.filters.map((filter) => (
              <li key={filter.id} className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium">
                {filter.label}
              </li>
            ))}
          </ul>
        ) : null}

        {message.items.length > 0 ? <Products message={message} /> : null}

        {latest && message.suggestions.length > 0 ? (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">Try:</p>
            <ul aria-label="Suggested prompts" className="mt-1 flex flex-wrap gap-1.5">
              {message.suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <Button size="sm" variant="outline" className="h-auto whitespace-normal rounded-full bg-background py-1 text-left text-xs" disabled={busy} onClick={() => onSend(suggestion)}>
                    {suggestion}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
