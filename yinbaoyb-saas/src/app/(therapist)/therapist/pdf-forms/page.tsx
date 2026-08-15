"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  PenTool,
  CheckCircle,
  Clock,
  Download,
  Search,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  Folder,
} from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import {
  getPdfTemplates,
  getPdfSubmissions,
  getAssignedTemplatesForTherapist,
  type TherapistPdfTemplate,
  type TherapistPdfSubmission,
} from "@/lib/pdf-storage";
import { generateDefaultSamplePdf } from "@/lib/pdf-editor-utils";

const PdfViewerEditor = dynamic(
  () => import("@/components/pdf/PdfViewerEditor").then((mod) => mod.PdfViewerEditor),
  { ssr: false }
);

export default function TherapistPdfFormsPage() {
  const { user, profile, tenantId } = useSession();
  const toast = useToast();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"assigned" | "my_submissions">("assigned");
  const [assignedTemplates, setAssignedTemplates] = useState<TherapistPdfTemplate[]>([]);
  const [mySubmissions, setMySubmissions] = useState<TherapistPdfSubmission[]>([]);
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);

  const [activeEditingDoc, setActiveEditingDoc] = useState<TherapistPdfTemplate | null>(null);
  const [search, setSearch] = useState("");

  const effectiveTenantId = tenantId || "00000000-0000-0000-0000-000000000001";
  const therapistId = user?.id || profile?.id || "";
  const therapistName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Terapeuta";
  const therapistRole = profile?.role || "terapeuta";

  const loadData = useCallback(async () => {
    // 1. Obtener especialidad del terapeuta actual
    let specialty = "";
    if (therapistId) {
      const { data: th } = await supabase.from("therapists").select("specialty").eq("id", therapistId).single();
      specialty = th?.specialty || (therapistRole === "fisioterapeuta" ? "Fisioterapia" : "Terapia Integral");
    }

    // 2. Cargar todas las plantillas y filtrar las asignadas
    const allTemplates = await getPdfTemplates(effectiveTenantId);
    const isAdmin = ["super_admin", "director", "coordinador", "admin"].includes(therapistRole);
    const assigned = isAdmin
      ? allTemplates
      : getAssignedTemplatesForTherapist(allTemplates, therapistId, specialty, therapistRole);
    setAssignedTemplates(assigned);

    // 3. Cargar envíos realizados por este terapeuta
    const allSubmissions = await getPdfSubmissions(effectiveTenantId);
    const mine = allSubmissions.filter((s) => s.therapist_id === therapistId || !s.therapist_id);
    setMySubmissions(mine);

    // 4. Cargar pacientes asignados a este terapeuta
    if (therapistId) {
      const { data: patData } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("tenant_id", effectiveTenantId)
        .or(`therapist_id.eq.${therapistId},secondary_therapist_ids.cs.{"${therapistId}"}`)
        .eq("active", true)
        .order("first_name");

      if (patData) {
        setPatients(
          patData.map((p: any) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`.trim(),
          }))
        );
      }
    }
  }, [effectiveTenantId, supabase, therapistId, therapistRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenFillEditor = (template: TherapistPdfTemplate) => {
    let pdfUrl = template.pdf_data;
    if (!pdfUrl) {
      pdfUrl = generateDefaultSamplePdf(template.title, template.category);
    }
    setActiveEditingDoc({ ...template, pdf_data: pdfUrl });
  };

  const handleDownloadSubmission = (sub: TherapistPdfSubmission) => {
    if (!sub.filled_pdf_data) {
      toast.addToast("El archivo no contiene datos para descargar", "error");
      return;
    }
    const link = document.createElement("a");
    link.href = sub.filled_pdf_data;
    link.download = `${sub.template_title.replace(/\s+/g, "_")}_${(sub.patient_name || "Completado").replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.addToast("Descargando PDF completado...", "success");
  };

  // ── AGRUPAR SECCIONES ASIGNADAS BAJO SU DOCUMENTO MATRIZ ──
  const childSections = assignedTemplates.filter((t) => !!t.parent_template_id);
  const sectionsByParent: Record<string, TherapistPdfTemplate[]> = {};

  childSections.forEach((sec) => {
    const pId = sec.parent_template_id!;
    if (!sectionsByParent[pId]) sectionsByParent[pId] = [];
    sectionsByParent[pId].push(sec);
  });

  Object.keys(sectionsByParent).forEach((pId) => {
    sectionsByParent[pId].sort((a, b) => (a.section_order || 0) - (b.section_order || 0));
  });

  // Todas las plantillas principales (que no son secciones hijas)
  const rootTemplates = assignedTemplates.filter((t) => !t.parent_template_id);

  // Secciones huérfanas (cuyo documento matriz no está entre los asignados principales)
  const orphanSections = childSections.filter(
    (s) => !rootTemplates.some((r) => r.id === s.parent_template_id)
  );

  // Filtros de búsqueda
  const filteredRootTemplates = rootTemplates.filter((t) => {
    const childs = sectionsByParent[t.id] || [];
    const matchChild = childs.some((c) =>
      c.title.toLowerCase().includes(search.toLowerCase())
    );
    return (
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      matchChild
    );
  });

  const filteredOrphans = orphanSections.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSubmissions = mySubmissions.filter((s) => {
    const query = search.toLowerCase();
    return (
      s.template_title.toLowerCase().includes(query) ||
      (s.patient_name || "").toLowerCase().includes(query)
    );
  });

  if (activeEditingDoc) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col animate-fadeIn">
        <PdfViewerEditor
          templateId={activeEditingDoc.id}
          templateTitle={activeEditingDoc.title}
          pdfDataUrl={activeEditingDoc.pdf_data}
          tenantId={effectiveTenantId}
          therapistId={therapistId}
          therapistName={therapistName}
          therapistRole={therapistRole}
          patients={patients}
          onClose={() => {
            setActiveEditingDoc(null);
            loadData();
          }}
          onSaved={() => {
            loadData();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── HEADER TERAPEUTA ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-semibold">
            <Sparkles size={13} />
            Formatos & Evaluaciones
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Mis Formatos PDF</h1>
          <p className="text-xs sm:text-sm text-indigo-200/80 max-w-xl">
            Accede a las plantillas y fichas clínicas asignadas por la administración. Puedes escribir directamente sobre el documento, colocar tu firma digital y guardarlo en la ficha del paciente.
          </p>
        </div>
      </div>

      {/* ── PESTAÑAS Y BÚSQUEDA ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("assigned")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "assigned"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Layers size={15} />
            Formatos Asignados ({assignedTemplates.length})
          </button>

          <button
            onClick={() => setActiveTab("my_submissions")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "my_submissions"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <CheckCircle size={15} />
            Mis Formularios Rellenados ({mySubmissions.length})
          </button>
        </div>

        {/* Buscador */}
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar formato..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ── FORMATOS ASIGNADOS AGRUPADOS Y ORDENADOS ── */}
      {activeTab === "assigned" && (
        <div>
          {filteredRootTemplates.length === 0 && filteredOrphans.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
                <FileText size={26} />
              </div>
              <p className="text-sm font-bold text-slate-800">No tienes formatos asignados por el momento</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                La administración te asignará plantillas clínicas y fichas de evaluación para tus sesiones terapéuticas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
              {/* 1. DOCUMENTOS PRINCIPALES (CON O SIN SECCIONES) */}
              {filteredRootTemplates.map((tpl) => {
                const childs = sectionsByParent[tpl.id] || [];
                const hasSections = childs.length > 0;

                return (
                  <div
                    key={tpl.id}
                    className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase flex items-center gap-1">
                          {hasSections && <Folder size={11} className="text-indigo-600" />}
                          {tpl.category} {hasSections ? `• ${childs.length} Secciones` : ""}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {tpl.file_size_bytes ? `${Math.round(tpl.file_size_bytes / 1024)} KB` : "PDF"}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {tpl.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {tpl.description || "Formato clínico listo para completar con información del paciente."}
                        </p>
                      </div>

                      {/* Lista de secciones ordenadas */}
                      {hasSections && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          {childs.map((sec, idx) => (
                            <div
                              key={sec.id}
                              className="p-2.5 bg-amber-50/50 rounded-2xl border border-amber-200/70 flex items-center justify-between gap-2 hover:bg-amber-100/50 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-amber-200 text-amber-900 font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {sec.section_order || idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 text-xs truncate">{sec.title}</p>
                                  <p className="text-[10px] text-slate-400">{sec.page_range || "Páginas"}</p>
                                </div>
                              </div>

                              <button
                                onClick={() => handleOpenFillEditor(sec)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-sm shrink-0 active:scale-95 transition-all"
                              >
                                <PenTool size={12} /> Rellenar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenFillEditor(tpl)}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                      >
                        <PenTool size={14} />
                        {hasSections ? "Abrir Documento Completo" : "Abrir y Rellenar Formato"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* 2. SECCIONES HUÉRFANAS ASIGNADAS DIRECTAMENTE */}
              {filteredOrphans.map((orphan) => (
                <div
                  key={orphan.id}
                  className="bg-white rounded-3xl border border-amber-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 uppercase">
                        {orphan.category} • Sección {orphan.section_order || 1}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {orphan.page_range || "PDF"}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{orphan.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {orphan.description || "Sección asignada lista para completar."}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenFillEditor(orphan)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                    >
                      <PenTool size={14} />
                      Rellenar Sección
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MIS FORMULARIOS COMPLETADOS ── */}
      {activeTab === "my_submissions" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Documentos que has rellenado y firmado</h3>
            <p className="text-xs text-slate-500">Historial con fecha, hora y firma digital almacenada.</p>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-16 p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Clock size={24} />
              </div>
              <p className="text-sm font-semibold text-slate-700">Aún no has rellenado ningún formato</p>
              <p className="text-xs text-slate-400">Cuando completes una evaluación, se guardará aquí.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSubmissions.map((sub) => (
                <div key={sub.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle size={10} /> Completado
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {sub.filled_date_formatted || new Date(sub.filled_at).toLocaleString()}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm">{sub.template_title}</h4>
                    <p className="text-xs text-slate-500">
                      Paciente: <strong className="text-indigo-600">{sub.patient_name || "General"}</strong>
                    </p>
                    {sub.notes && (
                      <p className="text-xs text-slate-600 bg-slate-100/80 p-2 rounded-xl italic mt-1">
                        "{sub.notes}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDownloadSubmission(sub)}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                  >
                    <Download size={14} />
                    Descargar PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
