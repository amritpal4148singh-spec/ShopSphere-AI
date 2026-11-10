"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Accessible tabs (PRD section 14): roving tabindex, Left/Right/Home/End keys, tab and tabpanel roles.
 * Only the active panel is rendered.
 */
export function Tabs({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTab(index: number) {
    const tab = tabs[index];
    if (!tab) return;
    setActiveId(tab.id);
    buttons.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    if (event.key === "ArrowRight") focusTab(index === last ? 0 : index + 1);
    else if (event.key === "ArrowLeft") focusTab(index === 0 ? last : index - 1);
    else if (event.key === "Home") focusTab(0);
    else if (event.key === "End") focusTab(last);
    else return;
    event.preventDefault();
  }

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab, index) => {
          const selected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "-mb-px shrink-0 rounded-t-lg border-b-[3px] px-5 py-3 text-sm font-bold transition-colors",
                selected ? "border-primary bg-accent/60 text-primary" : "border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          tabIndex={0}
          className="py-6"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
