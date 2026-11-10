"use client";

import Link from "next/link";

import { RecommendationPreferences } from "@/features/recommendations";
import { useAuth } from "@/features/auth";
import { Avatar } from "./avatar";
import { AddressesSection } from "./addresses-section";
import { MyReviewsSection } from "./my-reviews-section";
import { ProfileSection } from "./profile-section";
import { RecentlyViewedSection } from "./recently-viewed-section";
import { useProfile } from "../hooks/use-profile";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "addresses", label: "Addresses" },
  { id: "orders", label: "Orders" },
  { id: "wishlist", label: "Wishlist" },
  { id: "recently-viewed", label: "Recently viewed" },
  { id: "my-reviews", label: "My reviews" },
  { id: "recommendations", label: "Recommendation preferences" },
] as const;

/** The customer dashboard (PRD 5.7). Orders and wishlist keep their own pages and are linked here. */
export function DashboardView() {
  const { user } = useAuth();
  const { values } = useProfile();
  if (!user) return null;

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={values?.name ?? user.name} src={values?.avatar ?? null} />
        <div>
          <p className="font-display text-2xl font-semibold">{values?.name ?? user.name}</p>
          <p className="text-sm text-muted-foreground">{`Signed in as ${values?.name ?? user.name} (${user.role})`}</p>
        </div>
      </div>

      <nav aria-label="Dashboard sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 whitespace-nowrap">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="inline-block rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium hover:border-primary hover:bg-accent">
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div id="profile" className="scroll-mt-24">
        <ProfileSection />
      </div>
      <div id="addresses" className="scroll-mt-24">
        <AddressesSection />
      </div>

      <div id="orders" className="grid scroll-mt-24 gap-4 sm:grid-cols-2">
        <section aria-labelledby="dash-orders" className="rounded-xl border bg-card p-4 shadow-surface sm:p-6">
          <h2 id="dash-orders" className="section-title">
            Orders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Track an order or review what you bought.</p>
          <Link href="/orders" className="mt-3 inline-block rounded-sm font-medium text-primary underline-offset-4 hover:underline">
            View order history
          </Link>
        </section>
        <section id="wishlist" aria-labelledby="dash-wishlist" className="scroll-mt-24 rounded-xl border bg-card p-4 shadow-surface sm:p-6">
          <h2 id="dash-wishlist" className="section-title">
            Wishlist
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage saved products and move them to your cart.</p>
          <Link href="/wishlist" className="mt-3 inline-block rounded-sm font-medium text-primary underline-offset-4 hover:underline">
            Open wishlist
          </Link>
        </section>
      </div>

      <div id="recently-viewed" className="scroll-mt-24">
        <RecentlyViewedSection />
      </div>
      <div id="my-reviews" className="scroll-mt-24">
        <MyReviewsSection />
      </div>
      <div id="recommendations" className="scroll-mt-24">
        <RecommendationPreferences />
      </div>
    </div>
  );
}
