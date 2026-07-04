"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { PatientCard } from "@/features/patients/components/PatientCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Search, Activity } from "lucide-react";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string | null;
  status: string;
  reason_for_consultation: string | null;
  active: boolean;
}

export default function PhysicalTherapyDashboardPage() {
  const supabase = createClient();
  const { user, tenantId } = useSession();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const loadPatients = useCallback(async () => {
    if (!tenantId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let query = supabase.from("patients").select("*")
      .eq("tenant_id", tenantId)
      .or(`therapist_id.eq.${user.id},secondary_therapist_ids.cs.{"${user.id}"}`)
      .eq("active", true)
      .order("first_name", { ascending: true });
      
    if (filter !== "all") query = query.eq("status", filter);

    const { data } = await query;
    setPatients((data || []) as Patient[]);
    setLoading(false);
  }, [filter, tenantId, user?.id]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const filtered = patients.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.first_name.toLowerCase().includes(q) || p.last_name.toLowerCase().includes(q) || (p.reason_for_consultation || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-outfit">Portal de Terapia Física</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de historias clínicas de rehabilitación y evolución diaria</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <p className="text-sm text-indigo-850">
          💼 <strong>Módulo de Fisioterapia.</strong> Selecciona un paciente para gestionar su <strong>historial clínico completo</strong>, completar las pruebas físicas (Marcha, Daniels, ASIA, Glasgow) y registrar el seguimiento diario de sus sesiones de rehabilitación.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-450" />
            <input 
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Buscar paciente asignado..." 
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
            />
          </div>
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex bg-gray-100 rounded-lg p-0.5 min-w-max w-fit">
              {[
                { key: "all", label: "Todos" },
                { key: "activo", label: "Activos" },
                { key: "lista_espera", label: "En espera" },
                { key: "alta", label: "Alta" },
              ].map(f => (
                <button 
                  key={f.key} 
                  onClick={() => setFilter(f.key)} 
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${filter === f.key ? "bg-white text-indigo-650 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <PageLoading text="Cargando pacientes..." color="text-indigo-650" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="👥" title={search ? "No se encontraron pacientes" : "No tienes pacientes asignados"} />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <PatientCard
              key={p.id}
              patient={p}
              href={`/therapist/physical-therapy/patients/${p.id}`}
              accentColor="bg-indigo-100 text-indigo-700 border-indigo-250/20"
              showReason
              showAge
              showPhone={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
