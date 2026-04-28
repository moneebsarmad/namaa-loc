"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

declare global {
  interface Window {
    __portalTest?: {
      expireSession?: () => Promise<void>;
    };
  }
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let initTimedOut = false;
    const sessionTimeout = window.setTimeout(() => {
      if (!isMounted) return;
      initTimedOut = true;
      console.warn("Supabase session init timed out; continuing without cached session");
      setLoading(false);
    }, 2000);

    const initSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error) {
          console.error("Supabase session error", error.message);
        }
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      } catch (error) {
        if (!isMounted) return;
        console.error("Supabase session bootstrap error", error);
      } finally {
        window.clearTimeout(sessionTimeout);
        if (!isMounted) return;
        if (!initTimedOut) {
          setLoading(false);
        }
      }
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      }
    );

    return () => {
      isMounted = false;
      window.clearTimeout(sessionTimeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.__portalTest = {
      expireSession: async () => {
        setSession(null);
        setUser(null);
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("Supabase test sign out error", error.message);
        }
      },
    };

    return () => {
      if (window.__portalTest) {
        delete window.__portalTest;
      }
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return error ? error.message : null;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("Supabase sign out error", error.message);
        }
      },
    }),
    [session, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
