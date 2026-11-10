
"use client";

import { Sparkles } from "lucide-react";
import { Suspense, lazy, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useAssistantStore } from "@/store/assistant-store";
import { useAuthStore } from "@/store/auth-store";
import { useCompareStore } from "@/store/compare-store";
import { PANEL_ID } from "../constants";

// Load the assistant panel only when needed.
const AssistantPanel = lazy(() => import("./assistant-panel"));

function PanelFallback() {
  return (
    <div
      role="status"
      aria-label="Loading the assistant"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background text-sm text-muted-foreground sm:inset-auto sm:bottom-20 sm:right-4 sm:h-40 sm:w-[400px] sm:rounded-xl sm:border sm:shadow-xl"
    >
      Loading the assistant…
    </div>
  );
}

export function AssistantWidget() {
  const isOpen = useAssistantStore((state) => state.isOpen);
  const toggle = useAssistantStore((state) => state.toggle);
  const close = useAssistantStore((state) => state.close);
  const hydrate = useAssistantStore((state) => state.hydrate);

  const role = useAuthStore((state) => state.session?.user.role);

  const compareItems = useCompareStore((state) => state.items);
  const compareStatus = useCompareStore((state) => state.status);

  const pathname = usePathname();

  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      launcherRef.current?.focus();
    }

    wasOpen.current = isOpen;
  }, [isOpen]);

  // Move the launcher above the comparison tray whenever it is visible.
  const hasCompareTray =
    compareStatus === "ready" &&
    compareItems.length > 0 &&
    pathname !== "/compare";

  if (role === "admin") return null;

  return (
    <>
      {isOpen ? (
        <Suspense fallback={<PanelFallback />}>
          <AssistantPanel onClose={close} />
        </Suspense>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        aria-label={
          isOpen ? "Close shopping assistant" : "Open shopping assistant"
        }
        aria-expanded={isOpen}
        aria-controls={PANEL_ID}
        aria-haspopup="dialog"
        onClick={toggle}
        className={cn(
          "group fixed right-4 z-40 inline-flex h-13 animate-launcher-in items-center gap-2.5 rounded-full bg-primary py-0 pl-3.5 pr-5 text-sm font-bold text-primary-foreground ring-1 ring-primary-foreground/25 shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--navy-deep)_75%,transparent)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-deep hover:shadow-[0_18px_34px_-10px_color-mix(in_srgb,var(--navy-deep)_85%,transparent)] focus-visible:outline-offset-4 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 motion-reduce:hover:translate-y-0",

          // Normal position
          !hasCompareTray && "bottom-4 sm:bottom-6",

          // Elevated position when comparison tray is visible
          hasCompareTray &&
            "bottom-[calc(8rem+env(safe-area-inset-bottom))] sm:bottom-[6.5rem]",

          isOpen && "max-sm:hidden",
        )}
      >
        <span
          aria-hidden="true"
          className="relative flex size-8 items-center justify-center rounded-full bg-primary-foreground/15"
        >
          <Sparkles className="size-[1.15rem] text-gold-light transition-transform duration-300 group-hover:rotate-12 motion-reduce:transform-none" />

          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-cta ring-2 ring-primary">
            <span className="absolute inset-0 animate-ping-twice rounded-full bg-cta" />
          </span>
        </span>

        <span>Assistant</span>
      </button>
    </>
  );
}
