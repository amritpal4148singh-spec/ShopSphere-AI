import type { Metadata } from "next";

import { LoginForm } from "@/features/auth";
import { getSafeRedirectPath } from "@/utils/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <LoginForm nextPath={getSafeRedirectPath(next)} />;
}
