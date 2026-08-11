"use client";

import { use } from "react";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/constants";

interface TherapistProfile {
  id: string; first_name: string; last_name: string;
  phone: string | null; email: string | null; active: boolean; role: string;
}

interface TherapistData {
  id: string; specialty: string | null; license_number: string | null;
  certifications: string[] | null; therapeutic_approach: string[] | null;
  max_patients: number | null; active: boolean; tenant_id?: string;
  profiles: TherapistProfile | null;
}

interface PatientData {
  id: string; first_name: string; last_name: string; status: string; active: boolean | null;
}

interface AvailabilitySlot {
  id: string; day_of_week: number; start_time: string; end_time: string;
}

const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const dayShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const approachLabels: Record<string, string> = {
  TCC: "Terapia Cognitivo-Conductual", EMDR: "EMDR", sistemica: "Terapia Sistémica",
  psicoanalitica: "Psicoanalítica", humanista: "Humanista", gestalt: "Gestalt",
  integrativa: "Integrativa", mindfulness: "Mindfulness", arte: "Terapia de Arte",
  juego: "Terapia de Juego", familia: "Terapia Familiar", pareja: "Terapia de Pareja",
};

export default function TherapistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [therapist, setTherapist] = useState<TherapistData | null>(null);
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "patients" | "schedule">("info");

  // Availability form
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });

  // Edit form
  const [form, setForm] = useState({ role: "terapeuta", specialty: "", license_number: "", max_patients: 20, phone: "", therapeutic_approach: [] as string[], certifications: [] as string[] });
  const [approachInput, setApproachInput] = useState("");
  const [customApproachText, setCustomApproachText] = useState("");
  const [certInput, setCertInput] = useState("");

  // Handover state
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [activeTherapists, setActiveTherapists] = useState<{ id: string; name: string }[]>([]);
  const [selectedSuccessor, setSelectedSuccessor] = useState("");
  const [deactivateOld, setDeactivateOld] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [futureApptsCount, setFutureApptsCount] = useState(0);

  const supabase = createClient();
  const { tenantId } = useSession();
  const toast = useToast();
  const router = useRouter();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [therapistRes, profileRes, patientsRes, availabilityRes, apptsCountRes, activeTherapistsRes] = await Promise.all([
      supabase.from("therapists").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").eq("id", id),
      supabase.from("patients").select("*").eq("tenant_id", tenantId || "00000000-0000-0000-0000-000000000001").or(`therapist_id.eq.${id},secondary_therapist_ids.cs.{"${id}"}`).eq("active", true),
      supabase.from("therapist_availability").select("*").eq("therapist_id", id).order("day_of_week"),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("therapist_id", id).gte("appointment_date", new Date().toISOString().split("T")[0]),
      supabase.from("profiles").select("id, first_name, last_name").eq("tenant_id", tenantId || "00000000-0000-0000-0000-000000000001").in("role", ["terapeuta", "fisioterapeuta", "coordinador"]).eq("active", true).neq("id", id)
    ]);

    if (!therapistRes.data) {
      setLoading(false);
      return;
    }

    const tData = therapistRes.data;
    const profile = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;

    const combined = {
      ...tData,
      profiles: profile || null,
    };

    setTherapist(combined as unknown as TherapistData);
    setForm({
      role: profile?.role || "terapeuta",
      specialty: tData.specialty || "",
      license_number: tData.license_number || "",
      max_patients: tData.max_patients || 20,
      phone: profile?.phone || "",
      therapeutic_approach: tData.therapeutic_approach || [],
      certifications: (tData.certifications as string[]) || [],
    });

    if (patientsRes.data) setPatients(patientsRes.data as PatientData[]);
    if (availabilityRes.data) setAvailability(availabilityRes.data as AvailabilitySlot[]);
    if (apptsCountRes.count !== undefined) setFutureApptsCount(apptsCountRes.count || 0);
    if (activeTherapistsRes.data) {
      setActiveTherapists(
        activeTherapistsRes.data.map((p: any) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
        }))
      );
    }

    setLoading(false);
  }, [id, supabase, tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSave() {
    setSaving(true); setError(null);
    const { error: err1 } = await supabase.from("therapists").update({
      specialty: form.specialty || null,
      license_number: form.license_number || null,
      max_patients: form.max_patients,
      therapeutic_approach: form.therapeutic_approach.length > 0 ? form.therapeutic_approach : null,
      certifications: form.certifications.length > 0 ? form.certifications : null,
    }).eq("id", id);

    if (err1) { setError(err1.message); setSaving(false); return; }

    const { error: err2 } = await supabase.from("profiles").update({ 
      phone: form.phone || null,
      role: form.role || "terapeuta"
    }).eq("id", id);
    if (err2) { setError(err2.message); setSaving(false); return; }

    setEditing(false); setSaving(false); loadData();
  }

  async function handleAddAvailability(e: React.FormEvent) {
    e.preventDefault();
    const { error: err } = await supabase.from("therapist_availability").insert({
      therapist_id: id,
      tenant_id: tenantId || "00000000-0000-0000-0000-000000000001",
      day_of_week: newSlot.day_of_week,
      start_time: newSlot.start_time,
      end_time: newSlot.end_time,
    });
    if (err) { toast.addToast("Error: " + err.message, "error"); return; }
    setNewSlot({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });
    loadData();
  }

  async function handleRemoveAvailability(slotId: string) {
    const { error: err } = await supabase.from("therapist_availability").delete().eq("id", slotId);
    if (err) { toast.addToast("Error: " + err.message, "error"); return; }
    loadData();
  }

  async function handleToggleActive() {
    if (!therapist) return;
    const newActive = !therapist.active;
    await supabase.from("therapists").update({ active: newActive }).eq("id", id);
    await supabase.from("profiles").update({ active: newActive }).eq("id", id);
    loadData();
  }

  async function handleHandover() {
    if (confirmText !== "TRANSFERIR") {
      toast.addToast("Por favor escribe TRANSFERIR para confirmar", "error");
      return;
    }
    if (!selectedSuccessor) {
      toast.addToast("Selecciona el terapeuta de destino", "error");
      return;
    }

    setHandoverLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];

      // 1. Reasignar pacientes principales
      const { error: patientErr } = await supabase
        .from("patients")
        .update({ therapist_id: selectedSuccessor })
        .eq("therapist_id", id);
      
      if (patientErr) throw new Error("Error al transferir pacientes principales: " + patientErr.message);

      // 2. Remover de terapeutas secundarios
      const { data: secPatients, error: secFetchErr } = await supabase
        .from("patients")
        .select("id, secondary_therapist_ids")
        .contains("secondary_therapist_ids", [id]);

      if (secFetchErr) throw new Error("Error al buscar terapeutas secundarios: " + secFetchErr.message);

      if (secPatients && secPatients.length > 0) {
        for (const p of secPatients) {
          const updated = (p.secondary_therapist_ids || []).filter((x: string) => x !== id);
          const { error: secUpdateErr } = await supabase
            .from("patients")
            .update({ secondary_therapist_ids: updated })
            .eq("id", p.id);
          if (secUpdateErr) throw new Error(`Error al actualizar terapeuta secundario para paciente ${p.id}: ${secUpdateErr.message}`);
        }
      }

      // 3. Reasignar citas futuras (de hoy en adelante) en estado programada, confirmada, reprogramada
      const { data: apptsToUpdate, error: apptsFetchErr } = await supabase
        .from("appointments")
        .select("id")
        .eq("therapist_id", id)
        .gte("date", todayStr)
        .in("status", ["programada", "confirmada", "reprogramada"]);

      if (apptsFetchErr) throw new Error("Error al buscar citas futuras: " + apptsFetchErr.message);

      if (apptsToUpdate && apptsToUpdate.length > 0) {
        const { error: apptsUpdateErr } = await supabase
          .from("appointments")
          .update({ therapist_id: selectedSuccessor })
          .in("id", apptsToUpdate.map((a: { id: string }) => a.id));
        if (apptsUpdateErr) throw new Error("Error al transferir citas: " + apptsUpdateErr.message);
      }

      // 4. Desactivar terapeuta anterior (si aplica)
      if (deactivateOld) {
        const { error: therapistsErr } = await supabase
          .from("therapists")
          .update({ active: false })
          .eq("id", id);

        if (therapistsErr) throw new Error("Error al desactivar en tabla therapists: " + therapistsErr.message);

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch("/api/admin/update-user", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              id: id,
              active: false
            })
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error("Error al desactivar cuenta de usuario: " + (errData.error || "Error desconocido"));
          }
        }
      }

      toast.addToast("Traspaso de personal completado con éxito", "success");
      setShowHandoverModal(false);
      setConfirmText("");
      setSelectedSuccessor("");
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.addToast(err.message || "Ocurrió un error durante la transferencia", "error");
    } finally {
      setHandoverLoading(false);
    }
  }

  const handleAddApproach = () => {
    if (approachInput === "custom_option") {
      if (customApproachText.trim() && !form.therapeutic_approach.includes(customApproachText.trim())) {
        setForm({ ...form, therapeutic_approach: [...form.therapeutic_approach, customApproachText.trim()] });
        setCustomApproachText("");
        setApproachInput("");
      }
    } else if (approachInput && !form.therapeutic_approach.includes(approachInput)) {
      setForm({ ...form, therapeutic_approach: [...form.therapeutic_approach, approachInput] });
      setApproachInput("");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  if (!therapist) return <div className="p-8 text-center text-gray-500">Terapeuta no encontrado</div>;

  const p = therapist.profiles;
  const firstName = p?.first_name || "";
  const lastName = p?.last_name || "";
  const name = p ? `${firstName} ${lastName}`.trim() || "Terapeuta" : "Terapeuta";
  const initials = p ? `${firstName[0] || ""}${lastName[0] || ""}` : "T";
  const activePatients = patients.filter(pt => pt.active !== false && pt.status === "activo");
  const approaches = (therapist.therapeutic_approach || []).map(a => approachLabels[a] || a);
  const statusConfig: Record<string, { label: string; color: string }> = {
    activo: { label: "Activo", color: "bg-green-50 text-green-700" },
    alta: { label: "Alta", color: "bg-blue-50 text-blue-700" },
    abandonado: { label: "Abandonó", color: "bg-red-50 text-red-700" },
    lista_espera: { label: "En espera", color: "bg-yellow-50 text-yellow-700" },
  };
  const capacityPct = Math.round((activePatients.length / (therapist.max_patients || 20)) * 100);
  const capacityColor = capacityPct >= 90 ? "bg-red-500" : capacityPct >= 70 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── HERO CARD ── */}
      <div className="bg-white border-b px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-5xl mx-auto">
          <a href="/therapists" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Volver a terapeutas
          </a>

          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
              {initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-gray-900">{name}</h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${therapist.active ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                  {therapist.active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <p className="text-sm text-gray-500 mb-2">
                {therapist.specialty && <span>{therapist.specialty}</span>}
                {therapist.license_number && <span> · Lic. {therapist.license_number}</span>}
                {p?.email && <span> · {p.email}</span>}
              </p>

              {/* Capacity bar */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 max-w-[200px] h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${capacityColor}`} style={{ width: `${Math.min(capacityPct, 100)}%` }} />
                </div>
                <span className="text-xs text-gray-500 font-medium">{activePatients.length}/{therapist.max_patients || 20} pacientes</span>
              </div>

              {/* Approaches */}
              {approaches.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {approaches.map(a => <span key={a} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">{a}</span>)}
                </div>
              )}
            </div>

            {/* Mini KPIs */}
            <div className="grid grid-cols-3 gap-3 flex-shrink-0">
              <button onClick={() => setActiveTab("patients")} className="flex flex-col items-center p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100">
                <span className="text-lg font-bold text-blue-700">{patients.length}</span>
                <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Pacientes</span>
              </button>
              <button onClick={() => setActiveTab("schedule")} className="flex flex-col items-center p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-100">
                <span className="text-lg font-bold text-emerald-700">{availability.length}</span>
                <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Horarios</span>
              </button>
              <div className={`flex flex-col items-center p-2.5 rounded-xl border ${capacityPct >= 90 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100"}`}>
                <span className={`text-lg font-bold ${capacityPct >= 90 ? "text-red-600" : "text-gray-600"}`}>{capacityPct}%</span>
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Carga</span>
              </div>
            </div>
          </div>

          {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* ── ACCIONES RÁPIDAS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button onClick={() => { setActiveTab("info"); setEditing(true); }} className="flex items-center gap-3 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-2xl transition-colors text-left">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0"><svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
            <div><p className="text-sm font-semibold text-indigo-900">Editar Perfil</p><p className="text-[10px] text-indigo-600/70">Información profesional</p></div>
          </button>
          <button onClick={() => setActiveTab("schedule")} className="flex items-center gap-3 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-2xl transition-colors text-left">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0"><svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            <div><p className="text-sm font-semibold text-emerald-900">Gestionar Horario</p><p className="text-[10px] text-emerald-600/70">Configurar disponibilidad</p></div>
          </button>
          <button onClick={handleToggleActive} className={`flex items-center gap-3 px-4 py-3 border rounded-2xl transition-colors text-left ${therapist.active ? "bg-orange-50 hover:bg-orange-100 border-orange-100" : "bg-green-50 hover:bg-green-100 border-green-100"}`}>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${therapist.active ? "bg-orange-500" : "bg-green-600"}`}><svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={therapist.active ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M5 13l4 4L19 7"} /></svg></div>
            <div><p className={`text-sm font-semibold ${therapist.active ? "text-orange-900" : "text-green-900"}`}>{therapist.active ? "Desactivar" : "Activar"}</p><p className={`text-[10px] ${therapist.active ? "text-orange-600/70" : "text-green-600/70"}`}>{therapist.active ? "Inhabilitar terapeuta" : "Habilitar terapeuta"}</p></div>
          </button>
          <button onClick={() => setShowHandoverModal(true)} className="flex items-center gap-3 px-4 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-2xl transition-colors text-left">
            <div className="h-9 w-9 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0"><svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></div>
            <div><p className="text-sm font-semibold text-purple-900">Cambio Personal</p><p className="text-[10px] text-purple-600/70">Reasignar pacientes y citas</p></div>
          </button>
        </div>

        {/* ── TABS ── */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          {([
            { key: "info" as const, label: "Datos Profesionales", icon: "📋" },
            { key: "patients" as const, label: `Pacientes (${patients.length})`, icon: "👥" },
            { key: "schedule" as const, label: `Horario (${availability.length})`, icon: "🕐" },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* INFO TAB */}
        {activeTab === "info" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Información Profesional</h2>
                <button onClick={() => setEditing(!editing)} className="text-sm text-indigo-600 hover:text-indigo-700">{editing ? "Cancelar" : "Editar"}</button>
              </div>
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rol / Especialidad Principal</label>
                    <select 
                      value={form.role} 
                      onChange={e => setForm({...form, role: e.target.value})} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
                    >
                      <option value="terapeuta">👩‍⚕️ Terapeuta (Pedagógico / Neuropsicología)</option>
                      <option value="fisioterapeuta">🏃 Fisioterapeuta (Terapia Física / Rehabilitación)</option>
                      <option value="coordinador">📋 Coordinador/a Clínico</option>
                      <option value="director">👔 Director/a de Sede</option>
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Especialidad Detallada</label><input value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Licencia</label><input value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Máx. pacientes</label><input type="number" min={1} max={100} value={form.max_patients} onChange={e => setForm({...form, max_patients: parseInt(e.target.value) || 20})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Enfoque terapéutico</label>
                    <div className="flex gap-2 mb-2">
                      <select value={approachInput} onChange={e => { setApproachInput(e.target.value); if (e.target.value !== "custom_option") setCustomApproachText(""); }} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                        <option value="">Seleccionar...</option>
                        {Object.entries(approachLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        <option value="custom_option">Otro (escribir propio)...</option>
                      </select>
                      <button type="button" onClick={handleAddApproach} className="px-3 py-2 text-sm bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100">+</button>
                    </div>
                    {approachInput === "custom_option" && (
                      <div className="mb-3">
                        <input 
                          type="text" 
                          value={customApproachText} 
                          onChange={e => setCustomApproachText(e.target.value)} 
                          placeholder="Escribe tu propio enfoque..." 
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                        />
                      </div>
                    )}
                    {form.therapeutic_approach.length > 0 && (
                      <div className="flex flex-wrap gap-2">{form.therapeutic_approach.map(a => (
                        <span key={a} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">{approachLabels[a] || a}<button type="button" onClick={() => setForm({...form, therapeutic_approach: form.therapeutic_approach.filter(x => x !== a)})} className="text-indigo-400 hover:text-indigo-700">✕</button></span>
                      ))}</div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Certificaciones</label>
                    <div className="flex gap-2 mb-2">
                      <input value={certInput} onChange={e => setCertInput(e.target.value)} placeholder="Ej: Certificado en TCC, Diplomado en EMDR..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (certInput.trim() && !form.certifications.includes(certInput.trim())) { setForm({...form, certifications: [...form.certifications, certInput.trim()]}); setCertInput(""); } } }} />
                      <button type="button" onClick={() => { if (certInput.trim() && !form.certifications.includes(certInput.trim())) { setForm({...form, certifications: [...form.certifications, certInput.trim()]}); setCertInput(""); } }} className="px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100">+</button>
                    </div>
                    {form.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-2">{form.certifications.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">{c}<button type="button" onClick={() => setForm({...form, certifications: form.certifications.filter((_, idx) => idx !== i)})} className="text-green-400 hover:text-green-700">✕</button></span>
                      ))}</div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Presiona Enter o + para agregar cada certificación</p>
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                    <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><dt className="text-xs font-medium text-gray-500 uppercase">Rol Sistema</dt><dd className="mt-1 text-sm font-bold text-slate-900">{(p?.role && ROLE_LABELS[p.role]) || p?.role || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-gray-500 uppercase">Especialidad</dt><dd className="mt-1 text-sm text-gray-900">{therapist.specialty || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-gray-500 uppercase">Licencia</dt><dd className="mt-1 text-sm text-gray-900">{therapist.license_number || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-gray-500 uppercase">Email</dt><dd className="mt-1 text-sm text-gray-900">{p?.email || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-gray-500 uppercase">Teléfono</dt><dd className="mt-1 text-sm text-gray-900">{p?.phone || "—"}</dd></div>
                  <div><dt className="text-xs font-medium text-gray-500 uppercase">Capacidad</dt><dd className="mt-1 text-sm text-gray-900">{activePatients.length} / {therapist.max_patients || 20} pacientes</dd></div>
                  <div><dt className="text-xs font-medium text-gray-500 uppercase">Certificaciones</dt><dd className="mt-1 text-sm text-gray-900">
                    {therapist.certifications && therapist.certifications.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">{(therapist.certifications as string[]).map((c, i) => (
                        <span key={i} className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">{c}</span>
                      ))}</div>
                    ) : "—"}</dd></div>
                </dl>
              )}
              {approaches.length > 0 && !editing && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <dt className="text-xs font-medium text-gray-500 uppercase mb-2">Enfoque terapéutico</dt>
                  <div className="flex flex-wrap gap-2">{approaches.map(a => <span key={a} className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">{a}</span>)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PATIENTS TAB */}
        {activeTab === "patients" && (
          <div className="space-y-4">
            {patients.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-3">👥</div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Sin pacientes asignados</h3>
              </div>
            ) : patients.map(pt => {
              const s = statusConfig[pt.status] || { label: pt.status, color: "bg-gray-50 text-gray-700" };
              return (
                <Link key={pt.id} href={`/patients/${pt.id}`} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm">
                  <div>
                    <p className="font-medium text-gray-900">{pt.first_name} {pt.last_name}</p>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    {pt.active === false && <span className="ml-2 text-xs text-gray-400">(Inactivo)</span>}
                  </div>
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              );
            })}
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === "schedule" && (
          <div className="space-y-6">
            {/* Add availability */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Agregar Horario</h2>
              <form onSubmit={handleAddAvailability} className="flex items-end gap-3 flex-wrap">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Día</label><select value={newSlot.day_of_week} onChange={e => setNewSlot({...newSlot, day_of_week: parseInt(e.target.value)})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">{dayShort.map((d, i) => <option key={i} value={i}>{dayNames[i]}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Desde</label><input type="time" value={newSlot.start_time} onChange={e => setNewSlot({...newSlot, start_time: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label><input type="time" value={newSlot.end_time} onChange={e => setNewSlot({...newSlot, end_time: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Agregar</button>
              </form>
            </div>

            {/* Current availability */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Horario Semanal</h2>
              {availability.length === 0 ? (
                <p className="text-sm text-gray-500">Sin horario configurado</p>
              ) : (
                <div className="space-y-3">
                  {dayShort.map((day, i) => {
                    const slots = availability.filter(a => a.day_of_week === i);
                    if (slots.length === 0) return null;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-16 text-sm font-medium text-gray-700">{day}</span>
                        <div className="flex flex-wrap gap-2">
                          {slots.map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {s.start_time} - {s.end_time}
                              <button onClick={() => handleRemoveAvailability(s.id)} className="text-indigo-400 hover:text-red-600 ml-1">✕</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL CAMBIO DE PERSONAL ── */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>🔄</span> Cambio de Personal
              </h3>
              <button 
                onClick={() => { setShowHandoverModal(false); setConfirmText(""); setSelectedSuccessor(""); }} 
                className="text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-100 rounded-full p-1.5 transition-colors border"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
                <p className="font-semibold">⚠️ Información importante:</p>
                <p>Estás iniciando el proceso de entrega y traslado de pacientes asignados a <strong>{name}</strong>.</p>
                <ul className="list-disc list-inside space-y-1 mt-1 font-medium">
                  <li>Se reasignarán <strong>{patients.length}</strong> pacientes principales.</li>
                  <li>Se transferirán <strong>{futureApptsCount}</strong> citas futuras (de hoy en adelante).</li>
                  <li>Se le removerá de cualquier asignación como terapeuta secundario.</li>
                  <li>El historial clínico (notas y evaluaciones) permanecerá intacto firmado por su autor original, pero el nuevo terapeuta podrá leerlo sin problemas al ser parte del mismo centro.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Seleccionar Terapeuta Receptor (Destino) *
                  </label>
                  <select 
                    value={selectedSuccessor} 
                    onChange={e => setSelectedSuccessor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar terapeuta...</option>
                    {activeTherapists.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {activeTherapists.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No hay otros terapeutas activos registrados en este centro.</p>
                  )}
                </div>

                <div className="flex items-start gap-2.5">
                  <input 
                    type="checkbox" 
                    id="deactivateOld"
                    checked={deactivateOld} 
                    onChange={e => setDeactivateOld(e.target.checked)}
                    className="h-4.5 w-4.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-0.5"
                  />
                  <label htmlFor="deactivateOld" className="text-sm font-medium text-gray-700">
                    Desactivar la cuenta de <strong>{name}</strong> al finalizar la transferencia (impedirá que vuelva a iniciar sesión).
                  </label>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Para confirmar, escribe <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-red-600 font-bold">TRANSFERIR</span> *
                  </label>
                  <input 
                    type="text" 
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="Escribe TRANSFERIR"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => { setShowHandoverModal(false); setConfirmText(""); setSelectedSuccessor(""); }} 
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                disabled={handoverLoading}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleHandover}
                className="px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none tracking-wide"
                disabled={handoverLoading || confirmText !== "TRANSFERIR" || !selectedSuccessor}
              >
                {handoverLoading ? "Transfiriendo..." : "Confirmar Transferencia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}