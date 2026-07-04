"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import AIEvolutionView from "@/features/clinical/components/AIEvolutionView";
import ClinicalNoteCard from "@/components/clinical/ClinicalNoteCard";

interface Patient { id: string; first_name: string; last_name: string; date_of_birth: string | null; phone: string | null; email: string | null; status: string; reason_for_consultation: string | null; medical_history: string | null; active: boolean; }
interface Appointment { id: string; date: string; start_time: string; end_time: string; type: string; status: string; notes: string | null; }
interface ClinicalNote { id: string; format: string; content: string; signed: boolean; created_at: string; profiles?: { first_name: string; last_name: string } | null; }
interface ScaleResult { id: string; scale_type: string; total_score: number; risk_alert: boolean; applied_at: string; }

const typeLabels: Record<string, string> = { individual: "Individual", grupal: "Grupal", taller: "Taller", evaluacion: "Evaluación", supervision: "Supervisión" };
const statusLabels: Record<string, string> = { programada: "Programada", confirmada: "Confirmada", completada: "Completada", cancelada: "Cancelada", no_asistio: "No asistió" };
const statusColors: Record<string, string> = { programada: "bg-blue-50 text-blue-700", confirmada: "bg-green-50 text-green-700", completada: "bg-gray-50 text-gray-700", cancelada: "bg-red-50 text-red-700", no_asistio: "bg-orange-50 text-orange-700" };
const noteLabels: Record<string, string> = { soap: "SOAP", birp: "BIRP", dap: "DAP", libre: "Libre", progreso: "Progreso" };

export default function TherapistPatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [scales, setScales] = useState<ScaleResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"appointments" | "notes" | "scales" | "evaluaciones" | "informes" | "ai_evolution">("notes");

  // Form for new note
  const [showNewNote, setShowNewNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteForm, setNoteForm] = useState({ tareas: "", observaciones: "", resultados: "", recomendaciones: "" });

  // Evaluation upload state
  const [uploadingEval, setUploadingEval] = useState(false);
  const [evalFile, setEvalFile] = useState<File | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Report upload state
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const isEvaluation = (content: string) => {
    return content.trim().startsWith('{"type":"evaluacion"');
  };

  const isReport = (content: string) => {
    return content.trim().startsWith('{"type":"informe"');
  };

  const parseEvaluation = (content: string) => {
    try {
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  };

  const handleUploadEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalFile) return;
    setUploadingEval(true);
    setEvalError(null);

    // Max 5MB check
    if (evalFile.size > 5242880) {
      setEvalError("El archivo no debe superar los 5MB.");
      setUploadingEval(false);
      return;
    }

    // Strict extension check
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const fileExt = evalFile.name.substring(evalFile.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      setEvalError("Solo se permiten archivos PDF o Word (.doc, .docx).");
      setUploadingEval(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
      
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const payload = JSON.stringify({
          type: "evaluacion",
          file_name: evalFile.name,
          file_size: evalFile.size,
          file_type: evalFile.type,
          file_data: base64Data
        });

        const { error } = await supabase.from("clinical_notes").insert({
          tenant_id: prof!.tenant_id,
          patient_id: params.id as string,
          therapist_id: user!.id,
          format: "libre",
          content: payload,
          signed: false
        });

        if (error) {
          setEvalError("Error al guardar en base de datos: " + error.message);
          setUploadingEval(false);
          return;
        }

        setEvalFile(null);
        setUploadingEval(false);
        // Reload notes
        const { data } = await supabase.from("clinical_notes").select("id, format, content, signed, created_at, profiles!clinical_notes_therapist_id_fkey(first_name, last_name)").eq("tenant_id", prof!.tenant_id).eq("patient_id", params.id as string).eq("therapist_id", user!.id).order("created_at", { ascending: false }).limit(20);
        setNotes((data || []) as ClinicalNote[]);
      };
      reader.onerror = () => {
        setEvalError("Error al leer el archivo.");
        setUploadingEval(false);
      };
      reader.readAsDataURL(evalFile);
    } catch (err: any) {
      setEvalError(err.message || "Error al subir.");
      setUploadingEval(false);
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportFile) return;
    setUploadingReport(true);
    setReportError(null);

    // Max 5MB check
    if (reportFile.size > 5242880) {
      setReportError("El archivo no debe superar los 5MB.");
      setUploadingReport(false);
      return;
    }

    // Strict extension check
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const fileExt = reportFile.name.substring(reportFile.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      setReportError("Solo se permiten archivos PDF o Word (.doc, .docx).");
      setUploadingReport(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
      
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const payload = JSON.stringify({
          type: "informe",
          file_name: reportFile.name,
          file_size: reportFile.size,
          file_type: reportFile.type,
          file_data: base64Data
        });

        const { error } = await supabase.from("clinical_notes").insert({
          tenant_id: prof!.tenant_id,
          patient_id: params.id as string,
          therapist_id: user!.id,
          format: "libre",
          content: payload,
          signed: false
        });

        if (error) {
          setReportError("Error al guardar en base de datos: " + error.message);
          setUploadingReport(false);
          return;
        }

        setReportFile(null);
        setUploadingReport(false);
        // Reload notes
        const { data } = await supabase.from("clinical_notes").select("id, format, content, signed, created_at, profiles!clinical_notes_therapist_id_fkey(first_name, last_name)").eq("tenant_id", prof!.tenant_id).eq("patient_id", params.id as string).eq("therapist_id", user!.id).order("created_at", { ascending: false }).limit(20);
        setNotes((data || []) as ClinicalNote[]);
      };
      reader.onerror = () => {
        setReportError("Error al leer el archivo.");
        setUploadingReport(false);
      };
      reader.readAsDataURL(reportFile);
    } catch (err: any) {
      setReportError(err.message || "Error al subir.");
      setUploadingReport(false);
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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      if (!profile) { setLoading(false); return; }
      const patientId = params.id as string;

      const { data: pData } = await supabase.from("patients").select("*").eq("id", patientId).or(`therapist_id.eq.${user.id},secondary_therapist_ids.cs.{"${user.id}"}`).single();
      if (!pData) { setLoading(false); return; }
      setPatient(pData as Patient);

      const [aptRes, notesRes, scalesRes] = await Promise.all([
        supabase.from("appointments").select("id, date, start_time, end_time, type, status, notes").eq("tenant_id", profile.tenant_id).eq("patient_id", patientId).eq("therapist_id", user.id).order("date", { ascending: false }).limit(20),
        supabase.from("clinical_notes").select("id, format, content, signed, created_at, profiles!clinical_notes_therapist_id_fkey(first_name, last_name)").eq("tenant_id", profile.tenant_id).eq("patient_id", patientId).eq("therapist_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("scale_results").select("id, scale_type, total_score, risk_alert, applied_at").eq("tenant_id", profile.tenant_id).eq("patient_id", patientId).order("applied_at", { ascending: false }).limit(10),
      ]);
      setAppointments((aptRes.data || []) as Appointment[]);
      setNotes((notesRes.data || []) as ClinicalNote[]);
      setScales((scalesRes.data || []) as ScaleResult[]);
      setLoading(false);
    }
    load();
  }, [params.id]);

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteForm.tareas.trim() && !noteForm.observaciones.trim()) return;
    setSaving(true);
    
    // Concatenate exactly as structured single content
    const combinedContent = [
      noteForm.tareas.trim() ? `**Tareas Realizadas:**\n${noteForm.tareas.trim()}` : null,
      noteForm.observaciones.trim() ? `**Observaciones:**\n${noteForm.observaciones.trim()}` : null,
      noteForm.resultados.trim() ? `**Avances / Resultados:**\n${noteForm.resultados.trim()}` : null,
      noteForm.recomendaciones.trim() ? `**Recomendaciones para Casa:**\n${noteForm.recomendaciones.trim()}` : null,
    ].filter(Boolean).join("\n\n");

    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", user!.id).single();
    const { error } = await supabase.from("clinical_notes").insert({
      tenant_id: prof!.tenant_id, patient_id: params.id as string, therapist_id: user!.id,
      format: "libre", content: combinedContent, signed: false,
    });
    if (error) { alert("Error: " + error.message); setSaving(false); return; }
    setShowNewNote(false);
    setNoteForm({ tareas: "", observaciones: "", resultados: "", recomendaciones: "" });
    setSaving(false);
    // Reload notes
    const { data } = await supabase.from("clinical_notes").select("id, format, content, signed, created_at, profiles!clinical_notes_therapist_id_fkey(first_name, last_name)").eq("tenant_id", prof!.tenant_id).eq("patient_id", params.id as string).eq("therapist_id", user!.id).order("created_at", { ascending: false }).limit(20);
    setNotes((data || []) as ClinicalNote[]);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><svg className="animate-spin h-8 w-8 text-teal-600" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  if (!patient) return <div className="text-center py-12"><p className="text-gray-500">Paciente no encontrado</p><Link href="/therapist/patients" className="text-teal-600 text-sm mt-2 inline-block">← Volver a mis pacientes</Link></div>;

  const age = patient.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  const clinicalNotesList = notes.filter(n => !isEvaluation(n.content) && !isReport(n.content));
  const evaluationsList = notes.filter(n => isEvaluation(n.content));
  const reportsList = notes.filter(n => isReport(n.content));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-600" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{patient.first_name} {patient.last_name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {age !== null && <span className="text-sm text-gray-500">{age} años</span>}
            {patient.email && <span className="text-sm text-gray-500">✉️ {patient.email}</span>}
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${patient.status === "activo" ? "bg-green-50 text-green-700" : patient.status === "lista_espera" ? "bg-yellow-50 text-yellow-700" : patient.status === "alta" ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-700"}`}>
          {patient.status === "lista_espera" ? "En espera" : patient.status === "activo" ? "Activo" : patient.status === "alta" ? "Alta" : patient.status}
        </span>
      </div>

      {/* Info cards — SOLO LECTURA */}
      {(patient.reason_for_consultation || patient.medical_history) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patient.reason_for_consultation && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Motivo de consulta</p>
              <p className="text-sm text-gray-900">{patient.reason_for_consultation}</p>
            </div>
          )}
          {patient.medical_history && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Historial médico</p>
              <p className="text-sm text-gray-900">{patient.medical_history}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { key: "appointments", label: "Citas", count: appointments.length },
            { key: "notes", label: "Notas Clínicas", count: clinicalNotesList.length },
            { key: "scales", label: "Escalas", count: scales.length },
            { key: "evaluaciones", label: "Subir Evaluaciones", count: evaluationsList.length },
            { key: "informes", label: "Subir Informes", count: reportsList.length },
            { key: "ai_evolution", label: "Evolución IA", count: "✨" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-teal-600 text-teal-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Appointments tab — SOLO LECTURA */}
      {activeTab === "appointments" && (
        <div className="space-y-3">
          {appointments.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-gray-200"><div className="text-3xl mb-2">📅</div><p className="text-sm text-gray-500">Sin citas registradas</p></div>
          ) : appointments.map(apt => (
            <div key={apt.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{new Date(apt.date + "T12:00:00").toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" })}</p>
                  <p className="text-sm text-gray-500">{apt.start_time?.slice(0, 5)} - {apt.end_time?.slice(0, 5)} · {typeLabels[apt.type] || apt.type}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[apt.status] || "bg-gray-100 text-gray-600"}`}>{statusLabels[apt.status] || apt.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes tab — PUEDE CREAR NOTAS DE EVOLUCIÓN */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          {/* Botón para registrar evolución */}
          <button onClick={() => setShowNewNote(true)} className="w-full bg-teal-600 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-teal-700 inline-flex items-center justify-center gap-2">
            📋 Registrar nota de evolución
          </button>

          {/* Formulario de nueva nota */}
          {showNewNote && (
            <div className="bg-white rounded-xl border border-teal-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Registrar evolución</h3>
                <button onClick={() => setShowNewNote(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <form onSubmit={handleCreateNote} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tareas Realizadas *</label>
                  <textarea value={noteForm.tareas} onChange={e => setNoteForm({ ...noteForm, tareas: e.target.value })} rows={3} placeholder="Actividades o dinámicas trabajadas durante la sesión..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones *</label>
                  <textarea value={noteForm.observaciones} onChange={e => setNoteForm({ ...noteForm, observaciones: e.target.value })} rows={3} placeholder="Comportamiento, participación, dificultades, estado de ánimo del paciente..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avances / Resultados (Opcional)</label>
                  <textarea value={noteForm.resultados} onChange={e => setNoteForm({ ...noteForm, resultados: e.target.value })} rows={2} placeholder="Logros alcanzados en esta sesión, evolución respecto a los objetivos..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recomendaciones para Casa (Opcional)</label>
                  <textarea value={noteForm.recomendaciones} onChange={e => setNoteForm({ ...noteForm, recomendaciones: e.target.value })} rows={2} placeholder="Actividades de refuerzo sugeridas para realizar en el hogar..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowNewNote(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={saving || !noteForm.tareas.trim() || !noteForm.observaciones.trim()} className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 tracking-wide">{saving ? "Guardando..." : "Guardar Nota de Sesión"}</button>
                </div>
              </form>
            </div>
          )}

          {clinicalNotesList.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-gray-200"><div className="text-3xl mb-2">📋</div><p className="text-sm text-gray-500">Sin notas clínicas aún</p><p className="text-xs text-gray-400 mt-1">Registra la evolución después de cada sesión</p></div>
          ) : clinicalNotesList.map(note => (
            <ClinicalNoteCard
              key={note.id}
              id={note.id}
              format={note.format}
              content={note.content}
              signed={note.signed}
              createdAt={note.created_at}
              therapistName={note.profiles ? `${note.profiles.first_name} ${note.profiles.last_name}` : undefined}
            />
          ))}
        </div>
      )}

      {/* Scales tab — SOLO LECTURA */}
      {activeTab === "scales" && (
        <div className="space-y-3">
          {scales.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-gray-200"><div className="text-3xl mb-2">📊</div><p className="text-sm text-gray-500">Sin escalas aplicadas</p></div>
          ) : scales.map(scale => (
            <div key={scale.id} className={`bg-white rounded-xl border p-4 ${scale.risk_alert ? "border-red-200" : "border-gray-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{scale.scale_type}</p>
                  <p className="text-xs text-gray-500">{new Date(scale.applied_at).toLocaleDateString("es-EC")}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${scale.risk_alert ? "text-red-600" : "text-gray-900"}`}>{scale.total_score}</p>
                  {scale.risk_alert && <span className="text-xs text-red-600 font-medium">⚠️ Riesgo</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evaluations tab — SUBIR Y VER EVALUACIONES */}
      {activeTab === "evaluaciones" && (
        <div className="space-y-6">
          {/* Formulario de carga de evaluación */}
          <div className="bg-white rounded-xl border border-teal-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-outfit">Subir Nueva Evaluación</h3>
            <form onSubmit={handleUploadEvaluation} className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-teal-500 transition-colors bg-gray-50">
                <input
                  type="file"
                  id="eval-file-input"
                  accept=".pdf,.doc,.docx"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setEvalFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <label htmlFor="eval-file-input" className="cursor-pointer space-y-2 block">
                  <div className="text-4xl text-gray-400">📁</div>
                  <p className="text-sm text-gray-700 font-medium">
                    {evalFile ? evalFile.name : "Seleccionar o arrastrar archivo de evaluación"}
                  </p>
                  <p className="text-xs text-gray-400">Formatos permitidos: PDF y Word (.doc, .docx). Máximo 5MB.</p>
                </label>
              </div>

              {evalError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">{evalError}</p>
              )}

              {evalFile && (
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEvalFile(null)}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingEval}
                    className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {uploadingEval ? "Subiendo..." : "Subir Documento"}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Listado de evaluaciones */}
          <div className="space-y-3">
            {evaluationsList.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <div className="text-4xl mb-3">📁</div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">Sin evaluaciones subidas</h4>
                <p className="text-sm text-gray-500">Aquí se listarán las evaluaciones psicológicas o psicopedagógicas.</p>
              </div>
            ) : (
              evaluationsList.map(item => {
                const evalData = parseEvaluation(item.content);
                if (!evalData) return null;
                const formattedSize = evalData.file_size
                  ? `${(evalData.file_size / 1024).toFixed(1)} KB`
                  : "N/A";
                const isPdf = evalData.file_name?.toLowerCase().endsWith(".pdf");
                const isShared = !!evalData.shared;

                return (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${isPdf ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                        {isPdf ? "PDF" : "DOC"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{evalData.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString("es-EC")} · {formattedSize}</span>
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
                        <button
                          onClick={() => previewFile(item.content)}
                          className="px-3 py-1.5 text-xs font-semibold text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
                        >
                          Previsualizar
                        </button>
                      )}
                      <button
                        onClick={() => downloadFile(item.content)}
                        className="px-3 py-1.5 text-xs font-semibold text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
                      >
                        Descargar
                      </button>

                      <button 
                        onClick={() => item.content && handleToggleSharePortal(item.id, item.content)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          isShared 
                            ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                            : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                        }`}
                      >
                        {isShared ? "Quitar del Portal 🔒" : "Publicar al Portal 📤"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Reports tab — SUBIR Y VER INFORMES */}
      {activeTab === "informes" && (
        <div className="space-y-6">
          {/* Formulario de carga de informe */}
          <div className="bg-white rounded-xl border border-teal-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-outfit">Subir Nuevo Informe</h3>
            <form onSubmit={handleUploadReport} className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-teal-500 transition-colors bg-gray-50">
                <input
                  type="file"
                  id="report-file-input"
                  accept=".pdf,.doc,.docx"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setReportFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <label htmlFor="report-file-input" className="cursor-pointer space-y-2 block">
                  <div className="text-4xl text-gray-400">📄</div>
                  <p className="text-sm text-gray-700 font-medium">
                    {reportFile ? reportFile.name : "Seleccionar o arrastrar archivo de informe"}
                  </p>
                  <p className="text-xs text-gray-400">Formatos permitidos: PDF y Word (.doc, .docx). Máximo 5MB.</p>
                </label>
              </div>

              {reportError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">{reportError}</p>
              )}

              {reportFile && (
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReportFile(null)}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Descartar
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingReport}
                    className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {uploadingReport ? "Subiendo..." : "Subir Documento"}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Listado de informes */}
          <div className="space-y-3">
            {reportsList.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <div className="text-4xl mb-3">📄</div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">Sin informes subidos</h4>
                <p className="text-sm text-gray-500">Aquí se listarán los informes clínicos, de progreso u otros.</p>
              </div>
            ) : (
              reportsList.map(item => {
                const reportData = parseEvaluation(item.content); // parses file JSON
                if (!reportData) return null;
                const formattedSize = reportData.file_size
                  ? `${(reportData.file_size / 1024).toFixed(1)} KB`
                  : "N/A";
                const isPdf = reportData.file_name?.toLowerCase().endsWith(".pdf");
                const isShared = !!reportData.shared;

                return (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${isPdf ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                        {isPdf ? "PDF" : "DOC"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{reportData.file_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString("es-EC")} · {formattedSize}</span>
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
                        <button
                          onClick={() => previewFile(item.content)}
                          className="px-3 py-1.5 text-xs font-semibold text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
                        >
                          Previsualizar
                        </button>
                      )}
                      <button
                        onClick={() => downloadFile(item.content)}
                        className="px-3 py-1.5 text-xs font-semibold text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors"
                      >
                        Descargar
                      </button>

                      <button 
                        onClick={() => item.content && handleToggleSharePortal(item.id, item.content)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          isShared 
                            ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                            : "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                        }`}
                      >
                        {isShared ? "Quitar del Portal 🔒" : "Publicar al Portal 📤"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === "ai_evolution" && (
        <AIEvolutionView patientId={params.id as string} />
      )}
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