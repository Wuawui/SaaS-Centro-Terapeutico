"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/lib/constants";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { FileText, Sparkles, Folder, Check } from "lucide-react";
import {
  getPdfTemplates,
  savePdfSubmission,
  type TherapistPdfTemplate,
  type TherapistPdfSubmission,
} from "@/lib/pdf-storage";

interface TherapistOption {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function NewPatientPage() {
  const router = useRouter();
  const supabase = createClient();
  const { tenantId, user, profile } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [officialTemplates, setOfficialTemplates] = useState<TherapistPdfTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    avatar_url: "",
    document_number: "",
    birth_date: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    therapist_id: "",
    specialty_area: "terapia_fisica",
    emergency_contact_name: "",
    emergency_contact_relation: "",
    emergency_contact_phone: "",
    reason_for_consultation: "",
    primary_diagnosis: "",
    primary_diagnosis_desc: "",
    current_medication: "",
    medical_history: "",
    insurance_provider: "",
    insurance_policy: "",
  });

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      alert("Por favor selecciona un archivo en formato PDF.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert("El archivo PDF supera el tamaño máximo permitido de 15MB.");
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

  useEffect(() => {
    if (!tenantId) return;
    async function loadData() {
      // 1. Cargar terapeutas
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("tenant_id", tenantId)
        .in("role", ["terapeuta", "fisioterapeuta"])
        .eq("active", true);
      if (data) setTherapists(data as TherapistOption[]);

      // 2. Cargar plantillas oficiales de PDF del centro
      try {
        const tpls = await getPdfTemplates(tenantId || undefined);
        setOfficialTemplates(tpls);

        // Auto-seleccionar por defecto si hay una plantilla de Fisioterapia
        const physioTpl = tpls.find(
          (t) =>
            t.category.toLowerCase().includes("fisio") ||
            t.title.toLowerCase().includes("fisioterapia") ||
            t.title.toLowerCase().includes("kinesiol") ||
            t.title.toLowerCase().includes("rehabilit")
        );
        if (physioTpl) {
          setSelectedTemplateId(physioTpl.id);
        }
      } catch (err) {
        console.error("Error cargando plantillas PDF:", err);
      }
    }
    loadData();
  }, [tenantId, supabase]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    // Si cambia el área de especialidad, sugerir la plantilla adecuada
    if (name === "specialty_area") {
      if (value === "terapia_fisica") {
        const physioTpl = officialTemplates.find(
          (t) =>
            t.category.toLowerCase().includes("fisio") ||
            t.title.toLowerCase().includes("fisioterapia") ||
            t.title.toLowerCase().includes("kinesiol")
        );
        if (physioTpl) setSelectedTemplateId(physioTpl.id);
      } else {
        const integralTpl = officialTemplates.find(
          (t) =>
            t.category.toLowerCase().includes("evalua") ||
            t.title.toLowerCase().includes("inicial") ||
            t.title.toLowerCase().includes("integral")
        );
        if (integralTpl) setSelectedTemplateId(integralTpl.id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!tenantId) {
      setError("No se encontró el centro / tenant activo");
      setLoading(false);
      return;
    }

    const areaLabel = form.specialty_area === "terapia_fisica" ? "[Terapia Física / Rehabilitación]" : "[Terapia Integral]";
    const finalReason = form.reason_for_consultation 
      ? `${areaLabel} ${form.reason_for_consultation}`
      : areaLabel;

    // Normalizar género a las claves de constraint ('M', 'F', 'O', 'X' o null)
    let sanitizedGender: "M" | "F" | "O" | "X" | null = null;
    if (form.gender) {
      const g = form.gender.trim().toUpperCase();
      if (g === "M" || g === "MASCULINO" || g === "MALE") sanitizedGender = "M";
      else if (g === "F" || g === "FEMENINO" || g === "FEMALE") sanitizedGender = "F";
      else if (g === "O" || g === "OTRO" || g === "OTHER") sanitizedGender = "O";
      else if (g === "X" || g === "NO DICE") sanitizedGender = "X";
    }

    const { data: newPat, error: insertError } = await supabase
      .from("patients")
      .insert({
        tenant_id: tenantId,
        first_name: form.first_name,
        last_name: form.last_name,
        emergency_contact: form.avatar_url || null,
        document_number: form.document_number || null,
        birth_date: form.birth_date || null,
        gender: sanitizedGender,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        therapist_id: form.therapist_id || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_relation: form.emergency_contact_relation || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        reason_for_consultation: finalReason,
        primary_diagnosis: form.primary_diagnosis || null,
        primary_diagnosis_desc: form.primary_diagnosis_desc || null,
        current_medication: form.current_medication || null,
        medical_history: form.medical_history || null,
        insurance_provider: form.insurance_provider || null,
        insurance_policy: form.insurance_policy || null,
        status: "activo",
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Si seleccionó un formato oficial del centro, vincularlo de inmediato a la ficha del paciente
    if (newPat && selectedTemplateId) {
      try {
        const chosenTpl = officialTemplates.find((t) => t.id === selectedTemplateId);
        if (chosenTpl) {
          const assignedTherapist = therapists.find((th) => th.id === form.therapist_id);
          const initialSubmission: TherapistPdfSubmission = {
            id: "sub_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
            template_id: chosenTpl.id,
            template_title: chosenTpl.title,
            tenant_id: tenantId,
            therapist_id: form.therapist_id || user?.id || "",
            therapist_name: assignedTherapist
              ? `${assignedTherapist.first_name} ${assignedTherapist.last_name}`.trim()
              : profile
              ? `${profile.first_name} ${profile.last_name}`.trim()
              : "Por Asignar",
            therapist_role: assignedTherapist?.role || profile?.role || "fisioterapeuta",
            patient_id: newPat.id,
            patient_name: `${form.first_name} ${form.last_name}`.trim(),
            filled_at: new Date().toISOString(),
            filled_date_formatted: new Date().toLocaleString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            annotations: [],
            filled_pdf_data: chosenTpl.pdf_data || "",
            status: "borrador",
            notes: "Formato oficial asignado al crear la ficha del paciente.",
          };
          await savePdfSubmission(initialSubmission);
        }
      } catch (pdfErr) {
        console.error("Error al vincular formato PDF oficial:", pdfErr);
      }
    }

    router.push("/patients");
    router.refresh();
  };

  // Filtrar plantillas sugeridas según el área
  const relevantTemplates = officialTemplates.filter((t) => {
    if (form.specialty_area === "terapia_fisica") {
      return (
        t.category.toLowerCase().includes("fisio") ||
        t.category.toLowerCase().includes("evalua") ||
        t.category.toLowerCase().includes("consent") ||
        t.category.toLowerCase().includes("seguim") ||
        (t.assigned_specialties || []).some((s) => s.toLowerCase().includes("fisio"))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium mb-1"
          >
            ← Volver a pacientes
          </button>
          <h1 className="text-xl font-bold text-gray-900 font-outfit">Nuevo Paciente</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Asignación de Servicio & Profesional */}
          <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg space-y-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold mb-2">
                <Sparkles size={13} />
                Asignación Clínica & Formatos Oficiales
              </div>
              <h2 className="text-base sm:text-lg font-bold font-outfit">
                Especialidad, Terapeuta & Formato PDF Oficial
              </h2>
              <p className="text-xs text-teal-200/80">
                Selecciona el servicio terapéutico, el profesional responsable y el documento PDF del centro que utilizará el terapeuta.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-teal-100 mb-1">Área / Servicio de Atención *</label>
                <select
                  name="specialty_area"
                  value={form.specialty_area}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-teal-700/50 rounded-xl text-xs bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
                >
                  <option value="terapia_fisica">🏃 Terapia Física / Rehabilitación</option>
                  <option value="terapia_integral">🧩 Terapia Integral / Atención Temprana</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-teal-100 mb-1">Fisioterapeuta / Terapeuta Asignado</label>
                <select
                  name="therapist_id"
                  value={form.therapist_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-teal-700/50 rounded-xl text-xs bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
                >
                  <option value="">Sin terapeuta asignado por el momento...</option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} ({ROLE_LABELS[t.role] || t.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selector de Documento / Formato PDF Oficial del Centro */}
            <div className="p-4 bg-slate-800/90 rounded-2xl border border-teal-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-teal-100 flex items-center gap-1.5 font-outfit">
                  <FileText size={14} className="text-teal-400" />
                  Documento / Formato PDF Oficial del Centro para este Paciente
                </label>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full font-bold uppercase">
                  {form.specialty_area === "terapia_fisica" ? "Terapia Física" : "Integral"}
                </span>
              </div>

              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2.5 border border-teal-600/50 rounded-xl text-xs bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
              >
                <option value="">-- Sin formato PDF asignado al inicio (Asignar más tarde) --</option>
                {relevantTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    📄 {tpl.title} • [{tpl.category}] {tpl.page_range ? `(${tpl.page_range})` : ""}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-teal-200/70">
                Al crear el paciente, este documento oficial quedará listo en la pestaña <strong>"Formatos PDF"</strong> para que el terapeuta asignado pueda escribir y firmar sobre él.
              </p>
            </div>
          </div>

          {/* Datos personales */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 font-outfit">Datos Personales</h2>

            <AvatarUpload
              value={form.avatar_url}
              onChange={(val) => setForm({ ...form, avatar_url: val || "" })}
              label="Foto del Paciente (Tamaño Carnet)"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombres <span className="text-red-500">*</span>
                </label>
                <input
                  name="first_name"
                  type="text"
                  required
                  value={form.first_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="María"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apellidos <span className="text-red-500">*</span>
                </label>
                <input
                  name="last_name"
                  type="text"
                  required
                  value={form.last_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="González"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cédula / Documento</label>
                <input
                  name="document_number"
                  type="text"
                  value={form.document_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="1720000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento</label>
                <input
                  name="birth_date"
                  type="date"
                  value={form.birth_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                  <option value="X">No especificado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="+593 99 999 9999"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="paciente@ejemplo.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  name="address"
                  type="text"
                  value={form.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Av. Principal 123 y Secundaria"
                />
              </div>
            </div>
          </div>

          {/* Contacto de Emergencia */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 font-outfit">Contacto de Emergencia / Representante</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  name="emergency_contact_name"
                  type="text"
                  value={form.emergency_contact_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Juan González"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parentesco</label>
                <input
                  name="emergency_contact_relation"
                  type="text"
                  value={form.emergency_contact_relation}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Esposo, madre, hermano..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  name="emergency_contact_phone"
                  type="tel"
                  value={form.emergency_contact_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="+593 99 999 9999"
                />
              </div>
            </div>
          </div>

          {/* Información clínica */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 font-outfit">Información Clínica / Lesión</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de consulta / Mecanismo de lesión <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="reason_for_consultation"
                  value={form.reason_for_consultation}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Describe el dolor, molestia, traumatismo o motivo de consulta..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico Médico (CIE-10)</label>
                <input
                  name="primary_diagnosis"
                  type="text"
                  value={form.primary_diagnosis}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Ej: M54.5 (Lumbago)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del diagnóstico</label>
                <input
                  name="primary_diagnosis_desc"
                  type="text"
                  value={form.primary_diagnosis_desc}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Ej: Lumbalgia mecánica con espasmo paravertebral"
                />
              </div>

              {/* Historial Clínico y PDF Adjunto Externo */}
              <div className="md:col-span-2 space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Historial Clínico / Antecedentes</label>
                {!pdfUrl && (
                  <textarea
                    name="medical_history"
                    value={form.medical_history}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Escribe observaciones clínicas o adjunta un archivo PDF externo a continuación..."
                  />
                )}

                {/* Componente PDF */}
                <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-teal-900 uppercase tracking-wider font-outfit">
                      📄 Adjuntar Informe Médico Externo / PDF Escaneado
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
                    className="block w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-600 file:text-white hover:file:bg-teal-700 cursor-pointer"
                  />
                  <p className="text-[11px] text-teal-700/80">Archivos PDF de hasta 15MB con previsualización en vivo en pantalla.</p>

                  {pdfUrl && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-teal-200 shadow-xs">
                        <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5 font-outfit">
                          📄 Previsualización en Vivo de Ficha PDF
                        </span>
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
                        >
                          ↗️ Abrir pantalla completa
                        </a>
                      </div>
                      <iframe
                        src={pdfUrl}
                        className="w-full h-80 rounded-xl border border-teal-200 shadow-inner bg-slate-900"
                        title="Previsualización Historial PDF"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <a
              href="/patients"
              className="px-5 py-2.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
            >
              Cancelar
            </a>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? "Guardando..." : "Crear Paciente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}