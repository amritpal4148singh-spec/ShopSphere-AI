"use client";

import { Clock, Search, Tag, TrendingUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { useCategories } from "@/features/products";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MAX_QUERY_LENGTH } from "@/lib/constants";
import { POPULAR_SEARCHES } from "@/lib/popular-searches";
import { cn } from "@/lib/utils";
import { titleCase } from "@/utils/text";
import { SEARCH_DEBOUNCE_MS, SUGGESTION_MIN_CHARS } from "../constants";
import { useRecentSearches } from "../hooks/use-recent-searches";
import { useSuggestions } from "../hooks/use-suggestions";

type ItemKind = "search" | "recent" | "popular" | "category" | "product";

interface SuggestionItem {
  id: string;
  kind: ItemKind;
  label: string;
  /** Search term to run (kinds: search, recent, popular). */
  term?: string;
  /** Direct destination (kinds: category, product). */
  href?: string;
  hint?: string;
}

const GROUP_LABELS: Partial<Record<ItemKind, string>> = {
  recent: "Recent searches",
  popular: "Popular searches",
  category: "Categories",
  product: "Products",
};

const KIND_ICONS = { search: Search, recent: Clock, popular: TrendingUp, category: Tag, product: Search } as const;

/**
 * Header search with an ARIA combobox. Suggestions are requested only after typing pauses for
 * SEARCH_DEBOUNCE_MS (PRD MOD-03-001). Submitting an empty box fires no request and shows recent and
 * popular searches instead (PRD edge case 5). The URL is the source of truth on /search.
 */
export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/search" ? (searchParams.get("q") ?? "") : "";

  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  const trimmed = value.trim();
  const isTyping = trimmed.length >= SUGGESTION_MIN_CHARS;
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const settled = debounced === trimmed;

  const suggestions = useSuggestions(debounced, open && debounced.length >= SUGGESTION_MIN_CHARS);
  const categories = useCategories(open);
  const { recent, add, clear, refresh } = useRecentSearches();

  const items = useMemo<SuggestionItem[]>(() => {
    if (!isTyping) {
      return [
        ...recent.map((term): SuggestionItem => ({ id: `recent-${term}`, kind: "recent", label: term, term })),
        ...POPULAR_SEARCHES.map((term): SuggestionItem => ({ id: `popular-${term}`, kind: "popular", label: term, term })),
      ];
    }

    const lower = trimmed.toLowerCase();
    const list: SuggestionItem[] = [{ id: "search", kind: "search", label: `Search for “${trimmed}”`, term: trimmed }];

    for (const category of (categories.data ?? [])
      .filter((item) => item.name.toLowerCase().includes(lower) || item.slug.includes(lower))
      .slice(0, 3)) {
      list.push({ id: `category-${category.slug}`, kind: "category", label: category.name, href: `/category/${category.slug}` });
    }
    if (settled) {
      for (const product of suggestions.data ?? []) {
        list.push({
          id: `product-${product.id}`,
          kind: "product",
          label: product.title,
          href: `/products/${product.id}`,
          hint: titleCase(product.category),
        });
      }
    }
    return list;
  }, [isTyping, recent, trimmed, categories.data, settled, suggestions.data]);

  const showPanel = open && items.length > 0;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  function submitTerm(term: string) {
    const query = term.trim().slice(0, MAX_QUERY_LENGTH);
    if (query.length === 0) {
      setOpen(true);
      return;
    }
    add(query);
    setValue(query);
    setOpen(false);
    setActiveIndex(-1);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function choose(item: SuggestionItem) {
    if (item.href) {
      setOpen(false);
      setActiveIndex(-1);
      router.push(item.href);
      return;
    }
    submitTerm(item.term ?? "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const active = activeIndex >= 0 ? items[activeIndex] : undefined;
    if (active) choose(active);
    else submitTerm(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((index) => (items.length === 0 ? -1 : (index + 1) % items.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (items.length === 0 ? -1 : index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <form role="search" onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          name="q"
          role="combobox"
          aria-label="Search products"
          aria-expanded={showPanel}
          aria-controls={showPanel ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Search products"
          value={value}
          className="h-11 w-full min-w-0 rounded-full border border-input bg-card px-5 text-sm shadow-[inset_0_1px_2px_rgb(20_19_43/0.06)] transition placeholder:text-muted-foreground hover:border-primary/70 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] focus-visible:outline-none"
          onFocus={() => {
            refresh();
            setOpen(true);
          }}
          onChange={(event) => {
            setValue(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <Button type="submit" size="icon" aria-label="Search" className="size-11 rounded-full">
          <Search aria-hidden="true" />
        </Button>
      </form>

      {showPanel ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border bg-card p-1.5 text-card-foreground shadow-[0_18px_40px_-16px_rgb(20_19_43/0.35)]">
          <ul id={listboxId} role="listbox" aria-label="Search suggestions">
            {items.map((item, index) => {
              const Icon = KIND_ICONS[item.kind];
              const groupLabel = GROUP_LABELS[item.kind];
              const startsGroup = groupLabel !== undefined && items[index - 1]?.kind !== item.kind;
              return (
                <li key={item.id} role="presentation">
                  {startsGroup ? <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">{groupLabel}</p> : null}
                  <div
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm",
                      index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(item)}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint ? <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {isTyping && settled && suggestions.isFetching ? (
            <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
              Searching...
            </p>
          ) : null}
          {isTyping && settled && suggestions.isError ? (
            <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
              Suggestions are unavailable right now. You can still press Enter to search.
            </p>
          ) : null}
          {!isTyping && recent.length > 0 ? (
            <div className="border-t px-1 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                Clear history
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
