"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { AuthError } from "@/services/auth";
import { hasErrors, validateRegistration, type FieldErrors } from "@/utils/validation";
import { useAuth } from "../hooks/use-auth";

type RegisterField = "name" | "email" | "password" | "confirmPassword";
type RegisterErrors = FieldErrors<RegisterField>;

interface RegisterFormProps {
  /** Already sanitized with getSafeRedirectPath by the page. */
  nextPath: string;
}

const FIELD_ORDER: RegisterField[] = ["name", "email", "password", "confirmPassword"];

export function RegisterForm({ nextPath }: RegisterFormProps) {
  const { status, register } = useAuth();
  const router = useRouter();

  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (status === "authenticated") router.replace(nextPath);
  }, [status, nextPath, router]);

  function focusFirstInvalid(next: RegisterErrors) {
    const first = FIELD_ORDER.find((field) => next[field]);
    if (first) refs[first].current?.focus();
  }

  function setValue(field: RegisterField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const validation = validateRegistration(values);
    setErrors(validation);
    if (hasErrors(validation)) {
      focusFirstInvalid(validation);
      return;
    }

    setPending(true);
    try {
      await register({ name: values.name, email: values.email, password: values.password });
    } catch (error) {
      if (error instanceof AuthError && error.code === "EMAIL_TAKEN") {
        const next = { email: "An account with this email address already exists." };
        setErrors(next);
        focusFirstInvalid(next);
      } else if (error instanceof AuthError && error.code === "STORAGE_UNAVAILABLE") {
        setFormError("Your browser is blocking local storage, so the account cannot be saved. Allow storage for this site and try again.");
      } else {
        setFormError("Registration failed because of an unexpected problem. Try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <h1 className="page-title">Create your account</h1>
      <p className="mt-2 text-muted-foreground">
        This demo stores your account only in this browser. Do not use a real password.
      </p>

      <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField
          ref={refs.name}
          label="Name"
          name="name"
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={(event) => setValue("name", event.target.value)}
        />
        <FormField
          ref={refs.email}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValue("email", event.target.value)}
        />
        <FormField
          ref={refs.password}
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          value={values.password}
          error={errors.password}
          onChange={(event) => setValue("password", event.target.value)}
        />
        <FormField
          ref={refs.confirmPassword}
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => setValue("confirmPassword", event.target.value)}
        />

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
