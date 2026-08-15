"use client";

import React, { useState } from "react";
import { Upload, X, FileText, Check, Users, Layers, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { TherapistPdfTemplate } from "@/lib/pdf-storage";
import { savePdfTemplate } from "@/lib/pdf-storage";
import { generateDefaultSamplePdf } from "@/lib/pdf-editor-utils";

interface TherapistOption {
  id: string;
  name: string;
  specialty?: string;
}

interface AssignPdfModalProps {
  tenantId: string;
  adminName: string;
  therapists: TherapistOption[];
  onSaved: (template: TherapistPdfTemplate) => void;
  onClose: () => void;
  initialTemplate?: TherapistPdfTemplate | null;
}

export function AssignPdfModal({
  tenantId,
  adminName,
  therapists,
  onSaved,
  onClose,
  initialTemplate,
}: AssignPdfModalProps) {
  const toast = useToast();

  const [title, setTitle] = useState(initialTemplate?.title || "");
  const [description, setDescription] = useState(initialTemplate?.description || "");
  const [category, setCategory] = useState(initialTemplate?.category || "Evaluación");
  const [pdfData, setPdfData] = useState(initialTemplate?.pdf_data || "");
  const [fileName, setFileName] = useState(initialTemplate?.filename || "");
  const [fileSize, setFileSize] = useState(initialTemplate?.file_size_bytes || 0);

  const [assignedTo, setAssignedTo] = useState<"all" | "specialty" | "therapists">(
    initialTemplate?.assigned_to || "all"
  );
  const [selectedTherapistIds, setSelectedTherapistIds] = useState<string[]>(
    initialTemplate?.assigned_therapist_ids || []
  );
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(
    initialTemplate?.assigned_specialties || ["Terapia Integral", "Fisioterapia"]
  );

  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (initialTemplate) {
      setTitle(initialTemplate.title || "");
      setDescription(initialTemplate.description || "");
      setCategory(initialTemplate.category || "Evaluación");
      setPdfData(initialTemplate.pdf_data || "");
      setFileName(initialTemplate.filename || "");
      setFileSize(initialTemplate.file_size_bytes || 0);
      setAssignedTo(initialTemplate.assigned_to || "all");
      setSelectedTherapistIds(initialTemplate.assigned_therapist_ids || []);
      setSelectedSpecialties(initialTemplate.assigned_specialties || ["Terapia Integral", "Fisioterapia"]);
    }
  }, [initialTemplate]);

  // Manejador de subida de archivo PDF
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.addToast("Solo se permiten archivos en formato PDF", "error");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.addToast("El archivo excede el límite máximo de 15MB", "error");
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    if (!title) {
      setTitle(file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " "));
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPdfData(dataUrl);
      toast.addToast("PDF cargado correctamente", "success");
    };
    reader.readAsDataURL(file);
  };

  // Generar plantilla clínica de inicio en blanco si el admin no tiene un PDF a mano
  const handleUseStarterTemplate = () => {
    const generated = generateDefaultSamplePdf(title || "Ficha de Evaluación y Evolución", category);
    setPdfData(generated);
    setFileName("Plantilla_Clinica_Base.pdf");
    setFileSize(42000);
    if (!title) setTitle("Ficha de Evaluación y Evolución");
    toast.addToast("Plantilla base membretada generada con éxito", "info");
  };

  const handleToggleTherapist = (id: string) => {
    if (selectedTherapistIds.includes(id)) {
      setSelectedTherapistIds(selectedTherapistIds.filter((tId) => tId !== id));
    } else {
      setSelectedTherapistIds([...selectedTherapistIds, id]);
    }
  };

  const handleToggleSpecialty = (spec: string) => {
    if (selectedSpecialties.includes(spec)) {
      setSelectedSpecialties(selectedSpecialties.filter((s) => s !== spec));
    } else {
      setSelectedSpecialties([...selectedSpecialties, spec]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.addToast("Por favor ingresa un título para la plantilla", "error");
      return;
    }

    let finalPdfData = pdfData;
    if (!finalPdfData) {
      // Auto-generar si no se cargó archivo
      finalPdfData = generateDefaultSamplePdf(title, category);
    }

    setSaving(true);
    try {
      const template: TherapistPdfTemplate = {
        id: initialTemplate?.id || "tpl_" + Date.now(),
        tenant_id: tenantId,
        title: title.trim(),
        description: description.trim(),
        category,
        pdf_data: finalPdfData,
        filename: fileName || `${title.replace(/\s+/g, "_")}.pdf`,
        file_size_bytes: fileSize || 45000,
        assigned_to: assignedTo,
        assigned_therapist_ids: assignedTo === "therapists" ? selectedTherapistIds : [],
        assigned_specialties: assignedTo === "specialty" ? selectedSpecialties : [],
        created_at: initialTemplate?.created_at || new Date().toISOString(),
        created_by_name: adminName,
        parent_template_id: initialTemplate?.parent_template_id || null,
        parent_title: initialTemplate?.parent_title || null,
        section_order: initialTemplate?.section_order,
        page_range: initialTemplate?.page_range,
        has_sections: initialTemplate?.has_sections,
      };

      await savePdfTemplate(template);
      toast.addToast("Plantilla PDF guardada y asignada correctamente", "success");
      onSaved(template);
      onClose();
    } catch (err: any) {
      toast.addToast("Error al guardar: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const availableSpecialties = [
    "Terapia Integral",
    "Fisioterapia",
    "Terapia Física / Rehabilitación",
    "Terapia de Lenguaje",
    "Psicología / Psicopedagogía",
    "Terapia Ocupacional",
    "Atención Temprana",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 custom-scrollbar">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-indigo-600" size={20} />
              {initialTemplate ? "Editar Plantilla PDF" : "Subir y Asignar PDF a Terapeutas"}
            </h2>
            <p className="text-xs text-slate-500">
              Los terapeutas asignados podrán rellenar, escribir y firmar este documento directamente.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Carga de Archivo PDF */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              1. Documento PDF Personalizado
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-5 text-center transition-colors bg-slate-50/50">
              {pdfData ? (
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                      PDF
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 line-clamp-1">{fileName}</p>
                      <p className="text-[11px] text-slate-400">
                        {fileSize ? `${Math.round(fileSize / 1024)} KB` : "Documento cargado"} • Listo para asignación
                      </p>
                    </div>
                  </div>
                  <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg cursor-pointer transition-colors">
                    Cambiar PDF
                    <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
                    <Upload size={22} />
                  </div>
                  <div>
                    <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-indigo-600/20 inline-block transition-all active:scale-95">
                      Seleccionar Archivo PDF
                      <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <p className="text-[11px] text-slate-400 mt-2">Formatos PDF de hasta 15MB</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleUseStarterTemplate}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1.5 hover:underline"
                    >
                      <Sparkles size={13} />
                      ¿No tienes un PDF listo? Generar formato membretado base
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Información de la Plantilla */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Título del Formato / Evaluación</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Ficha de Evaluación Kinesiológica"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
              >
                <option value="Evaluación">📋 Evaluación Inicial</option>
                <option value="Fisioterapia">🏃 Fisioterapia / Rehabilitación</option>
                <option value="Consentimientos">✍️ Consentimientos y Autorizaciones</option>
                <option value="Seguimiento">📈 Seguimiento y Evolución</option>
                <option value="Terapia de Lenguaje">🗣️ Terapia de Lenguaje</option>
                <option value="Informes Generales">📄 Informes Generales</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Descripción o Instrucciones para el Terapeuta</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ej. Rellenar al finalizar la sesión diagnóstica y solicitar firma del representante."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Asignación */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              2. Asignar a Terapeutas
            </label>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setAssignedTo("all")}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  assignedTo === "all"
                    ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Users size={16} /> Todo el Equipo
              </button>

              <button
                type="button"
                onClick={() => setAssignedTo("specialty")}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  assignedTo === "specialty"
                    ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Layers size={16} /> Por Especialidad
              </button>

              <button
                type="button"
                onClick={() => setAssignedTo("therapists")}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all ${
                  assignedTo === "therapists"
                    ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <FileText size={16} /> Específicos
              </button>
            </div>

            {/* Opciones por Especialidad */}
            {assignedTo === "specialty" && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Selecciona las especialidades autorizadas:</p>
                <div className="flex flex-wrap gap-2">
                  {availableSpecialties.map((spec) => {
                    const isSelected = selectedSpecialties.includes(spec);
                    return (
                      <button
                        type="button"
                        key={spec}
                        onClick={() => handleToggleSpecialty(spec)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                        {spec}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Opciones por Terapeutas Específicos */}
            {assignedTo === "therapists" && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Selecciona los profesionales:</p>
                {therapists.length === 0 ? (
                  <p className="text-xs text-slate-400">No hay terapeutas registrados aún.</p>
                ) : (
                  <div className="space-y-1.5">
                    {therapists.map((t) => {
                      const isSelected = selectedTherapistIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected ? "bg-indigo-50 border-indigo-300" : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleTherapist(t.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            />
                            <span className="text-xs font-semibold text-slate-800">{t.name}</span>
                          </div>
                          {t.specialty && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              {t.specialty}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? "Guardando..." : initialTemplate ? "Actualizar Plantilla" : "Guardar y Asignar PDF"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
