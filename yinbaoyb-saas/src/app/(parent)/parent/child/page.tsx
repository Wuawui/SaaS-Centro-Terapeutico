"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/ui/UserAvatar";

export default function ParentChildPage() {
  const supabase = createClient();
  const [child, setChild] = useState<any>(null);
  const [therapist, setTherapist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error: rpcErr } = await supabase.rpc("get_parent_children", { p_parent_id: user.id });
      if (rpcErr) { setError(rpcErr.message); setLoading(false); return; }

      if (data && data.length > 0) {
        setChild({
          ...data[0],
          avatar_url: data[0].emergency_contact || data[0].avatar_url || null,
        });
        if (data[0].therapist_id) {
          const { data: tData } = await supabase.rpc("get_profile_by_id", { profile_id: data[0].therapist_id });
          const tProfile = Array.isArray(tData) ? tData[0] : tData;
          setTherapist(tProfile || null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Error cargando datos");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin h-6 w-6 border-4 border-emerald-600 border-t-transparent rounded-full" /></div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">Error: {error}</div>;
  if (!child) return <div className="text-center py-8"><p className="text-gray-500">No tienes pacientes vinculados</p></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">👦 Perfil de {child.first_name}</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            src={child.avatar_url}
            name={`${child.first_name} ${child.last_name}`}
            size="xl"
            fallbackGradient="from-emerald-500 to-teal-600"
          />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{child.first_name} {child.last_name}</h2>
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${child.status === "activo" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
              {child.status === "activo" ? "Activo" : child.status === "lista_espera" ? "En espera" : child.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          {child.primary_diagnosis && (
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Diagnóstico</dt><dd className="mt-0.5 text-sm text-gray-900">{child.primary_diagnosis}</dd></div>
          )}
          {child.birth_date && (
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Fecha de nacimiento</dt><dd className="mt-0.5 text-sm text-gray-900">{new Date(child.birth_date).toLocaleDateString("es-EC")}</dd></div>
          )}
          {therapist && (
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Terapeuta asignado</dt><dd className="mt-0.5 text-sm text-gray-900">{therapist.first_name} {therapist.last_name}</dd></div>
          )}
          {child.emergency_contact && (
            <div><dt className="text-xs font-medium text-gray-500 uppercase">Contacto de emergencia</dt><dd className="mt-0.5 text-sm text-gray-900">{child.emergency_contact}</dd></div>
          )}
        </div>
      </div>
    </div>
  );
}