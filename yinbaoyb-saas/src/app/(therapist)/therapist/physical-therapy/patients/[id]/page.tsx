"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { 
  ArrowLeft, 
  Activity, 
  FileText, 
  Plus, 
  Calendar, 
  Heart, 
  Clock, 
  User, 
  AlertCircle,
  TrendingDown
} from "lucide-react";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  reason_for_consultation: string | null;
  primary_diagnosis: string | null;
  active: boolean;
}

interface PTHistory {
  id: string;
  created_at: string;
  identification_data: any;
  treatment_plan: any;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
}

interface PTSession {
  id: string;
  created_at: string;
  session_number: number;
  treatment_applied: string;
  pain_level_eva: number;
  observations: string;
  profiles: {
    first_name: string;
    last_name: string;
  } | null;
}

export default function TherapistPTPatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [histories, setHistories] = useState<PTHistory[]>([]);
  const [sessions, setSessions] = useState<PTSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"histories" | "sessions">("histories");

  // New session form state
  const [showNewSession, setShowNewSession] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    historyId: "",
    sessionNumber: 1,
    treatmentApplied: "",
    painLevelEva: 5,
    observations: ""
  });
  const [sessionError, setSessionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch patient
      const { data: pData } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();
      
      if (!pData) return;
      setPatient(pData as Patient);

      // 2. Fetch PT Histories
      const histRes = await fetch(`/api/physical-therapy/histories?patientId=${patientId}`, {
        headers: { "Content-Type": "application/json" }
      });
      const histData = await histRes.json();
      setHistories(histData || []);

      // 3. Fetch PT Sessions
      const sessRes = await fetch(`/api/physical-therapy/sessions?patientId=${patientId}`, {
        headers: { "Content-Type": "application/json" }
      });
      const sessData = await sessRes.json();
      const loadedSessions = sessData || [];
      setSessions(loadedSessions);

      // Prefill session form details
      if (histData && histData.length > 0) {
        setSessionForm(prev => ({
          ...prev,
          historyId: histData[0].id,
          sessionNumber: loadedSessions.length > 0 ? Math.max(...loadedSessions.map((s: any) => s.session_number)) + 1 : 1
        }));
      }
    } catch (err) {
      console.error("Error loading patient PT data:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.historyId || !sessionForm.treatmentApplied) {
      setSessionError("Completa todos los campos obligatorios.");
      return;
    }
    setSavingSession(true);
    setSessionError(null);

    try {
      const res = await fetch("/api/physical-therapy/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historyId: sessionForm.historyId,
          patientId,
          sessionNumber: Number(sessionForm.sessionNumber),
          treatmentApplied: sessionForm.treatmentApplied,
          painLevelEva: Number(sessionForm.painLevelEva),
          observations: sessionForm.observations
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar la sesión.");

      // Reload
      setShowNewSession(false);
      setSessionForm(prev => ({
        ...prev,
        treatmentApplied: "",
        observations: "",
        painLevelEva: 5
      }));
      await loadData();
    } catch (err: any) {
      setSessionError(err.message || "Error al guardar.");
    } finally {
      setSavingSession(false);
    }
  };

  if (loading) return <PageLoading text="Cargando expediente de terapia física..." color="text-indigo-650" />;
  if (!patient) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-gray-200">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-gray-900">Paciente no encontrado</h3>
        <p className="text-xs text-gray-500 mt-1">El expediente clínico solicitado no existe o no tienes acceso.</p>
        <Link href="/therapist/physical-therapy" className="inline-flex items-center gap-1.5 text-xs text-indigo-650 hover:underline mt-4 font-semibold">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al portal
        </Link>
      </div>
    );
  }

  // Helper for pain tag styling
  const getPainTagColor = (level: number) => {
    if (level <= 2) return "bg-green-50 text-green-700 border-green-200";
    if (level <= 5) return "bg-yellow-50 text-yellow-700 border-yellow-250";
    if (level <= 8) return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / 31557600000);
  };

  return (
    <div className="space-y-6">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <Link 
          href="/therapist/physical-therapy" 
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors font-bold"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Pacientes
        </Link>
      </div>

      {/* Patient Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-650 px-2.5 py-1 rounded-full font-outfit">Fisioterapia</span>
          <h1 className="text-xl font-bold text-gray-900 mt-2.5 font-outfit">
            {patient.first_name} {patient.last_name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {getAge(patient.birth_date) !== null ? `${getAge(patient.birth_date)} años` : "Edad no especificada"}</span>
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> Teléfono: {patient.phone || "—"}</span>
          </div>
        </div>
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 max-w-sm">
          <p className="text-xs font-semibold text-indigo-950 uppercase tracking-wider">Diagnóstico Inicial</p>
          <p className="text-xs text-indigo-900 mt-1 leading-relaxed">{patient.primary_diagnosis || "Sin diagnóstico clínico inicial registrado."}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button 
            onClick={() => setActiveTab("histories")} 
            className={`pb-3 text-xs font-bold border-b-2 transition-all font-outfit ${activeTab === "histories" ? "border-indigo-650 text-indigo-650" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            📋 Evaluaciones de Rehabilitación ({histories.length})
          </button>
          <button 
            onClick={() => setActiveTab("sessions")} 
            className={`pb-3 text-xs font-bold border-b-2 transition-all font-outfit ${activeTab === "sessions" ? "border-indigo-650 text-indigo-650" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            🏃 Evolución Diario de Sesiones ({sessions.length})
          </button>
        </nav>
      </div>

      {/* TABS CONTENT */}
      {activeTab === "histories" && (
        <div className="space-y-4">
          <Link 
            href={`/therapist/physical-therapy/histories/new?patientId=${patient.id}`}
            className="w-full bg-indigo-650 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/10 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Realizar Nueva Evaluación de Rehabilitación (FisioJoy)
          </Link>

          {histories.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <div className="text-4xl mb-3">📄</div>
              <h3 className="text-sm font-bold text-gray-800">Sin Historias de Rehabilitación</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Realiza la primera evaluación clínica completa para estructurar el plan analítico de atención del paciente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {histories.map(hist => (
                <div key={hist.id} className="bg-white border border-slate-100 shadow-soft rounded-2xl p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-650 px-2 py-0.5 rounded">Historia clínica</span>
                      <span className="text-xs text-slate-400">{new Date(hist.created_at).toLocaleDateString("es-EC")}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 font-outfit">
                      Motivo: {hist.identification_data?.motivo_consulta || "Observación general / Consulta primaria"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Evaluado por: {hist.profiles ? `${hist.profiles.first_name} ${hist.profiles.last_name}` : "Terapeuta responsable"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link 
                      href={`/therapist/physical-therapy/histories/${hist.id}?patientId=${patient.id}`}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all text-center flex-1 sm:flex-initial"
                    >
                      Ver / Editar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="space-y-4">
          <button 
            onClick={() => {
              if (histories.length === 0) {
                alert("Debes realizar al menos una Historia Clínica de Rehabilitación inicial antes de registrar sesiones de evolución diaria.");
                return;
              }
              setShowNewSession(true);
            }}
            className="w-full bg-indigo-650 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/10 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Registrar Sesión Diaria de Evolución
          </button>

          {/* New session form */}
          {showNewSession && (
            <div className="bg-white rounded-2xl border border-indigo-200 p-6 space-y-4 shadow-soft">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-outfit">Registrar Sesión Diaria</h3>
                <button onClick={() => setShowNewSession(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {sessionError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span>{sessionError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSession} className="space-y-4 text-xs font-semibold">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Vincular a Historia de Rehabilitación</label>
                    <select 
                      value={sessionForm.historyId}
                      onChange={e => setSessionForm({ ...sessionForm, historyId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
                    >
                      {histories.map(h => (
                        <option key={h.id} value={h.id}>
                          {new Date(h.created_at).toLocaleDateString()} - {h.identification_data?.motivo_consulta?.substring(0, 25) || "Evaluación inicial"}...
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Sesión Número *</label>
                    <input 
                      type="number"
                      value={sessionForm.sessionNumber}
                      onChange={e => setSessionForm({ ...sessionForm, sessionNumber: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Escala del Dolor EVA (0 - 10) *</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="0"
                        max="10"
                        value={sessionForm.painLevelEva}
                        onChange={e => setSessionForm({ ...sessionForm, painLevelEva: Number(e.target.value) })}
                        className="w-full h-1.5 bg-gray-250 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                      />
                      <span className={`px-2 py-1 border rounded font-mono text-xs font-bold min-w-8 text-center ${getPainTagColor(sessionForm.painLevelEva)}`}>
                        {sessionForm.painLevelEva}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Tratamiento Aplicado (Agentes físicos, técnicas, ejercicios) *</label>
                  <textarea 
                    value={sessionForm.treatmentApplied} 
                    onChange={e => setSessionForm({ ...sessionForm, treatmentApplied: e.target.value })}
                    rows={3} 
                    placeholder="Detalla los agentes físicos (ej. calor húmedo, electroterapia), técnicas de terapia manual y ejercicios realizados..." 
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none font-medium leading-relaxed" 
                    required 
                  />
                </div>

                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Observaciones / Evolución (Opcional)</label>
                  <textarea 
                    value={sessionForm.observations} 
                    onChange={e => setSessionForm({ ...sessionForm, observations: e.target.value })}
                    rows={2} 
                    placeholder="Logros específicos, fatiga, tolerancia al ejercicio, etc..." 
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none font-medium leading-relaxed" 
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowNewSession(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all font-bold">Cancelar</button>
                  <button type="submit" disabled={savingSession} className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl transition-all font-bold shadow-sm shadow-indigo-500/10 cursor-pointer">{savingSession ? "Registrando..." : "Registrar Sesión"}</button>
                </div>
              </form>
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <div className="text-4xl mb-3">🏃</div>
              <h3 className="text-sm font-bold text-gray-800">Sin Sesiones Registradas</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Registra la evolución de cada sesión diaria para monitorear el dolor (EVA) y el tratamiento de rehabilitación del paciente.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map(sess => (
                <div key={sess.id} className="bg-white border border-slate-100 shadow-soft rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-650 px-2 py-0.5 rounded">Sesión {sess.session_number}</span>
                      <span className="text-xs text-slate-400 font-mono">{new Date(sess.created_at).toLocaleDateString("es-EC")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-400">Dolor (EVA):</span>
                      <span className={`px-2 py-0.5 border rounded-full font-mono text-[10px] font-bold ${getPainTagColor(sess.pain_level_eva)}`}>
                        {sess.pain_level_eva} / 10
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs leading-relaxed">
                    <p className="text-slate-800">
                      <strong className="text-slate-900 block mb-0.5">Tratamiento Aplicado:</strong>
                      <span className="text-slate-600 font-medium whitespace-pre-wrap">{sess.treatment_applied}</span>
                    </p>
                    {sess.observations && (
                      <p className="text-slate-800">
                        <strong className="text-slate-900 block mb-0.5">Observaciones:</strong>
                        <span className="text-slate-600 font-medium whitespace-pre-wrap">{sess.observations}</span>
                      </p>
                    )}
                  </div>
                  
                  <div className="pt-2 border-t border-slate-50 text-[10px] text-slate-400 font-semibold">
                    Registrado por: {sess.profiles ? `Lic. ${sess.profiles.first_name} ${sess.profiles.last_name}` : "Terapeuta responsable"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Wrapping in callback optimization
import { useCallback } from "react";
