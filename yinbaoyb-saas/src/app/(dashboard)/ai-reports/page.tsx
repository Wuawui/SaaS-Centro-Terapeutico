"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { 
  Sparkles, 
  Search, 
  Printer, 
  AlertCircle,
  FileText,
  User,
  MapPin,
  Calendar,
  Layers,
  Heart,
  Save,
  CheckCircle
} from "lucide-react";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  primary_diagnosis: string | null;
  reason_for_consultation: string | null;
  birth_date: string | null;
  status: string;
  address: string | null;
  emergency_contact_name: string | null;
}

// Helper components for print/edit duality
function PrintEditableTextarea({
  value,
  onChange,
  className = "w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-700 bg-slate-50/20 focus:outline-none"
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  return (
    <>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${className} print:hidden`}
      />
      <p className="hidden print:block whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
        {value}
      </p>
    </>
  );
}

function PrintEditableInput({
  value,
  onChange,
  className = "bg-transparent border-b border-dashed border-gray-300 w-full focus:outline-none font-semibold text-slate-800"
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${className} print:hidden`}
      />
      <span className="hidden print:inline font-semibold text-slate-800">
        {value}
      </span>
    </>
  );
}

export default function AIReportsPage() {
  const supabase = createClient();
  const { tenantId } = useSession();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  const [notesCount, setNotesCount] = useState<number>(0);
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable general details
  const [reportType, setReportType] = useState<"process-therapeutic" | "classroom-observation">("process-therapeutic");
  const [reportDate, setReportDate] = useState("");
  const [observationDate, setObservationDate] = useState("");
  const [recipientVal, setRecipientVal] = useState("DECE de Preescolar ANAI");
  const [diagnosisVal, setDiagnosisVal] = useState("");
  const [addressVal, setAddressVal] = useState("");
  const [representativeVal, setRepresentativeVal] = useState("");
  const [customAgeVal, setCustomAgeVal] = useState("");
  const [centerNameVal, setCenterNameVal] = useState("Centro Terapéutico Logros");
  const [centerSubtitleVal, setCenterSubtitleVal] = useState("Centro Terapéutico Integral");
  const [profName, setProfName] = useState("Mirella Morán Parreño");
  const [profSpecialty, setProfSpecialty] = useState("Lic. En Terapia Ocupacional");
  const [profCenter, setProfCenter] = useState("LOGROS");
  const [contactAddress, setContactAddress] = useState("San Eduardo Av Barcelona");
  const [contactPhone, setContactPhone] = useState("0998168551");
  const [contactInstagram, setContactInstagram] = useState("@centroterapeutico_logros");

  // Load active patients for selector
  const loadPatients = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error: pErr } = await supabase
        .from("patients")
        .select("id, first_name, last_name, primary_diagnosis, reason_for_consultation, birth_date, status, address, emergency_contact_name")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("first_name");

      if (pErr) throw pErr;
      setPatients(data || []);
      setFilteredPatients(data || []);
    } catch (err: any) {
      console.error("Error loading patients:", err);
      setError("No se pudieron cargar los pacientes de la sede.");
    } finally {
      setLoading(false);
    }
  }, [tenantId, supabase]);

  useEffect(() => {
    loadPatients();
    // set default report date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setReportDate(`${yyyy}-${mm}-${dd}`);
    setObservationDate(`${yyyy}-${mm}-${dd}`);
  }, [loadPatients]);

  // Search filter
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = patients.filter(p => 
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(query) ||
      (p.primary_diagnosis?.toLowerCase().includes(query) ?? false)
    );
    setFilteredPatients(filtered);
  }, [searchQuery, patients]);

  // Calculate age helper
  const getAge = (dob: string | null) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / 31557600000);
  };

  // Format date helper (e.g. 15 de Mayo del 2021)
  const formatBirthDate = (dob: string | null) => {
    if (!dob) return "—";
    const date = new Date(dob + "T00:00:00");
    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    return `${date.getDate()} de ${months[date.getMonth()]} del ${date.getFullYear()}`;
  };

  // Handle select patient
  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setReport(null);
    setError(null);
    setSuccessMsg(null);
    setNotesCount(0);

    // Populate editable patient fields
    setDiagnosisVal(patient.primary_diagnosis || "");
    setAddressVal(patient.address || "");
    const age = getAge(patient.birth_date);
    setCustomAgeVal(age !== null ? `${age} años` : "");

    try {
      // 1. Fetch notes count
      const { count, error: countErr } = await supabase
        .from("clinical_notes")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patient.id);
      if (countErr) throw countErr;
      setNotesCount(count || 0);

      // 2. Fetch parent representative
      const { data: ppData } = await supabase
        .from("parent_patients")
        .select("relationship, profiles(first_name, last_name)")
        .eq("patient_id", patient.id)
        .limit(1);

      if (ppData?.[0]?.profiles) {
        const p: any = ppData[0].profiles;
        setRepresentativeVal(`${p.first_name} ${p.last_name}`);
      } else {
        setRepresentativeVal(patient.emergency_contact_name || "");
      }
    } catch (err) {
      console.error("Error loading patient details:", err);
    }
  };

  // Call API to generate report
  const handleGenerateReport = async () => {
    if (!selectedPatient) return;
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    setReport(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Inicia sesión para realizar esta acción.");
        setGenerating(false);
        return;
      }

      const res = await fetch("/api/clinical/ai-detailed-report", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          patientId: selectedPatient.id,
          reportType: reportType
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Error al procesar el reporte con IA.");
      }

      setReport(result);
      if (reportType === "classroom-observation") {
        setRecipientVal(result.destinatario || "DECE de Preescolar ANAI");
      }
      setSuccessMsg("¡Informe estructurado y rellenado con éxito por la IA!");
    } catch (err: any) {
      console.error("AI Report Error:", err);
      setError(err.message || "Error al conectar con el servidor de IA.");
    } finally {
      setGenerating(false);
    }
  };

  // Native window print
  const handlePrint = () => {
    window.print();
  };

  // Helper to handle report field edits
  const updateReportField = (key: string, value: any) => {
    if (!report) return;
    setReport({
      ...report,
      [key]: value
    });
  };

  // Helper to handle TO/TL objectives edits
  const updateObjective = (type: "to" | "tl", index: number, value: string) => {
    if (!report) return;
    const key = type === "to" ? "objetivos_to" : "objetivos_tl";
    const arr = [...report[key]];
    arr[index] = value;
    setReport({
      ...report,
      [key]: arr
    });
  };

  if (loading) return <PageLoading text="Cargando panel de informes..." />;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/* Screen Header (Hidden on Print) */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-outfit">Informes Directivos e Institucionales</h1>
            <p className="text-sm text-gray-500 mt-1">Genera informes oficiales estructurados con IA para el Centro y el entorno escolar</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-800 flex items-start gap-3 print:hidden">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Error</h4>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 flex items-start gap-3 print:hidden">
            <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Proceso Exitoso</h4>
              <p className="text-xs text-emerald-700 mt-1">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Selector & Config (Hidden on Print) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
          {/* Selector de Pacientes */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-soft p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4 font-outfit">🔍 Selección de Paciente</h2>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por nombre..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
              />
            </div>

            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              {filteredPatients.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No se encontraron pacientes activos</p>
              ) : filteredPatients.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => handleSelectPatient(p)}
                  className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all border ${
                    selectedPatient?.id === p.id 
                      ? "bg-indigo-50 text-indigo-700 border-indigo-250/50 shadow-sm" 
                      : "hover:bg-slate-50 text-slate-600 border-transparent"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-outfit text-sm">{p.first_name} {p.last_name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      p.status === "activo" ? "bg-green-50 text-green-700 border border-green-200" : "bg-yellow-50 text-yellow-700 border border-yellow-250"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  {p.primary_diagnosis && (
                    <p className="text-[10px] text-slate-400 mt-1 font-mono italic">Diagnóstico: {p.primary_diagnosis}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Ficha & Controles del Informe */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedPatient ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                <div className="text-5xl mb-4">📄</div>
                <h2 className="text-base font-bold text-gray-900 font-outfit">Gestor de Informes de IA</h2>
                <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
                  Selecciona un paciente a la izquierda para configurar su informe oficial y autocompletarlo con IA.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-indigo-50 text-indigo-650 px-2.5 py-1 rounded-full font-outfit">Datos del Informe</span>
                    <h2 className="text-lg font-bold text-slate-900 font-outfit mt-2">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">{notesCount} notas clínicas de evolución encontradas</p>
                  </div>

                  {/* Selector de Tipo de Informe */}
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-xs self-start">
                    <button
                      type="button"
                      onClick={() => {
                        setReportType("process-therapeutic");
                        setReport(null);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className={`px-3 py-2 text-[10px] font-bold rounded-lg transition-all ${
                        reportType === "process-therapeutic"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      📄 Proceso Terapéutico
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportType("classroom-observation");
                        setReport(null);
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className={`px-3 py-2 text-[10px] font-bold rounded-lg transition-all ${
                        reportType === "classroom-observation"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🏫 Observación Áulica
                    </button>
                  </div>
                </div>

                {/* Patient and report configurations before generating */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Nombre del Centro (Cabecera)</label>
                    <input 
                      type="text"
                      value={centerNameVal}
                      onChange={e => setCenterNameVal(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Subtítulo del Centro</label>
                    <input 
                      type="text"
                      value={centerSubtitleVal}
                      onChange={e => setCenterSubtitleVal(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {reportType === "process-therapeutic" ? (
                    <div>
                      <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Fecha de Informe</label>
                      <input 
                        type="date"
                        value={reportDate}
                        onChange={e => setReportDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Fecha de Observación</label>
                      <input 
                        type="date"
                        value={observationDate}
                        onChange={e => setObservationDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Edad a mostrar</label>
                    <input 
                      type="text"
                      value={customAgeVal}
                      onChange={e => setCustomAgeVal(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {reportType === "classroom-observation" && (
                    <div>
                      <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Destinatario (DECE / Escuela)</label>
                      <input 
                        type="text"
                        value={recipientVal}
                        onChange={e => setRecipientVal(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {reportType === "process-therapeutic" && (
                    <>
                      <div>
                        <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Diagnóstico Clínico</label>
                        <input 
                          type="text"
                          value={diagnosisVal}
                          onChange={e => setDiagnosisVal(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Representante Legal</label>
                        <input 
                          type="text"
                          value={representativeVal}
                          onChange={e => setRepresentativeVal(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2">
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Dirección del menor</label>
                    <input 
                      type="text"
                      value={addressVal}
                      onChange={e => setAddressVal(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[9px] font-bold tracking-wider uppercase text-indigo-650">Configuración del Pie de Firma</span>
                  </div>
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Nombre del Profesional</label>
                    <input 
                      type="text"
                      value={profName}
                      onChange={e => setProfName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Cargo / Especialidad</label>
                    <input 
                      type="text"
                      value={profSpecialty}
                      onChange={e => setProfSpecialty(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Institución / Sello</label>
                    <input 
                      type="text"
                      value={profCenter}
                      onChange={e => setProfCenter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 mt-2 pt-2 border-t border-slate-100">
                    <span className="text-[9px] font-bold tracking-wider uppercase text-indigo-650">Redes Sociales y Dirección (Pie de Página)</span>
                  </div>
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Dirección de Contacto</label>
                    <input 
                      type="text"
                      value={contactAddress}
                      onChange={e => setContactAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Teléfono / WhatsApp</label>
                    <input 
                      type="text"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Instagram</label>
                    <input 
                      type="text"
                      value={contactInstagram}
                      onChange={e => setContactInstagram(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-sm">
                    Al presionar el botón de abajo, la inteligencia artificial procesará el historial clínico y redactará un informe técnico completo.
                  </p>
                  
                  <button
                    onClick={handleGenerateReport}
                    disabled={generating || notesCount === 0}
                    className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold py-3 px-5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-500/10 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    {generating ? "Generando Informe..." : "Auto-rellenar con IA"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generating Loading State Screen (Hidden on Print) */}
        {generating && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-soft print:hidden">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-50" />
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 animate-pulse font-outfit">La IA está estructurando y analizando el historial clínico...</h3>
                <p className="text-xs text-slate-400 mt-1">Este proceso compilará información de {notesCount} sesiones.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* REPORT PRINT VIEW & EDITOR STACK */}
      {report && selectedPatient && (
        <div className="space-y-6">
          {/* Actionbar above print sheet (Screen only) */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden mt-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 font-outfit">Edición de Informe antes de imprimir</h2>
              <p className="text-xs text-slate-400">Puedes editar cualquier texto directamente en la hoja y luego imprimir.</p>
            </div>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Imprimir / Descargar PDF
            </button>
          </div>

          {/* RENDERING OPTION 1: INFORME DE PROCESO TERAPEUTICO */}
          {reportType === "process-therapeutic" ? (
            <div className="bg-white text-black p-8 md:p-16 border border-slate-200 shadow-xl rounded-3xl max-w-[900px] mx-auto print-sheet font-sans">
              
              {/* Page Header (Logo & Areas) */}
              <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-4 mb-6 font-sans">
                <div className="flex flex-col">
                  <span className="text-indigo-950 font-extrabold text-2xl tracking-wider font-outfit uppercase">{centerNameVal}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{centerSubtitleVal}</span>
                </div>
                <div className="text-right text-[10px] text-slate-700 italic leading-snug">
                  <p>Estimulación Temprana</p>
                  <p>Terapia Ocupacional</p>
                  <p>Terapia de Lenguaje</p>
                  <p>Psicología</p>
                </div>
              </div>

              {/* Title */}
              <div className="text-center my-6">
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">Informe de Proceso Terapéutico</h2>
              </div>

              {/* Fecha de Informe */}
              <div className="text-sm mb-6 flex items-center gap-1 font-sans">
                <span className="font-bold text-slate-800">Fecha de Informe:</span>
                <PrintEditableInput 
                  value={reportDate}
                  onChange={setReportDate}
                  className="border-b border-dashed border-gray-300 focus:outline-none font-medium w-36 px-1 bg-transparent"
                />
              </div>

              {/* 1. DATOS PERSONALES */}
              <div className="mb-8 font-sans">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">1. Datos Personales</h3>
                <table className="w-full text-xs text-left leading-relaxed">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 pr-4 font-bold text-slate-700 w-36">Nombre:</th>
                      <td className="py-2 text-slate-800 font-semibold">{selectedPatient.first_name} {selectedPatient.last_name}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 pr-4 font-bold text-slate-700">Fecha de nacimiento:</th>
                      <td className="py-2 text-slate-800">{formatBirthDate(selectedPatient.birth_date)}</td>
                      <th className="py-2 px-4 font-bold text-slate-700 w-24">Edad:</th>
                      <td className="py-2 text-slate-800">
                        <PrintEditableInput 
                          value={customAgeVal} 
                          onChange={setCustomAgeVal} 
                        />
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 pr-4 font-bold text-slate-700">Diagnóstico:</th>
                      <td className="py-2 text-slate-800" colSpan={3}>
                        <PrintEditableInput 
                          value={diagnosisVal} 
                          onChange={setDiagnosisVal} 
                          className="bg-transparent border-b border-dashed border-gray-300 w-full focus:outline-none font-medium text-slate-800"
                        />
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 pr-4 font-bold text-slate-700">Dirección:</th>
                      <td className="py-2 text-slate-800" colSpan={3}>
                        <PrintEditableInput 
                          value={addressVal} 
                          onChange={setAddressVal} 
                        />
                      </td>
                    </tr>
                    <tr>
                      <th className="py-2 pr-4 font-bold text-slate-700">Representante:</th>
                      <td className="py-2 text-slate-800" colSpan={3}>
                        <PrintEditableInput 
                          value={representativeVal} 
                          onChange={setRepresentativeVal} 
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* MOTIVO DE INFORME */}
              <div className="mb-8 avoid-page-break">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-1.5">Motivo de Informe</h4>
                <PrintEditableTextarea
                  value={report.motivo_informe}
                  onChange={val => updateReportField("motivo_informe", val)}
                  className="w-full min-h-[80px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* AREA TERAPIA OCUPACIONAL */}
              <div className="mb-8 avoid-page-break">
                <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider border-b-2 border-indigo-900 pb-1 mb-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-800 print:hidden" />
                  Área Terapia Ocupacional
                </h3>
                
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">Enfoque de Intervención Actual</h4>
                  <PrintEditableTextarea
                    value={report.enfoque_to}
                    onChange={val => updateReportField("enfoque_to", val)}
                    className="w-full min-h-[90px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* PLAN DE TRABAJO (TO) */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">Plan de Trabajo (Procesamiento Sensorial, Praxias y Autonomía)</h4>
                  
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Perfil Sensorial y Modulación de la Atención:</h5>
                    <PrintEditableTextarea
                      value={report.plan_sensorial_to}
                      onChange={val => updateReportField("plan_sensorial_to", val)}
                      className="w-full min-h-[70px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Transiciones y Regulación Conductual:</h5>
                    <PrintEditableTextarea
                      value={report.plan_transiciones_to}
                      onChange={val => updateReportField("plan_transiciones_to", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Agarre y Grafomotricidad:</h5>
                    <PrintEditableTextarea
                      value={report.plan_grafomotricidad_to}
                      onChange={val => updateReportField("plan_grafomotricidad_to", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Habilidades de Coordinación:</h5>
                    <PrintEditableTextarea
                      value={report.plan_coordinacion_to}
                      onChange={val => updateReportField("plan_coordinacion_to", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Motricidad Gruesa y Planeamiento Motor:</h5>
                    <PrintEditableTextarea
                      value={report.plan_motricidad_gruesa_to}
                      onChange={val => updateReportField("plan_motricidad_gruesa_to", val)}
                      className="w-full min-h-[75px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Seguimiento de Órdenes y Continuidad de la Tarea:</h5>
                    <PrintEditableTextarea
                      value={report.plan_cognitivo_to}
                      onChange={val => updateReportField("plan_cognitivo_to", val)}
                      className="w-full min-h-[70px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Orientación y Conceptos Básicos:</h5>
                    <PrintEditableTextarea
                      value={report.plan_conceptos_to}
                      onChange={val => updateReportField("plan_conceptos_to", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Alimentación y Rutina de Mesa (AVD):</h5>
                    <PrintEditableTextarea
                      value={report.plan_alimentacion_to}
                      onChange={val => updateReportField("plan_alimentacion_to", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Vestido e Higiene (AVD):</h5>
                    <PrintEditableTextarea
                      value={report.plan_vestido_to}
                      onChange={val => updateReportField("plan_vestido_to", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Regulación Emocional y Conductual:</h5>
                    <PrintEditableTextarea
                      value={report.plan_regulacion_conductual_to}
                      onChange={val => updateReportField("plan_regulacion_conductual_to", val)}
                      className="w-full min-h-[65px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* OBJETIVOS TO */}
                <div className="mt-6 avoid-page-break">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-2">Objetivos TO</h4>
                  <div className="space-y-2">
                    {report.objetivos_to?.map((obj: string, i: number) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-xs font-bold mt-2 text-indigo-700 font-mono">•</span>
                        <PrintEditableTextarea
                          value={obj}
                          onChange={val => updateObjective("to", i, val)}
                          className="w-full min-h-[45px] p-1.5 border border-slate-200 rounded-md text-xs leading-relaxed text-slate-700 bg-slate-50/20 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AREA TERAPIA DE LENGUAJE */}
              <div className="mb-8 avoid-page-break mt-8">
                <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider border-b-2 border-indigo-900 pb-1 mb-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-800 print:hidden" />
                  Área de Terapia de Lenguaje
                </h3>

                <div className="mb-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">Enfoque de Intervención Actual</h4>
                  <PrintEditableTextarea
                    value={report.enfoque_tl}
                    onChange={val => updateReportField("enfoque_tl", val)}
                    className="w-full min-h-[90px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                  />
                </div>

                {/* PLAN DE TRABAJO (TL) */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">Plan de Trabajo</h4>
                  
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Comprensión y Seguimiento de Instrucciones:</h5>
                    <PrintEditableTextarea
                      value={report.plan_instrucciones_tl}
                      onChange={val => updateReportField("plan_instrucciones_tl", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Intención Comunicativa y Pragmática:</h5>
                    <PrintEditableTextarea
                      value={report.plan_intencion_tl}
                      onChange={val => updateReportField("plan_intencion_tl", val)}
                      className="w-full min-h-[70px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Sistemas Aumentativos y Alternativos de Comunicación (SAAC):</h5>
                    <PrintEditableTextarea
                      value={report.plan_saac_tl}
                      onChange={val => updateReportField("plan_saac_tl", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Expansión de estructuras comunicativas:</h5>
                    <PrintEditableTextarea
                      value={report.plan_estructuras_tl}
                      onChange={val => updateReportField("plan_estructuras_tl", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Memoria y atención de lo aprendido:</h5>
                    <PrintEditableTextarea
                      value={report.plan_memoria_tl}
                      onChange={val => updateReportField("plan_memoria_tl", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Atención conjunta:</h5>
                    <PrintEditableTextarea
                      value={report.plan_atencion_conjunta_tl}
                      onChange={val => updateReportField("plan_atencion_conjunta_tl", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1">• Generalización de habilidades comunicativas:</h5>
                    <PrintEditableTextarea
                      value={report.plan_generalizacion_tl}
                      onChange={val => updateReportField("plan_generalizacion_tl", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>
                </div>

                {/* OBJETIVOS TL */}
                <div className="mt-6 avoid-page-break">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1 mb-2">Objetivos TL</h4>
                  <div className="space-y-2">
                    {report.objetivos_tl?.map((obj: string, i: number) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-xs font-bold mt-2 text-indigo-700 font-mono">•</span>
                        <PrintEditableTextarea
                          value={obj}
                          onChange={val => updateObjective("tl", i, val)}
                          className="w-full min-h-[45px] p-1.5 border border-slate-200 rounded-md text-xs leading-relaxed text-slate-700 bg-slate-50/20 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RECOMENDACIONES PARA EL ENTORNO ESCOLAR */}
              <div className="mb-8 avoid-page-break mt-8">
                <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider border-b-2 border-indigo-900 pb-1 mb-4 flex items-center gap-2">
                  <Heart className="h-4 w-4 text-indigo-800 print:hidden" />
                  Recomendaciones y Adaptaciones para el Entorno Escolar
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Ubicación en el Aula:</h4>
                    <PrintEditableTextarea
                      value={report.reco_ubicacion_escuela}
                      onChange={val => updateReportField("reco_ubicacion_escuela", val)}
                      className="w-full min-h-[55px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Anticipación Visual Obligatoria:</h4>
                    <PrintEditableTextarea
                      value={report.reco_anticipacion_escuela}
                      onChange={val => updateReportField("reco_anticipacion_escuela", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Segmentación de Instrucciones y Cierre de Tareas:</h4>
                    <PrintEditableTextarea
                      value={report.reco_segmentacion_escuela}
                      onChange={val => updateReportField("reco_segmentacion_escuela", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Uso del Sistema Visual para Peticiones:</h4>
                    <PrintEditableTextarea
                      value={report.reco_sistema_visual_escuela}
                      onChange={val => updateReportField("reco_sistema_visual_escuela", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Gestión del Límite y Regulación Emocional:</h4>
                    <PrintEditableTextarea
                      value={report.reco_limites_escuela}
                      onChange={val => updateReportField("reco_limites_escuela", val)}
                      className="w-full min-h-[55px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Fomento de la Autonomía Sin Sustitución:</h4>
                    <PrintEditableTextarea
                      value={report.reco_autonomia_escuela}
                      onChange={val => updateReportField("reco_autonomia_escuela", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Acompañamiento en Desafíos Motores:</h4>
                    <PrintEditableTextarea
                      value={report.reco_motores_escuela}
                      onChange={val => updateReportField("reco_motores_escuela", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* FOOTER BLOCK: CONTACT INFO & SIGNATURE */}
              <div className="mt-16 pt-8 border-t border-slate-200 avoid-page-break flex flex-col sm:flex-row justify-between items-center sm:items-end gap-6 text-xs text-left font-sans">
                {/* Left Column: Contact & Social Info */}
                <div className="space-y-2 text-slate-700 leading-snug w-full sm:w-auto">
                  {contactAddress && (
                    <div className="flex items-center gap-2">
                      <span className="text-red-500 text-sm">📍</span>
                      <span className="font-semibold text-slate-800">{contactAddress}</span>
                    </div>
                  )}
                  {contactPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-500 text-sm">💬</span>
                      <span className="font-semibold text-slate-800">{contactPhone}</span>
                    </div>
                  )}
                  {contactInstagram && (
                    <div className="flex items-center gap-2">
                      <span className="text-pink-500 text-sm">📸</span>
                      <span className="font-semibold text-slate-800">{contactInstagram}</span>
                    </div>
                  )}
                </div>

                {/* Right Column: Signature Box */}
                <div className="flex flex-col items-center justify-center text-center space-y-3 w-full sm:w-auto">
                  <div className="pt-2">
                    <div className="w-56 border-b border-slate-350 mx-auto mb-1.5" />
                    <p className="font-bold text-slate-900 uppercase">{profName}</p>
                    <p className="text-slate-500">{profSpecialty}</p>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase font-outfit">{profCenter}</p>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* RENDERING OPTION 2: INFORME DE OBSERVACIÓN AULICA Y SUGERENCIAS DE ADAPTACIÓN */
            <div className="bg-white text-black p-8 md:p-16 border border-slate-200 shadow-xl rounded-3xl max-w-[900px] mx-auto print-sheet font-sans">
              
              {/* Page Header (Logo & Areas) */}
              <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-4 mb-6 font-sans">
                <div className="flex flex-col">
                  <span className="text-indigo-950 font-extrabold text-2xl tracking-wider font-outfit uppercase">{centerNameVal}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{centerSubtitleVal}</span>
                </div>
                <div className="text-right text-[10px] text-slate-700 italic leading-snug">
                  <p>Estimulación Temprana</p>
                  <p>Terapia Ocupacional</p>
                  <p>Terapia de Lenguaje</p>
                  <p>Psicología</p>
                </div>
              </div>

              {/* Title */}
              <div className="text-center my-6">
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
                  INFORME DE OBSERVACIÓN AULICA<br/>Y SUGERENCIAS DE ADAPTACIÓN
                </h2>
              </div>

              {/* 1. DATOS PERSONALES */}
              <div className="mb-8 font-sans">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">1. Datos Personales</h3>
                <table className="w-full text-xs text-left leading-relaxed">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 pr-4 font-bold text-slate-700 w-44">Nombre:</th>
                      <td className="py-2 text-slate-800 font-semibold">{selectedPatient.first_name} {selectedPatient.last_name}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 pr-4 font-bold text-slate-700">Fecha de nacimiento:</th>
                      <td className="py-2 text-slate-800">{formatBirthDate(selectedPatient.birth_date)}</td>
                      <th className="py-2 px-4 font-bold text-slate-700 w-24">Edad:</th>
                      <td className="py-2 text-slate-800">
                        <PrintEditableInput 
                          value={customAgeVal} 
                          onChange={setCustomAgeVal} 
                        />
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 pr-4 font-bold text-slate-700">Fecha de Observación:</th>
                      <td className="py-2 text-slate-800" colSpan={3}>
                        <PrintEditableInput 
                          value={observationDate} 
                          onChange={setObservationDate} 
                        />
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <th className="py-2 pr-4 font-bold text-slate-700">Terapeuta Responsable:</th>
                      <td className="py-2 text-slate-800" colSpan={3}>
                        <span className="font-semibold text-slate-800">Lic. {profName} – {profCenter}</span>
                      </td>
                    </tr>
                    <tr>
                      <th className="py-2 pr-4 font-bold text-slate-700">Destinatario:</th>
                      <td className="py-2 text-slate-800" colSpan={3}>
                        <PrintEditableInput 
                          value={recipientVal} 
                          onChange={setRecipientVal} 
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 2. OBJETIVO DE LA OBSERVACIÓN */}
              <div className="mb-8 avoid-page-break">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">2. Objetivo de la Observación</h3>
                <PrintEditableTextarea
                  value={report.objetivo_observacion}
                  onChange={val => updateReportField("objetivo_observacion", val)}
                  className="w-full min-h-[70px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                />
              </div>

              {/* 3. HALLAZGOS DE LA OBSERVACIÓN */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">3. Hallazgos de la Observación</h3>
                
                {/* A. Conducta Atencional y Desempeño Académico */}
                <div className="mb-6 avoid-page-break">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">A. Conducta Atencional y Desempeño Académico</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Contacto Visual:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_contacto_visual}
                        onChange={val => updateReportField("hallazgo_contacto_visual", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Comprensión de la Tarea:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_comprension_tarea}
                        onChange={val => updateReportField("hallazgo_comprension_tarea", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Ubicación en el Espacio:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_ubicacion_espacio}
                        onChange={val => updateReportField("hallazgo_ubicacion_espacio", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* B. Regulación Emocional y Conducta en el Aula */}
                <div className="mb-6 avoid-page-break">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">B. Regulación Emocional y Conducta en el Aula</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Baja Tolerancia a la Frustración:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_tolerancia_frustracion}
                        onChange={val => updateReportField("hallazgo_tolerancia_frustracion", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Hipersensibilidad Auditiva Correlacionada:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_hipersensibilidad_auditiva}
                        onChange={val => updateReportField("hallazgo_hipersensibilidad_auditiva", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Uso del Grito como Protesta:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_grito_protesta}
                        onChange={val => updateReportField("hallazgo_grito_protesta", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Falta de Interés en las Reglas:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_interes_reglas}
                        onChange={val => updateReportField("hallazgo_interes_reglas", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* C. Comportamiento en Áreas Abiertas y Transiciones Escolares */}
                <div className="mb-6 avoid-page-break">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                    C. Comportamiento en Áreas Abiertas y Transiciones Escolares
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Conductas de Evasión en Educación Física:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_evasion_deporte}
                        onChange={val => updateReportField("hallazgo_evasion_deporte", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Dificultad en Transiciones:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_dificultad_transiciones}
                        onChange={val => updateReportField("hallazgo_dificultad_transiciones", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 mb-1">• Interacción Social en el Recreo:</h5>
                      <PrintEditableTextarea
                        value={report.hallazgo_recreo_socializacion}
                        onChange={val => updateReportField("hallazgo_recreo_socializacion", val)}
                        className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. CONCLUSIÓN */}
              <div className="mb-8 avoid-page-break">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-355 pb-1 mb-3">4. Conclusión</h3>
                <PrintEditableTextarea
                  value={report.conclusion_observacion}
                  onChange={val => updateReportField("conclusion_observacion", val)}
                  className="w-full min-h-[90px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                />
              </div>

              {/* 5. RECOMENDACIONES Y ADAPTACIONES PARA EL AULA */}
              <div className="mb-8 avoid-page-break">
                <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider border-b-2 border-indigo-900 pb-1 mb-4 flex items-center gap-2 font-sans">
                  <Heart className="h-4 w-4 text-indigo-800 print:hidden" />
                  5. Recomendaciones y Adaptaciones para el Aula
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Reubicación Estratégica en el Salón:</h4>
                    <PrintEditableTextarea
                      value={report.reco_salon_ubicacion}
                      onChange={val => updateReportField("reco_salon_ubicacion", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Implementación Obligatoria de Pictogramas de Regulación:</h4>
                    <PrintEditableTextarea
                      value={report.reco_regulacion_pictogramas}
                      onChange={val => updateReportField("reco_regulacion_pictogramas", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Estructura y Gestión de la Transición (Anticipación):</h4>
                    <PrintEditableTextarea
                      value={report.reco_transicion_anticipacion}
                      onChange={val => updateReportField("reco_transicion_anticipacion", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Segmentación y Modelado de la Tarea:</h4>
                    <PrintEditableTextarea
                      value={report.reco_tarea_segmentacion}
                      onChange={val => updateReportField("reco_tarea_segmentacion", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Manejo de la Evasión en Educación Física:</h4>
                    <PrintEditableTextarea
                      value={report.reco_deporte_evasion}
                      onChange={val => updateReportField("reco_deporte_evasion", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">• Fomento Guiado de la Socialización:</h4>
                    <PrintEditableTextarea
                      value={report.reco_recreo_socializacion}
                      onChange={val => updateReportField("reco_recreo_socializacion", val)}
                      className="w-full min-h-[60px] p-2 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-750 bg-slate-50/20 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* FOOTER BLOCK: CONTACT INFO & SIGNATURE */}
              <div className="mt-16 pt-8 border-t border-slate-200 avoid-page-break flex flex-col sm:flex-row justify-between items-center sm:items-end gap-6 text-xs text-left font-sans">
                {/* Left Column: Contact & Social Info */}
                <div className="space-y-2 text-slate-700 leading-snug w-full sm:w-auto">
                  {contactAddress && (
                    <div className="flex items-center gap-2">
                      <span className="text-red-500 text-sm">📍</span>
                      <span className="font-semibold text-slate-800">{contactAddress}</span>
                    </div>
                  )}
                  {contactPhone && (
                    <div className="flex items-center gap-2">
                      <span className="text-green-500 text-sm">💬</span>
                      <span className="font-semibold text-slate-800">{contactPhone}</span>
                    </div>
                  )}
                  {contactInstagram && (
                    <div className="flex items-center gap-2">
                      <span className="text-pink-500 text-sm">📸</span>
                      <span className="font-semibold text-slate-800">{contactInstagram}</span>
                    </div>
                  )}
                </div>

                {/* Right Column: Signature Box */}
                <div className="flex flex-col items-center justify-center text-center space-y-3 w-full sm:w-auto">
                  <div className="pt-2">
                    <div className="w-56 border-b border-slate-350 mx-auto mb-1.5" />
                    <p className="font-bold text-slate-900 uppercase">{profName}</p>
                    <p className="text-slate-500">{profSpecialty}</p>
                    <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase font-outfit">{profCenter}</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Screen Only Credit Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-150 print:hidden max-w-[900px] mx-auto">
            <div className="text-[10px] text-slate-400 max-w-lg leading-relaxed font-semibold">
              <span className="font-bold text-indigo-655 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Informe de Proceso Terapéutico optimizado por IA local
              </span>
              <p className="mt-0.5">El reporte compila el plan y los objetivos específicos basados en el historial. Recuerda que al imprimir o guardar en PDF, todos los campos se integran de forma limpia y transparente sin bordes ni controles de formulario.</p>
            </div>
            <button 
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 flex-shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / Descargar PDF
            </button>
          </div>
        </div>
      )}

      {/* Global CSS for Native Print formatting */}
      <style jsx global>{`
        @media print {
          /* Reset parent containers */
          html, body, main, div.min-h-screen, div.transition-all, main.mx-auto {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            position: static !important;
            display: block !important;
            box-shadow: none !important;
            transform: none !important;
            float: none !important;
            height: auto !important;
            min-height: 0 !important;
          }
          
          /* Override the left padding offset caused by the Sidebar */
          div.lg\\:pl-72, .lg\\:pl-72 {
            padding-left: 0 !important;
            margin-left: 0 !important;
          }

          /* Hide screen-only components explicitly */
          aside, nav, header, button, svg, [role="navigation"], .no-print, .print\\:hidden {
            display: none !important;
          }

          /* Printable document formatting */
          .print-sheet {
            background: white !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
            padding: 1.5cm 2cm !important;
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            margin: 0 !important;
            position: static !important;
          }

          .avoid-page-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Clean text rendering for printed fields */
          p, span {
            word-wrap: break-word !important;
            white-space: pre-wrap !important;
          }
        }
      `}</style>
    </div>
  );
}
