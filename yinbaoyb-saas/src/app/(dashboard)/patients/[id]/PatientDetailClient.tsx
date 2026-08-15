"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ParentLinking from "@/components/clinical/ParentLinking";
import AIEvolutionView from "@/features/clinical/components/AIEvolutionView";
import ClinicalNoteCard from "@/components/clinical/ClinicalNoteCard";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { AvatarUpload } from "@/components/ui/AvatarUpload";

interface TherapistProfile { id: string; first_name: string; last_name: string }
interface Therapist { id: string; profiles: TherapistProfile | null }

interface ScaleResult { id: string; scale_type: string; total_score: number; risk_alert: boolean; completed_at: string }
interface ClinicalNote { id: string; format: string; signed: boolean; created_at: string; subjective?: string; content?: string; profiles?: { first_name: string; last_name: string } | null }
interface Appointment { id: string; type: string; status: string; date: string; start_time: string; end_time: string }

interface Patient {
  id: string; first_name: string; last_name: string; document_number: string | null;
  birth_date: string | null; gender: string | null; phone: string | null; email: string | null;
  address: string | null; emergency_contact_name: string | null; emergency_contact_relation: string | null;
  emergency_contact_phone: string | null; reason_for_consultation: string | null;
  primary_diagnosis: string | null; primary_diagnosis_desc: string | null; current_medication: string | null;
  medical_history: string | null; insurance_provider: string | null; insurance_policy: string | null;
  avatar_url?: string | null;
  status: string; active: boolean | null; therapist_id: string | null; secondary_therapist_ids?: string[]; created_at: string;
}

const statusFlow: Record<string, { label: string; color: string; next: string[] }> = {
  lista_espera: { label: "En lista de espera", color: "bg-yellow-50 text-yellow-700 border-yellow-200", next: ["activo"] },
  activo: { label: "Activo", color: "bg-green-50 text-green-700 border-green-200", next: ["alta", "abandonado"] },
  alta: { label: "Dado de alta", color: "bg-blue-50 text-blue-700 border-blue-200", next: ["activo"] },
  abandonado: { label: "Abandonó", color: "bg-red-50 text-red-700 border-red-200", next: ["activo"] },
};
const nextLabels: Record<string, string> = { activo: "Activar", alta: "Dar de alta", abandonado: "Marcar abandonó" };
const scaleMax: Record<string, number> = { "PHQ-9": 27, "GAD-7": 21, "PCL-5": 80, "BDI-II": 63, "SRS": 40, "ORS": 40 };
const scaleRisk: Record<string, number> = { "PHQ-9": 15, "GAD-7": 15, "PCL-5": 33, "BDI-II": 29, "ORS": 25 };
const aptTypeLabels: Record<string, string> = { individual: "Individual", grupal: "Grupal", taller: "Taller", evaluacion: "Evaluación", supervision: "Supervisión" };
const aptStatusLabels: Record<string, { label: string; color: string }> = {
  programada: { label: "Programada", color: "text-blue-600" }, confirmada: { label: "Confirmada", color: "text-green-600" },
  completada: { label: "Completada", color: "text-gray-600" }, cancelada: { label: "Cancelada", color: "text-red-600" },
  no_asistio: { label: "No asistió", color: "text-orange-600" },
};
const noteLabels: Record<string, string> = { SOAP: "SOAP", BIRP: "BIRP", DAP: "DAP", libre: "Nota libre", progreso: "Nota de progreso" };

export default function PatientDetailClient({ patient }: { patient: Patient }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "escalas" | "notas" | "citas" | "padre" | "evaluaciones" | "informes" | "ai_evolution">("info");
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState(patient.therapist_id || "");
  const [selectedSecondaries, setSelectedSecondaries] = useState<string[]>(patient.secondary_therapist_ids || []);
  const [scaleResults, setScaleResults] = useState<ScaleResult[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statusConfirm, setStatusConfirm] = useState<string | null>(null);
  const [showTherapistSelect, setShowTherapistSelect] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(() => {
    if (patient.medical_history?.startsWith("data:application/pdf")) {
      return patient.medical_history;
    }
    return null;
  });

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      alert("Por favor selecciona un archivo en formato PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo PDF supera el tamaño máximo permitido de 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      setPdfUrl(base64);
      setForm(prev => ({ ...prev, medical_history: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const isEvaluation = (content?: string) => {
    return content?.trim().startsWith('{"type":"evaluacion"') ?? false;
  };

  const isReport = (content?: string) => {
    return content?.trim().startsWith('{"type":"informe"') ?? false;
  };

  const parseEvaluation = (content?: string) => {
    try {
      return content ? JSON.parse(content) : null;
    } catch (e) {
      return null;
    }
  };

  const downloadFile = (fileJsonStr: string) => {
    try {
      const fileObj = JSON.parse(fileJsonStr);
      const link = document.createElement("a");
      link.href = fileObj.file_data;
      link.download = fileObj.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Error al descargar el archivo");
    }
  };

  const previewFile = (fileJsonStr: string) => {
    try {
      const fileObj = JSON.parse(fileJsonStr);
      if (fileObj.file_data && fileObj.file_data.startsWith("data:application/pdf")) {
        setPreviewUrl(fileObj.file_data);
        setPreviewName(fileObj.file_name);
      } else {
        alert("La previsualización en pantalla está optimizada para archivos PDF");
      }
    } catch (e) {
      alert("Error al previsualizar el archivo");
    }
  };

  const handleToggleSharePortal = async (itemId: string, currentContent: string) => {
    try {
      const evalObj = JSON.parse(currentContent);
      const newShared = !evalObj.shared;
      evalObj.shared = newShared;
      const updatedContent = JSON.stringify(evalObj);

      const { error: err } = await supabase
        .from("clinical_notes")
        .update({ content: updatedContent })
        .eq("id", itemId);

      if (err) {
        alert("Error al actualizar visibilidad: " + err.message);
        return;
      }

      window.location.reload();
    } catch (e) {
      alert("Error al procesar el archivo");
    }
  };

  const [form, setForm] = useState({
    first_name: patient.first_name, last_name: patient.last_name,
    avatar_url: (patient as any).emergency_contact || patient.avatar_url || "",
    document_number: patient.document_number || "", phone: patient.phone || "",
    email: patient.email || "", reason_for_consultation: patient.reason_for_consultation || "",
    primary_diagnosis: patient.primary_diagnosis || "", primary_diagnosis_desc: patient.primary_diagnosis_desc || "",
    current_medication: patient.current_medication || "", medical_history: patient.medical_history || "",
    birth_date: patient.birth_date || "", gender: patient.gender || "", address: patient.address || "",
    emergency_contact_name: patient.emergency_contact_name || "",
    emergency_contact_relation: patient.emergency_contact_relation || "",
    emergency_contact_phone: patient.emergency_contact_phone || "",
    insurance_provider: patient.insurance_provider || "",
    insurance_policy: patient.insurance_policy || "",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const pid = patient.id;
    // Obtener tenant_id del usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profileData } = await supabase.from("profiles").select("tenant_id").eq("id", user?.id || "").single();
    const tid = profileData?.tenant_id;

    const { data: t } = await supabase.from("therapists").select("id, profiles!inner(id, first_name, last_name)").eq("profiles.active", true);
    if (t) setTherapists(t as unknown as Therapist[]);

    const { data: s } = await supabase.from("scale_results").select("id, scale_type, total_score, risk_alert, completed_at").eq("patient_id", pid).order("completed_at", { ascending: true });
    if (s) setScaleResults(s as ScaleResult[]);

    const { data: n } = await supabase.from("clinical_notes").select("id, format, signed, created_at, subjective, content, profiles!clinical_notes_therapist_id_fkey(first_name, last_name)").eq("patient_id", pid).order("created_at", { ascending: false }).limit(50);
    if (n) setClinicalNotes(n as ClinicalNote[]);

    const { data: a } = await supabase.from("appointments").select("id, type, status, date, start_time, end_time").eq("patient_id", pid).eq("tenant_id", tid || "").order("date", { ascending: false }).limit(10);
    if (a) setAppointments(a as Appointment[]);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setSaving(true); setError(null);
    const { error: err } = await supabase.from("patients").update({
      first_name: form.first_name, last_name: form.last_name,
      emergency_contact: form.avatar_url || null,
      document_number: form.document_number || null, phone: form.phone || null,
      email: form.email || null, reason_for_consultation: form.reason_for_consultation || null,
      primary_diagnosis: form.primary_diagnosis || null, primary_diagnosis_desc: form.primary_diagnosis_desc || null,
      current_medication: form.current_medication || null, medical_history: form.medical_history || null,
      birth_date: form.birth_date || null, gender: form.gender || null, address: form.address || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_relation: form.emergency_contact_relation || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      insurance_provider: form.insurance_provider || null,
      insurance_policy: form.insurance_policy || null,
    }).eq("id", patient.id);
    if (err) { setError(err.message); setSaving(false); return; }
    setEditing(false); setSaving(false); window.location.reload();
  };

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    const { error: err } = await supabase.from("patients").update({ status: newStatus }).eq("id", patient.id);
    if (err) { setError(err.message); setSaving(false); return; }
    setStatusConfirm(null); window.location.reload();
  };

  const handleAssignTherapist = async () => {
    setSaving(true);
    const { error: err } = await supabase.from("patients").update({ 
      therapist_id: selectedTherapist || null,
      secondary_therapist_ids: selectedSecondaries
    }).eq("id", patient.id);
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false); setShowTherapistSelect(false); window.location.reload();
  };

  const toggleSecondary = (id: string) => {
    setSelectedSecondaries(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar permanentemente a ${patient.first_name} ${patient.last_name}? Esta acción no se puede deshacer.`)) {
      return;
    }
    setSaving(true);
    const { error: delErr } = await supabase.from("patients").delete().eq("id", patient.id);
    if (delErr) {
      alert("Error al eliminar el paciente: " + delErr.message);
      setSaving(false);
      return;
    }
    router.push("/patients");
    router.refresh();
  };

  const status = statusFlow[patient.status] || { label: patient.status, color: "bg-gray-50 text-gray-700 border-gray-200", next: [] };
  const therapistName = (() => {
    const t = therapists.find(t => t.id === patient.therapist_id);
    const p = t?.profiles;
    return p ? `${p.first_name} ${p.last_name}` : null;
  })();
  const fmt = (d: string) => new Date(d).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });
  const scalesByType = scaleResults.reduce((a, r) => { (a[r.scale_type] = a[r.scale_type] || []).push(r); return a; }, {} as Record<string, ScaleResult[]>);

  // Derived data for Hero Card
  const patientAge = patient.birth_date ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000) : null;
  const genderLabel = patient.gender === "M" ? "Masculino" : patient.gender === "F" ? "Femenino" : patient.gender === "O" ? "Otro" : null;
  const initials = `${patient.first_name?.[0] || ""}${patient.last_name?.[0] || ""}`;
  const riskAlerts = scaleResults.filter(r => r.risk_alert).length;

  const clinicalNotesList = clinicalNotes.filter(n => !isEvaluation(n.content) && !isReport(n.content));
  const evaluationsList = clinicalNotes.filter(n => isEvaluation(n.content));
  const reportsList = clinicalNotes.filter(n => isReport(n.content));
  const unsignedNotes = clinicalNotesList.filter(n => !n.signed).length;

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div><dt className="text-xs font-medium text-gray-500 uppercase">{label}</dt><dd className="mt-1 text-sm text-gray-900">{value || "—"}</dd></div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── HERO CARD ── */}
      <div className="bg-white border-b px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-5xl mx-auto">
          {/* Back button */}
          <a href="/patients" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Volver a pacientes
          </a>

          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Avatar */}
            <UserAvatar
              src={(patient as any).emergency_contact || patient.avatar_url}
              name={`${patient.first_name} ${patient.last_name}`}
              size="xl"
              fallbackGradient="from-indigo-500 to-purple-600"
            />

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-gray-900">{patient.first_name} {patient.last_name}</h1>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${status.color}`}>{status.label}</span>
                {patient.active === false && <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-600">Inactivo</span>}
              </div>

              {/* Sub-info line */}
              <p className="text-sm text-gray-500 mb-2">
                {patientAge !== null && <span>{patientAge} años</span>}
                {patientAge !== null && genderLabel && <span> · </span>}
                {genderLabel && <span>{genderLabel}</span>}
                {therapistName && <span> · Terapeuta: <span className="font-medium text-gray-700">{therapistName}</span></span>}
              </p>

              {/* Diagnosis pill */}
              {patient.primary_diagnosis && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg mb-3">
                  <span className="text-xs font-mono font-bold text-indigo-600">{patient.primary_diagnosis}</span>
                  {patient.primary_diagnosis_desc && <span className="text-xs text-gray-500">— {patient.primary_diagnosis_desc}</span>}
                </div>
              )}

              {/* Status actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {status.next.map(ns => (
                  <button key={ns} onClick={() => setStatusConfirm(ns)} className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors">
                    {nextLabels[ns]}
                  </button>
                ))}
              </div>
            </div>

            {/* Mini KPIs */}
            <div className="grid grid-cols-4 gap-3 sm:gap-4 flex-shrink-0">
              <button onClick={() => setActiveTab("citas")} className="flex flex-col items-center p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-100">
                <span className="text-lg font-bold text-blue-700">{appointments.length}</span>
                <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Citas</span>
              </button>
              <button onClick={() => setActiveTab("notas")} className="flex flex-col items-center p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-100 relative">
                <span className="text-lg font-bold text-emerald-700">{clinicalNotesList.length}</span>
                <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Notas</span>
                {unsignedNotes > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">{unsignedNotes}</span>}
              </button>
              <button onClick={() => setActiveTab("escalas")} className="flex flex-col items-center p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer border border-purple-100">
                <span className="text-lg font-bold text-purple-700">{scaleResults.length}</span>
                <span className="text-[10px] font-medium text-purple-600 uppercase tracking-wider">Escalas</span>
              </button>
              <div className={`flex flex-col items-center p-2.5 rounded-xl border ${riskAlerts > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-100"}`}>
                <span className={`text-lg font-bold ${riskAlerts > 0 ? "text-red-600" : "text-gray-400"}`}>{riskAlerts}</span>
                <span className={`text-[10px] font-medium uppercase tracking-wider ${riskAlerts > 0 ? "text-red-500" : "text-gray-400"}`}>Alertas</span>
              </div>
            </div>
          </div>

          {statusConfirm && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-3">
              <p className="text-sm text-indigo-700">¿Confirmar cambio a <strong>{statusFlow[statusConfirm]?.label}</strong>?</p>
              <button onClick={() => handleStatusChange(statusConfirm)} disabled={saving} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">{saving ? "..." : "Confirmar"}</button>
              <button onClick={() => setStatusConfirm(null)} className="px-3 py-1 text-xs bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50">Cancelar</button>
            </div>
          )}
          {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* ── ACCIONES RÁPIDAS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <a href="/clinical" className="flex items-center gap-3 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-2xl transition-colors">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0"><svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
            <div><p className="text-sm font-semibold text-emerald-900">Nueva Nota</p><p className="text-[10px] text-emerald-600/70 hidden sm:block">Escribir nota clínica</p></div>
          </a>
          <a href="/agenda" className="flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-2xl transition-colors">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0"><svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
            <div><p className="text-sm font-semibold text-blue-900">Agendar Cita</p><p className="text-[10px] text-blue-600/70 hidden sm:block">Programar sesión</p></div>
          </a>
          <button onClick={() => setActiveTab("padre")} className="flex items-center gap-3 px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-2xl transition-colors text-left">
            <div className="h-9 w-9 rounded-xl bg-amber-600 flex items-center justify-center flex-shrink-0"><svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
            <div><p className="text-sm font-semibold text-amber-900">Vincular Padre</p><p className="text-[10px] text-amber-600/70 hidden sm:block">Asociar acudiente</p></div>
          </button>
        </div>

        {/* ── TABS MEJORADOS ── */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          {([
            { key: "info" as const, label: "Datos del Paciente", icon: "📋", count: 0, alert: false },
            { key: "notas" as const, label: "Notas Clínicas", icon: "📝", count: clinicalNotesList.length, alert: unsignedNotes > 0 },
            { key: "evaluaciones" as const, label: "Evaluaciones", icon: "📁", count: evaluationsList.length, alert: false },
            { key: "informes" as const, label: "Informes", icon: "📄", count: reportsList.length, alert: false },
            { key: "ai_evolution" as const, label: "Evolución IA", icon: "✨", count: 0, alert: false },
            { key: "citas" as const, label: "Historial de Citas", icon: "📅", count: appointments.length, alert: false },
            { key: "padre" as const, label: "Padre / Acudiente", icon: "👨‍👧", count: 0, alert: false },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  tab.alert ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* INFO TAB */}
        {activeTab === "info" && (
          <div className="space-y-6">
            {/* Therapist */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Equipo Terapéutico</h2>
                {!showTherapistSelect && (
                  <button onClick={() => setShowTherapistSelect(true)} className="text-sm text-indigo-600 hover:text-indigo-700">Editar equipo</button>
                )}
              </div>
              
              {!showTherapistSelect ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Terapeuta Principal (Coordinador)</h3>
                    {therapistName ? (
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">{therapistName.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                        <p className="font-medium text-gray-900 text-sm">{therapistName}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Sin terapeuta asignado</p>
                    )}
                  </div>
                  
                  {selectedSecondaries.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Terapeutas Adicionales</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedSecondaries.map(sid => {
                          const t = therapists.find(th => th.id === sid);
                          if (!t || !t.profiles) return null;
                          return (
                            <span key={sid} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-gray-700 border border-gray-200 text-xs font-medium">
                              <span className="h-4 w-4 rounded-full bg-gray-200 flex items-center justify-center text-[8px] text-gray-600">
                                {t.profiles.first_name[0]}{t.profiles.last_name[0]}
                              </span>
                              {t.profiles.first_name} {t.profiles.last_name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta Principal</label>
                    <select value={selectedTherapist} onChange={e => setSelectedTherapist(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                      <option value="">-- Sin asignar --</option>
                      {therapists.map(t => t.profiles && <option key={t.id} value={t.id}>{t.profiles.first_name} {t.profiles.last_name}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Terapeutas Adicionales</label>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
                      {therapists.filter(t => t.id !== selectedTherapist).map(t => {
                        if (!t.profiles) return null;
                        const isSelected = selectedSecondaries.includes(t.id);
                        return (
                          <label key={t.id} className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-indigo-50 border border-indigo-100" : "hover:bg-gray-100 border border-transparent"}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSecondary(t.id)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                            <span className="text-sm font-medium text-gray-900">{t.profiles.first_name} {t.profiles.last_name}</span>
                          </label>
                        );
                      })}
                      {therapists.filter(t => t.id !== selectedTherapist).length === 0 && (
                        <p className="text-xs text-gray-500 p-2 text-center">No hay más terapeutas disponibles.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button onClick={() => {
                        setShowTherapistSelect(false);
                        setSelectedTherapist(patient.therapist_id || "");
                        setSelectedSecondaries(patient.secondary_therapist_ids || []);
                      }} className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleAssignTherapist} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {saving ? "Guardando..." : "Guardar Equipo"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Editable info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Datos Personales</h2>
                <button onClick={() => setEditing(!editing)} className="text-sm text-indigo-600 hover:text-indigo-700">{editing ? "Cancelar" : "Editar"}</button>
              </div>
              {editing ? (
                <div className="space-y-6">
                  {/* Sección 1: Datos Personales */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 pb-1 border-b border-gray-100">Datos Personales</h3>
                    <AvatarUpload
                      value={form.avatar_url}
                      onChange={(val) => setForm(prev => ({ ...prev, avatar_url: val || "" }))}
                      label="Actualizar Foto Carnet del Paciente"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label><input name="first_name" required value={form.first_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label><input name="last_name" required value={form.last_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Documento</label><input name="document_number" value={form.document_number} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento</label><input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                        <select name="gender" value={form.gender} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white">
                          <option value="">Selecciona...</option>
                          <option value="M">Masculino</option>
                          <option value="F">Femenino</option>
                          <option value="O">Otro</option>
                          <option value="X">No dice</option>
                        </select>
                      </div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input name="phone" value={form.phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" name="email" value={form.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label><input name="address" value={form.address} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                    </div>
                  </div>

                  {/* Sección 2: Contacto de Emergencia */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-100">Contacto de Emergencia</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Relación / Vínculo</label><input name="emergency_contact_relation" value={form.emergency_contact_relation} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label><input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                    </div>
                  </div>

                  {/* Sección 3: Información Clínica */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-100">Información Clínica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Motivo de consulta</label><textarea name="reason_for_consultation" value={form.reason_for_consultation} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico (CIE-10)</label><input name="primary_diagnosis" value={form.primary_diagnosis} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción Diagnóstico</label><input name="primary_diagnosis_desc" value={form.primary_diagnosis_desc} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Medicación</label><textarea name="current_medication" value={form.current_medication} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Historial Clínico / Antecedentes</label>
                        {!pdfUrl && (
                          <textarea name="medical_history" value={form.medical_history} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-3" placeholder="Escribe observaciones o adjunta el PDF abajo..." />
                        )}
                        
                        {/* Adjuntar PDF max 5MB con previsualización */}
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-indigo-900 uppercase tracking-wider">
                              📄 Adjuntar Ficha / Historial en PDF (Máx 5MB - Solo Admin)
                            </label>
                            {pdfUrl && (
                              <button
                                type="button"
                                onClick={() => { setPdfUrl(null); setForm(prev => ({ ...prev, medical_history: "" })); }}
                                className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition-colors"
                              >
                                🗑️ Eliminar PDF
                              </button>
                            )}
                          </div>

                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={handlePdfUpload}
                            className="block w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                          />
                          <p className="text-[11px] text-indigo-600/80">Formatos permitidos: PDF de hasta 5MB con visor de previsualización en vivo.</p>

                          {pdfUrl && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-indigo-200 shadow-xs">
                                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 font-outfit">
                                  📄 Previsualización en Vivo del Historial Clínico PDF
                                </span>
                                <a
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                                >
                                  ↗️ Pantalla completa
                                </a>
                              </div>
                              <iframe
                                src={pdfUrl}
                                className="w-full h-80 rounded-xl border border-indigo-200 shadow-inner bg-slate-900"
                                title="Previsualización Historial Clínico PDF"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección 4: Seguro Médico */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-100">Seguro Médico</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Aseguradora</label><input name="insurance_provider" value={form.insurance_provider} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Póliza</label><input name="insurance_policy" value={form.insurance_policy} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
                  </div>
                </div>
              ) : (
                <>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Field label="Nombre" value={`${patient.first_name} ${patient.last_name}`} />
                    <Field label="Documento" value={patient.document_number} />
                    <Field label="Nacimiento" value={patient.birth_date ? fmt(patient.birth_date) : null} />
                    <Field label="Género" value={patient.gender === "M" ? "Masculino" : patient.gender === "F" ? "Femenino" : patient.gender === "O" ? "Otro" : patient.gender === "X" ? "No dice" : null} />
                    <Field label="Teléfono" value={patient.phone} />
                    <Field label="Email" value={patient.email} />
                    <Field label="Dirección" value={patient.address} />
                  </dl>
                  {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Contacto de Emergencia</h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label="Nombre" value={patient.emergency_contact_name} />
                        <Field label="Relación" value={patient.emergency_contact_relation} />
                        <Field label="Teléfono" value={patient.emergency_contact_phone} />
                      </dl>
                    </div>
                  )}
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Información Clínica</h3>
                    <dl className="grid grid-cols-1 gap-4">
                      <Field label="Motivo de consulta" value={patient.reason_for_consultation} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Diagnóstico" value={patient.primary_diagnosis} />
                        <Field label="Descripción" value={patient.primary_diagnosis_desc} />
                      </div>
                      <Field label="Medicación" value={patient.current_medication} />
                      {pdfUrl ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                              📄 Ficha de Historial Clínico Adjunta (Documento PDF)
                            </label>
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                            >
                              ↗️ Abrir PDF completo
                            </a>
                          </div>
                          <iframe
                            src={pdfUrl}
                            className="w-full h-96 rounded-xl border border-gray-200 bg-slate-900 shadow-sm"
                            title="Visor Historial Clínico PDF"
                          />
                        </div>
                      ) : (
                        <Field label="Historial" value={patient.medical_history} />
                      )}
                    </dl>
                  </div>
                  {(patient.insurance_provider || patient.insurance_policy) && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Seguro Médico</h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Aseguradora" value={patient.insurance_provider} />
                        <Field label="Póliza" value={patient.insurance_policy} />
                      </dl>
                    </div>
                  )}
                  <div className="mt-6 pt-6 border-t border-red-100">
                    <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">Eliminar paciente</button>
                    {showDeleteConfirm && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <p className="text-sm text-red-700">¿Eliminar permanentemente?</p>
                        <button onClick={handleDelete} disabled={saving} className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">{saving ? "..." : "Sí, eliminar"}</button>
                        <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 text-xs bg-white text-gray-700 border rounded hover:bg-gray-50">Cancelar</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ESCALAS TAB */}
        {activeTab === "escalas" && (
          <div className="space-y-6">
            {Object.keys(scalesByType).length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Sin escalas aplicadas</h3>
                <p className="text-sm text-gray-500">Las escalas clínicas aparecerán aquí cuando se apliquen</p>
              </div>
            ) : Object.entries(scalesByType).map(([type, results]) => {
              const max = scaleMax[type] || 100;
              const thresh = scaleRisk[type];
              const latest = results[results.length - 1]?.total_score;
              const isRisk = thresh && latest && latest >= thresh;
              return (
                <div key={type} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div><h3 className="text-lg font-semibold text-gray-900">{type}</h3><p className="text-xs text-gray-500">{results.length} evaluación{results.length !== 1 ? "es" : ""}</p></div>
                    {isRisk && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">⚠️ Riesgo</span>}
                  </div>
                  <div className="flex items-end gap-1 h-32 mb-4">
                    {results.map(r => {
                      const pct = Math.min((r.total_score / max) * 100, 100);
                      const over = thresh && r.total_score >= thresh;
                      return <div key={r.id} className="flex-1 flex flex-col items-center gap-1" title={`${fmt(r.completed_at)}: ${r.total_score}/${max}`}>
                        <span className="text-xs text-gray-500">{r.total_score}</span>
                        <div className="w-full rounded-t-sm" style={{ height: `${pct}%`, backgroundColor: over ? "#ef4444" : "#6366f1" }} />
                        <span className="text-[10px] text-gray-400">{new Date(r.completed_at).toLocaleDateString("es-EC", { month: "short" })}</span>
                      </div>;
                    })}
                  </div>
                  <div className="space-y-2">
                    {[...results].reverse().map(r => (
                      <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm font-medium text-gray-900">{r.total_score}/{max}{r.risk_alert && <span className="ml-2 text-xs text-red-600">⚠️</span>}</span>
                        <span className="text-xs text-gray-500">{fmt(r.completed_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* NOTAS TAB */}
        {activeTab === "notas" && (
          <div className="space-y-4">
            {clinicalNotesList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-3">📝</div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Sin notas clínicas</h3>
                <p className="text-sm text-gray-500">Las notas de sesión aparecerán aquí</p>
              </div>
            ) : clinicalNotesList.map(n => (
              <ClinicalNoteCard
                key={n.id}
                id={n.id}
                format={n.format}
                content={n.content || n.subjective || "Sin contenido"}
                signed={n.signed}
                createdAt={n.created_at}
                therapistName={n.profiles ? `${n.profiles.first_name} ${n.profiles.last_name}` : undefined}
              />
            ))}
          </div>
        )}

        {/* EVALUACIONES TAB */}
        {activeTab === "evaluaciones" && (
          <div className="space-y-4">
            {evaluationsList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-3">📁</div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Sin evaluaciones subidas</h3>
                <p className="text-sm text-gray-500">Las evaluaciones del paciente subidas por los terapeutas aparecerán aquí</p>
              </div>
            ) : evaluationsList.map(item => {
              const evalData = parseEvaluation(item.content);
              if (!evalData) return null;
              const formattedSize = evalData.file_size ? `${(evalData.file_size / 1024).toFixed(1)} KB` : "N/A";
              const isPdf = evalData.file_name?.toLowerCase().endsWith(".pdf");
              const isShared = !!evalData.shared;

              return (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${isPdf ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                      {isPdf ? "PDF" : "DOC"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{evalData.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{fmt(item.created_at)} · {formattedSize}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          isShared ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}>
                          {isShared ? "👁️ Compartido en Portal" : "🔒 Privado (Solo Centro)"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPdf && (
                      <button onClick={() => item.content && previewFile(item.content)} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                        Previsualizar
                      </button>
                    )}
                    <button onClick={() => item.content && downloadFile(item.content)} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                      Descargar
                    </button>
                    
                    <button 
                      onClick={() => item.content && handleToggleSharePortal(item.id, item.content)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        isShared 
                          ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                          : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      }`}
                    >
                      {isShared ? "Quitar del Portal 🔒" : "Publicar al Portal 📤"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* INFORMES TAB */}
        {activeTab === "informes" && (
          <div className="space-y-4">
            {reportsList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-3">📄</div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Sin informes subidos</h3>
                <p className="text-sm text-gray-500">Los informes del paciente subidos por los terapeutas aparecerán aquí</p>
              </div>
            ) : reportsList.map(item => {
              const reportData = parseEvaluation(item.content);
              if (!reportData) return null;
              const formattedSize = reportData.file_size ? `${(reportData.file_size / 1024).toFixed(1)} KB` : "N/A";
              const isPdf = reportData.file_name?.toLowerCase().endsWith(".pdf");
              const isShared = !!reportData.shared;

              return (
                <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${isPdf ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                      {isPdf ? "PDF" : "DOC"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{reportData.file_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{fmt(item.created_at)} · {formattedSize}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          isShared ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}>
                          {isShared ? "👁️ Compartido en Portal" : "🔒 Privado (Solo Centro)"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPdf && (
                      <button onClick={() => item.content && previewFile(item.content)} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                        Previsualizar
                      </button>
                    )}
                    <button onClick={() => item.content && downloadFile(item.content)} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                      Descargar
                    </button>
                    
                    <button 
                      onClick={() => item.content && handleToggleSharePortal(item.id, item.content)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        isShared 
                          ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                          : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      }`}
                    >
                      {isShared ? "Quitar del Portal 🔒" : "Publicar al Portal 📤"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CITAS TAB */}
        {activeTab === "citas" && (
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-4xl mb-3">📅</div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Sin citas registradas</h3>
                <p className="text-sm text-gray-500">Las citas aparecerán aquí cuando se programen</p>
              </div>
            ) : appointments.map(a => {
              const s = aptStatusLabels[a.status] || { label: a.status, color: "text-gray-600" };
              return (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{aptTypeLabels[a.type] || a.type}</span>
                      <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{fmt(a.date)} · {a.start_time} - {a.end_time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* PADRE TAB */}
        {activeTab === "padre" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <ParentLinking patientId={patient.id} />
          </div>
        )}

        {/* EVOLUCIÓN IA TAB */}
        {activeTab === "ai_evolution" && (
          <AIEvolutionView patientId={patient.id} />
        )}
      </div>
      {/* Modal de Previsualización de PDF */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-150 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <h3 className="font-semibold text-gray-900 text-base md:text-lg truncate max-w-md md:max-w-xl">{previewName}</h3>
              </div>
              <button 
                onClick={() => { setPreviewUrl(null); setPreviewName(null); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Iframe */}
            <div className="flex-1 bg-gray-100 relative">
              <iframe 
                src={previewUrl} 
                className="w-full h-full border-0" 
                title="Vista previa de documento"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}