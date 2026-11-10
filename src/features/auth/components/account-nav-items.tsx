"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuth } from "../hooks/use-auth";

interface AccountNavItemsProps {
  /** Called after any item is activated (used to close the mobile menu). */
  onNavigate?: () => void;
  linkClassName?: string;
}

/**
 * Role-based account navigation. Render inside a <ul>. Renders nothing until the session has been
 * restored, so server and first client render match.
 */
export function AccountNavItems({ onNavigate, linkClassName }: AccountNavItemsProps) {
  const { status, user, logout } = useAuth();

  if (status === "idle") return null;

  if (!user) {
    return (
      <>
        <li>
          <Link href="/login" onClick={onNavigate} className={linkClassName}>
            Sign in
          </Link>
        </li>
        <li>
          <Link href="/register" onClick={onNavigate} className={linkClassName}>
            Create account
          </Link>
        </li>
      </>
    );
  }

  return (
    <>
      <li>
        <Link href="/dashboard" onClick={onNavigate} className={linkClassName}>
          Dashboard
        </Link>
      </li>
      <li>
        <Link href="/orders" onClick={onNavigate} className={linkClassName}>
          Orders
        </Link>
      </li>
      {user.role === "admin" ? (
        <li>
          <Link href="/admin" onClick={onNavigate} className={linkClassName}>
            Admin
          </Link>
        </li>
      ) : null}
      <li>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onNavigate?.();
            logout();
          }}
        >
          Sign out
        </Button>
      </li>
    </>
  );
}
