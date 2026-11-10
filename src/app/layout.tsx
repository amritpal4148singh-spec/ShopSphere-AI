import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CompareTray } from "@/features/compare";
import { MobileCartButton } from "@/features/cart";
import { LazyAssistantWidget } from "@/features/ai-assistant";
import { Providers } from "./providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Display face for headlines, titles, prices and the wordmark: a refined variable serif with optical sizing (delicate at
// large sizes, sturdy at small ones). Body text stays in Manrope.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "ShopSphere AI",
    template: "%s | ShopSphere AI",
  },
  description: "A personalized storefront that explains why it recommends what it does.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${fraunces.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <CompareTray />
          <MobileCartButton />
          <LazyAssistantWidget />
        </Providers>
      </body>
    </html>
  );
}
