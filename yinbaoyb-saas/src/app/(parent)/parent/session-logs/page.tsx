"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { useParentData } from "@/hooks/useParentData";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { 
  ClipboardList, 
  Activity, 
  Calendar, 
  User, 
  BookOpen, 
  Sparkles, 
  MessageSquare,
  ChevronRight,
  TrendingUp,
  FileText
} from "lucide-react";

interface TherapistProfile {
  first_name: string;
  last_name: string;
}

interface ClinicalNote {
  id: string;
  format: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  behavior: string | null;
  intervention: string | null;
  response: string | null;
  data: string | null;
  mood: string | null;
  content: string | null;
  tasks_assigned: string | null;
  next_objective: string | null;
  progress_score: number | null;
  signed: boolean;
  created_at: string;
  profiles: TherapistProfile | null;
}

interface PhysicalTherapySession {
  id: string;
  session_number: number;
  treatment_applied: string;
  observations: string | null;
  pain_level_eva: number;
  created_at: string;
  profiles: TherapistProfile | null;
}

const renderFormattedText = (text: string) => {
  if (!text) return null;
  
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <div className="space-y-3 whitespace-pre-line text-sm text-gray-700">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const boldText = part.slice(2, -2);
          const lower = boldText.toLowerCase();
          
          let borderClass = "border-emerald-500 text-emerald-800 bg-emerald-50/40";
          if (lower.includes("recomendaciones") || lower.includes("casa") || lower.includes("tareas para")) {
            borderClass = "border-amber-500 text-amber-800 bg-amber-50/40";
          } else if (lower.includes("observaciones") || lower.includes("comentario")) {
            borderClass = "border-indigo-500 text-indigo-800 bg-indigo-50/40";
          }
          
          return (
            <div 
              key={i} 
              className={`font-bold text-xs uppercase tracking-wide border-l-4 pl-3 py-1.5 mt-4 first:mt-0 rounded-r-lg ${borderClass}`}
            >
              {boldText}
            </div>
          );
        }
        
        const cleanContent = part.replace(/^\n+/, '');
        return cleanContent ? <div key={i} className="pl-4 text-gray-600 font-medium leading-relaxed">{cleanContent}</div> : null;
      })}
    </div>
  );
};

export default function ParentSessionLogsPage() {
  const supabase = createClient();
  const { user } = useSession();
  const { children, loading: parentLoading, error: parentError } = useParentData();
  
  const [activeTab, setActiveTab] = useState<"clinical" | "physical">("clinical");
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);
  const [ptSessions, setPtSessions] = useState<PhysicalTherapySession[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  const previewFile = (fileObj: any) => {
    if (fileObj.file_data && fileObj.file_data.startsWith("data:application/pdf")) {
      setPreviewUrl(fileObj.file_data);
      setPreviewName(fileObj.file_name);
    } else {
      alert("La previsualización está disponible únicamente para archivos PDF");
    }
  };

  useEffect(() => {
    if (children.length > 0) {
      const child = children[0];
      const patientId = child.id || child.patient_id;
      loadSessionLogs(patientId);
    } else if (!parentLoading) {
      setLoadingLogs(false);
    }
  }, [children, parentLoading]);

  async function loadSessionLogs(patientId: string) {
    setLoadingLogs(true);
    setErrorLogs(null);
    try {
      // 1. Fetch clinical notes
      const { data: notesData, error: notesErr } = await supabase
        .from("clinical_notes")
        .select(`
          id,
          format,
          subjective,
          objective,
          assessment,
          plan,
          behavior,
          intervention,
          response,
          data,
          mood,
          content,
          tasks_assigned,
          next_objective,
          progress_score,
          signed,
          created_at,
          profiles!clinical_notes_therapist_id_fkey(first_name, last_name)
        `)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (notesErr) throw notesErr;

      // 2. Fetch physical therapy sessions
      const { data: ptData, error: ptErr } = await supabase
        .from("physical_therapy_sessions")
        .select(`
          id,
          session_number,
          treatment_applied,
          observations,
          pain_level_eva,
          created_at,
          profiles!physical_therapy_sessions_therapist_id_fkey(first_name, last_name)
        `)
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (ptErr) {
        console.warn("Could not load physical therapy sessions. They might not exist yet.", ptErr);
      }

      setClinicalNotes((notesData as unknown as ClinicalNote[]) || []);
      setPtSessions((ptData as unknown as PhysicalTherapySession[]) || []);
    } catch (err: any) {
      console.error("Error loading session logs:", err);
      setErrorLogs(err.message || "Error al cargar la bitácora de sesiones");
    } finally {
      setLoadingLogs(false);
    }
  }

  if (parentLoading || loadingLogs) {
    return <PageLoading text="Cargando bitácora de sesiones..." color="text-emerald-600" />;
  }

  if (parentError || errorLogs) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        Error: {parentError || errorLogs}
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">👨‍👩‍👧</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Portal de Padres</h2>
        <p className="text-gray-500">Aún no tienes pacientes vinculados para ver sus bitácoras.</p>
      </div>
    );
  }

  const child = children[0];
  const childName = `${child.first_name} ${child.last_name}`;

  // Helper to format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-EC", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case "SOAP": return "Terapia SOAP";
      case "BIRP": return "Terapia BIRP";
      case "DAP": return "Terapia DAP";
      case "libre": return "Nota Libre";
      case "progreso": return "Nota de Progreso";
      default: return "Nota de Terapia";
    }
  };

  const renderPainMeter = (level: number) => {
    const getColor = (lvl: number) => {
      if (lvl <= 2) return "bg-green-500";
      if (lvl <= 5) return "bg-yellow-500";
      if (lvl <= 8) return "bg-orange-500";
      return "bg-red-600";
    };

    return (
      <div className="space-y-1.5 w-full max-w-xs">
        <div className="flex justify-between text-[10px] text-gray-500 font-medium">
          <span>Dolor (EVA): {level}/10</span>
          <span>
            {level === 0 ? "Sin dolor" : 
             level <= 3 ? "Leve" : 
             level <= 6 ? "Moderado" : "Severo"}
          </span>
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${getColor(level)}`} 
            style={{ width: `${(level / 10) * 100}%` }} 
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📚 Sesiones y Comentarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Revisa el historial de actividades y observaciones registradas por los terapeutas para <span className="font-semibold text-emerald-600">{childName}</span>.
          </p>
        </div>
        
        {/* Child Badge */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 flex items-center gap-2 self-start md:self-auto">
          <span className="text-base">👦</span>
          <div className="text-xs">
            <p className="font-bold text-emerald-800">{childName}</p>
            <p className="text-emerald-600 uppercase tracking-wider font-semibold text-[9px]">Paciente Vinculado</p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("clinical")}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "clinical"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Terapia General ({clinicalNotes.length})
        </button>
        <button
          onClick={() => setActiveTab("physical")}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "physical"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Activity className="h-4 w-4" />
          Terapia Física ({ptSessions.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === "clinical" ? (
          clinicalNotes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">📝</div>
              <h3 className="text-base font-bold text-gray-800">Aún no hay notas registradas</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Los terapeutas generales registrarán la bitácora y comentarios en el sistema a medida que avancen las sesiones.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {clinicalNotes.map(note => {
                const tName = note.profiles ? `${note.profiles.first_name} ${note.profiles.last_name}` : "Terapeuta";
                const initial = tName.charAt(0);

                const isReport = note.content?.trim().startsWith('{"type":"informe"') || note.content?.trim().startsWith('{"type":"evaluacion"');
                let fileData: any = null;
                if (isReport) {
                  try {
                    fileData = JSON.parse(note.content || "");
                  } catch (e) {}
                }

                if (isReport && fileData) {
                  const formattedSize = fileData.file_size ? `${(fileData.file_size / 1024).toFixed(1)} KB` : "";
                  const isPdf = fileData.file_name?.toLowerCase().endsWith(".pdf");
                  return (
                    <div key={note.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow transition-shadow flex flex-col md:flex-row gap-6">
                      <div className="md:w-1/4 flex md:flex-col items-start gap-4 md:border-r md:border-gray-100 md:pr-6">
                        <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {initial}
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900 text-sm">{tName}</p>
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Documento Compartido</p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium pt-1">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span>{formatDate(note.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-xl p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${isPdf ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                            {isPdf ? "PDF" : "DOC"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{fileData.file_name}</p>
                            <p className="text-xs text-gray-400">{formattedSize}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => previewFile(fileData)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm cursor-pointer active:scale-95"
                          >
                            Previsualizar
                          </button>
                          <button
                            onClick={() => {
                              try {
                                const link = document.createElement("a");
                                link.href = fileData.file_data;
                                link.download = fileData.file_name;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              } catch (e) {
                                alert("Error al descargar el archivo");
                              }
                            }}
                            className="px-3.5 py-1.5 text-xs font-semibold text-emerald-600 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm active:scale-95 cursor-pointer"
                          >
                            Descargar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={note.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow transition-shadow flex flex-col md:flex-row gap-6">
                    {/* Sidebar Card Metadata */}
                    <div className="md:w-1/4 flex md:flex-col items-start gap-4 md:border-r md:border-gray-100 md:pr-6">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {initial}
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-gray-900 text-sm">{tName}</p>
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{getFormatLabel(note.format)}</p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium pt-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>{formatDate(note.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Main Content Areas */}
                    <div className="flex-1 space-y-4">
                      {/* SOAP Format Parsing */}
                      {note.format === "SOAP" && (
                        <div className="grid grid-cols-1 gap-3">
                          {note.subjective && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Observaciones del Menor (Subjetivo)</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.subjective}</p>
                            </div>
                          )}
                          {note.objective && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Actividades Desarrolladas (Objetivo)</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.objective}</p>
                            </div>
                          )}
                          {note.assessment && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Evaluación de Avance (Análisis)</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.assessment}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* BIRP Format Parsing */}
                      {note.format === "BIRP" && (
                        <div className="grid grid-cols-1 gap-3">
                          {note.behavior && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Comportamiento en Sesión</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.behavior}</p>
                            </div>
                          )}
                          {note.intervention && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Intervención Terapéutica</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.intervention}</p>
                            </div>
                          )}
                          {note.response && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Respuesta del Menor</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.response}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* DAP Format Parsing */}
                      {note.format === "DAP" && (
                        <div className="grid grid-cols-1 gap-3">
                          {note.data && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Datos de la Sesión</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.data}</p>
                            </div>
                          )}
                          {note.assessment && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Análisis Clínico</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.assessment}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Libre Format Parsing */}
                      {note.format === "libre" && note.content && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Bitácora de la Sesión</h4>
                          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                            {renderFormattedText(note.content)}
                          </div>
                        </div>
                      )}

                      {/* Flex/Other fields */}
                      {note.format === "progreso" && (
                        <div className="grid grid-cols-1 gap-3">
                          {note.content && (
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Avances Registrados</h4>
                              <p className="text-sm text-gray-700 mt-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">{note.content}</p>
                            </div>
                          )}
                          {note.progress_score !== null && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Puntaje de sesión:</span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {note.progress_score}/10
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Mood / Estado de ánimo */}
                      {note.mood && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                          <span>Estado de ánimo en terapia:</span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200 font-bold capitalize">{note.mood}</span>
                        </div>
                      )}

                      {/* Tasks assigned to home / COMPROMISOS */}
                      {note.tasks_assigned && (
                        <div className="border-t border-dashed border-gray-100 pt-3 mt-1">
                          <h4 className="text-xs font-bold text-amber-600 flex items-center gap-1">
                            <span>🏠 Ejercicios / Tareas en Casa</span>
                          </h4>
                          <p className="text-sm text-gray-800 mt-1 bg-amber-50/40 p-3 rounded-lg border border-amber-200/50 font-medium whitespace-pre-line">
                            {note.tasks_assigned}
                          </p>
                        </div>
                      )}

                      {/* Next objective */}
                      {note.next_objective && (
                        <div className="border-t border-dashed border-gray-100 pt-3">
                          <h4 className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                            <span>🎯 Próximo Objetivo Terapéutico</span>
                          </h4>
                          <p className="text-sm text-gray-700 mt-1 font-medium italic">
                            {note.next_objective}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          ptSessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">🏃‍♂️</div>
              <h3 className="text-base font-bold text-gray-800">Aún no hay sesiones de terapia física</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Los fisioterapeutas registrarán las sesiones diarias, los ejercicios y evolución motriz de tu hijo/a aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {ptSessions.map(session => {
                const tName = session.profiles ? `${session.profiles.first_name} ${session.profiles.last_name}` : "Fisioterapeuta";
                const initial = tName.charAt(0);

                return (
                  <div key={session.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow transition-shadow flex flex-col md:flex-row gap-6">
                    {/* Sidebar metadata */}
                    <div className="md:w-1/4 flex md:flex-col items-start gap-4 md:border-r md:border-gray-100 md:pr-6">
                      <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {initial}
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-gray-900 text-sm">{tName}</p>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
                          Sesión #{session.session_number}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium pt-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>{formatDate(session.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Main content area */}
                    <div className="flex-1 space-y-4">
                      {/* Treatment applied */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tratamiento de Rehabilitación Aplicado</h4>
                        <p className="text-sm text-gray-800 mt-1.5 font-medium whitespace-pre-line bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                          {session.treatment_applied}
                        </p>
                      </div>

                      {/* Observations */}
                      {session.observations && (
                        <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Observaciones del Especialista</h4>
                          <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                            {session.observations}
                          </p>
                        </div>
                      )}

                      {/* Pain scale (EVA) */}
                      <div className="border-t border-gray-100 pt-3">
                        {renderPainMeter(session.pain_level_eva)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
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
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none cursor-pointer"
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
