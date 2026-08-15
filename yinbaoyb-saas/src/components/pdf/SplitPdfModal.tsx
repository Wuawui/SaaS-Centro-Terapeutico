"use client";

import React, { useState, useEffect } from "react";
import {
  Scissors,
  X,
  FileText,
  Plus,
  Trash2,
  Users,
  Layers,
  Check,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { TherapistPdfTemplate } from "@/lib/pdf-storage";
import { savePdfTemplate } from "@/lib/pdf-storage";
import { extractPdfPages, getPdfPageCount } from "@/lib/pdf-editor-utils";

interface TherapistOption {
  id: string;
  name: string;
  specialty?: string;
}

interface SplitPdfModalProps {
  template: TherapistPdfTemplate;
  tenantId: string;
  adminName: string;
  therapists: TherapistOption[];
  onSaved: () => void;
  onClose: () => void;
}

interface SectionConfig {
  id: string;
  title: string;
  category: string;
  pageNumbers: number[];
  assigned_to: "all" | "specialty" | "therapists";
  assigned_therapist_ids: string[];
  assigned_specialties: string[];
}

export function SplitPdfModal({
  template,
  tenantId,
  adminName,
  therapists,
  onSaved,
  onClose,
}: SplitPdfModalProps) {
  const toast = useToast();

  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingPages, setLoadingPages] = useState(true);
  const [processing, setProcessing] = useState(false);

  const availableSpecialties = [
    "Terapia Integral",
    "Fisioterapia",
    "Terapia Física / Rehabilitación",
    "Terapia de Lenguaje",
    "Psicología / Psicopedagogía",
    "Terapia Ocupacional",
    "Atención Temprana",
  ];

  // Configuración de Secciones iniciales
  const [sections, setSections] = useState<SectionConfig[]>([]);

  // 1. Detectar cantidad de páginas del PDF
  useEffect(() => {
    async function initPageCount() {
      if (!template.pdf_data) {
        setTotalPages(1);
        setLoadingPages(false);
        return;
      }

      setLoadingPages(true);
      const count = await getPdfPageCount(template.pdf_data);
      const safeCount = Math.max(1, count);
      setTotalPages(safeCount);

      // Crear 2 secciones sugeridas si hay más de 1 página
      if (safeCount >= 2) {
        const mid = Math.ceil(safeCount / 2);
        setSections([
          {
            id: "sec_1",
            title: `${template.title} - Parte 1`,
            category: template.category || "Evaluación",
            pageNumbers: Array.from({ length: mid }, (_, i) => i + 1),
            assigned_to: "all",
            assigned_therapist_ids: [],
            assigned_specialties: ["Terapia Integral", "Fisioterapia"],
          },
          {
            id: "sec_2",
            title: `${template.title} - Parte 2`,
            category: template.category || "Evaluación",
            pageNumbers: Array.from({ length: safeCount - mid }, (_, i) => i + mid + 1),
            assigned_to: "all",
            assigned_therapist_ids: [],
            assigned_specialties: ["Terapia Integral", "Fisioterapia"],
          },
        ]);
      } else {
        setSections([
          {
            id: "sec_1",
            title: `${template.title} - Sección 1`,
            category: template.category || "Evaluación",
            pageNumbers: [1],
            assigned_to: "all",
            assigned_therapist_ids: [],
            assigned_specialties: ["Terapia Integral", "Fisioterapia"],
          },
        ]);
      }
      setLoadingPages(false);
    }

    initPageCount();
  }, [template]);

  // Añadir una nueva sección
  const handleAddSection = () => {
    const nextIdx = sections.length + 1;
    const newSec: SectionConfig = {
      id: "sec_" + Date.now(),
      title: `${template.title} - Sección ${nextIdx}`,
      category: template.category || "Evaluación",
      pageNumbers: [1],
      assigned_to: "all",
      assigned_therapist_ids: [],
      assigned_specialties: ["Terapia Integral", "Fisioterapia"],
    };
    setSections([...sections, newSec]);
  };

  // Eliminar una sección
  const handleRemoveSection = (id: string) => {
    if (sections.length <= 1) {
      toast.addToast("Debe haber al menos 1 sección", "info");
      return;
    }
    setSections(sections.filter((s) => s.id !== id));
  };

  // Alternar una página dentro de una sección
  const handleTogglePage = (secId: string, pageNum: number) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const exists = s.pageNumbers.includes(pageNum);
        const updated = exists
          ? s.pageNumbers.filter((p) => p !== pageNum)
          : [...s.pageNumbers, pageNum].sort((a, b) => a - b);
        return { ...s, pageNumbers: updated };
      })
    );
  };

  // Alternar terapeuta dentro de una sección
  const handleToggleTherapist = (secId: string, therapistId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const ids = s.assigned_therapist_ids || [];
        const updated = ids.includes(therapistId)
          ? ids.filter((id) => id !== therapistId)
          : [...ids, therapistId];
        return { ...s, assigned_therapist_ids: updated };
      })
    );
  };

  // Alternar especialidad dentro de una sección
  const handleToggleSpecialty = (secId: string, spec: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const specs = s.assigned_specialties || [];
        const updated = specs.includes(spec)
          ? specs.filter((item) => item !== spec)
          : [...specs, spec];
        return { ...s, assigned_specialties: updated };
      })
    );
  };

  // Ejecutar división y guardado de secciones
  const handleSplitAndSave = async () => {
    // Validaciones
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (!s.title.trim()) {
        toast.addToast(`Por favor asigna un nombre a la Sección ${i + 1}`, "error");
        return;
      }
      if (s.pageNumbers.length === 0) {
        toast.addToast(`La sección "${s.title}" debe contener al menos 1 página`, "error");
        return;
      }
    }

    setProcessing(true);
    try {
      let createdCount = 0;

      for (let idx = 0; idx < sections.length; idx++) {
        const s = sections[idx];
        // Extraer páginas correspondientes
        const extractedPdf = await extractPdfPages(template.pdf_data, s.pageNumbers);

        const newTemplate: TherapistPdfTemplate = {
          id: "tpl_sec_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
          tenant_id: tenantId || "00000000-0000-0000-0000-000000000001",
          title: s.title.trim(),
          description: `Sección ${idx + 1} del documento "${template.title}" (Págs: ${s.pageNumbers.join(", ")}).`,
          category: s.category || template.category,
          pdf_data: extractedPdf,
          filename: `${s.title.replace(/\s+/g, "_")}.pdf`,
          file_size_bytes: Math.round(template.file_size_bytes * (s.pageNumbers.length / totalPages)),
          assigned_to: s.assigned_to,
          assigned_therapist_ids: s.assigned_to === "therapists" ? s.assigned_therapist_ids : [],
          assigned_specialties: s.assigned_to === "specialty" ? s.assigned_specialties : [],
          created_at: new Date().toISOString(),
          created_by_name: adminName,
          parent_template_id: template.id,
          parent_title: template.title,
          section_order: idx + 1,
          page_range: `Págs. ${s.pageNumbers.join(", ")}`,
        };

        await savePdfTemplate(newTemplate);
        createdCount++;
      }

      // Marcar documento matriz como contenedor de secciones
      await savePdfTemplate({
        ...template,
        has_sections: true,
      });

      toast.addToast(`¡Se crearon y organizaron ${createdCount} secciones dentro del documento matriz!`, "success");
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Error al dividir PDF:", err);
      toast.addToast("Error al dividir PDF: " + err.message, "error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* ── HEADER MODAL ── */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Scissors className="text-indigo-600" size={20} />
              Editar y Dividir PDF por Secciones
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Documento: <strong className="text-slate-700">{template.title}</strong> • Total de Páginas:{" "}
              <strong className="text-indigo-600 font-mono">{totalPages}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── CONTENIDO SCROLLABLE ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50">
          {loadingPages ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Analizando páginas del PDF...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Configuración de Secciones a Extraer ({sections.length})
                </span>

                <button
                  type="button"
                  onClick={handleAddSection}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                >
                  <Plus size={14} /> Añadir Otra Sección
                </button>
              </div>

              {/* LISTA DE SECCIONES CONFIGURABLES */}
              <div className="space-y-5">
                {sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 relative group"
                  >
                    {/* Cabecera de Sección */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={sec.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSections((prev) =>
                              prev.map((s) => (s.id === sec.id ? { ...s, title: val } : s))
                            );
                          }}
                          placeholder={`Nombre de la sección ${idx + 1}`}
                          className="font-bold text-sm text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 w-full max-w-md"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={sec.category}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSections((prev) =>
                              prev.map((s) => (s.id === sec.id ? { ...s, category: val } : s))
                            );
                          }}
                          className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-700 focus:outline-none"
                        >
                          <option value="Evaluación">📋 Evaluación</option>
                          <option value="Fisioterapia">🏃 Fisioterapia</option>
                          <option value="Consentimientos">✍️ Consentimiento</option>
                          <option value="Seguimiento">📈 Seguimiento</option>
                          <option value="Terapia de Lenguaje">🗣️ Lenguaje</option>
                        </select>

                        {sections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(sec.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar esta sección"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SELECTOR DE PÁGINAS PARA ESTA SECCIÓN */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase">
                          Páginas de esta sección ({sec.pageNumbers.length} seleccionadas):
                        </label>
                        <span className="text-[11px] text-indigo-600 font-mono font-semibold">
                          {sec.pageNumbers.length > 0 ? `Páginas: ${sec.pageNumbers.join(", ")}` : "Ninguna"}
                        </span>
                      </div>

                      {/* Input rápido por rango de texto */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">Escribir rango rápido:</span>
                        <input
                          type="text"
                          defaultValue={sec.pageNumbers.join(", ")}
                          key={sec.id + "_" + sec.pageNumbers.join("-")}
                          placeholder="Ej. 1-3, 5"
                          onBlur={(e) => {
                            const val = e.target.value;
                            const result = new Set<number>();
                            val.split(/[,;\s]+/).forEach((part) => {
                              if (part.includes("-")) {
                                const [s, end] = part.split("-").map(Number);
                                if (!isNaN(s) && !isNaN(end)) {
                                  for (let p = Math.min(s, end); p <= Math.max(s, end); p++) {
                                    if (p >= 1 && p <= totalPages) result.add(p);
                                  }
                                }
                              } else {
                                const n = Number(part);
                                if (!isNaN(n) && n >= 1 && n <= totalPages) result.add(n);
                              }
                            });
                            if (result.size > 0) {
                              setSections((prev) =>
                                prev.map((s) =>
                                  s.id === sec.id ? { ...s, pageNumbers: Array.from(result).sort((a, b) => a - b) } : s
                                )
                              );
                            }
                          }}
                          className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 w-36 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                          const isSelected = sec.pageNumbers.includes(pageNum);
                          return (
                            <button
                              type="button"
                              key={pageNum}
                              onClick={() => handleTogglePage(sec.id, pageNum)}
                              className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ASIGNACIÓN DE ESTA SECCIÓN */}
                    <div className="pt-3 border-t border-slate-100 space-y-2.5">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase">
                        Asignar esta sección a:
                      </label>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSections((prev) =>
                              prev.map((s) => (s.id === sec.id ? { ...s, assigned_to: "all" } : s))
                            );
                          }}
                          className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all ${
                            sec.assigned_to === "all"
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Users size={14} /> Todo el Equipo
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSections((prev) =>
                              prev.map((s) => (s.id === sec.id ? { ...s, assigned_to: "specialty" } : s))
                            );
                          }}
                          className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all ${
                            sec.assigned_to === "specialty"
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Layers size={14} /> Especialidad
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSections((prev) =>
                              prev.map((s) => (s.id === sec.id ? { ...s, assigned_to: "therapists" } : s))
                            );
                          }}
                          className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all ${
                            sec.assigned_to === "therapists"
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <FileText size={14} /> Específicos
                        </button>
                      </div>

                      {/* Asignación por especialidad */}
                      {sec.assigned_to === "specialty" && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-1.5">
                          {availableSpecialties.map((spec) => {
                            const isSelected = (sec.assigned_specialties || []).includes(spec);
                            return (
                              <button
                                type="button"
                                key={spec}
                                onClick={() => handleToggleSpecialty(sec.id, spec)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                                  isSelected
                                    ? "bg-indigo-600 text-white"
                                    : "bg-white text-slate-700 border border-slate-200"
                                }`}
                              >
                                {isSelected && <Check size={11} />}
                                {spec}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Asignación por terapeutas específicos */}
                      {sec.assigned_to === "therapists" && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-36 overflow-y-auto custom-scrollbar space-y-1">
                          {therapists.map((t) => {
                            const isSelected = (sec.assigned_therapist_ids || []).includes(t.id);
                            return (
                              <label
                                key={t.id}
                                className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer text-xs ${
                                  isSelected
                                    ? "bg-indigo-50 border-indigo-300 font-bold text-indigo-900"
                                    : "bg-white border-slate-200 text-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleTherapist(sec.id, t.id)}
                                    className="rounded text-indigo-600 h-3.5 w-3.5"
                                  />
                                  <span>{t.name}</span>
                                </div>
                                {t.specialty && (
                                  <span className="text-[10px] text-slate-400">{t.specialty}</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-white z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSplitAndSave}
            disabled={processing || loadingPages}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
          >
            <Scissors size={15} />
            {processing ? "Extrayendo y Guardando..." : "Guardar y Asignar Secciones"}
          </button>
        </div>
      </div>
    </div>
  );
}
