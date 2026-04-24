import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError, setToken } from "@/lib/api";
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
