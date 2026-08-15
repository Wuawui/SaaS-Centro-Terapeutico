"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/types";
import { motion } from "framer-motion";

// ============================================================
// SessionProvider — Single source of truth for auth + profile
// Strategy: Use onAuthStateChange as PRIMARY source (no locks).
// getSession() is only used as a one-time fallback with timeout.
// ============================================================

interface SessionContextValue {
  user: User | null;
  profile: Profile | null;
  tenantId: string | null;
  tenantName: string;
  tenantColor: string;
  tenantInitials: string;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshTenant: () => Promise<void>;
  isAdmin: boolean;
  isTherapist: boolean;
  isParent: boolean;
  isCoordinator: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  profile: null,
  tenantId: null,
  tenantName: "CentroYB",
  tenantColor: "#4F46E5",
  tenantInitials: "YB",
  role: null,
  loading: true,
  signOut: async () => {},
  refreshTenant: async () => {},
  isAdmin: false,
  isTherapist: false,
  isParent: false,
  isCoordinator: false,
});

// Singleton cache to avoid re-fetching across mounts
let _cached: { user: User | null; profile: Profile | null; loadedAt: number } | null = null;
let _tenantCache: { name: string; color: string; loadedAt: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

async function fetchProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: prof } = await supabase
    .from("profiles")
    .select("*, tenants(active)")
    .eq("id", userId)
    .single();
  return prof as Profile | null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(_cached?.user ?? null);
  const [profile, setProfile] = useState<Profile | null>(_cached?.profile ?? null);
  const [tenantName, setTenantName] = useState(_tenantCache?.name ?? "CentroYB");
  const [tenantColor, setTenantColor] = useState(_tenantCache?.color ?? "#4F46E5");
  const [loading, setLoading] = useState(
    !_cached?.user || Date.now() - (_cached.loadedAt || 0) > CACHE_TTL
  );

  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    let resolved = false; // Track if we've already resolved loading

    const resolve = () => {
      if (!resolved) {
        resolved = true;
        if (!cancelled) setLoading(false);
      }
    };

    // 1) Use cache immediately
    if (_cached?.user && Date.now() - _cached.loadedAt < CACHE_TTL) {
      if (!cancelled) {
        setUser(_cached.user);
        setProfile(_cached.profile);
        resolve();
      }
    }

    // 2) Helper to process a session (shared between listener & fallback)
    const processSession = async (session: Session | null) => {
      if (!session?.user) {
        _cached = { user: null, profile: null, loadedAt: Date.now() };
        if (!cancelled) {
          setUser(null);
          setProfile(null);
        }
        resolve();
        return;
      }

      try {
        const prof = await fetchProfile(supabase, session.user.id);

        // Tenant suspended check
        if (prof && (prof as any).tenants?.active === false && typeof window !== "undefined") {
          if (window.location.pathname !== "/suspended") {
            window.location.href = "/suspended";
          }
          resolve();
          return;
        }

        _cached = { user: session.user, profile: prof, loadedAt: Date.now() };
        if (!cancelled) {
          setUser(session.user);
          setProfile(prof);
        }

        // Fetch tenant branding
        let brandingTenantId = prof?.tenant_id;

        if (prof?.role === "padre") {
          try {
            const { data: linkedPatients } = await supabase
              .from("parent_patients")
              .select("tenant_id")
              .eq("parent_id", session.user.id)
              .limit(1);
            if (linkedPatients && linkedPatients.length > 0) {
              brandingTenantId = linkedPatients[0].tenant_id;
            }
          } catch (e) {
            console.error("Error fetching linked patient tenant branding:", e);
          }
        }

        if (brandingTenantId) {
          const { data: t } = await supabase.from("tenants").select("name, primary_color").eq("id", brandingTenantId).single();
          if (t && !cancelled) {
            setTenantName(t.name || "CentroYB");
            setTenantColor(t.primary_color || "#4F46E5");
            _tenantCache = { name: t.name || "CentroYB", color: t.primary_color || "#4F46E5", loadedAt: Date.now() };
          }
        }
      } catch (err) {
        console.error("SessionProvider: error fetching profile", err);
      }
      resolve();
    };

    // 3) PRIMARY: Listen to onAuthStateChange (no locks, instant)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        // INITIAL_SESSION fires immediately with cached token — this is the fast path
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          processSession(session).catch((err) => {
            console.error("SessionProvider: processSession error", err);
            resolve(); // Always resolve to prevent infinite loading
          });
        } else if (event === "SIGNED_OUT") {
          _cached = { user: null, profile: null, loadedAt: Date.now() };
          if (!cancelled) {
            setUser(null);
            setProfile(null);
          }
          resolve();
        }
      }
    );

    // 4) Safety timeout: if nothing resolves in 3s, force stop loading
    //    This prevents infinite spinners when Supabase is unreachable
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        console.warn("SessionProvider: safety timeout (3s), forcing loading=false");
        resolve();
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    _cached = null;
    _tenantCache = null;
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut errors — redirect anyway
    }
    window.location.href = "/login";
  }, []);

  const refreshTenant = useCallback(async () => {
    let tid = profile?.tenant_id;

    if (profile?.role === "padre") {
      try {
        const { data: linked } = await supabase
          .from("parent_patients")
          .select("tenant_id")
          .eq("parent_id", user?.id)
          .limit(1);
        if (linked && linked.length > 0) {
          tid = linked[0].tenant_id;
        }
      } catch (e) {
        console.error("Error refreshing tenant for parent:", e);
      }
    }

    if (!tid) return;
    const { data: t } = await supabase.from("tenants").select("name, primary_color").eq("id", tid).single();
    if (t) {
      setTenantName(t.name || "CentroYB");
      setTenantColor(t.primary_color || "#4F46E5");
      _tenantCache = { name: t.name || "CentroYB", color: t.primary_color || "#4F46E5", loadedAt: Date.now() };
    }
  }, [profile?.tenant_id, profile?.role, user?.id]);

  const role = (profile?.role as UserRole) ?? null;
  const tenantInitials = tenantName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "YB";

  const value: SessionContextValue = {
    user,
    profile,
    tenantId: profile?.tenant_id ?? null,
    tenantName,
    tenantColor,
    tenantInitials,
    role,
    loading,
    signOut,
    refreshTenant,
    isAdmin: role === "super_admin" || role === "director" || role === "admin",
    isTherapist: role === "terapeuta" || (role as string) === "fisioterapeuta",
    isParent: role === "padre",
    isCoordinator: role === "coordinador",
  };

  // Block rendering of children until session resolves.
  // This prevents pages from fetching data with null tenantId.
  if (loading) {
    return (
      <SessionContext.Provider value={value}>
        <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="h-10 w-10 rounded-[14px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 animate-pulse">
              YB
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" />
            </div>
          </motion.div>
        </div>
      </SessionContext.Provider>
    );
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Hook to access the current session.
 * Replaces: useAuth(), useParentAuth(), useTenantId()
 */
export function useSession() {
  return useContext(SessionContext);
}
