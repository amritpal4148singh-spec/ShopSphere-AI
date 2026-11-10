"use client";

import { Info, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSISTANT_DISCLOSURE, MAX_MESSAGE_LENGTH, STARTER_PROMPTS } from "@/services/assistant";
import { PANEL_ID } from "../constants";
import { useAssistant } from "../hooks/use-assistant";
import { useIsMobile } from "../hooks/use-is-mobile";
import { MessageBubble } from "./message-bubble";

/** Header icon buttons sit on the dark midnight bar, so they invert from the default ghost style. */
const HEADER_BUTTON = "rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface AssistantPanelProps {
  onClose: () => void;
}

/**
 * The chat (PRD 7.2): messages with distinct treatment for the shopper and the assistant, inline product cards,
 * starter prompts, a typing indicator, and a persistent note that it is rule-based. A side panel from the `sm`
 * breakpoint, the whole screen below it, where it is a modal dialog with focus kept inside (PRD 14, 15).
 */
export default function AssistantPanel({ onClose }: AssistantPanelProps) {
  const { messages, thinking, send, retry, reset } = useAssistant();
  const mobile = useIsMobile();
  const [draft, setDraft] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const aboutId = useId();
  const inputId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, thinking]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !mobile) return;
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || thinking) return;
    send(draft);
    setDraft("");
  }

  const lastMessage = messages[messages.length - 1];

  return (
    <div
      ref={panelRef}
      id={PANEL_ID}
      role="dialog"
      aria-modal={mobile}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex animate-panel-in flex-col bg-background sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100dvh-7rem))] sm:w-[400px] sm:overflow-hidden sm:rounded-2xl sm:border sm:shadow-[0_30px_70px_-20px_color-mix(in_srgb,var(--navy-deep)_55%,transparent)]"
    >
      <div className="on-dark flex items-center gap-2 border-b border-gold/40 bg-ink px-3 py-2.5 text-primary-foreground">
        <span aria-hidden="true" className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/12">
          <Sparkles className="size-4 text-gold-light" />
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-cta ring-2 ring-ink" />
        </span>
        <h2 id={titleId} className="font-display text-base font-semibold tracking-tight">
          Shopping Assistant
        </h2>
        <span className="rounded-full border border-primary-foreground/30 px-2 py-0.5 text-xs font-semibold text-primary-foreground/85">Rule-based</span>
        <div className="ml-auto flex items-center">
          <Button variant="ghost" size="icon" className={HEADER_BUTTON} aria-label="About this assistant" aria-expanded={aboutOpen} aria-controls={aboutId} onClick={() => setAboutOpen((open) => !open)}>
            <Info aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className={HEADER_BUTTON} aria-label="Start a new chat" onClick={reset} disabled={messages.length === 0}>
            <RotateCcw aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className={HEADER_BUTTON} aria-label="Close assistant" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div id={aboutId} hidden={!aboutOpen} className="border-b bg-accent px-3 py-2 text-xs text-accent-foreground">
        {ASSISTANT_DISCLOSURE}
      </div>

      <div ref={logRef} role="log" aria-label="Conversation" aria-live="polite" tabIndex={0} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm">Hi! Tell me what you&rsquo;re looking for, with a price limit or a rating if you like, and I&rsquo;ll find matching products.</p>
            <div>
              <p className="text-xs text-muted-foreground">Try one of these:</p>
              <ul aria-label="Starter prompts" className="mt-1 flex flex-wrap gap-1.5">
                {STARTER_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <Button size="sm" variant="outline" className="h-auto whitespace-normal rounded-full py-1 text-left text-xs" disabled={thinking} onClick={() => send(prompt)}>
                      {prompt}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} latest={message === lastMessage && !thinking} busy={thinking} onSend={send} onRetry={retry} />
        ))}

        {thinking ? (
          <div role="status" className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-3">
              <span className="sr-only">Assistant is typing</span>
              {[0, 1, 2].map((dot) => (
                <span key={dot} aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${dot * 150}ms` }} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="border-t px-3 py-2">
        <label htmlFor={inputId} className="sr-only">
          Message the shopping assistant
        </label>
        <div className="flex gap-2">
          <Input ref={inputRef} id={inputId} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={MAX_MESSAGE_LENGTH} placeholder="e.g. headphones under ₹5,000" autoComplete="off" />
          <Button type="submit" disabled={!draft.trim() || thinking} aria-label="Send message">
            <Send aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Rule-based assistant: it matches keywords and filters, it is not a language model.</p>
      </form>
    </div>
  );
}
