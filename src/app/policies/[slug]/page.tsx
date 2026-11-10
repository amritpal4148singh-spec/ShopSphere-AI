import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { POLICIES, getPolicy } from "@/lib/policies";

interface PolicyPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return POLICIES.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const policy = getPolicy((await params).slug);
  return { title: policy?.title ?? "Policy" };
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const policy = getPolicy((await params).slug);
  if (!policy) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="inline-block rounded-full border border-gold-edge bg-secondary px-3 py-1 text-xs font-semibold text-gold-ink">Demonstration content</p>
      <h1 className="page-title mt-4">{policy.title}</h1>
      <p className="mt-3 text-muted-foreground">{policy.summary}</p>

      <div className="mt-8 space-y-8">
        {policy.sections.map((section) => (
          <section key={section.heading} aria-labelledby={`h-${section.heading.replace(/\W+/g, "-").toLowerCase()}`}>
            <h2 id={`h-${section.heading.replace(/\W+/g, "-").toLowerCase()}`} className="section-title">
              {section.heading}
            </h2>
            <div className="mt-2 space-y-3 leading-relaxed">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <nav aria-label="Other policies" className="mt-12 border-t pt-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {POLICIES.filter((other) => other.slug !== policy.slug).map((other) => (
            <li key={other.slug}>
              <Link href={`/policies/${other.slug}`} className="rounded-sm font-medium text-primary underline-offset-4 hover:underline">
                {other.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
