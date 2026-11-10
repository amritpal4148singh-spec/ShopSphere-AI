"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { AuthError, DEMO_ACCOUNTS } from "@/services/auth";
import { hasErrors, validateLogin, type FieldErrors } from "@/utils/validation";
import { useAuth } from "../hooks/use-auth";

type LoginErrors = FieldErrors<"email" | "password">;

interface LoginFormProps {
  /** Already sanitized with getSafeRedirectPath by the page. */
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const { status, login } = useAuth();
  const router = useRouter();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // One redirect mechanism for fresh sign-in and for already-signed-in visitors.
  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, nextPath, router]);

  function focusFirstInvalid(next: LoginErrors) {
    if (next.email) emailRef.current?.focus();
    else if (next.password) passwordRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const validation = validateLogin(values);
    setErrors(validation);
    if (hasErrors(validation)) {
      focusFirstInvalid(validation);
      return;
    }

    setPending(true);
    try {
      await login(values);
    } catch (error) {
      if (error instanceof AuthError && error.code === "ACCOUNT_NOT_FOUND") {
        const next = { email: "No account found with this email address." };
        setErrors(next);
        focusFirstInvalid(next);
      } else if (error instanceof AuthError && error.code === "WRONG_PASSWORD") {
        const next = { password: "Incorrect password. Check it and try again." };
        setErrors(next);
        focusFirstInvalid(next);
      } else {
        setFormError("Sign-in failed because of an unexpected problem. Try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="page-title">Sign in</h1>
      <p className="mt-2 text-muted-foreground">Sign in to check out, track orders, and manage your account.</p>

      {status === "expired" ? (
        <p role="status" className="mt-6 rounded-md border bg-accent px-4 py-3 text-sm text-accent-foreground">
          Your session expired. Sign in again to continue.
          {nextPath.startsWith("/checkout") ? " Your checkout progress is saved and will be restored." : ""}
        </p>
      ) : null}

      <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
        />
        <FormField
          ref={passwordRef}
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
        />

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        New to ShopSphere AI?{" "}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-md border bg-card p-4 text-sm text-muted-foreground">
        <p className="font-medium text-card-foreground">Local demo accounts</p>
        <p className="mt-1">These accounts exist only in this demo and hold no real data.</p>
        <p className="mt-2">{`Customer: ${DEMO_ACCOUNTS.customer.email} / ${DEMO_ACCOUNTS.customer.password}`}</p>
        <p>{`Administrator: ${DEMO_ACCOUNTS.admin.email} / ${DEMO_ACCOUNTS.admin.password}`}</p>
      </div>
    </section>
  );
}
