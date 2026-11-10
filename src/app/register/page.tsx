import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth";
import { getSafeRedirectPath } from "@/utils/redirect";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <RegisterForm nextPath={getSafeRedirectPath(next)} />;
}
