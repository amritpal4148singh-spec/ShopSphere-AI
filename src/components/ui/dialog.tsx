"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Visible title; also the dialog's accessible name. */
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * An accessible modal dialog (PRD 14): role="dialog" with aria-modal and a name, focus moves in on open, Tab stays inside,
 * Escape or a backdrop click closes it, the page behind does not scroll, and focus returns to what opened it.
 */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusables = () => (panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden";
        }) : []);
    (focusables()[0] ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-primary/50 backdrop-blur-[2px]" aria-hidden="true" onClick={onClose} data-testid="dialog-backdrop" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gold-edge bg-card shadow-lift outline-none sm:max-w-3xl sm:rounded-2xl motion-safe:animate-panel-in", className)}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-3">
          <h2 id={titleId} className="font-display text-lg font-semibold leading-snug">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
