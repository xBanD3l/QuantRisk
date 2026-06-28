"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User, SupabaseClient } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchProfile, touchLastLogin, type Profile } from "@/lib/supabase/data";

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  accessToken: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => (isSupabaseConfigured() ? createClient() : null), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const {
      data: { user: currentUser }
    } = await supabase.auth.getUser();
    if (!currentUser) {
      setProfile(null);
      return;
    }
    const row = await fetchProfile(supabase, currentUser.id);
    setProfile(row);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client: SupabaseClient = supabase;

    let mounted = true;

    async function init() {
      const {
        data: { session: initialSession }
      } = await client.auth.getSession();
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await touchLastLogin(client, initialSession.user);
        const row = await fetchProfile(client, initialSession.user.id);
        if (mounted) setProfile(row);
      }
      if (mounted) setLoading(false);
    }

    void init();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        await touchLastLogin(client, nextSession.user);
        const row = await fetchProfile(client, nextSession.user.id);
        setProfile(row);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      console.error("Supabase is not configured.");
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setProfile(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      session,
      accessToken: session?.access_token ?? null,
      loading,
      signInWithGoogle,
      signOut,
      refreshProfile
    }),
    [user, profile, session, loading, signInWithGoogle, signOut, refreshProfile]
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
