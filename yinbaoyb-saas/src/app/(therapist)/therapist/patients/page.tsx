"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { PatientCard } from "@/features/patients/components/PatientCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PATIENT_STATUS_CONFIG } from "@/lib/constants";
import { Search } from "lucide-react";

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

// Memoria caché SWR para pacientes del terapeuta (0ms)
let _thPatientsCache: { data: Patient[]; userId: string; timestamp: number } | null = null;

export default function TherapistPatientsPage() {
  const supabase = createClient();
  const { user, tenantId } = useSession();
  const [patients, setPatients] = useState<Patient[]>(() => {
    if (_thPatientsCache && (!user || _thPatientsCache.userId === user.id)) {
      return _thPatientsCache.data;
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    return !(_thPatientsCache && (!user || _thPatientsCache.userId === user.id));
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const loadPatients = useCallback(async () => {
    if (!tenantId || !user) {
      setLoading(false);
      return;
    }
    if (!patients || patients.length === 0) {
      setLoading(true);
    }

    let query = supabase.from("patients").select("id, first_name, last_name, document_number, phone, status, reason_for_consultation, active, emergency_contact, birth_date")
      .eq("tenant_id", tenantId)
      .or(`therapist_id.eq.${user.id},secondary_therapist_ids.cs.{"${user.id}"}`)
      .eq("active", true)
      .order("first_name", { ascending: true });
    if (filter !== "all") query = query.eq("status", filter);

    const { data } = await query;
    const mapped = (data || []).map((p: any) => ({
      ...p,
      avatar_url: p.emergency_contact || null,
    }));
    setPatients(mapped as Patient[]);
    _thPatientsCache = { data: mapped as Patient[], userId: user.id, timestamp: Date.now() };
    setLoading(false);
  }, [filter, tenantId, user?.id, supabase]);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const filtered = patients.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.first_name.toLowerCase().includes(q) || p.last_name.toLowerCase().includes(q) || (p.reason_for_consultation || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Pacientes</h1>
        <p className="text-sm text-gray-500 mt-1">{patients.length} paciente{patients.length !== 1 ? "s" : ""} asignado{patients.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">👁️ <strong>Solo lectura.</strong> Aquí puedes ver la información de tus pacientes. Para registrar la evolución de una sesión, selecciona un paciente y ve a <strong>Notas Clínicas</strong>.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
          </div>
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex bg-gray-100 rounded-lg p-0.5 min-w-max">
              {[
                { key: "all", label: "Todos" },
                { key: "activo", label: "Activos" },
                { key: "lista_espera", label: "En espera" },
                { key: "alta", label: "Alta" },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${filter === f.key ? "bg-white text-teal-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <PageLoading text="Cargando pacientes..." color="text-teal-600" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="👥" title={search ? "No se encontraron pacientes" : "No tienes pacientes asignados"} />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <PatientCard
              key={p.id}
              patient={p}
              href={`/therapist/patients/${p.id}`}
              accentColor="bg-teal-100 text-teal-700"
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