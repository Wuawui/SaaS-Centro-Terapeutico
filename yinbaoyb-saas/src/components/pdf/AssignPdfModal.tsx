"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  X,
  FileText,
  Users,
  Sparkles,
  Plus,
  Trash2,
  Settings2,
  FileCheck2,
  FileType2,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { TherapistPdfTemplate } from "@/lib/pdf-storage";
import {
  savePdfTemplate,
  getPdfCategories,
  addPdfCategory,
  deletePdfCategory,
  DEFAULT_PDF_CATEGORIES,
} from "@/lib/pdf-storage";
import { generateDefaultSamplePdf, convertWordToPdf } from "@/lib/pdf-editor-utils";

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
  const [category, setCategory] = useState(initialTemplate?.category || "Evaluación Inicial");
  const [pdfData, setPdfData] = useState(initialTemplate?.pdf_data || "");
  const [fileName, setFileName] = useState(initialTemplate?.filename || "");
  const [fileSize, setFileSize] = useState(initialTemplate?.file_size_bytes || 0);
  const [fileType, setFileType] = useState<"pdf" | "word">("pdf");

  const [assignedTo, setAssignedTo] = useState<"all" | "specialty" | "therapists">(
    initialTemplate?.assigned_to || "all"
  );
  const [selectedTherapistIds, setSelectedTherapistIds] = useState<string[]>(
    initialTemplate?.assigned_therapist_ids || []
  );
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(
    initialTemplate?.assigned_specialties || ["Terapia Integral", "Fisioterapia"]
  );

  const [categories, setCategories] = useState<string[]>(DEFAULT_PDF_CATEGORIES);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showManageCategories, setShowManageCategories] = useState(false);

  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cargar categorías disponibles
  useEffect(() => {
    async function loadCats() {
      const cats = await getPdfCategories(tenantId);
      setCategories(cats);
      if (!initialTemplate && cats.length > 0) {
        setCategory(cats[0]);
      }
    }
    loadCats();
  }, [tenantId, initialTemplate]);

  useEffect(() => {
    if (initialTemplate) {
      setTitle(initialTemplate.title || "");
      setDescription(initialTemplate.description || "");
      setCategory(initialTemplate.category || "Evaluación Inicial");
      setPdfData(initialTemplate.pdf_data || "");
      setFileName(initialTemplate.filename || "");
      setFileSize(initialTemplate.file_size_bytes || 0);
      setAssignedTo(initialTemplate.assigned_to || "all");
      setSelectedTherapistIds(initialTemplate.assigned_therapist_ids || []);
      setSelectedSpecialties(initialTemplate.assigned_specialties || ["Terapia Integral", "Fisioterapia"]);
    }
  }, [initialTemplate]);

  // Manejador de subida de archivo PDF o WORD (.docx / .doc)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isWord =
      file.name.toLowerCase().endsWith(".docx") ||
      file.name.toLowerCase().endsWith(".doc") ||
      file.type.includes("word") ||
      file.type.includes("officedocument");

    if (!isPdf && !isWord) {
      toast.addToast("Solo se permiten archivos en formato PDF o Word (.docx / .doc)", "error");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.addToast("El archivo excede el límite máximo de 25MB", "error");
      return;
    }

    const baseTitle = file.name.replace(/\.(pdf|docx|doc)$/i, "").replace(/[-_]/g, " ");
    if (!title) {
      setTitle(baseTitle);
    }

    // ── Caso Word: Conversión local inmediata ──
    if (isWord) {
      setConverting(true);
      try {
        const result = await convertWordToPdf(file, category, baseTitle);
        setPdfData(result.pdfData);
        setFileName(`${baseTitle}.pdf`);
        setFileSize(result.fileSize);
        setFileType("word");
        toast.addToast("Documento Word (.docx) convertido a PDF localmente con éxito ✓", "success");
      } catch (err: any) {
        console.error("Error convirtiendo Word:", err);
        toast.addToast("Error al procesar archivo Word: " + err.message, "error");
      } finally {
        setConverting(false);
      }
      return;
    }

    // ── Caso PDF nativo ──
    setFileName(file.name);
    setFileSize(file.size);
    setFileType("pdf");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPdfData(dataUrl);
      toast.addToast("Archivo PDF cargado correctamente ✓", "success");
    };
    reader.readAsDataURL(file);
  };

  // Generar plantilla clínica de inicio en blanco
  const handleUseStarterTemplate = () => {
    const generated = generateDefaultSamplePdf(title || "Ficha de Evaluación y Evolución", category);
    setPdfData(generated);
    setFileName("Plantilla_Clinica_Base.pdf");
    setFileSize(42000);
    setFileType("pdf");
    if (!title) setTitle("Ficha de Evaluación y Evolución");
    toast.addToast("Plantilla base membretada generada con éxito", "info");
  };

  // Agregar categoría personalizada
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const clean = newCategoryName.trim();
    const updated = await addPdfCategory(clean, tenantId);
    setCategories(updated);
    setCategory(clean);
    setNewCategoryName("");
    setShowAddCategory(false);
    toast.addToast(`Categoría "${clean}" agregada con éxito ✓`, "success");
  };

  // Eliminar categoría existente
  const handleDeleteCategory = async (catToDelete: string) => {
    if (!confirm(`¿Eliminar la categoría "${catToDelete}" del centro?`)) return;
    const updated = await deletePdfCategory(catToDelete, tenantId);
    setCategories(updated);
    if (category === catToDelete && updated.length > 0) {
      setCategory(updated[0]);
    }
    toast.addToast(`Categoría "${catToDelete}" eliminada`, "info");
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
      toast.addToast("Plantilla guardada y asignada correctamente ✓", "success");
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
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-indigo-600" size={20} />
              {initialTemplate ? "Editar Plantilla de Documento" : "Subir y Asignar PDF / Word a Terapeutas"}
            </h2>
            <p className="text-xs text-slate-500">
              Soporta archivos <b>PDF</b> y <b>Word (.docx/.doc)</b> procesados localmente. Los terapeutas podrán rellenarlos y firmarlos.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Carga de Archivo PDF / WORD */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              1. Documento PDF o Word (.docx / .doc)
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-5 text-center transition-colors bg-slate-50/50">
              {converting ? (
                <div className="py-6 flex flex-col items-center justify-center gap-3 text-indigo-600">
                  <Loader2 className="animate-spin" size={32} />
                  <p className="text-sm font-bold text-slate-700">Procesando y convirtiendo archivo Word localmente...</p>
                  <p className="text-xs text-slate-400">Generando PDF estructurado e interactivo con membrete del centro.</p>
                </div>
              ) : pdfData ? (
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                  <div className="flex items-center gap-3 text-left">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                      fileType === "word" ? "bg-blue-100 text-blue-700" : "bg-indigo-50 text-indigo-600"
                    }`}>
                      {fileType === "word" ? <FileType2 size={20} /> : <FileCheck2 size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 line-clamp-1">{fileName}</p>
                      <p className="text-[11px] text-slate-400">
                        {fileSize ? `${Math.round(fileSize / 1024)} KB` : "Documento cargado"} • {fileType === "word" ? "Word convertido a PDF" : "PDF nativo"} • Listo para asignación
                      </p>
                    </div>
                  </div>
                  <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 rounded-lg cursor-pointer transition-colors">
                    Cambiar archivo
                    <input
                      type="file"
                      accept=".pdf, .docx, .doc, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
                    <Upload size={22} />
                  </div>
                  <div>
                    <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md shadow-indigo-600/20 inline-block transition-all active:scale-95">
                      Seleccionar Archivo (PDF o Word)
                      <input
                        type="file"
                        accept=".pdf, .docx, .doc, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Soporta <b>.pdf</b>, <b>.docx</b> y <b>.doc</b> de hasta 25MB (Conversión local)
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleUseStarterTemplate}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1.5 hover:underline"
                    >
                      <Sparkles size={13} />
                      ¿No tienes un archivo? Generar formato membretado base
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Información de la Plantilla y Categorías */}
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

            {/* Categoría Dinámica con Gestión y Eliminación */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">Categoría</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                  >
                    <Plus size={12} /> Nueva
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setShowManageCategories(!showManageCategories)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                  >
                    <Settings2 size={12} /> {showManageCategories ? "Cerrar" : "Gestionar"}
                  </button>
                </div>
              </div>

              {showAddCategory ? (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nombre de categoría..."
                    className="flex-1 px-3 py-1.5 border border-indigo-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(false)}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      📁 {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Panel de Gestión de Categorías (Eliminar) */}
          {showManageCategories && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  🗑️ Eliminar Categorías Personalizadas
                </span>
                <span className="text-[10px] text-slate-400">Haz clic en ✕ para eliminar</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {categories.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold"
                      title="Eliminar categoría"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

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
                🏃 Por Especialidad
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
                👤 Terapeutas Específicos
              </button>
            </div>

            {/* Asignación por especialidad */}
            {assignedTo === "specialty" && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-700">Selecciona las especialidades autorizadas:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableSpecialties.map((spec) => {
                    const isSelected = selectedSpecialties.includes(spec);
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => handleToggleSpecialty(spec)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left border transition-colors ${
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-md flex items-center justify-center border ${
                          isSelected ? "bg-white text-indigo-600" : "border-slate-300"
                        }`}>
                          {isSelected && "✓"}
                        </span>
                        <span>{spec}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Asignación por terapeutas específicos */}
            {assignedTo === "therapists" && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Selecciona los terapeutas que tendrán acceso ({selectedTherapistIds.length} seleccionados):
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {therapists.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay terapeutas registrados en el centro.</p>
                  ) : (
                    therapists.map((th) => {
                      const isSelected = selectedTherapistIds.includes(th.id);
                      return (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => handleToggleTherapist(th.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-500 text-indigo-900"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] border ${
                              isSelected ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-300"
                            }`}>
                              {isSelected && "✓"}
                            </span>
                            <span>{th.name}</span>
                          </div>
                          {th.specialty && (
                            <span className="text-[10px] text-slate-400 font-normal">{th.specialty}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || converting}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 inline-flex items-center gap-2 active:scale-95"
            >
              {saving ? "Guardando..." : initialTemplate ? "Guardar Cambios" : "Guardar y Asignar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
