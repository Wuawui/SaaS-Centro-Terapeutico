"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/lib/constants";

interface TherapistOption {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function NewPatientPage() {
  const router = useRouter();
  const supabase = createClient();
  const { tenantId } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
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

  useEffect(() => {
    if (!tenantId) return;
    async function loadTherapists() {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("tenant_id", tenantId)
        .in("role", ["terapeuta", "fisioterapeuta"])
        .eq("active", true);
      if (data) setTherapists(data as TherapistOption[]);
    }
    loadTherapists();
  }, [tenantId, supabase]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
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

    const { data: newPat, error: insertError } = await supabase
      .from("patients")
      .insert({
        tenant_id: tenantId,
        first_name: form.first_name,
        last_name: form.last_name,
        document_number: form.document_number || null,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        therapist_id: form.therapist_id || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_relation: form.emergency_contact_relation || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        reason_for_consultation: form.reason_for_consultation || null,
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

    router.push("/patients");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/patients" className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Nuevo Paciente</h1>
              <p className="text-xs text-gray-500">Registro de datos personales y asignación de especialidad</p>
            </div>
          </div>
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
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-md">
            <h2 className="text-base font-bold mb-1 font-outfit flex items-center gap-2">
              🏃 Asignación de Especialidad & Terapeuta
            </h2>
            <p className="text-xs text-teal-200/80 mb-4">Selecciona el área de atención y el profesional a cargo</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-teal-100 mb-1">Área / Servicio de Atención *</label>
                <select
                  name="specialty_area"
                  value={form.specialty_area}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-teal-700/50 rounded-xl text-xs bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
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
                  className="w-full px-3 py-2 border border-teal-700/50 rounded-xl text-xs bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium"
                >
                  <option value="">Sin terapeuta asignado por el momento...</option>
                  {therapists.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} ({ROLE_LABELS[t.role] || t.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Datos personales */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos Personales</h2>
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
                  placeholder="García López"
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
                  placeholder="1234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                  <option value="X">Prefiere no decir</option>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="maria@ejemplo.com"
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
                  placeholder="Av. 9 de Octubre, Guayaquil"
                />
              </div>
            </div>
          </div>

          {/* Contacto de emergencia */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contacto de Emergencia</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  name="emergency_contact_name"
                  type="text"
                  value={form.emergency_contact_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Juan García"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relación</label>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Clínica / Lesión</h2>
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

              {/* Historial Clínico y PDF */}
              <div className="md:col-span-2 space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Historial Clínico / Antecedentes</label>
                {!pdfUrl && (
                  <textarea
                    name="medical_history"
                    value={form.medical_history}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Escribe observaciones clínicas o adjunta la ficha en PDF a continuación..."
                  />
                )}

                {/* Componente PDF Max 5MB */}
                <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-teal-900 uppercase tracking-wider font-outfit">
                      📄 Adjuntar Ficha / Historial Clínico en PDF (Máx 5MB - Solo Admin)
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
                  <p className="text-[11px] text-teal-700/80">Archivos PDF de hasta 5MB con previsualización en vivo en pantalla.</p>

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