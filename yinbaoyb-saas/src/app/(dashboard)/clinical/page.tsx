"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { NOTE_FORMAT_CONFIG, getRiskLevel } from "@/lib/constants";
import Link from "next/link";

// Tipos
interface Patient { id: string; first_name: string; last_name: string; status: string; active: boolean | null; }
interface ClinicalNote {
  id: string; patient_id: string; therapist_id: string; format: string;
  subjective: string | null; objective: string | null; assessment: string | null; plan: string | null;
  behavior: string | null; intervention: string | null; response: string | null;
  data: string | null; mood: string | null; content: string | null;
  tasks_assigned: string | null; next_objective: string | null;
  progress_score: number | null; signed: boolean; created_at: string;
  profiles?: { first_name: string; last_name: string } | null;
}
interface ScaleResult {
  id: string; patient_id: string; scale_id: string; total_score: number;
  risk_alert: boolean; notes: string | null; completed_at: string;
}
interface ScaleInfo { id: string; name: string; acronym: string; max_score: number; risk_threshold: number | null; }
interface ScaleQuestion { id: string; order_index: number; text: string; options: any; }

const formatConfig = NOTE_FORMAT_CONFIG;

const riskEmoji = (score: number, max: number) => getRiskLevel(score, max);

const THERAPIST_NOTE = "💡 Selecciona un paciente para comenzar. El flujo es: paciente → nota o escala → guardar.";

export default function ClinicalPage() {
  const supabase = createClient();
  const { user, tenantId } = useSession();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchPatient, setSearchPatient] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientNotes, setPatientNotes] = useState<ClinicalNote[]>([]);
  const [patientScales, setPatientScales] = useState<ScaleResult[]>([]);
  const [scales, setScales] = useState<ScaleInfo[]>([]);

  // Modo actual
  const [mode, setMode] = useState<"overview" | "note" | "scale">("overview");

  // Nota rápida
  const [noteFormat, setNoteFormat] = useState("SOAP");
  const [noteFields, setNoteFields] = useState<Record<string, string>>({});
  const [noteProgress, setNoteProgress] = useState(5);
  const [noteSigned, setNoteSigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escala
  const [selectedScale, setSelectedScale] = useState("");
  const [scaleQuestions, setScaleQuestions] = useState<ScaleQuestion[]>([]);
  const [scaleAnswers, setScaleAnswers] = useState<Record<string, number>>({});
  const [scaleNotes, setScaleNotes] = useState("");
  const [scaleSaving, setScaleSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: pErr } = await supabase.from("patients").select("id, first_name, last_name, status, active").eq("active", true).eq("tenant_id", tenantId).order("first_name");
      if (pErr) throw pErr;
      setPatients(data || []);

      const { data: scalesData, error: sErr } = await supabase.from("clinical_scales").select("id, name, acronym, max_score, risk_threshold").eq("tenant_id", tenantId);
      if (sErr) throw sErr;
      setScales(scalesData || []);
    } catch (err: any) {
      console.error("Error loading clinical data:", err);
      setError("Error de conexión: no se pudieron cargar los datos clínicos.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Cargar datos del paciente seleccionado
  useEffect(() => {
    if (!selectedPatient) return;
    loadPatientData(selectedPatient.id);
  }, [selectedPatient?.id]);

  async function loadPatientData(patientId: string) {
    const [notesRes, scalesRes] = await Promise.all([
      supabase.from("clinical_notes").select("*, profiles!clinical_notes_therapist_id_fkey(first_name, last_name)").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20),
      supabase.from("scale_results").select("id, patient_id, scale_id, total_score, risk_alert, notes, completed_at").eq("patient_id", patientId).order("completed_at", { ascending: false }).limit(20),
    ]);
    setPatientNotes(notesRes.data || []);
    setPatientScales(scalesRes.data || []);
  }

  // Cargar preguntas de escala
  useEffect(() => {
    if (!selectedScale) { setScaleQuestions([]); return; }
    supabase.from("scale_questions").select("id, order_index, text, options").eq("scale_id", selectedScale).order("order_index").then(({ data }: { data: ScaleQuestion[] | null }) => {
      setScaleQuestions(data || []);
      setScaleAnswers({});
    });
  }, [selectedScale]);

  async function handleSaveNote() {
    if (!selectedPatient) { setError("Selecciona un paciente"); return; }
    setSaving(true); setError(null);
    if (!user || !tenantId) { setError("No autenticado"); setSaving(false); return; }

    const noteData: Record<string, any> = {
      tenant_id: tenantId,
      patient_id: selectedPatient.id,
      therapist_id: user.id,
      format: noteFormat,
      progress_score: noteProgress,
      signed: noteSigned,
      ...noteFields,
    };
    Object.keys(noteData).forEach(k => { if (noteData[k] === "" || noteData[k] === undefined) noteData[k] = null; });

    const { error: err } = await supabase.from("clinical_notes").insert(noteData);
    if (err) { setError(err.message); setSaving(false); return; }
    setNoteFields({}); setNoteProgress(5); setNoteSigned(false); setSaving(false); setMode("overview");
    loadPatientData(selectedPatient.id);
  }

  async function handleSaveScale() {
    if (!selectedPatient || !selectedScale) { setError("Selecciona paciente y escala"); return; }
    if (Object.keys(scaleAnswers).length < scaleQuestions.length) { setError("Responde todas las preguntas"); return; }
    setScaleSaving(true); setError(null);
    if (!user || !tenantId) { setError("No autenticado"); setScaleSaving(false); return; }



    const totalScore = Object.values(scaleAnswers).reduce((s, v) => s + v, 0);
    const scaleInfo = scales.find(s => s.id === selectedScale);
    const riskAlert = scaleInfo?.risk_threshold ? totalScore >= scaleInfo.risk_threshold : false;

    const { error: err } = await supabase.from("scale_results").insert({
      tenant_id: tenantId!,
      patient_id: selectedPatient.id,
      scale_id: selectedScale,
      therapist_id: user.id,
      answers: scaleAnswers,
      total_score: totalScore,
      risk_alert: riskAlert,
      notes: scaleNotes || null,
    });
    if (err) { setError(err.message); setScaleSaving(false); return; }
    setScaleAnswers({}); setScaleNotes(""); setScaleQuestions([]); setSelectedScale(""); setScaleSaving(false); setMode("overview");
    loadPatientData(selectedPatient.id);
  }

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchPatient.toLowerCase())
  );

  // Escala info helper
  const getScaleInfo = (scaleId: string) => scales.find(s => s.id === scaleId);

  // Timeline unificado del paciente
  const timeline = [
    ...patientNotes.map(n => ({ type: "note" as const, date: n.created_at, data: n })),
    ...patientScales.map(s => ({ type: "scale" as const, date: s.completed_at, data: s })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clínico</h1>
        <p className="text-sm text-gray-500 mt-1">Historial clínico, notas de sesión y escalas</p>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between">{error}<button onClick={() => setError(null)} className="text-red-500 underline">Cerrar</button></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Selector de paciente */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">👥 Pacientes</h2>
            <input type="text" placeholder="Buscar paciente..." value={searchPatient} onChange={e => setSearchPatient(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sin pacientes activos</p>
              ) : filteredPatients.map(p => (
                <button key={p.id} onClick={() => { setSelectedPatient(p); setMode("overview"); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedPatient?.id === p.id ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "hover:bg-gray-50 text-gray-700"}`}>
                  <span className="font-medium">{p.first_name} {p.last_name}</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === "activo" ? "bg-green-50 text-green-700" : p.status === "lista_espera" ? "bg-yellow-50 text-yellow-700" : "bg-gray-50 text-gray-600"}`}>{p.status === "lista_espera" ? "En espera" : p.status}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Acciones rápidas */}
          {selectedPatient && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-2">⚡ Acciones Rápidas</h2>
              <button 
                onClick={() => { 
                  setMode("note"); 
                  if (!noteFormat) setNoteFormat("SOAP"); 
                }} 
                className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-100 transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                📝 Registrar Nota
              </button>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button onClick={() => { setMode("scale"); }} className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70 border border-emerald-100/50 transition-colors flex items-center gap-2 cursor-pointer">
                  📊 Aplicar escala
                </button>
                <Link href={`/patients/${selectedPatient.id}`} className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100/60 transition-colors flex items-center gap-2">
                  👤 Ver ficha del paciente
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: Contenido */}
        <div className="lg:col-span-2 space-y-4">

          {/* Sin paciente seleccionado */}
          {!selectedPatient && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-5xl mb-4">🏥</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Módulo Clínico</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">{THERAPIST_NOTE}</p>
            </div>
          )}

          {/* OVERVIEW: Timeline del paciente */}
          {selectedPatient && mode === "overview" && (
            <>
              {/* Header del paciente */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedPatient.first_name} {selectedPatient.last_name}</h2>
                    <p className="text-sm text-gray-500">
                      {patientNotes.length} nota{patientNotes.length !== 1 ? "s" : ""} · {patientScales.length} escala{patientScales.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {patientScales.length > 0 && (() => {
                      const last = patientScales[0];
                      const info = getScaleInfo(last.scale_id);
                      const risk = riskEmoji(last.total_score, info?.max_score || 27);
                      return (
                        <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${risk.color} bg-gray-50`}>
                          {risk.emoji} Última escala: {last.total_score}/{info?.max_score || "?"}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Progreso visual */}
                {patientScales.length >= 2 && (() => {
                  const info = getScaleInfo(patientScales[0].scale_id);
                  const maxScore = info?.max_score || 27;
                  const last3 = patientScales.slice(0, Math.min(5, patientScales.length)).reverse();
                  return (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">Evolución de escalas</p>
                      <div className="flex items-end gap-1 h-16">
                        {last3.map((s, i) => {
                          const pct = maxScore ? (s.total_score / maxScore) * 100 : 0;
                          const r = riskEmoji(s.total_score, maxScore);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div className={`w-full rounded-t ${r.emoji === "🔴" ? "bg-red-400" : r.emoji === "🟡" ? "bg-yellow-400" : "bg-green-400"}`} style={{ height: `${Math.max(pct, 8)}%` }} />
                              <span className="text-[10px] text-gray-400">{s.total_score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Timeline */}
              {timeline.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <div className="text-3xl mb-2">📝</div>
                  <p className="text-sm text-gray-500">Sin registros clínicos aún</p>
                  <button onClick={() => setMode("note")} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Crear primera nota</button>
                </div>
              ) : timeline.map((item, i) => {
                if (item.type === "note") {
                  const n = item.data as ClinicalNote;
                  const cfg = formatConfig[n.format] || formatConfig.libre;
                  return (
                    <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                        {n.profiles && <span className="text-xs text-gray-500">👨‍⚕️ {n.profiles.first_name} {n.profiles.last_name}</span>}
                        {n.signed && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">✓ Firmada</span>}
                        {n.progress_score && <span className={`text-xs font-medium ${n.progress_score >= 7 ? "text-green-600" : n.progress_score >= 4 ? "text-yellow-600" : "text-red-600"}`}>Progreso: {n.progress_score}/10</span>}
                        <span className="text-xs text-gray-400 ml-auto">{new Date(n.created_at).toLocaleDateString("es-EC", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="space-y-1.5">
                        {cfg.fields.map(f => {
                          const val = (n as any)[f.key];
                          if (!val) return null;
                          return <p key={f.key} className="text-sm"><span className="font-medium text-gray-700">{f.label}:</span> <span className="text-gray-600">{val.length > 120 ? val.slice(0, 120) + "..." : val}</span></p>;
                        })}
                      </div>
                    </div>
                  );
                } else {
                  const s = item.data as ScaleResult;
                  const info = getScaleInfo(s.scale_id);
                  const risk = riskEmoji(s.total_score, info?.max_score || 27);
                  return (
                    <div key={i} className={`rounded-xl border p-4 ${s.risk_alert ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">📊 {info?.acronym || "Escala"}</span>
                          {s.risk_alert && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚠️ Alerta</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-lg font-bold ${risk.color}`}>{s.total_score}</span>
                          <span className="text-xs text-gray-400">/{info?.max_score || "?"}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className={`h-1.5 rounded-full ${s.risk_alert ? "bg-red-500" : risk.emoji === "🟡" ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(info?.max_score ? (s.total_score / info.max_score) * 100 : 0, 100)}%` }} /></div>
                      <p className="text-xs text-gray-400 mt-1">{info?.name} · {new Date(s.completed_at).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</p>
                    </div>
                  );
                }
              })}
            </>
          )}

          {/* MODO NOTA */}
          {selectedPatient && mode === "note" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">📝 Nueva nota para {selectedPatient.first_name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{formatConfig[noteFormat]?.label}</p>
                </div>
                <button onClick={() => setMode("overview")} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {/* Selector de formato estilo Tab Bar Segmentado */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Formato de la Nota</label>
                <div className="bg-gray-100/80 backdrop-blur-sm p-1 rounded-xl flex flex-wrap gap-1 border border-gray-200/50">
                  {Object.entries(formatConfig).map(([key, cfg]) => {
                    const isActive = noteFormat === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setNoteFormat(key);
                          setNoteFields({});
                        }}
                        className={`flex-1 min-w-[70px] text-center px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                          isActive
                            ? "bg-white text-indigo-700 shadow-sm border border-gray-200/30"
                            : "text-gray-500 hover:text-gray-700 hover:bg-white/40"
                        }`}
                      >
                        <span className="text-sm leading-none">{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campos dinámicos */}
              <div className="space-y-4 mb-5">
                {(formatConfig[noteFormat]?.fields || []).map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                    <textarea value={noteFields[field.key] || ""} onChange={e => setNoteFields({ ...noteFields, [field.key]: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y" placeholder={field.placeholder} />
                  </div>
                ))}
              </div>

              {/* Puntuación de progreso */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Progreso de sesión</label>
                  <span className={`text-sm font-bold ${noteProgress >= 7 ? "text-green-600" : noteProgress >= 4 ? "text-yellow-600" : "text-red-600"}`}>{noteProgress}/10</span>
                </div>
                <input type="range" min={1} max={10} value={noteProgress} onChange={e => setNoteProgress(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>😰 Muy mal</span><span>😐 Neutral</span><span>😊 Excelente</span></div>
              </div>

              {/* Firma */}
              <div className="flex items-center gap-2 mb-5">
                <input type="checkbox" id="sign" checked={noteSigned} onChange={e => setNoteSigned(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                <label htmlFor="sign" className="text-sm text-gray-700">🔒 Firmar nota (bloquea edición futura)</label>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setMode("overview")} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSaveNote} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "Guardando..." : "💾 Guardar nota"}</button>
              </div>
            </div>
          )}

          {/* MODO ESCALA */}
          {selectedPatient && mode === "scale" && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">📊 Aplicar escala a {selectedPatient.first_name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Responde cada pregunta según lo reportado por el paciente</p>
                </div>
                <button onClick={() => setMode("overview")} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {/* Selector de escala */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                {scales.map(s => (
                  <button key={s.id} onClick={() => setSelectedScale(s.id)} className={`px-3 py-2.5 rounded-lg text-sm border transition-colors text-left ${selectedScale === s.id ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                    <span className="font-semibold">{s.acronym}</span>
                    <span className="block text-xs text-gray-500">{s.name}</span>
                  </button>
                ))}
              </div>

              {/* Preguntas */}
              {scaleQuestions.length > 0 && (
                <div className="space-y-3 mb-5">
                  {scaleQuestions.map((q, i) => {
                    const options = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
                    const currentAnswer = scaleAnswers[q.id];
                    return (
                      <div key={q.id} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-900 mb-2">{i + 1}. {q.text}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.isArray(options) ? options.map((opt: any, oi: number) => {
                            const val = typeof opt === "object" ? opt.value : oi;
                            const label = typeof opt === "object" ? opt.label : opt;
                            return (
                              <button key={oi} onClick={() => setScaleAnswers({ ...scaleAnswers, [q.id]: val })}
                                className={`px-2.5 py-1 rounded text-xs border transition-colors ${currentAnswer === val ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-300 hover:border-indigo-300"}`}>
                                {label}
                              </button>
                            );
                          }) : <p className="text-xs text-gray-500">Sin opciones</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Puntuación en vivo */}
              {Object.keys(scaleAnswers).length > 0 && (() => {
                const total = Object.values(scaleAnswers).reduce((s, v) => s + v, 0);
                const info = scales.find(s => s.id === selectedScale);
                const risk = riskEmoji(total, info?.max_score || 27);
                return (
                  <div className={`rounded-lg p-4 mb-5 ${scaleAnswers.length >= scaleQuestions.length && risk.emoji === "🔴" ? "bg-red-50 border border-red-200" : "bg-indigo-50 border border-indigo-200"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Puntuación</p>
                        <p className="text-xs text-gray-500">{Object.keys(scaleAnswers).length} de {scaleQuestions.length} preguntas respondidas</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-3xl font-bold ${risk.color}`}>{total}</span>
                        <span className="text-sm text-gray-400">/{info?.max_score || "?"}</span>
                        <p className={`text-xs font-medium ${risk.color}`}>{risk.emoji} {risk.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notas */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
                <textarea value={scaleNotes} onChange={e => setScaleNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y" placeholder="Notas adicionales sobre la evaluación..." />
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setMode("overview")} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSaveScale} disabled={scaleSaving || !selectedScale || !selectedPatient} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">{scaleSaving ? "Guardando..." : "💾 Guardar escala"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}