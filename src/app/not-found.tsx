import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-24 sm:px-6 lg:px-8">
      <h1 className="page-title">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">This page does not exist or has moved.</p>
      <Button asChild className="mt-6">
        <Link href="/">Go to the homepage</Link>
      </Button>
    </section>
  );
}
