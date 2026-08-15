"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";

// Cache global — datos que se comparten entre páginas con Stale-While-Revalidate
interface AppData {
  therapists: any[];
  patients: any[];
  profile: any;
  tenantId: string | null;
  loadedAt: number | null;
}

const cache: AppData = {
  therapists: [],
  patients: [],
  profile: null,
  tenantId: null,
  loadedAt: null,
};

const CACHE_TTL = 45_000; // 45 segundos

export function useAppData() {
  const [data, setData] = useState<AppData>(cache);
  const [loading, setLoading] = useState(!cache.loadedAt);
  const supabase = createClient();

  const loadAll = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cache.loadedAt && now - cache.loadedAt < CACHE_TTL) {
      setLoading(false);
      setData({ ...cache });
      return cache;
    }

    // Servir caché existente al instante si existe mientras se revalida de fondo
    if (cache.loadedAt) {
      setLoading(false);
      setData({ ...cache });
    } else {
      setLoading(true);
    }

    try {
      // Cargar perfil del usuario primero
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return cache; }

      // Obtener tenant_id desde profile
      const { data: profileData } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      const tenantId = profileData?.tenant_id || null;

      // Ejecutar queries en paralelo (filtrando por tenant_id)
      const [therapistsRes, patientsRes, profileRes] = await Promise.all([
        supabase.from("therapists").select("id, specialty, license_number, certifications, therapeutic_approach, max_patients, active, tenant_id").eq("tenant_id", tenantId).order("active", { ascending: false }),
        supabase.from("patients").select("id, first_name, last_name, status, active, therapist_id, created_at, tenant_id, reason_for_consultation, primary_diagnosis").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.rpc("get_profile_by_id", { profile_id: user.id }),
      ]);

      // Cargar profiles de terapeutas en paralelo
      const therapistIds = (therapistsRes.data || []).map((t: any) => t.id);
      const profilesRes = therapistIds.length > 0
        ? await supabase.rpc("get_therapist_profiles")
        : { data: [] };

      // Combinar therapists con profiles
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const therapistsWithProfiles = (therapistsRes.data || []).map((t: any) => ({
        ...t,
        profiles: profileMap.get(t.id) || null,
      }));

      cache.therapists = therapistsWithProfiles;
      cache.patients = patientsRes.data || [];
      cache.profile = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;
      cache.tenantId = tenantId;
      cache.loadedAt = now;

      setData({ ...cache });
    } catch (err) {
      console.error("Error loading app data:", err);
    }
    setLoading(false);
    return cache;
  }, [supabase]);

  const invalidate = useCallback(() => {
    cache.loadedAt = null;
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    ...data,
    loading,
    reload: () => loadAll(true),
    invalidate,
  };
}