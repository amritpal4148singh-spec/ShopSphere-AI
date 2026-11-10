import { useAuthStore } from "@/store/auth-store";

/** Feature-facing view of the auth store. Components use this instead of the store directly. */
export function useAuth() {
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const logout = useAuthStore((state) => state.logout);

  const user = session?.user ?? null;

  return {
    status,
    user,
    isAuthenticated: status === "authenticated",
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
  };
}
