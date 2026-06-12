import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError, SESSION_EXPIRED_EVENT, setToken } from "@/lib/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Per-user data stashed in localStorage by PlanContext, CartContext, and
// PlanCompose. Cleared on sign-out so the next account on this device
// doesn't inherit the previous user's plan, ticks, or compose drafts (or
// worse, have the plan-sync debounce PUT them into their own account).
const USER_DATA_KEYS = [
  "foodlab_plan_v2",
  "foodlab_plan", // legacy v1 plan key
  "foodlab_plan_profiles",
  "foodlab_plan_serve_with",
  "foodlab_cart_bought",
  "foodlab_compose_messages",
  "foodlab_compose_draft",
  "foodlab_compose_saved",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On boot, try /auth/me with stored token.
  useEffect(() => {
    (async () => {
      try {
        const { user } = await api<{ user: User }>("/auth/me");
        setUser(user);
      } catch (err) {
        setUser(null);
        // Only drop the stored token when the server actually rejects it.
        // Network errors or fetches aborted by navigation shouldn't nuke a
        // valid token mid-flight.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setToken(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // If any in-flight request hits 401/403, the api wrapper drops the token
  // and fires SESSION_EXPIRED_EVENT. Listen for it and flip the UI back to
  // signed-out without making the user reload the page.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user } = await api<{ token: string; user: User }>(
      "/auth/signin",
      { method: "POST", body: { email, password }, auth: false },
    );
    setToken(token);
    setUser(user);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { token, user } = await api<{ token: string; user: User }>(
        "/auth/signup",
        {
          method: "POST",
          body: { email, password, displayName },
          auth: false,
        },
      );
      setToken(token);
      setUser(user);
    },
    [],
  );

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    try {
      for (const key of USER_DATA_KEYS) localStorage.removeItem(key);
    } catch {
      // private mode — nothing persisted anyway
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
