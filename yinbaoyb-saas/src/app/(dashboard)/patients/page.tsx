"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { PATIENT_STATUS_CONFIG } from "@/lib/constants";
import { Activity, Puzzle, Users, Plus, Search } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  primary_diagnosis: string | null;
  primary_diagnosis_desc: string | null;
  reason_for_consultation: string | null;
  therapist_id: string | null;
  status: string;
  active: boolean | null;
  created_at: string;
  therapist_role?: string;
}

const statusConfig = PATIENT_STATUS_CONFIG;

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "terapia_fisica" | "terapia_integral">("all");
  const [showInactive, setShowInactive] = useState(false);
  const toast = useToast();
  const supabase = createClient();
  const { tenantId } = useSession();

  useEffect(() => {
    fetchPatients();
  }, [tenantId]);

  async function fetchPatients() {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const [patRes, profRes, thRes] = await Promise.all([
        supabase
          .from("patients")
          .select("id, first_name, last_name, emergency_contact, document_number, phone, email, status, primary_diagnosis, primary_diagnosis_desc, reason_for_consultation, therapist_id, active, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, role")
          .eq("tenant_id", tenantId),
        supabase
          .from("therapists")
          .select("id, specialty")
      ]);

      if (patRes.error) {
        setErrorMsg(`Error: ${patRes.error.message}`);
      } else {
        const profMap = new Map<string, string>((profRes.data || []).map((p: any) => [p.id, p.role]));
        const thMap = new Map<string, string>((thRes.data || []).map((t: any) => [t.id, String(t.specialty || "")]));

        const enriched = (patRes.data || []).map((p: any) => {
          const pRole = p.therapist_id ? profMap.get(p.therapist_id) : undefined;
          const tSpec = p.therapist_id ? thMap.get(p.therapist_id) : undefined;
          const isPhysioTherapist = pRole === "fisioterapeuta" || 
            (typeof tSpec === "string" && (tSpec.toLowerCase().includes("fisica") || tSpec.toLowerCase().includes("fisio") || tSpec.toLowerCase().includes("rehabilitacion")));
          
          return {
            ...p,
            avatar_url: p.emergency_contact || null,
            therapist_role: isPhysioTherapist ? "fisioterapeuta" : pRole
          };
        });
        setPatients(enriched);
      }
    } catch (err: any) {
      console.error("Error fetching patients:", err);
      setErrorMsg(`Error de conexión: no se pudieron cargar los datos de pacientes.`);
    } finally {
      setLoading(false);
    }
  }

  // Helper para determinar la categoría del paciente
  const getPatientCategory = (p: Patient): "terapia_fisica" | "terapia_integral" => {
    if (p.therapist_role === "fisioterapeuta") return "terapia_fisica";
    const text = `${p.primary_diagnosis_desc || ""} ${p.primary_diagnosis || ""} ${p.reason_for_consultation || ""}`.toLowerCase();
    if (
      text.includes("física") || 
      text.includes("fisica") || 
      text.includes("rehabilitación") || 
      text.includes("rehabilitacion") || 
      text.includes("fisioterapia") || 
      text.includes("lumbago") || 
      text.includes("espasmo") || 
      text.includes("lesión") || 
      text.includes("lesion") || 
      text.includes("fractura") || 
      text.includes("dolor") || 
      text.includes("daniels") || 
      text.includes("goniometría") || 
      text.includes("marcha")
    ) {
      return "terapia_fisica";
    }
    return "terapia_integral";
  };

  const activePatients = patients.filter(p => p.active !== false);
  const inactivePatients = patients.filter(p => p.active === false);

  const filterList = (list: Patient[]) =>
    list.filter(p => {
      // 1. Filtro por categoría (Terapia Física vs Terapia Integral)
      const category = getPatientCategory(p);
      if (categoryFilter !== "all" && category !== categoryFilter) {
        return false;
      }
      // 2. Filtro de búsqueda por texto
      if (search) {
        const q = search.toLowerCase();
        return (
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          (p.document_number || "").toLowerCase().includes(q) ||
          (p.primary_diagnosis_desc || p.primary_diagnosis || "").toLowerCase().includes(q) ||
          (p.reason_for_consultation || "").toLowerCase().includes(q)
        );
      }
      return true;
    });

  const physicalCount = activePatients.filter(p => getPatientCategory(p) === "terapia_fisica").length;
  const integralCount = activePatients.filter(p => getPatientCategory(p) === "terapia_integral").length;

  if (loading) return <PageLoading text="Cargando catálogo de pacientes..." />;

  const PatientCard = ({ patient, inactive }: { patient: Patient; inactive?: boolean }) => {
    const status = statusConfig[patient.status] || { label: patient.status, color: "bg-gray-50 text-gray-700" };
    const category = getPatientCategory(patient);
    const initials = `${patient.first_name?.[0] || ""}${patient.last_name?.[0] || ""}`;
    const dx = patient.primary_diagnosis_desc || patient.primary_diagnosis || patient.reason_for_consultation;

    return (
      <Link
        href={`/patients/${patient.id}`}
        className={`block bg-white rounded-2xl border p-4 transition-all duration-200 hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 group ${
          inactive ? "border-gray-200 opacity-70" : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-4">
          <UserAvatar
            src={patient.avatar_url}
            name={`${patient.first_name} ${patient.last_name}`}
            size="md"
            fallbackGradient={
              inactive
                ? "from-gray-400 to-gray-500"
                : category === "terapia_fisica"
                ? "from-teal-500 to-emerald-600"
                : "from-indigo-500 to-purple-600"
            }
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors font-outfit">
                {patient.first_name} {patient.last_name}
              </h3>
              
              {/* Badge de Categoría Principal */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-outfit ${
                category === "terapia_fisica"
                  ? "bg-teal-50 text-teal-700 border-teal-200"
                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
              }`}>
                {category === "terapia_fisica" ? (
                  <>🏃 Terapia Física</>
                ) : (
                  <>🧩 Terapia Integral</>
                )}
              </span>

              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${status.color}`}>
                {status.label}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              {patient.phone && (
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {patient.phone}
                </span>
              )}
              {dx && (
                <span className="flex items-center gap-1 truncate font-medium text-slate-600">
                  <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span className="truncate">{dx}</span>
                </span>
              )}
            </div>
          </div>

          <svg className="h-5 w-5 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-outfit">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activePatients.length} activo{activePatients.length !== 1 ? "s" : ""} · {physicalCount} Terapia Física · {integralCount} Terapia Integral
          </p>
        </div>
        <Link href="/patients/new" className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors inline-flex items-center gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Nuevo Paciente
        </Link>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm font-medium">Error al cargar pacientes</p>
          <p className="text-red-600 text-xs mt-1">{errorMsg}</p>
          <button onClick={fetchPatients} className="mt-2 text-xs text-red-700 underline font-bold">Reintentar</button>
        </div>
      )}

      {/* PESTAÑAS DE CATEGORÍA DE PACIENTES */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        
        {/* Selector de Categoría (Tabs) */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto gap-1">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              categoryFilter === "all" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4" /> Todos ({activePatients.length})
          </button>

          <button
            onClick={() => setCategoryFilter("terapia_fisica")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              categoryFilter === "terapia_fisica" ? "bg-white text-teal-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="h-4 w-4 text-teal-600" /> 🏃 Terapia Física ({physicalCount})
          </button>

          <button
            onClick={() => setCategoryFilter("terapia_integral")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              categoryFilter === "terapia_integral" ? "bg-white text-purple-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Puzzle className="h-4 w-4 text-purple-600" /> 🧩 Terapia Integral ({integralCount})
          </button>
        </div>

        {/* Buscador general */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por paciente, cédula o diagnóstico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {activePatients.length === 0 && patients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1 font-outfit">No hay pacientes registrados</h3>
          <p className="text-sm text-gray-500 mb-5">Comienza registrando a tu primer paciente de Terapia Física o Terapia Integral</p>
          <Link href="/patients/new" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Registrar Paciente
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filterList(activePatients).map(p => (
            <PatientCard key={p.id} patient={p} />
          ))}
          {filterList(activePatients).length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-xs font-semibold text-gray-500">
                {search 
                  ? `No se encontraron pacientes que coincidan con "${search}"`
                  : `No hay pacientes registrados en la categoría seleccionada.`}
              </p>
            </div>
          )}
        </div>
      )}

      {inactivePatients.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <button onClick={() => setShowInactive(!showInactive)} className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors">
            <svg className={`h-4 w-4 transition-transform ${showInactive ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            {inactivePatients.length} paciente{inactivePatients.length !== 1 ? "s" : ""} inactivo{inactivePatients.length !== 1 ? "s" : ""}
          </button>
          {showInactive && (
            <div className="space-y-3 mt-3">
              {filterList(inactivePatients).map(p => (
                <PatientCard key={p.id} patient={p} inactive />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}