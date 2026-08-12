"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { NOTE_FORMAT_LABELS, NOTE_FORMAT_COLORS } from "@/lib/constants";
import { createClinicalNote, signClinicalNote } from "@/lib/data/queries";
import ClinicalNoteCard from "@/components/clinical/ClinicalNoteCard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Activity, 
  Zap, 
  Dumbbell, 
  ArrowRight, 
  FileText, 
  Brain, 
  Footprints, 
  Bone, 
  Target, 
  PlusCircle, 
  Heart,
  FileSpreadsheet,
  Stethoscope,
  Microscope
} from "lucide-react";

interface ClinicalNote {
  id: string;
  patient_id: string;
  format: string;
  content: string;
  signed: boolean;
  created_at: string;
  patients: { first_name: string; last_name: string } | null;
  profiles?: { first_name: string; last_name: string } | null;
}

export default function TherapistClinicalPage() {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();
  const { profile, user, tenantId } = useSession();
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myPatients, setMyPatients] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  
  // Note / Report Type Selector (del PDF FISIOJOY completo - 8 Módulos)
  type ReportType = 
    | "sesion" 
    | "anamnesis" 
    | "goniometria" 
    | "daniels" 
    | "marcha_postura" 
    | "neurologico" 
    | "pruebas_gabinete" 
    | "cif_plan" 
    | "general";

  const isPhysio = (profile?.role as string) === "fisioterapeuta" || (profile as any)?.specialty_area === "terapia_fisica";
  const [reportType, setReportType] = useState<ReportType>(isPhysio ? "sesion" : "general");

  // Form states
  const [generalForm, setGeneralForm] = useState({ patient_id: "", tareas: "", observaciones: "", resultados: "", recomendaciones: "" });
  
  // 1. Sesión Diaria
  const [sesionForm, setSesionForm] = useState({
    patient_id: "", pain_before: 5, pain_after: 2, treatment: "", mobility_daniels: "", observations: ""
  });

  // 2. Anamnesis & Antecedentes Médicos (Pág 2-4 PDF)
  const [anamnesisForm, setAnamnesisForm] = useState({
    patient_id: "",
    peso: "", talla: "", estatura: "", imc: "", tension_arterial: "", f_cardiaca: "", f_respiratoria: "", temperatura: "",
    antecedentes_heredo: "",
    antecedentes_patologicos: "",
    antecedentes_no_patologicos: "",
    gineco_obstetricos: "",
    perinatales_pediatrico: ""
  });

  // 3. Goniometría y Exploración Articular (Pág 15-20 PDF)
  const [goniometriaForm, setGoniometriaForm] = useState({
    patient_id: "",
    cervical_flexion_izq: "", cervical_flexion_der: "", cervical_extension_izq: "", cervical_extension_der: "",
    hombro_flexion_izq: "", hombro_flexion_der: "", hombro_abduccion_izq: "", hombro_abduccion_der: "", hombro_rot_int_izq: "", hombro_rot_int_der: "",
    codo_flexion_izq: "", codo_flexion_der: "", codo_pronacion_izq: "", codo_pronacion_der: "",
    muneca_flexion_izq: "", muneca_flexion_der: "", muneca_desv_rad_izq: "", muneca_desv_rad_der: "",
    cadera_flexion_izq: "", cadera_flexion_der: "", cadera_abduccion_izq: "", cadera_abduccion_der: "",
    rodilla_flexion_izq: "", rodilla_flexion_der: "", rodilla_extension_izq: "", rodilla_extension_der: "",
    tobillo_plantar_izq: "", tobillo_plantar_der: "", tobillo_dorsal_izq: "", tobillo_dorsal_der: "",
    observaciones_end_feel: ""
  });

  // 4. Evaluación Muscular Escala Daniels 0-5 (Pág 21-24 PDF)
  const [danielsForm, setDanielsForm] = useState({
    patient_id: "",
    cuello_flexion_izq: 5, cuello_flexion_der: 5,
    tronco_flexion_izq: 5, tronco_flexion_der: 5,
    hombro_flexion_izq: 5, hombro_flexion_der: 5, hombro_abduccion_izq: 5, hombro_abduccion_der: 5,
    codo_flexion_izq: 5, codo_flexion_der: 5,
    muneca_flexion_izq: 5, muneca_flexion_der: 5,
    cadera_flexion_izq: 5, cadera_flexion_der: 5, cadera_abduccion_izq: 5, cadera_abduccion_der: 5,
    rodilla_flexion_izq: 5, rodilla_flexion_der: 5, rodilla_extension_izq: 5, rodilla_extension_der: 5,
    tobillo_plantar_izq: 5, tobillo_plantar_der: 5,
    observaciones_tono: ""
  });

  // 5. Examen Postural & Marcha (Pág 5, 8-14 PDF)
  const [marchaForm, setMarchaForm] = useState({
    patient_id: "",
    tipo_marcha: "Libre",
    movilidad: "Independiente",
    biotipo: "Mesomorfo",
    postura: "Ideal",
    facies: "Normal",
    actitud: "Neutra",
    vista_anterior_obs: "Hombros y caderas nivelados",
    vista_lateral_obs: "Alineación fisiológica de columna",
    vista_posterior_obs: "Escápulas simétricas sin escoliosis",
    fase_apoyo: "Contacto inicial y apoyo medio conservados",
    fase_balanceo: "Pre-balanceo y avance simétrico",
    velocidad_m_seg: "1.31",
    cadencia_pasos_min: "117",
    longitud_paso_cm: "70",
    observaciones: ""
  });

  // 6. Valoración Neurológica (Pág 25-31 PDF)
  const [neuroForm, setNeuroForm] = useState({
    patient_id: "",
    glasgow_ocular: 4, glasgow_verbal: 5, glasgow_motor: 6,
    ashworth_hipertonia: "0",
    campbell_hipotonia: "Normal (0)",
    reflejo_bicipital: "Normal (2)",
    reflejo_rotuliano: "Normal (2)",
    reflejo_aquiliano: "Normal (2)",
    pares_craneales_obs: "Pares craneales del I al XII sin alteraciones",
    asia_motor_sensitivo: "Sensibilidad conservada en dermatomas C2-S5",
    observaciones: ""
  });

  // 7. Pruebas Clínicas & Exámenes de Imagen (Pág 32 PDF)
  const [gabineteForm, setGabineteForm] = useState({
    patient_id: "",
    test_exploratorios: "",
    tipo_imagen: "Rayos X",
    proyeccion: "Anteroposterior y Lateral",
    hallazgos_imagen: "",
    observaciones: ""
  });

  // 8. Diagnóstico CIF y Plan de Rehabilitación (Pág 33-35 PDF)
  const [cifForm, setCifForm] = useState({
    patient_id: "",
    padecimiento_actual: "",
    diagnostico_cif: "",
    pronostico: "Favorable bajo tratamiento kinesiológico",
    objetivos_generales: "Disminución del dolor e independencia funcional",
    objetivos_especificos: "Recuperación de rangos articulares y fortalecimiento",
    total_sesiones: 12,
    sesiones_semanales: 3,
    duracion_minutos: 45,
    tecnicas_prescritas: "Electroterapia TENS, CHP, Terapia Manual, Kinesiología y Reeducación de la Marcha"
  });

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDate, setSearchDate] = useState("");

  useEffect(() => {
    if (isPhysio) {
      setReportType("sesion");
    }
  }, [isPhysio]);

  const loadNotes = useCallback(async () => {
    if (!tenantId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let query = supabase.from("clinical_notes")
      .select("id, patient_id, format, content, signed, created_at, patients!clinical_notes_patient_id_fkey(first_name, last_name), profiles!clinical_notes_therapist_id_fkey(first_name, last_name)")
      .eq("tenant_id", tenantId).eq("therapist_id", user.id)
      .order("created_at", { ascending: false }).limit(50);
    if (filter !== "all" && filter !== "unsigned") query = query.eq("format", filter.toUpperCase());
    if (filter === "unsigned") query = query.eq("signed", false);

    const [notesRes, patRes] = await Promise.all([
      query,
      supabase.from("patients").select("id, first_name, last_name").eq("tenant_id", tenantId).eq("therapist_id", user.id).eq("active", true),
    ]);
    setNotes((notesRes.data || []) as unknown as ClinicalNote[]);
    setMyPatients(patRes.data || []);
    setLoading(false);
  }, [filter, tenantId, user?.id, supabase]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const getPainBadge = (val: number) => {
    if (val <= 2) return "bg-green-50 text-green-700 border-green-200";
    if (val <= 5) return "bg-yellow-50 text-yellow-700 border-yellow-250";
    if (val <= 8) return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-red-50 text-red-700 border-red-200";
  };

  const handleQuickTreatment = (preset: string) => {
    setSesionForm(prev => ({
      ...prev,
      treatment: prev.treatment ? `${prev.treatment}, ${preset}` : preset
    }));
  };

  // Guardar según el reporte seleccionado del PDF FISIOJOY
  async function handleSaveReport(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !tenantId) return;

    let targetPatientId = "";
    let finalContent = "";
    const timestampStr = new Date().toLocaleString("es-EC", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true
    });

    if (reportType === "general") {
      if (!generalForm.patient_id || !generalForm.tareas.trim()) {
        toast.addToast("Ingresa el paciente y las tareas realizadas", "error"); return;
      }
      targetPatientId = generalForm.patient_id;
      finalContent = [
        `**Tareas Realizadas:**\n${generalForm.tareas.trim()}`,
        `**Observaciones:**\n${generalForm.observaciones.trim()}`,
        generalForm.resultados.trim() ? `**Avances:**\n${generalForm.resultados.trim()}` : null,
        generalForm.recomendaciones.trim() ? `**Recomendaciones:**\n${generalForm.recomendaciones.trim()}` : null,
        `---\n*Nota registrada el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");

    } else if (reportType === "sesion") {
      if (!sesionForm.patient_id || !sesionForm.treatment.trim()) {
        toast.addToast("Selecciona el paciente e ingresa el tratamiento", "error"); return;
      }
      targetPatientId = sesionForm.patient_id;
      finalContent = [
        `### 🏃 EVOLUCIÓN DE FISIOTERAPIA Y REHABILITACIÓN`,
        `• **Escala del Dolor (EVA):** Inicial **${sesionForm.pain_before}/10** ➔ Final **${sesionForm.pain_after}/10**`,
        `• **Tratamiento Aplicado & Agentes Físicos:**\n${sesionForm.treatment.trim()}`,
        sesionForm.mobility_daniels.trim() ? `• **Movilidad & Fuerza (Daniels 0-5):**\n${sesionForm.mobility_daniels.trim()}` : null,
        sesionForm.observations.trim() ? `• **Observaciones & Tolerancia:**\n${sesionForm.observations.trim()}` : null,
        `---\n*Evolución registrada el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");

    } else if (reportType === "anamnesis") {
      if (!anamnesisForm.patient_id) { toast.addToast("Selecciona el paciente", "error"); return; }
      targetPatientId = anamnesisForm.patient_id;
      finalContent = [
        `### 🩺 ANAMNESIS, SIGNOS VITALES Y ANTECEDENTES MÉDICOS (PDF Pág 2-4)`,
        `• **Signos Vitales & Medidas:** Peso: ${anamnesisForm.peso || "—"}kg | Talla/IMC: ${anamnesisForm.imc || "—"} | TA: ${anamnesisForm.tension_arterial || "120/80"} | FC: ${anamnesisForm.f_cardiaca || "72"} | FR: ${anamnesisForm.f_respiratoria || "16"} | Temp: ${anamnesisForm.temperatura || "36.5"}°C`,
        `• **Antecedentes Heredofamiliares:**\n${anamnesisForm.antecedentes_heredo || "Sin antecedentes mórbidos de importancia."}`,
        `• **Antecedentes Patológicos:**\n${anamnesisForm.antecedentes_patologicos || "Sin antecedentes patológicos reportados."}`,
        `• **Antecedentes No Patológicos & Hábitos:**\n${anamnesisForm.antecedentes_no_patologicos || "Estilo de vida activo, hidratación adecuada."}`,
        anamnesisForm.gineco_obstetricos ? `• **Antecedentes Gineco-Obstétricos:**\n${anamnesisForm.gineco_obstetricos}` : null,
        anamnesisForm.perinatales_pediatrico ? `• **Antecedentes Perinatales (Pediátrico):**\n${anamnesisForm.perinatales_pediatrico}` : null,
        `---\n*Anamnesis clínica guardada el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");

    } else if (reportType === "goniometria") {
      if (!goniometriaForm.patient_id) { toast.addToast("Selecciona el paciente", "error"); return; }
      targetPatientId = goniometriaForm.patient_id;
      finalContent = [
        `### 🦴 REPORTE GONIOMÉTRICO Y EXPLORACIÓN ARTICULAR (PDF Pág 15-20)`,
        `• **Raquis Cervical Flexión (0-45°):** Izq: ${goniometriaForm.cervical_flexion_izq || "45°"} | Der: ${goniometriaForm.cervical_flexion_der || "45°"} | Extensión (0-45°): Izq: ${goniometriaForm.cervical_extension_izq || "45°"} | Der: ${goniometriaForm.cervical_extension_der || "45°"}`,
        `• **Hombro Flexión (0-170°):** Izq: ${goniometriaForm.hombro_flexion_izq || "160°"} | Der: ${goniometriaForm.hombro_flexion_der || "170°"} | Abducción (0-180°): Izq: ${goniometriaForm.hombro_abduccion_izq || "150°"} | Der: ${goniometriaForm.hombro_abduccion_der || "180°"}`,
        `• **Codo Flexión (0-150°):** Izq: ${goniometriaForm.codo_flexion_izq || "150°"} | Der: ${goniometriaForm.codo_flexion_der || "150°"} | Pronación (0-90°): Izq: ${goniometriaForm.codo_pronacion_izq || "85°"} | Der: ${goniometriaForm.codo_pronacion_der || "90°"}`,
        `• **Muñeca Flexión (0-80°):** Izq: ${goniometriaForm.muneca_flexion_izq || "75°"} | Der: ${goniometriaForm.muneca_flexion_der || "80°"}`,
        `• **Cadera Flexión (0-140°):** Izq: ${goniometriaForm.cadera_flexion_izq || "120°"} | Der: ${goniometriaForm.cadera_flexion_der || "135°"} | Abducción (0-50°): Izq: ${goniometriaForm.cadera_abduccion_izq || "45°"} | Der: ${goniometriaForm.cadera_abduccion_der || "50°"}`,
        `• **Rodilla Flexión (0-150°):** Izq: ${goniometriaForm.rodilla_flexion_izq || "130°"} | Der: ${goniometriaForm.rodilla_flexion_der || "145°"} | Extensión Pasiva (0-10°): Izq: ${goniometriaForm.rodilla_extension_izq || "0°"} | Der: ${goniometriaForm.rodilla_extension_der || "0°"}`,
        `• **Tobillo Flexión Plantar (0-50°):** Izq: ${goniometriaForm.tobillo_plantar_izq || "45°"} | Der: ${goniometriaForm.tobillo_plantar_der || "50°"} | Flexión Dorsal (0-30°): Izq: ${goniometriaForm.tobillo_dorsal_izq || "25°"} | Der: ${goniometriaForm.tobillo_dorsal_der || "30°"}`,
        goniometriaForm.observaciones_end_feel.trim() ? `• **Observaciones End-Feel (Sensación Final):**\n${goniometriaForm.observaciones_end_feel.trim()}` : null,
        `---\n*Goniometría articular registrada el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");

    } else if (reportType === "daniels") {
      if (!danielsForm.patient_id) { toast.addToast("Selecciona el paciente", "error"); return; }
      targetPatientId = danielsForm.patient_id;
      finalContent = [
        `### 💪 EVALUACIÓN DE FUERZA MUSCULAR - ESCALA DE DANIELS (PDF Pág 21-24)`,
        `• **Cuello Flexión:** Izq: **${danielsForm.cuello_flexion_izq}/5** | Der: **${danielsForm.cuello_flexion_der}/5**`,
        `• **Tronco Flexión:** Izq: **${danielsForm.tronco_flexion_izq}/5** | Der: **${danielsForm.tronco_flexion_der}/5**`,
        `• **Hombro Flexión:** Izq: **${danielsForm.hombro_flexion_izq}/5** | Der: **${danielsForm.hombro_flexion_der}/5** | Abducción: Izq: **${danielsForm.hombro_abduccion_izq}/5** | Der: **${danielsForm.hombro_abduccion_der}/5**`,
        `• **Codo Flexión:** Izq: **${danielsForm.codo_flexion_izq}/5** | Der: **${danielsForm.codo_flexion_der}/5**`,
        `• **Muñeca Flexión:** Izq: **${danielsForm.muneca_flexion_izq}/5** | Der: **${danielsForm.muneca_flexion_der}/5**`,
        `• **Cadera Flexión:** Izq: **${danielsForm.cadera_flexion_izq}/5** | Der: **${danielsForm.cadera_flexion_der}/5** | Abducción: Izq: **${danielsForm.cadera_abduccion_izq}/5** | Der: **${danielsForm.cadera_abduccion_der}/5**`,
        `• **Rodilla Flexión:** Izq: **${danielsForm.rodilla_flexion_izq}/5** | Der: **${danielsForm.rodilla_flexion_der}/5** | Extensión: Izq: **${danielsForm.rodilla_extension_izq}/5** | Der: **${danielsForm.rodilla_extension_der}/5**`,
        `• **Tobillo Flexión:** Izq: **${danielsForm.tobillo_plantar_izq}/5** | Der: **${danielsForm.tobillo_plantar_der}/5**`,
        danielsForm.observaciones_tono.trim() ? `• **Observaciones de Tono & Atrofias:**\n${danielsForm.observaciones_tono.trim()}` : null,
        `---\n*Escala de Daniels guardada el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");

    } else if (reportType === "marcha_postura") {
      if (!marchaForm.patient_id) { toast.addToast("Selecciona el paciente", "error"); return; }
      targetPatientId = marchaForm.patient_id;
      finalContent = [
        `### 🦵 EXAMEN POSTURAL Y ANÁLISIS DE LA MARCHA (PDF Pág 5, 8-14)`,
        `• **Marcha & Movilidad:** Tipo: **${marchaForm.tipo_marcha}** | Movilidad: **${marchaForm.movilidad}**`,
        `• **Biotipo & Postura:** Biotipo: **${marchaForm.biotipo}** | Postura Estática: **${marchaForm.postura}**`,
        `• **Facies & Actitud:** Facies: **${marchaForm.facies}** | Actitud: **${marchaForm.actitud}**`,
        `• **Examen Postural Anterior:** ${marchaForm.vista_anterior_obs}`,
        `• **Examen Postural Lateral:** ${marchaForm.vista_lateral_obs}`,
        `• **Examen Postural Posterior:** ${marchaForm.vista_posterior_obs}`,
        `• **Fases de Marcha:** Apoyo: ${marchaForm.fase_apoyo} | Balanceo: ${marchaForm.fase_balanceo}`,
        `• **Análisis Cuantitativo:** Velocidad: **${marchaForm.velocidad_m_seg} m/s** | Cadencia: **${marchaForm.cadencia_pasos_min} pasos/min** | Longitud paso: **${marchaForm.longitud_paso_cm} cm**`,
        marchaForm.observaciones.trim() ? `• **Observaciones Posturales:**\n${marchaForm.observaciones.trim()}` : null,
        `---\n*Examen Postural registrado el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");

    } else if (reportType === "neurologico") {
      if (!neuroForm.patient_id) { toast.addToast("Selecciona el paciente", "error"); return; }
      targetPatientId = neuroForm.patient_id;
      const glasgowTotal = neuroForm.glasgow_ocular + neuroForm.glasgow_verbal + neuroForm.glasgow_motor;
      const glasgowDx = glasgowTotal >= 13 ? "TCE Leve (13-15)" : glasgowTotal >= 9 ? "TCE Moderado (9-12)" : "TCE Grave (3-8)";

      finalContent = [
        `### 🧠 VALORACIÓN NEUROLÓGICA COMPLETA (PDF Pág 25-31)`,
        `• **Escala de Glasgow:** Total **${glasgowTotal}/15** (${glasgowDx}) [Ocular: ${neuroForm.glasgow_ocular}, Verbal: ${neuroForm.glasgow_verbal}, Motora: ${neuroForm.glasgow_motor}]`,
        `• **Tono Muscular (Ashworth Hipertonía):** Grado **${neuroForm.ashworth_hipertonia}**`,
        `• **Tono Muscular (Campbell Hipotonía):** Grado **${neuroForm.campbell_hipotonia}**`,
        `• **Reflejos Osteotendinosos (Seidel 0-4):** Bicipital: ${neuroForm.reflejo_bicipital} | Rotuliano: ${neuroForm.reflejo_rotuliano} | Aquiliano: ${neuroForm.reflejo_aquiliano}`,
        `• **Valoración ASIA (Sensitiva/Motora):** ${neuroForm.asia_motor_sensitivo}`,
        `• **Examen Pares Craneales (I al XII):** ${neuroForm.pares_craneales_obs}`,
        neuroForm.observaciones.trim() ? `• **Observaciones Neurológicas:**\n${neuroForm.observaciones.trim()}` : null,
        `---\n*Valoración Neurológica guardada el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");

    } else if (reportType === "pruebas_gabinete") {
      if (!gabineteForm.patient_id) { toast.addToast("Selecciona el paciente", "error"); return; }
      targetPatientId = gabineteForm.patient_id;
      finalContent = [
        `### 🧪 PRUEBAS CLÍNICAS, TEST EXPLORATORIOS Y GABINETE (PDF Pág 32)`,
        `• **Maniobras y Test Exploratorios:**\n${gabineteForm.test_exploratorios || "Sin pruebas especiales reportadas."}`,
        `• **Estudios de Imagen:** Tipo: **${gabineteForm.tipo_imagen}** (${gabineteForm.proyeccion})`,
        `• **Hallazgos e Interpretación:**\n${gabineteForm.hallazgos_imagen || "Imágenes sin hallazgos patológicos mayores."}`,
        gabineteForm.observaciones.trim() ? `• **Observaciones:**\n${gabineteForm.observaciones.trim()}` : null,
        `---\n*Pruebas de Gabinete guardadas el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");

    } else if (reportType === "cif_plan") {
      if (!cifForm.patient_id || !cifForm.diagnostico_cif.trim()) {
        toast.addToast("Ingresa el paciente y el Diagnóstico CIF", "error"); return;
      }
      targetPatientId = cifForm.patient_id;
      finalContent = [
        `### 🎯 PLAN ANALÍTICO DE ATENCIÓN EN REHABILITACIÓN - CIF (PDF Pág 33-35)`,
        `• **Padecimiento Actual:** ${cifForm.padecimiento_actual || "Lesión neuromusculoesquelética en evolución."}`,
        `• **Diagnóstico Basado en la CIF:**\n${cifForm.diagnostico_cif.trim()}`,
        `• **Pronóstico de Recuperación:** ${cifForm.pronostico}`,
        `• **Objetivos Generales:**\n${cifForm.objetivos_generales}`,
        `• **Objetivos Específicos:**\n${cifForm.objetivos_especificos}`,
        `• **Prescripción Terapéutica:** Prescritas **${cifForm.total_sesiones} sesiones** (${cifForm.sesiones_semanales} por semana, ${cifForm.duracion_minutos} min/sesión)`,
        `• **Técnicas e Indicaciones Prescritas:**\n${cifForm.tecnicas_prescritas}`,
        `---\n*Plan CIF prescrito el ${timestampStr}*`
      ].filter(Boolean).join("\n\n");
    }

    setSaving(true);
    const { error } = await createClinicalNote(supabase, {
      tenant_id: tenantId,
      patient_id: targetPatientId,
      therapist_id: user.id,
      format: "libre",
      content: finalContent,
      signed: false,
    });

    if (error) { toast.addToast("Error: " + error.message, "error"); setSaving(false); return; }

    toast.addToast("Reporte clínico de fisioterapia registrado ✓", "success");
    setShowNew(false);
    setSaving(false);
    loadNotes();
  }

  async function handleSign(noteId: string) {
    const { error } = await signClinicalNote(supabase, noteId);
    if (error) { toast.addToast("Error: " + error.message, "error"); return; }
    toast.addToast("Nota firmada ✓", "success");
    loadNotes();
  }

  const filtered = filter === "unsigned"
    ? notes.filter(n => !n.signed)
    : filter === "all"
    ? notes
    : notes.filter(n => n.format?.toLowerCase() === filter);

  const searchedNotes = filtered.filter(n => {
    const isEval = n.content?.trim().startsWith('{"type":"evaluacion"') ?? false;
    const isRep = n.content?.trim().startsWith('{"type":"informe"') ?? false;
    if (isEval || isRep) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const pName = n.patients
        ? `${n.patients.first_name} ${n.patients.last_name}`.toLowerCase()
        : "";
      if (!pName.includes(q)) return false;
    }
    if (searchDate) {
      const d = new Date(n.created_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const noteDateStr = `${year}-${month}-${day}`;
      if (noteDateStr !== searchDate) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Notas & Reportes Clínicos</h1>
            {isPhysio && (
              <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-bold font-outfit">
                Módulo Fisioterapia Activo
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isPhysio ? "Registra evaluaciones de rehabilitación física y la evolución de tus pacientes" : "Registra la evolución diaria y notas clínicas de tus pacientes"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPhysio && (
            <Link 
              href="/therapist/physical-therapy"
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 font-outfit"
            >
              <Activity className="h-4 w-4" /> Historia Clínica de Rehabilitación <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <button onClick={() => setShowNew(true)} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-teal-700 inline-flex items-center gap-2 shadow-sm">
            <PlusCircle className="h-4 w-4" /> Registrar Reporte Clínico
          </button>
        </div>
      </div>

      {/* FORMULARIO Y SELECTOR DE REPORTES FISIOTERAPÉUTICOS */}
      {showNew && (
        <div className="bg-white rounded-2xl border border-teal-200 p-6 shadow-soft space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-gray-900 font-outfit">Selecciona el tipo de reporte a rellenar</h2>
              <p className="text-xs text-gray-500">Módulos del Formulario de Evaluación Fisioterapéutica</p>
            </div>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
          </div>

          {/* TARJETAS DE SELECCIÓN DE LOS 8 REPORTE DEL PDF */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: "sesion", title: "1. Evolución Sesión", desc: "EVA pre/post + Agentes físicos", icon: Zap, color: "bg-teal-50 text-teal-700 border-teal-200" },
              { id: "anamnesis", title: "2. Anamnesis & Signos", desc: "Antecedentes y vitales (Pág 2-4)", icon: Stethoscope, color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
              { id: "goniometria", title: "3. Goniometría", desc: "Rangos activos/pasivos en °", icon: Bone, color: "bg-blue-50 text-blue-700 border-blue-200" },
              { id: "daniels", title: "4. Fuerza Daniels", desc: "Escala Daniels 0 a 5 por grupo", icon: Dumbbell, color: "bg-purple-50 text-purple-700 border-purple-200" },
              { id: "marcha_postura", title: "5. Postura & Marcha", desc: "Biotipo, apoyos y velocidad", icon: Footprints, color: "bg-amber-50 text-amber-700 border-amber-200" },
              { id: "neurologico", title: "6. Valoración Neuro", desc: "Glasgow, Ashworth y Pares", icon: Brain, color: "bg-rose-50 text-rose-700 border-rose-200" },
              { id: "pruebas_gabinete", title: "7. Test & Imagen", desc: "Pruebas clínicas, RX, RM, TAC", icon: Microscope, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
              { id: "cif_plan", title: "8. Plan CIF", desc: "Diagnóstico CIF y prescripción", icon: Target, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setReportType(item.id as ReportType)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  reportType === item.id 
                    ? "ring-2 ring-teal-500 border-teal-500 bg-white shadow-sm" 
                    : `${item.color} opacity-85 hover:opacity-100`
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <item.icon className="h-5 w-5" />
                  {reportType === item.id && <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 font-outfit">{item.title}</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSaveReport} className="space-y-4 text-xs font-semibold pt-2 border-t border-slate-100">
            
            {/* 1. SEGUIMIENTO DE SESIÓN DIARIA */}
            {reportType === "sesion" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={sesionForm.patient_id} required onChange={e => setSesionForm({ ...sesionForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente asignado...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-teal-50/50 p-4 rounded-xl border border-teal-100">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800">Dolor Pre-Sesión (EVA 0-10)</label>
                      <span className={`px-2 py-0.5 border rounded font-mono text-xs font-bold ${getPainBadge(sesionForm.pain_before)}`}>{sesionForm.pain_before} / 10</span>
                    </div>
                    <input type="range" min="0" max="10" value={sesionForm.pain_before} onChange={e => setSesionForm({ ...sesionForm, pain_before: Number(e.target.value) })} className="w-full accent-teal-600 cursor-pointer" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800">Dolor Post-Sesión (EVA 0-10)</label>
                      <span className={`px-2 py-0.5 border rounded font-mono text-xs font-bold ${getPainBadge(sesionForm.pain_after)}`}>{sesionForm.pain_after} / 10</span>
                    </div>
                    <input type="range" min="0" max="10" value={sesionForm.pain_after} onChange={e => setSesionForm({ ...sesionForm, pain_after: Number(e.target.value) })} className="w-full accent-teal-600 cursor-pointer" />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tratamiento Aplicado & Agentes Físicos *</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {["Calor Húmedo (CHP)", "TENS Electroterapia", "Ultrasonido 1MHz", "Terapia Manual", "Crioterapia", "Kinesiología"].map(preset => (
                      <button key={preset} type="button" onClick={() => handleQuickTreatment(preset)} className="px-2 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 rounded-lg text-[10px] border border-slate-200">+ {preset}</button>
                    ))}
                  </div>
                  <textarea value={sesionForm.treatment} onChange={e => setSesionForm({ ...sesionForm, treatment: e.target.value })} rows={3} required placeholder="Detalla agentes térmicos, electroterapia, ejercicios kinesiológicos..." className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none font-medium" />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Observaciones & Recomendaciones para Casa</label>
                  <textarea value={sesionForm.observations} onChange={e => setSesionForm({ ...sesionForm, observations: e.target.value })} rows={2} placeholder="Tolerancia del paciente, fatiga, crioterapia en hogar..." className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none font-medium" />
                </div>
              </div>
            )}

            {/* 2. ANAMNESIS, SIGNOS VITALES Y ANTECEDENTES */}
            {reportType === "anamnesis" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={anamnesisForm.patient_id} required onChange={e => setAnamnesisForm({ ...anamnesisForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div className="bg-cyan-50/50 p-4 rounded-xl border border-cyan-100 space-y-3">
                  <h4 className="font-bold text-cyan-900 text-xs">Medidas Físicas y Signos Vitales (Pág 2 PDF)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div><label className="block text-[10px] text-gray-500">Peso (kg)</label><input value={anamnesisForm.peso} onChange={e => setAnamnesisForm({ ...anamnesisForm, peso: e.target.value })} placeholder="70" className="w-full p-1.5 border rounded-lg bg-white" /></div>
                    <div><label className="block text-[10px] text-gray-500">Estatura (cm)</label><input value={anamnesisForm.estatura} onChange={e => setAnamnesisForm({ ...anamnesisForm, estatura: e.target.value })} placeholder="175" className="w-full p-1.5 border rounded-lg bg-white" /></div>
                    <div><label className="block text-[10px] text-gray-500">IMC</label><input value={anamnesisForm.imc} onChange={e => setAnamnesisForm({ ...anamnesisForm, imc: e.target.value })} placeholder="22.8" className="w-full p-1.5 border rounded-lg bg-white" /></div>
                    <div><label className="block text-[10px] text-gray-500">Tensión Arterial</label><input value={anamnesisForm.tension_arterial} onChange={e => setAnamnesisForm({ ...anamnesisForm, tension_arterial: e.target.value })} placeholder="120/80" className="w-full p-1.5 border rounded-lg bg-white" /></div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Antecedentes Heredofamiliares & Patológicos</label>
                  <textarea value={anamnesisForm.antecedentes_patologicos} onChange={e => setAnamnesisForm({ ...anamnesisForm, antecedentes_patologicos: e.target.value })} rows={3} placeholder="Cirugías previas, traumatismos, alergias, diabetes, cardiopatías..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" />
                </div>
              </div>
            )}

            {/* 3. GONIOMETRÍA Y EXPLORACIÓN ARTICULAR */}
            {reportType === "goniometria" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={goniometriaForm.patient_id} required onChange={e => setGoniometriaForm({ ...goniometriaForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                  <h4 className="font-bold text-blue-900 text-xs">Evaluación de Arcos de Movimiento en Grados (°) (PDF Pág 15-20)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div><label className="block text-[10px] text-gray-500">Hombro Flex (0-170°) Izq/Der</label><div className="flex gap-1"><input value={goniometriaForm.hombro_flexion_izq} onChange={e => setGoniometriaForm({ ...goniometriaForm, hombro_flexion_izq: e.target.value })} placeholder="160°" className="w-full p-1 border rounded" /><input value={goniometriaForm.hombro_flexion_der} onChange={e => setGoniometriaForm({ ...goniometriaForm, hombro_flexion_der: e.target.value })} placeholder="170°" className="w-full p-1 border rounded" /></div></div>
                    <div><label className="block text-[10px] text-gray-500">Hombro Abd (0-180°) Izq/Der</label><div className="flex gap-1"><input value={goniometriaForm.hombro_abduccion_izq} onChange={e => setGoniometriaForm({ ...goniometriaForm, hombro_abduccion_izq: e.target.value })} placeholder="150°" className="w-full p-1 border rounded" /><input value={goniometriaForm.hombro_abduccion_der} onChange={e => setGoniometriaForm({ ...goniometriaForm, hombro_abduccion_der: e.target.value })} placeholder="180°" className="w-full p-1 border rounded" /></div></div>
                    <div><label className="block text-[10px] text-gray-500">Rodilla Flex (0-150°) Izq/Der</label><div className="flex gap-1"><input value={goniometriaForm.rodilla_flexion_izq} onChange={e => setGoniometriaForm({ ...goniometriaForm, rodilla_flexion_izq: e.target.value })} placeholder="120°" className="w-full p-1 border rounded" /><input value={goniometriaForm.rodilla_flexion_der} onChange={e => setGoniometriaForm({ ...goniometriaForm, rodilla_flexion_der: e.target.value })} placeholder="145°" className="w-full p-1 border rounded" /></div></div>
                    <div><label className="block text-[10px] text-gray-500">Tobillo Plantar (0-50°) Izq/Der</label><div className="flex gap-1"><input value={goniometriaForm.tobillo_plantar_izq} onChange={e => setGoniometriaForm({ ...goniometriaForm, tobillo_plantar_izq: e.target.value })} placeholder="45°" className="w-full p-1 border rounded" /><input value={goniometriaForm.tobillo_plantar_der} onChange={e => setGoniometriaForm({ ...goniometriaForm, tobillo_plantar_der: e.target.value })} placeholder="50°" className="w-full p-1 border rounded" /></div></div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Observaciones de Rangos & Sensación Final (End Feel)</label>
                  <textarea value={goniometriaForm.observaciones_end_feel} onChange={e => setGoniometriaForm({ ...goniometriaForm, observaciones_end_feel: e.target.value })} rows={2} placeholder="Desviaciones, tope óseo/blando o dolor al final del rango..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" />
                </div>
              </div>
            )}

            {/* 4. EVALUACIÓN MUSCULAR (DANIELS 0 A 5) */}
            {reportType === "daniels" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={danielsForm.patient_id} required onChange={e => setDanielsForm({ ...danielsForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-3">
                  <h4 className="font-bold text-purple-900 text-xs">Fuerza Muscular (Escala de Daniels: 0=Parálisis a 5=Normal) (PDF Pág 21-24)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {[
                      { key: "hombro_flexion", label: "Hombro Flex" },
                      { key: "codo_flexion", label: "Codo Flex" },
                      { key: "muneca_flexion", label: "Muñeca Flex" },
                      { key: "cadera_flexion", label: "Cadera Flex" },
                      { key: "rodilla_flexion", label: "Rodilla Flex" },
                      { key: "tobillo_flexion", label: "Tobillo Flex" },
                    ].map(item => (
                      <div key={item.key} className="space-y-1">
                        <label className="block text-[10px] text-gray-600 font-bold">{item.label}</label>
                        <div className="flex gap-1">
                          <select value={(danielsForm as any)[`${item.key}_izq`]} onChange={e => setDanielsForm({ ...danielsForm, [`${item.key}_izq`]: Number(e.target.value) })} className="w-full p-1 border rounded text-xs bg-white font-mono">
                            {[0,1,2,3,4,5].map(v => <option key={v} value={v}>Izq: {v}/5</option>)}
                          </select>
                          <select value={(danielsForm as any)[`${item.key}_der`]} onChange={e => setDanielsForm({ ...danielsForm, [`${item.key}_der`]: Number(e.target.value) })} className="w-full p-1 border rounded text-xs bg-white font-mono">
                            {[0,1,2,3,4,5].map(v => <option key={v} value={v}>Der: {v}/5</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Observaciones de Tono & Atrofias Musculares</label>
                  <textarea value={danielsForm.observaciones_tono} onChange={e => setDanielsForm({ ...danielsForm, observaciones_tono: e.target.value })} rows={2} placeholder="Atrofias, hipotonía, contracturas o zonas de espasmo..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" />
                </div>
              </div>
            )}

            {/* 5. EXAMEN POSTURAL Y MARCHA */}
            {reportType === "marcha_postura" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={marchaForm.patient_id} required onChange={e => setMarchaForm({ ...marchaForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                  <div>
                    <label className="block text-[10px] text-amber-900 font-bold mb-1">Tipo de Marcha</label>
                    <select value={marchaForm.tipo_marcha} onChange={e => setMarchaForm({ ...marchaForm, tipo_marcha: e.target.value })} className="w-full p-1.5 border rounded-lg bg-white text-xs">
                      <option value="Libre">Libre</option>
                      <option value="Claudicante">Claudicante</option>
                      <option value="Con ayuda">Con ayuda</option>
                      <option value="Espástica">Espástica</option>
                      <option value="Atáxica">Atáxica</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-amber-900 font-bold mb-1">Movilidad</label>
                    <select value={marchaForm.movilidad} onChange={e => setMarchaForm({ ...marchaForm, movilidad: e.target.value })} className="w-full p-1.5 border rounded-lg bg-white text-xs">
                      <option value="Independiente">Independiente</option>
                      <option value="Dependiente">Dependiente</option>
                      <option value="Silla de ruedas">Silla de ruedas</option>
                      <option value="Andadera">Andadera</option>
                      <option value="Muletas o bastón">Muletas o bastón</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-amber-900 font-bold mb-1">Biotipo</label>
                    <select value={marchaForm.biotipo} onChange={e => setMarchaForm({ ...marchaForm, biotipo: e.target.value })} className="w-full p-1.5 border rounded-lg bg-white text-xs">
                      <option value="Ectomorfo">Ectomorfo</option>
                      <option value="Mesomorfo">Mesomorfo</option>
                      <option value="Endomorfo">Endomorfo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-amber-900 font-bold mb-1">Postura Principal</label>
                    <select value={marchaForm.postura} onChange={e => setMarchaForm({ ...marchaForm, postura: e.target.value })} className="w-full p-1.5 border rounded-lg bg-white text-xs">
                      <option value="Ideal">Ideal</option>
                      <option value="Cifolordótica">Cifolordótica</option>
                      <option value="Espalda arqueada">Espalda arqueada</option>
                      <option value="Militar">Militar</option>
                      <option value="Aplanada">Aplanada</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Observaciones Posturales & Adaptaciones de Marcha</label>
                  <textarea value={marchaForm.observaciones} onChange={e => setMarchaForm({ ...marchaForm, observaciones: e.target.value })} rows={2} placeholder="Basculación pélvica, inclinación de tronco, genu varum/valgum..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" />
                </div>
              </div>
            )}

            {/* 6. VALORACIÓN NEUROLÓGICA */}
            {reportType === "neurologico" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={neuroForm.patient_id} required onChange={e => setNeuroForm({ ...neuroForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-3">
                  <h4 className="font-bold text-rose-900 text-xs">Escala de Glasgow (Conciencia: {neuroForm.glasgow_ocular + neuroForm.glasgow_verbal + neuroForm.glasgow_motor}/15) (PDF Pág 25)</h4>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] text-gray-600">Ocular (1-4)</label>
                      <select value={neuroForm.glasgow_ocular} onChange={e => setNeuroForm({ ...neuroForm, glasgow_ocular: Number(e.target.value) })} className="w-full p-1 border rounded bg-white font-mono">
                        <option value={4}>4: Espontánea</option>
                        <option value={3}>3: A voz</option>
                        <option value={2}>2: Al dolor</option>
                        <option value={1}>1: Nula</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-600">Verbal (1-5)</label>
                      <select value={neuroForm.glasgow_verbal} onChange={e => setNeuroForm({ ...neuroForm, glasgow_verbal: Number(e.target.value) })} className="w-full p-1 border rounded bg-white font-mono">
                        <option value={5}>5: Orientado</option>
                        <option value={4}>4: Confuso</option>
                        <option value={3}>3: Incoherente</option>
                        <option value={2}>2: Incomprensible</option>
                        <option value={1}>1: Nula</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-600">Motora (1-6)</label>
                      <select value={neuroForm.glasgow_motor} onChange={e => setNeuroForm({ ...neuroForm, glasgow_motor: Number(e.target.value) })} className="w-full p-1 border rounded bg-white font-mono">
                        <option value={6}>6: Obedece</option>
                        <option value={5}>5: Localiza</option>
                        <option value={4}>4: Retira</option>
                        <option value={3}>3: Flexión anormal</option>
                        <option value={2}>2: Extensión anormal</option>
                        <option value={1}>1: Nula</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Evaluación de Pares Craneales (I al XII) & Reflejos</label>
                  <textarea value={neuroForm.pares_craneales_obs} onChange={e => setNeuroForm({ ...neuroForm, pares_craneales_obs: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-xl" />
                </div>
              </div>
            )}

            {/* 7. PRUEBAS CLÍNICAS Y GABINETE */}
            {reportType === "pruebas_gabinete" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={gabineteForm.patient_id} required onChange={e => setGabineteForm({ ...gabineteForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Maniobras & Test Exploratorios (PDF Pág 32)</label>
                  <textarea value={gabineteForm.test_exploratorios} onChange={e => setGabineteForm({ ...gabineteForm, test_exploratorios: e.target.value })} rows={2} placeholder="Ej: Test de Lachman (+), Pruebas ortopédicas..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-900 mb-1">Tipo de Estudio de Imagen</label>
                    <select value={gabineteForm.tipo_imagen} onChange={e => setGabineteForm({ ...gabineteForm, tipo_imagen: e.target.value })} className="w-full p-2 border rounded-lg bg-white">
                      <option value="Rayos X">Rayos X</option>
                      <option value="Resonancia Magnética (RM)">Resonancia Magnética (RM)</option>
                      <option value="Tomografía (TAC)">Tomografía (TAC)</option>
                      <option value="Ecografía Musculoesquelética">Ecografía Musculoesquelética</option>
                      <option value="Electromiografía (EMG)">Electromiografía (EMG)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-900 mb-1">Hallazgos e Interpretación</label>
                    <input value={gabineteForm.hallazgos_imagen} onChange={e => setGabineteForm({ ...gabineteForm, hallazgos_imagen: e.target.value })} placeholder="Ej: Fisura en platillo tibial, alineación conservada..." className="w-full p-2 border rounded-lg bg-white" />
                  </div>
                </div>
              </div>
            )}

            {/* 8. PLAN CIF Y PRESCRIPCIÓN */}
            {reportType === "cif_plan" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={cifForm.patient_id} required onChange={e => setCifForm({ ...cifForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Diagnóstico basado en la CIF * (PDF Pág 33)</label>
                  <textarea value={cifForm.diagnostico_cif} onChange={e => setCifForm({ ...cifForm, diagnostico_cif: e.target.value })} rows={2} required placeholder="Clasificación Internacional del Funcionamiento (deficiencias estructurales y limitaciones de actividad)..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <div><label className="block text-[10px] font-bold text-emerald-900 mb-1">Sesiones Totales Prescritas</label><input type="number" value={cifForm.total_sesiones} onChange={e => setCifForm({ ...cifForm, total_sesiones: Number(e.target.value) })} className="w-full p-2 border rounded-lg bg-white" /></div>
                  <div><label className="block text-[10px] font-bold text-emerald-900 mb-1">Frecuencia (Sesiones/Semana)</label><input type="number" value={cifForm.sesiones_semanales} onChange={e => setCifForm({ ...cifForm, sesiones_semanales: Number(e.target.value) })} className="w-full p-2 border rounded-lg bg-white" /></div>
                  <div><label className="block text-[10px] font-bold text-emerald-900 mb-1">Duración Sesión (Minutos)</label><input type="number" value={cifForm.duracion_minutos} onChange={e => setCifForm({ ...cifForm, duracion_minutos: Number(e.target.value) })} className="w-full p-2 border rounded-lg bg-white" /></div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Objetivos del Tratamiento</label>
                  <textarea value={cifForm.objetivos_generales} onChange={e => setCifForm({ ...cifForm, objetivos_generales: e.target.value })} rows={2} placeholder="Objetivos generales y específicos de la atención kinesiológica..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" />
                </div>
              </div>
            )}

            {/* 9. NOTA GENERAL */}
            {reportType === "general" && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Paciente *</label>
                  <select value={generalForm.patient_id} required onChange={e => setGeneralForm({ ...generalForm, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white font-medium">
                    <option value="">Seleccionar paciente...</option>
                    {myPatients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block font-bold text-gray-700 mb-1">Tareas Realizadas *</label><textarea value={generalForm.tareas} onChange={e => setGeneralForm({ ...generalForm, tareas: e.target.value })} rows={3} required placeholder="Actividades trabajadas..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" /></div>
                  <div><label className="block font-bold text-gray-700 mb-1">Observaciones *</label><textarea value={generalForm.observaciones} onChange={e => setGeneralForm({ ...generalForm, observaciones: e.target.value })} rows={3} required placeholder="Observaciones generales..." className="w-full px-3 py-2 border border-gray-300 rounded-xl" /></div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-sm cursor-pointer">
                {saving ? "Guardando..." : "Guardar Reporte Clínico"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200">
        <div className="flex bg-gray-100 rounded-xl p-0.5 w-full md:max-w-xs">
          {[
            { key: "all", label: "Todas" },
            { key: "unsigned", label: "Sin firmar" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                filter === f.key ? "bg-white text-teal-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Buscar por paciente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-2">
          <input
            type="date"
            value={searchDate}
            onChange={e => setSearchDate(e.target.value)}
            className="w-full md:w-auto px-3 py-1.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
          />
          {searchDate && (
            <button
              onClick={() => setSearchDate("")}
              className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 px-2.5 py-1.5 rounded-xl border border-gray-200 transition-colors font-bold"
              title="Limpiar fecha"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Lista de notas */}
      {loading ? (
        <PageLoading text="Cargando notas..." color="text-teal-600" />
      ) : searchedNotes.length === 0 ? (
        <EmptyState 
          icon="📋" 
          title="Sin notas clínicas" 
          description={searchQuery || searchDate ? "No se encontraron notas que coincidan con los criterios de búsqueda." : "Registra la evolución o cualquiera de los 8 reportes del PDF FISIOJOY después de cada sesión"} 
        />
      ) : (
        <div className="space-y-4">
          {searchedNotes.map((note) => {
            const pName = note.patients
              ? `${note.patients.first_name} ${note.patients.last_name}`
              : "Paciente";
            return (
              <ClinicalNoteCard
                key={note.id}
                id={note.id}
                format={note.format}
                content={note.content}
                signed={note.signed}
                createdAt={note.created_at}
                patientName={pName}
                therapistName={note.profiles ? `${note.profiles.first_name} ${note.profiles.last_name}` : undefined}
                onSign={handleSign}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}