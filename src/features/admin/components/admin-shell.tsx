"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LocalBadge } from "@/components/ui/local-badge";
import { ADMIN_CATALOGUE_KEY } from "@/lib/admin-storage";
import { ANALYTICS_STORAGE_KEY } from "@/lib/analytics-storage";
import { cn } from "@/lib/utils";
import { ORDER_STORAGE_PREFIX } from "@/lib/order-storage";
import { useAdminCatalogueStore } from "@/store/admin-catalogue-store";
import { useAdminOrdersStore } from "@/store/admin-orders-store";
import { useAnalyticsStore } from "@/store/analytics-store";

const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/analytics", label: "Analytics" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Frame of every admin screen: section navigation, the Data Write Policy notice (PRD 4.2), and the loading of the local
 * data the screens work on. Everything an administrator changes here is simulated and stays in this browser.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    useAdminCatalogueStore.getState().hydrate();
    useAdminOrdersStore.getState().load();
    useAnalyticsStore.getState().hydrate();

    function handleStorage(event: StorageEvent) {
      const key = event.key;
      if (key === null || key === ADMIN_CATALOGUE_KEY) useAdminCatalogueStore.getState().reload();
      if (key === null || key.startsWith(ORDER_STORAGE_PREFIX)) useAdminOrdersStore.getState().load();
      if (key === null || key === ANALYTICS_STORAGE_KEY) useAnalyticsStore.getState().reload();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Admin sections" className="-mx-1 overflow-x-auto pb-2">
        <ul className="flex min-w-max gap-1 px-1">
          {SECTIONS.map((section) => {
            const active = isActive(pathname, section.href);
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("block rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground")}
                >
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p role="note" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
        <LocalBadge />
        <span>Changes made in the admin area are simulated and saved in this browser&rsquo;s local storage only. They do not change the storefront and are not sent to any server.</span>
      </p>

      <div className="mt-6">{children}</div>
    </div>
  );
}
