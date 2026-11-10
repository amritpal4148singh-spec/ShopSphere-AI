"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { AccountNavItems } from "@/features/auth";
import { CartLink } from "@/features/cart";
import { SearchBar } from "@/features/search";
import { WishlistLink } from "@/features/wishlist";
import { useUiStore } from "@/store/ui-store";

const NAV_LINK = "nav-link rounded-sm hover:text-primary";
const MOBILE_NAV_LINK = "block rounded-md px-2 py-3 hover:bg-accent hover:text-accent-foreground";

/** A sphere with an orbiting satellite: the brand mark, echoed by the hero's orbit composition. */
function BrandMark() {
  return (
    <span aria-hidden="true" className="relative inline-block size-7 shrink-0">
      <span className="absolute inset-0 rounded-full bg-primary shadow-[inset_-3px_-4px_6px_rgb(0_0_0/0.22),inset_2px_2px_4px_rgb(255_255_255/0.28)]" />
      <span className="absolute -inset-x-1.5 top-1/2 h-3.5 -translate-y-1/2 -rotate-[24deg] rounded-[50%] border-[1.5px] border-gold transition-transform duration-500 ease-out group-hover/brand:-rotate-[64deg] motion-reduce:transition-none" />
      <span className="absolute -right-1 top-0.5 size-2.5 rounded-full border border-gold-edge bg-cta ring-2 ring-background" />
    </span>
  );
}

export function SiteHeader() {
  const isMobileNavOpen = useUiStore((state) => state.isMobileNavOpen);
  const toggleMobileNav = useUiStore((state) => state.toggleMobileNav);
  const closeMobileNav = useUiStore((state) => state.closeMobileNav);

  return (
    <header className="site-header sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group/brand flex items-center gap-2.5 rounded-md py-1 pr-1 font-display text-xl font-semibold tracking-tight">
          <BrandMark />
          <span>
            ShopSphere{" "}
            <span className="relative -top-px ml-0.5 inline-block rounded-md bg-primary px-1.5 py-1 align-middle text-[0.65rem] font-bold leading-none tracking-wider text-gold-light">AI</span>
          </span>
        </Link>

        {/* One search instance: full width on its own row below lg, inline from lg up. */}
        <div className="order-last w-full lg:order-none lg:mx-4 lg:w-auto lg:max-w-lg lg:flex-1">
          <Suspense fallback={<div aria-hidden="true" className="h-11 w-full rounded-full border border-input bg-card" />}>
            <SearchBar />
          </Suspense>
        </div>

        <nav aria-label="Primary" className="hidden lg:ml-auto lg:block">
          <ul className="flex items-center gap-7 text-sm font-semibold">
            <li>
              <Link href="/" className={NAV_LINK}>
                Home
              </Link>
            </li>
            <li>
              <Link href="/products" className={NAV_LINK}>
                Shop
              </Link>
            </li>
            <AccountNavItems linkClassName={NAV_LINK} />
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <WishlistLink />
          <CartLink />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full lg:hidden"
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-nav"
          aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
          onClick={toggleMobileNav}
        >
          {isMobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
      </div>

      <nav id="mobile-nav" aria-label="Mobile" hidden={!isMobileNavOpen} className="border-t border-border/80 lg:hidden">
        <ul className="mx-auto flex w-full max-w-screen-2xl flex-col px-2 py-2 text-sm font-semibold sm:px-4">
          <li>
            <Link href="/" onClick={closeMobileNav} className={MOBILE_NAV_LINK}>
              Home
            </Link>
          </li>
          <li>
            <Link href="/products" onClick={closeMobileNav} className={MOBILE_NAV_LINK}>
              Shop
            </Link>
          </li>
          <AccountNavItems onNavigate={closeMobileNav} linkClassName={MOBILE_NAV_LINK} />
        </ul>
      </nav>
    </header>
  );
}
