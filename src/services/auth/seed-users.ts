import type { StoredUser } from "@/types/auth";

/**
 * Local development accounts (PRD section 21: at least one Customer and one Administrator).
 * They exist only in this client bundle for testing. Never reuse a real password here.
 */
export const DEMO_ACCOUNTS = {
  customer: { name: "Demo Customer", email: "customer@shopsphere.test", password: "Customer123" },
  admin: { name: "Demo Admin", email: "admin@shopsphere.test", password: "Admin12345" },
} as const;

export const SEED_USERS: readonly StoredUser[] = [
  {
    id: "user-seed-customer",
    name: DEMO_ACCOUNTS.customer.name,
    email: DEMO_ACCOUNTS.customer.email,
    role: "customer",
    salt: "seed-customer-salt",
    passwordHash: "75b452685a4b190824833d03865407957951d8550db30ec899e14401dad83dca",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "user-seed-admin",
    name: DEMO_ACCOUNTS.admin.name,
    email: DEMO_ACCOUNTS.admin.email,
    role: "admin",
    salt: "seed-admin-salt",
    passwordHash: "33082e7c7ef4e32b83e1a7128cdc6f9c2e76744b5d678cbb0c2358f512df70e8",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];
