"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { 
  ArrowLeft, 
  Save, 
  Printer, 
  Activity, 
  ChevronRight,
  Sparkles,
  ClipboardList,
  AlertCircle
} from "lucide-react";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  phone: string | null;
  status: string;
  primary_diagnosis: string | null;
}

export default function TherapistPTHistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const historyId = params.id as string;
  const patientIdFromQuery = searchParams.get("patientId");

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "measures" | "gait" | "articular" | "daniels_asia" | "plan">("general");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Consolidated Form State
  const [form, setForm] = useState<any>({
    identificationData: {
      no_expediente: "",
      cama_cubiculo: "",
      fecha: "",
      hora: "",
      escolaridad: "",
      ocupacion: "",
      domicilio: "",
      telefono: "",
      tel_emergencia: "",
      tipo_sangre: "O+",
      religion: "",
      nacionalidad: "",
      estado_civil: "",
      lugar_radicacion: "",
      medico_tratante: "",
      remision: "",
      deporte_disciplina: "",
      deporte_categoria: "",
      deporte_alto_rendimiento: "No",
      deporte_entrenador: "",
      deporte_competitivo: "No",
      deporte_club: "",
      motivo_consulta: "",
      diagnostico_medico: "",
      mecanismo_lesion: "",
      tratamientos_previos: "",
      antecedentes_heredofamiliares: "",
      antecedentes_patologicos: "",
      antecedentes_no_patologicos: "",
      antecedentes_gineco: "",
      antecedentes_perinatales: ""
    },
    physicalMeasures: {
      peso: "",
      talla: "",
      estatura: "",
      imc: "",
      temperatura: "",
      f_cardiaca: "",
      f_respiratoria: "",
      tension_arterial: ""
    },
    explorationGeneral: {
      marcha_tipo: "Libre",
      movilidad_tipo: "Independiente",
      facies_tipo: "Normal",
      facies_especifique: "",
      actitud_tipo: "Neutra",
      actitud_especifique: "",
      eva_dolor: 0,
      eva_segmento: "",
      semiologia_circunstancias: "",
      semiologia_tipo: "",
      semiologia_antiguedad: "",
      semiologia_localizacion: "",
      semiologia_irradiacion: "",
      semiologia_aumento: "",
      semiologia_atenuantes: "",
      semiologia_duracion: "",
      semiologia_actividades_dificultad: "",
      observaciones: ""
    },
    explorationStructural: {
      craneo: "",
      cuello: "",
      piel: "",
      lesiones: "",
      cabello: "",
      unas: "",
      biotipo: "Mesomorfo",
      postura: "Ideal",
      inspeccion_estatica: ""
    },
    gaitAnalysis: {
      fase_apoyo: "",
      fase_balanceo: "",
      marcha_caracteristicas: "",
      marcha_adaptaciones: "",
      marcha_longitud_paso_der: "",
      marcha_longitud_paso_izq: "",
      marcha_zancada_der: "",
      marcha_zancada_izq: "",
      marcha_anchura_der: "",
      marcha_anchura_izq: "",
      marcha_pasos_min_der: "",
      marcha_pasos_min_izq: "",
      marcha_angulo_pie_der: "",
      marcha_angulo_pie_izq: "",
      marcha_velocidad_der: "",
      marcha_velocidad_izq: ""
    },
    articularEvaluation: {
      cervical_movilidad: "",
      dorsolumbar_movilidad: "",
      hombro_movilidad_der: "",
      hombro_movilidad_izq: "",
      codo_movilidad_der: "",
      codo_movilidad_izq: "",
      muneca_movilidad_der: "",
      muneca_movilidad_izq: "",
      cadera_movilidad_der: "",
      cadera_movilidad_izq: "",
      rodilla_movilidad_der: "",
      rodilla_movilidad_izq: "",
      tobillo_movilidad_der: "",
      tobillo_movilidad_izq: ""
    },
    muscularEvaluation: {
      daniels_cuello: "",
      daniels_tronco: "",
      daniels_hombro_der: "",
      daniels_hombro_izq: "",
      daniels_codo_der: "",
      daniels_codo_izq: "",
      daniels_muneca_der: "",
      daniels_muneca_izq: "",
      daniels_cadera_der: "",
      daniels_cadera_izq: "",
      daniels_rodilla_der: "",
      daniels_rodilla_izq: "",
      daniels_tobillo_der: "",
      daniels_tobillo_izq: ""
    },
    neurologicalEvaluation: {
      glasgow_ocular: "4",
      glasgow_verbal: "5",
      glasgow_motor: "6",
      ashworth_hipertonia: "",
      campbell_hipotonia: "",
      reflejos_seidel: "",
      asia_sensitivo: "",
      asia_motor: "",
      pares_craneales: "",
      observaciones_neurologicas: ""
    },
    treatmentPlan: {
      padecimiento_actual: "",
      diagnostico_cif: "",
      pronostico: "",
      objetivos_generales: "",
      objetivos_especificos: "",
      total_sesiones: "",
      sesiones_semanales: "",
      duracion_sesion: "45 minutos",
      observaciones_plan: ""
    }
  });

  const updateSection = (section: string, key: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let patientId = patientIdFromQuery;

      // 1. If editing existing history, load history details
      if (historyId !== "new") {
        const histRes = await fetch(`/api/physical-therapy/histories?id=${historyId}`);
        const histData = await histRes.json();
        if (histData && !histData.error) {
          setForm({
            identificationData: histData.identification_data || {},
            physicalMeasures: histData.physical_measures || {},
            explorationGeneral: histData.exploration_general || {},
            explorationStructural: histData.exploration_structural || {},
            gaitAnalysis: histData.gait_analysis || {},
            articularEvaluation: histData.articular_evaluation || {},
            muscularEvaluation: histData.muscular_evaluation || {},
            neurologicalEvaluation: histData.neurological_evaluation || {},
            treatmentPlan: histData.treatment_plan || {}
          });
          patientId = histData.patient_id;
        }
      }

      // 2. Load Patient details
      if (patientId) {
        const { data: pData } = await supabase
          .from("patients")
          .select("*")
          .eq("id", patientId)
          .single();
        if (pData) {
          setPatient(pData as Patient);
          
          // Prefill date if new
          if (historyId === "new") {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, "0");
            const dd = String(today.getDate()).padStart(2, "0");
            const hh = String(today.getHours()).padStart(2, "0");
            const min = String(today.getMinutes()).padStart(2, "0");

            setForm((prev: any) => ({
              ...prev,
              identificationData: {
                ...prev.identificationData,
                fecha: `${yyyy}-${mm}-${dd}`,
                hora: `${hh}:${min}`,
                telefono: pData.phone || "",
                diagnostico_medico: pData.primary_diagnosis || "",
                motivo_consulta: pData.reason_for_consultation || ""
              }
            }));
          }
        }
      }
    } catch (err) {
      console.error("Error loading PT details page:", err);
    } finally {
      setLoading(false);
    }
  }, [historyId, patientIdFromQuery, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!patient) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      patientId: patient.id,
      id: historyId !== "new" ? historyId : undefined,
      identificationData: form.identificationData,
      physicalMeasures: form.physicalMeasures,
      explorationGeneral: form.explorationGeneral,
      explorationStructural: form.explorationStructural,
      gaitAnalysis: form.gaitAnalysis,
      articularEvaluation: form.articularEvaluation,
      muscularEvaluation: form.muscularEvaluation,
      neurologicalEvaluation: form.neurologicalEvaluation,
      treatmentPlan: form.treatmentPlan
    };

    try {
      const url = "/api/physical-therapy/histories";
      const method = historyId === "new" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el historial.");

      setSuccessMsg("¡Historial Clínico guardado con éxito!");
      if (historyId === "new") {
        router.push(`/therapist/physical-therapy/patients/${patient.id}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <PageLoading text="Cargando formulario clínico de rehabilitación..." color="text-indigo-650" />;
  if (!patient) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-gray-200">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-gray-900">Paciente no seleccionado</h3>
        <p className="text-xs text-gray-500 mt-1">Es necesario suministrar un ID de paciente para abrir el historial.</p>
        <Link href="/therapist/physical-therapy" className="inline-flex items-center gap-1.5 text-xs text-indigo-650 hover:underline mt-4 font-semibold">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al portal
        </Link>
      </div>
    );
  }

  // Calculate age helper
  const getAge = (dob: string | null) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / 31557600000);
  };

  return (
    <div className="space-y-6">
      {/* SCREEN NAVIGATION & HEADER (Hidden on Print) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print print:hidden">
        <div className="space-y-1">
          <Link 
            href={`/therapist/physical-therapy/patients/${patient.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors font-bold"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Expediente
          </Link>
          <h1 className="text-xl font-bold text-slate-955 font-outfit mt-2">
            {historyId === "new" ? "Nueva Historia Clínica" : "Editar Historia Clínica"}
          </h1>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{patient.first_name} {patient.last_name} ({getAge(patient.birth_date)} años)</p>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button 
            onClick={handlePrint}
            className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-initial flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex-1 sm:flex-initial flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/10 cursor-pointer"
          >
            <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar Ficha"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-center gap-2 no-print print:hidden">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-250 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 no-print print:hidden">
          <ClipboardList className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TABS SELECTOR (Hidden on Print) */}
      <div className="bg-white rounded-xl border border-slate-150 p-1 no-print print:hidden">
        <div className="flex flex-wrap gap-1">
          {[
            { key: "general", label: "Ficha & Antecedentes" },
            { key: "measures", label: "Signos & Postura" },
            { key: "gait", label: "Dolor & Marcha" },
            { key: "articular", label: "Exploración Articular" },
            { key: "daniels_asia", label: "Daniels, ASIA & Glasgow" },
            { key: "plan", label: "Plan Terapéutico CIF" }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 min-w-[140px] text-center py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab.key 
                  ? "bg-indigo-50 text-indigo-750 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SCREEN EDITOR CONTAINER (Hidden on Print) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6 no-print print:hidden text-xs font-semibold">
        
        {/* TAB 1: GENERAL */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Datos de Identificación y Antecedentes</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">No. Expediente</label>
                <input type="text" value={form.identificationData.no_expediente || ""} onChange={e => updateSection("identificationData", "no_expediente", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Cama / Cubículo</label>
                <input type="text" value={form.identificationData.cama_cubiculo || ""} onChange={e => updateSection("identificationData", "cama_cubiculo", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Fecha</label>
                <input type="date" value={form.identificationData.fecha || ""} onChange={e => updateSection("identificationData", "fecha", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Hora</label>
                <input type="time" value={form.identificationData.hora || ""} onChange={e => updateSection("identificationData", "hora", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Escolaridad</label>
                <input type="text" value={form.identificationData.escolaridad || ""} onChange={e => updateSection("identificationData", "escolaridad", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Ocupación</label>
                <input type="text" value={form.identificationData.ocupacion || ""} onChange={e => updateSection("identificationData", "ocupacion", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Domicilio</label>
                <input type="text" value={form.identificationData.domicilio || ""} onChange={e => updateSection("identificationData", "domicilio", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Teléfono</label>
                <input type="text" value={form.identificationData.telefono || ""} onChange={e => updateSection("identificationData", "telefono", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Contacto de Emergencia</label>
                <input type="text" value={form.identificationData.tel_emergencia || ""} onChange={e => updateSection("identificationData", "tel_emergencia", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Tipo de Sangre</label>
                <input type="text" value={form.identificationData.tipo_sangre || ""} onChange={e => updateSection("identificationData", "tipo_sangre", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Estado Civil</label>
                <input type="text" value={form.identificationData.estado_civil || ""} onChange={e => updateSection("identificationData", "estado_civil", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Médico Tratante</label>
                <input type="text" value={form.identificationData.medico_tratante || ""} onChange={e => updateSection("identificationData", "medico_tratante", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">En caso de Paciente Deportivo</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Disciplina deportiva</label>
                  <input type="text" value={form.identificationData.deporte_disciplina || ""} onChange={e => updateSection("identificationData", "deporte_disciplina", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Categoría</label>
                  <input type="text" value={form.identificationData.deporte_categoria || ""} onChange={e => updateSection("identificationData", "deporte_categoria", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Alto Rendimiento (Sí/No)</label>
                  <select value={form.identificationData.deporte_alto_rendimiento || "No"} onChange={e => updateSection("identificationData", "deporte_alto_rendimiento", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white font-medium">
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Motivo y Diagnóstico</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Motivo de Consulta *</label>
                  <textarea value={form.identificationData.motivo_consulta || ""} onChange={e => updateSection("identificationData", "motivo_consulta", e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" required />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Diagnóstico Médico *</label>
                  <textarea value={form.identificationData.diagnostico_medico || ""} onChange={e => updateSection("identificationData", "diagnostico_medico", e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" required />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Mecanismo de Lesión</label>
                  <textarea value={form.identificationData.mecanismo_lesion || ""} onChange={e => updateSection("identificationData", "mecanismo_lesion", e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Tratamientos Previos</label>
                  <textarea value={form.identificationData.tratamientos_previos || ""} onChange={e => updateSection("identificationData", "tratamientos_previos", e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Antecedentes Clínicos</h4>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Antecedentes Heredofamiliares</label>
                  <textarea value={form.identificationData.antecedentes_heredofamiliares || ""} onChange={e => updateSection("identificationData", "antecedentes_heredofamiliares", e.target.value)} rows={2} placeholder="Diabetes, cardiopatías, neoplasias, etc..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Antecedentes Patológicos</label>
                  <textarea value={form.identificationData.antecedentes_patologicos || ""} onChange={e => updateSection("identificationData", "antecedentes_patologicos", e.target.value)} rows={2} placeholder="Alergias, cirugías previas, fracturas, traumatismos, etc..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Antecedentes No Patológicos</label>
                  <textarea value={form.identificationData.antecedentes_no_patologicos || ""} onChange={e => updateSection("identificationData", "antecedentes_no_patologicos", e.target.value)} rows={2} placeholder="Hábitos, actividad física, alimentación, etc..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEASURES */}
        {activeTab === "measures" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Medidas Físicas y Signos Vitales</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Peso (kg)</label>
                <input type="text" value={form.physicalMeasures.peso || ""} onChange={e => updateSection("physicalMeasures", "peso", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Talla (cm)</label>
                <input type="text" value={form.physicalMeasures.talla || ""} onChange={e => updateSection("physicalMeasures", "talla", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Estatura (m)</label>
                <input type="text" value={form.physicalMeasures.estatura || ""} onChange={e => updateSection("physicalMeasures", "estatura", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">IMC</label>
                <input type="text" value={form.physicalMeasures.imc || ""} onChange={e => updateSection("physicalMeasures", "imc", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Temperatura (°C)</label>
                <input type="text" value={form.physicalMeasures.temperatura || ""} onChange={e => updateSection("physicalMeasures", "temperatura", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Frecuencia Cardíaca (lpm)</label>
                <input type="text" value={form.physicalMeasures.f_cardiaca || ""} onChange={e => updateSection("physicalMeasures", "f_cardiaca", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Frecuencia Respiratoria (rpm)</label>
                <input type="text" value={form.physicalMeasures.f_respiratoria || ""} onChange={e => updateSection("physicalMeasures", "f_respiratoria", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Presión Arterial</label>
                <input type="text" value={form.physicalMeasures.tension_arterial || ""} onChange={e => updateSection("physicalMeasures", "tension_arterial", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Estructura Postural y Biotipo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Biotipo Postural</label>
                  <select value={form.explorationStructural.biotipo || "Mesomorfo"} onChange={e => updateSection("explorationStructural", "biotipo", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white font-medium">
                    <option value="Ectomorfo">Ectomorfo</option>
                    <option value="Mesomorfo">Mesomorfo</option>
                    <option value="Endomorfo">Endomorfo</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Postura General</label>
                  <select value={form.explorationStructural.postura || "Ideal"} onChange={e => updateSection("explorationStructural", "postura", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white font-medium">
                    <option value="Ideal">Ideal</option>
                    <option value="Cifolordótica">Cifolordótica</option>
                    <option value="Espalda arqueada">Espalda arqueada</option>
                    <option value="Militar">Militar</option>
                    <option value="Aplanada">Aplanada</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Inspección Estática Detallada (Cráneo, Cuello, Piel)</label>
                  <textarea value={form.explorationStructural.inspeccion_estatica || ""} onChange={e => updateSection("explorationStructural", "inspeccion_estatica", e.target.value)} rows={3} placeholder="Describir alineación de hombros, caderas, simetría de clavículas, etc..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GAIT */}
        {activeTab === "gait" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Evaluación del Dolor (EVA) y Análisis de Marcha</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Nivel del Dolor EVA (0 al 10)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="10" value={form.explorationGeneral.eva_dolor || 0} onChange={e => updateSection("explorationGeneral", "eva_dolor", Number(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-650" />
                  <span className="px-2 py-1 bg-indigo-50 border border-indigo-200 rounded text-indigo-750 font-bold font-mono min-w-8 text-center">{form.explorationGeneral.eva_dolor}</span>
                </div>
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Segmento Corporal Evaluado</label>
                <input type="text" value={form.explorationGeneral.eva_segmento || ""} onChange={e => updateSection("explorationGeneral", "eva_segmento", e.target.value)} placeholder="Ej. Rodilla derecha, Lumbar" className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div className="md:col-span-2">
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Semiología del Dolor (Antigüedad, tipo, irradiación, atenuantes)</label>
                <textarea value={form.explorationGeneral.semiologia_circunstancias || ""} onChange={e => updateSection("explorationGeneral", "semiologia_circunstancias", e.target.value)} rows={3} placeholder="Describir tipo de dolor, factores de aumento y actividades limitadas..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Análisis Cualitativo de la Marcha</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Fase de Apoyo</label>
                  <textarea value={form.gaitAnalysis.fase_apoyo || ""} onChange={e => updateSection("gaitAnalysis", "fase_apoyo", e.target.value)} rows={2} placeholder="Describir contacto inicial, respuesta a la carga, apoyo medio..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Fase de Balanceo</label>
                  <textarea value={form.gaitAnalysis.fase_balanceo || ""} onChange={e => updateSection("gaitAnalysis", "fase_balanceo", e.target.value)} rows={2} placeholder="Describir pre-balanceo, balanceo inicial, balanceo medio..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Adaptaciones y Anomalías Durante la Marcha</label>
                  <textarea value={form.gaitAnalysis.marcha_adaptaciones || ""} onChange={e => updateSection("gaitAnalysis", "marcha_adaptaciones", e.target.value)} rows={2} placeholder="Compensación de tronco, oscilación de brazos, rotaciones..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ARTICULAR */}
        {activeTab === "articular" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Exploración Articular (Rangos de Movimiento)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Raquis Cervical</label>
                <input type="text" value={form.articularEvaluation.cervical_movilidad || ""} onChange={e => updateSection("articularEvaluation", "cervical_movilidad", e.target.value)} placeholder="Flexión (0-35/45°), Extensión (0-35/45°)..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Raquis Dorsolumbar</label>
                <input type="text" value={form.articularEvaluation.dorsolumbar_movilidad || ""} onChange={e => updateSection("articularEvaluation", "dorsolumbar_movilidad", e.target.value)} placeholder="Flexión (0-80°), Extensión (0-30°)..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Hombro Derecho (Flex, Abd, Rot)</label>
                <input type="text" value={form.articularEvaluation.hombro_movilidad_der || ""} onChange={e => updateSection("articularEvaluation", "hombro_movilidad_der", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Hombro Izquierdo (Flex, Abd, Rot)</label>
                <input type="text" value={form.articularEvaluation.hombro_movilidad_izq || ""} onChange={e => updateSection("articularEvaluation", "hombro_movilidad_izq", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Codo / Antebrazo Derecho</label>
                <input type="text" value={form.articularEvaluation.codo_movilidad_der || ""} onChange={e => updateSection("articularEvaluation", "codo_movilidad_der", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Codo / Antebrazo Izquierdo</label>
                <input type="text" value={form.articularEvaluation.codo_movilidad_izq || ""} onChange={e => updateSection("articularEvaluation", "codo_movilidad_izq", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Cadera Derecha (Flex, Ext, Rot)</label>
                <input type="text" value={form.articularEvaluation.cadera_movilidad_der || ""} onChange={e => updateSection("articularEvaluation", "cadera_movilidad_der", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Cadera Izquierda (Flex, Ext, Rot)</label>
                <input type="text" value={form.articularEvaluation.cadera_movilidad_izq || ""} onChange={e => updateSection("articularEvaluation", "cadera_movilidad_izq", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>

              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Rodilla Derecha</label>
                <input type="text" value={form.articularEvaluation.rodilla_movilidad_der || ""} onChange={e => updateSection("articularEvaluation", "rodilla_movilidad_der", e.target.value)} placeholder="Flexión (0-135/150°)..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Rodilla Izquierda</label>
                <input type="text" value={form.articularEvaluation.rodilla_movilidad_izq || ""} onChange={e => updateSection("articularEvaluation", "rodilla_movilidad_izq", e.target.value)} placeholder="Flexión (0-135/150°)..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DANIELS, ASIA & GLASGOW */}
        {activeTab === "daniels_asia" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Fuerza Muscular (Daniels), Sensibilidad ASIA y Glasgow</h3>
            
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Escala de Daniels (Fuerza 0-5)</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Cuello / Tronco</label>
                  <input type="text" value={form.muscularEvaluation.daniels_cuello || ""} onChange={e => updateSection("muscularEvaluation", "daniels_cuello", e.target.value)} placeholder="Grado..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Hombro Derecho / Izquierdo</label>
                  <input type="text" value={form.muscularEvaluation.daniels_hombro_der || ""} onChange={e => updateSection("muscularEvaluation", "daniels_hombro_der", e.target.value)} placeholder="D / I..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Codo Derecho / Izquierdo</label>
                  <input type="text" value={form.muscularEvaluation.daniels_codo_der || ""} onChange={e => updateSection("muscularEvaluation", "daniels_codo_der", e.target.value)} placeholder="D / I..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Cadera Derecha / Izquierda</label>
                  <input type="text" value={form.muscularEvaluation.daniels_cadera_der || ""} onChange={e => updateSection("muscularEvaluation", "daniels_cadera_der", e.target.value)} placeholder="D / I..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Valoración Sensitiva y Motora (ASIA) y Reflejos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Valoración Sensitiva (Tacto/Pinchazo ASIA)</label>
                  <input type="text" value={form.neurologicalEvaluation.asia_sensitivo || ""} onChange={e => updateSection("neurologicalEvaluation", "asia_sensitivo", e.target.value)} placeholder="Dermatomas evaluados..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Valoración Motora (Miotomas ASIA)</label>
                  <input type="text" value={form.neurologicalEvaluation.asia_motor || ""} onChange={e => updateSection("neurologicalEvaluation", "asia_motor", e.target.value)} placeholder="Puntos y miotomas clave..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Escala de Glasgow (Conciencia 3-15)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" min="1" max="4" value={form.neurologicalEvaluation.glasgow_ocular || ""} onChange={e => updateSection("neurologicalEvaluation", "glasgow_ocular", e.target.value)} placeholder="Ocular" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-center font-mono font-medium" />
                    <input type="number" min="1" max="5" value={form.neurologicalEvaluation.glasgow_verbal || ""} onChange={e => updateSection("neurologicalEvaluation", "glasgow_verbal", e.target.value)} placeholder="Verbal" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-center font-mono font-medium" />
                    <input type="number" min="1" max="6" value={form.neurologicalEvaluation.glasgow_motor || ""} onChange={e => updateSection("neurologicalEvaluation", "glasgow_motor", e.target.value)} placeholder="Motor" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-center font-mono font-medium" />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Reflejos Osteotendinosos (Seidel)</label>
                  <input type="text" value={form.neurologicalEvaluation.reflejos_seidel || ""} onChange={e => updateSection("neurologicalEvaluation", "reflejos_seidel", e.target.value)} placeholder="Rotuliano, Aquiliano, Bicipital, etc..." className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PLAN */}
        {activeTab === "plan" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Plan Analítico de Atención en Rehabilitación</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Padecimiento Actual</label>
                <textarea value={form.treatmentPlan.padecimiento_actual || ""} onChange={e => updateSection("treatmentPlan", "padecimiento_actual", e.target.value)} rows={3} placeholder="Descripción de la evolución del dolor, limitaciones funcionales..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Diagnóstico basado en la CIF (Clasificación Internacional del Funcionamiento)</label>
                <textarea value={form.treatmentPlan.diagnostico_cif || ""} onChange={e => updateSection("treatmentPlan", "diagnostico_cif", e.target.value)} rows={3} placeholder="Estructuras/funciones corporales, restricciones en la participación..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
              </div>
              <div>
                <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Pronóstico de la Enfermedad / Recuperación</label>
                <textarea value={form.treatmentPlan.pronostico || ""} onChange={e => updateSection("treatmentPlan", "pronostico", e.target.value)} rows={2} placeholder="Favorable/reservado a evolución, metas de reintegro deportivo/laboral..." className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Objetivos Generales</label>
                  <textarea value={form.treatmentPlan.objetivos_generales || ""} onChange={e => updateSection("treatmentPlan", "objetivos_generales", e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Objetivos Específicos</label>
                  <textarea value={form.treatmentPlan.objetivos_especificos || ""} onChange={e => updateSection("treatmentPlan", "objetivos_especificos", e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-xl resize-none font-medium leading-relaxed" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Total de Sesiones Programadas</label>
                  <input type="text" value={form.treatmentPlan.total_sesiones || ""} onChange={e => updateSection("treatmentPlan", "total_sesiones", e.target.value)} placeholder="Ej. 10 sesiones" className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Sesiones Semanales</label>
                  <input type="text" value={form.treatmentPlan.sesiones_semanales || ""} onChange={e => updateSection("treatmentPlan", "sesiones_semanales", e.target.value)} placeholder="Ej. 2 veces por semana" className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
                <div>
                  <label className="text-slate-400 uppercase text-[9px] tracking-wider block mb-1">Duración de Sesión</label>
                  <input type="text" value={form.treatmentPlan.duracion_sesion || "45 minutos"} onChange={e => updateSection("treatmentPlan", "duracion_sesion", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-xl font-medium" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form save confirmation */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <p className="text-[10px] text-slate-450 leading-normal max-w-md">
            Al presionar guardar, todos los bloques de la historia clínica se sincronizarán directamente con la base de datos de la sede.
          </p>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/10 cursor-pointer animate-none"
          >
            {saving ? "Guardando..." : "Guardar Historial de Rehabilitación"}
          </button>
        </div>
      </div>

      {/* PRINT VIEW (Stacked Layout - Only visible when printing) */}
      <div className="hidden print:block bg-white text-black p-8 md:p-12 font-sans w-full max-w-[850px] mx-auto print-sheet">
        
        {/* Print Header */}
        <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-4 mb-6">
          <div className="flex flex-col">
            <span className="text-indigo-950 font-extrabold text-2xl tracking-wider uppercase font-outfit">FISIOJOY</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Rehabilitación y Fisioterapia</span>
          </div>
          <div className="text-right text-[10px] text-slate-700 italic leading-snug">
            <p>LTF. Erika Vanessa Lara Lara</p>
            <p>Cédula Profesional: 0201958170</p>
            <p>Email: fisiojoy20@gmail.com</p>
            <p>WhatsApp: 0985104738</p>
          </div>
        </div>

        {/* Document Title */}
        <div className="text-center my-6">
          <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2">
            HISTORIA CLÍNICA EN REHABILITACIÓN
          </h2>
          <p className="text-xs text-slate-400 mt-1">Expediente No: {form.identificationData.no_expediente || "—"} · Cama/Cubículo: {form.identificationData.cama_cubiculo || "—"}</p>
        </div>

        {/* Section 1: Datos Personales */}
        <div className="mb-6 avoid-page-break">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">1. Ficha de Identificación</h3>
          <table className="w-full text-[11px] text-left leading-relaxed">
            <tbody>
              <tr className="border-b border-slate-100">
                <th className="py-1.5 font-bold text-slate-700 w-36">Nombre del Paciente:</th>
                <td className="py-1.5 text-slate-800 font-semibold">{patient.first_name} {patient.last_name}</td>
                <th className="py-1.5 px-4 font-bold text-slate-700 w-28">Edad / Sexo:</th>
                <td className="py-1.5 text-slate-800">{getAge(patient.birth_date)} años</td>
              </tr>
              <tr className="border-b border-slate-100">
                <th className="py-1.5 font-bold text-slate-700">Escolaridad:</th>
                <td className="py-1.5 text-slate-800">{form.identificationData.escolaridad || "—"}</td>
                <th className="py-1.5 px-4 font-bold text-slate-700">Ocupación:</th>
                <td className="py-1.5 text-slate-800">{form.identificationData.ocupacion || "—"}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <th className="py-1.5 font-bold text-slate-700">Domicilio:</th>
                <td className="py-1.5 text-slate-800" colSpan={3}>{form.identificationData.domicilio || "—"}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <th className="py-1.5 font-bold text-slate-700">Teléfono:</th>
                <td className="py-1.5 text-slate-800">{form.identificationData.telefono || "—"}</td>
                <th className="py-1.5 px-4 font-bold text-slate-700">Contacto Emergencia:</th>
                <td className="py-1.5 text-slate-800">{form.identificationData.tel_emergencia || "—"}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <th className="py-1.5 font-bold text-slate-700">Tipo de Sangre:</th>
                <td className="py-1.5 text-slate-800">{form.identificationData.tipo_sangre || "—"}</td>
                <th className="py-1.5 px-4 font-bold text-slate-700">Médico Tratante:</th>
                <td className="py-1.5 text-slate-800">{form.identificationData.medico_tratante || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Medidas y Signos */}
        <div className="mb-6 avoid-page-break">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">2. Medidas Físicas y Signos Vitales</h3>
          <div className="grid grid-cols-4 gap-4 text-[11px] py-1">
            <div><strong>Peso:</strong> {form.physicalMeasures.peso || "—"} kg</div>
            <div><strong>Talla:</strong> {form.physicalMeasures.talla || "—"} cm</div>
            <div><strong>Estatura:</strong> {form.physicalMeasures.estatura || "—"} m</div>
            <div><strong>IMC:</strong> {form.physicalMeasures.imc || "—"}</div>
            
            <div><strong>Temp:</strong> {form.physicalMeasures.temperatura || "—"} °C</div>
            <div><strong>Frec. Cardíaca:</strong> {form.physicalMeasures.f_cardiaca || "—"} lpm</div>
            <div><strong>Frec. Resp:</strong> {form.physicalMeasures.f_respiratoria || "—"} rpm</div>
            <div><strong>Presión Art:</strong> {form.physicalMeasures.tension_arterial || "—"}</div>
          </div>
        </div>

        {/* Section 3: Consulta */}
        <div className="mb-6 avoid-page-break">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">3. Motivo y Diagnóstico Clínico</h3>
          <div className="space-y-3 text-[11px] leading-relaxed">
            <p><strong>Motivo de la consulta:</strong> {form.identificationData.motivo_consulta || "—"}</p>
            <p><strong>Diagnóstico médico:</strong> {form.identificationData.diagnostico_medico || "—"}</p>
            {form.identificationData.mecanismo_lesion && <p><strong>Mecanismo de lesión:</strong> {form.identificationData.mecanismo_lesion}</p>}
            {form.identificationData.tratamientos_previos && <p><strong>Tratamientos previos:</strong> {form.identificationData.tratamientos_previos}</p>}
          </div>
        </div>

        {/* Section 4: Dolor y Marcha */}
        <div className="mb-6 avoid-page-break">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">4. Escala del Dolor (EVA) y Marcha</h3>
          <div className="space-y-3 text-[11px] leading-relaxed">
            <p><strong>Intensidad del dolor (EVA):</strong> {form.explorationGeneral.eva_dolor} / 10 en segmento {form.explorationGeneral.eva_segmento || "no especificado"}</p>
            {form.explorationGeneral.semiologia_circunstancias && <p><strong>Semiología del dolor:</strong> {form.explorationGeneral.semiologia_circunstancias}</p>}
            {form.gaitAnalysis.fase_apoyo && <p><strong>Marcha (Fase de Apoyo):</strong> {form.gaitAnalysis.fase_apoyo}</p>}
            {form.gaitAnalysis.fase_balanceo && <p><strong>Marcha (Fase de Balanceo):</strong> {form.gaitAnalysis.fase_balanceo}</p>}
            {form.gaitAnalysis.marcha_adaptaciones && <p><strong>Marcha (Adaptaciones/Anomalías):</strong> {form.gaitAnalysis.marcha_adaptaciones}</p>}
          </div>
        </div>

        {/* Section 5: Articular y Muscular */}
        <div className="mb-6 avoid-page-break">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">5. Exploración Articular y Daniels</h3>
          <div className="grid grid-cols-2 gap-4 text-[11px] leading-relaxed">
            <div>
              <p><strong>Cervical / Dorsolumbar:</strong> {form.articularEvaluation.cervical_movilidad || "—"}</p>
              <p><strong>Hombro / Codo:</strong> {form.articularEvaluation.hombro_movilidad_der || "—"}</p>
            </div>
            <div>
              <p><strong>Fuerza Muscular (Daniels):</strong></p>
              <p>Cuello: {form.muscularEvaluation.daniels_cuello || "—"} · Hombros: {form.muscularEvaluation.daniels_hombro_der || "—"} · Codos: {form.muscularEvaluation.daniels_codo_der || "—"}</p>
            </div>
          </div>
        </div>

        {/* Section 6: Plan de Atención CIF */}
        <div className="mb-6 avoid-page-break">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-350 pb-1 mb-3">6. Plan Analítico de Atención en Rehabilitación</h3>
          <div className="space-y-3 text-[11px] leading-relaxed">
            <p><strong>Padecimiento actual:</strong> {form.treatmentPlan.padecimiento_actual || "—"}</p>
            <p><strong>Diagnóstico basado en la CIF:</strong> {form.treatmentPlan.diagnostico_cif || "—"}</p>
            <p><strong>Pronóstico de recuperación:</strong> {form.treatmentPlan.pronostico || "—"}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong>Objetivos Generales:</strong>
                <p className="whitespace-pre-wrap">{form.treatmentPlan.objetivos_generales || "—"}</p>
              </div>
              <div>
                <strong>Objetivos Específicos:</strong>
                <p className="whitespace-pre-wrap">{form.treatmentPlan.objetivos_especificos || "—"}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex gap-6">
              <span><strong>Total de sesiones:</strong> {form.treatmentPlan.total_sesiones || "—"}</span>
              <span><strong>Sesiones semanales:</strong> {form.treatmentPlan.sesiones_semanales || "—"}</span>
              <span><strong>Duración sesión:</strong> {form.treatmentPlan.duracion_sesion || "45 min"}</span>
            </div>
          </div>
        </div>

        {/* Signature Box */}
        <div className="mt-12 pt-8 border-t border-slate-200 avoid-page-break flex justify-between items-end gap-6 text-[11px] font-sans">
          <div>
            <p><strong>Firma del Paciente o Representante:</strong></p>
            <div className="w-48 border-b border-slate-300 mt-8" />
          </div>
          <div className="text-center">
            <div className="w-56 border-b border-slate-300 mx-auto mb-1" />
            <p className="font-bold">LTF. Erika Vanessa Lara Lara</p>
            <p className="text-slate-500">Cédula Profesional: 0201958170</p>
          </div>
        </div>

      </div>
    </div>
  );
}
