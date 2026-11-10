import Link from "next/link";

import { POLICIES } from "@/lib/policies";
import { NewsletterForm } from "@/features/newsletter";

// Footer wording differs from the header's link names on purpose, so a link is never announced (or found) twice with one name.
const SHOP_LINKS = [
  { href: "/products", label: "Browse the catalogue" },
  { href: "/search", label: "Search the store" },
  { href: "/compare", label: "Compare products" },
  { href: "/wishlist", label: "Saved items" },
  { href: "/cart", label: "Your shopping bag" },
] as const;

const ACCOUNT_LINKS = [
  { href: "/login", label: "Log in" },
  { href: "/register", label: "Become a member" },
  { href: "/dashboard", label: "Your account" },
  { href: "/orders", label: "Order tracking" },
] as const;

const linkClass = "rounded-sm text-primary-foreground/80 underline-offset-4 hover:text-primary-foreground hover:underline";

/** Site footer (PRD 5.1): sitemap links, policy pages and a newsletter signup (a simulation). */
export function SiteFooter() {
  return (
    <footer className="on-dark border-t border-gold/50 bg-ink text-primary-foreground">
      <div className="mx-auto grid w-full max-w-screen-2xl gap-10 px-4 py-12 text-sm sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.5fr] lg:px-8">
        <div className="space-y-3">
          <p className="font-display text-2xl font-semibold tracking-tight">
            ShopSphere <span className="text-cta">AI</span>
          </p>
          <p className="max-w-xs text-primary-foreground/75">
            A demonstration storefront. Payments are simulated and recommendations and the shopping assistant run on local rules, not a language model.
          </p>
        </div>

        <nav aria-label="Shop">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Shop</h2>
          <ul className="space-y-2">
            {SHOP_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Account</h2>
          <ul className="space-y-2">
            {ACCOUNT_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Policies">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Policies</h2>
          <ul className="space-y-2">
            {POLICIES.map((policy) => (
              <li key={policy.slug}>
                <Link href={`/policies/${policy.slug}`} className={linkClass}>
                  {policy.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <NewsletterForm />
      </div>
      <div className="border-t border-primary-foreground/15">
        <p className="mx-auto max-w-screen-2xl px-4 py-4 text-xs text-primary-foreground/70 sm:px-6 lg:px-8">Demonstration project. Not a real store.</p>
      </div>
    </footer>
  );
}
