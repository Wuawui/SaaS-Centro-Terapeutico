"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Upload,
  Users,
  Search,
  Download,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  Eye,
  PenTool,
  Filter,
  Calendar,
  Sparkles,
  Layers,
  ArrowRight,
  Scissors,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  UserCheck,
} from "lucide-react";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import {
  getPdfTemplates,
  getPdfSubmissions,
  deletePdfTemplate,
  deletePdfSubmission,
  type TherapistPdfTemplate,
  type TherapistPdfSubmission,
} from "@/lib/pdf-storage";
import { AssignPdfModal } from "@/components/pdf/AssignPdfModal";
import { SplitPdfModal } from "@/components/pdf/SplitPdfModal";
import { PdfViewerEditor } from "@/components/pdf/PdfViewerEditor";
import { generateDefaultSamplePdf } from "@/lib/pdf-editor-utils";

export default function TherapistPdfsAdminPage() {
  const { profile, tenantId } = useSession();
  const toast = useToast();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"templates" | "submissions">("templates");
  const [templates, setTemplates] = useState<TherapistPdfTemplate[]>([]);
  const [submissions, setSubmissions] = useState<TherapistPdfSubmission[]>([]);

  // Terapeutas y pacientes cargados de base de datos
  const [therapists, setTherapists] = useState<{ id: string; name: string; specialty?: string }[]>([]);
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);

  // Modales y Editores
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TherapistPdfTemplate | null>(null);
  const [splittingTemplate, setSplittingTemplate] = useState<TherapistPdfTemplate | null>(null);

  // Acordeones de carpetas/secciones expandidas
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  // Editor Activo
  const [activeEditingDoc, setActiveEditingDoc] = useState<{
    template: TherapistPdfTemplate;
    submission?: TherapistPdfSubmission | null;
  } | null>(null);

  // Búsqueda y Filtros
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const effectiveTenantId = tenantId || "00000000-0000-0000-0000-000000000001";

  const loadData = useCallback(async () => {
    // 1. Cargar plantillas y submissions desde IndexedDB
    const tpls = await getPdfTemplates(effectiveTenantId);
    const subs = await getPdfSubmissions(effectiveTenantId);
    setTemplates(tpls);
    setSubmissions(subs);

    // 2. Cargar terapeutas de la base de datos
    try {
      const { data: profData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role")
        .eq("tenant_id", effectiveTenantId)
        .in("role", ["terapeuta", "fisioterapeuta", "coordinador", "director", "super_admin"]);

      const { data: thData } = await supabase.from("therapists").select("id, specialty");
      const specMap = new Map((thData || []).map((t: any) => [t.id, t.specialty || ""]));

      if (profData) {
        setTherapists(
          profData.map((p: any) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name}`.trim(),
            specialty: specMap.get(p.id) || (p.role === "fisioterapeuta" ? "Fisioterapia" : "Terapia Integral"),
          }))
        );
      }

      // 3. Cargar pacientes para asociar
      const { data: patData } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .eq("tenant_id", effectiveTenantId)
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
    } catch (e) {
      console.error("Error al cargar terapeutas/pacientes:", e);
    }
  }, [effectiveTenantId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (id: string) => {
    setExpandedParents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const adminName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : "Administrador";
  const adminRole = profile?.role || "admin";

  // Mapa de ID a Nombre de terapeuta
  const therapistNameMap = new Map(therapists.map((t) => [t.id, t.name]));

  const getAssignedNamesText = (tpl: TherapistPdfTemplate): string => {
    if (tpl.assigned_to === "all" || !tpl.assigned_to) {
      return "Todo el equipo";
    }
    if (tpl.assigned_to === "specialty") {
      return `Especialidad: ${tpl.assigned_specialties?.join(", ") || "General"}`;
    }
    if (tpl.assigned_to === "therapists") {
      const ids = tpl.assigned_therapist_ids || [];
      if (ids.length === 0) return "Sin asignar";
      const names = ids.map((id) => therapistNameMap.get(id) || id);
      return names.join(", ");
    }
    return "Asignado";
  };

  // Abrir editor para rellenar
  const handleOpenFillEditor = (template: TherapistPdfTemplate, submission?: TherapistPdfSubmission) => {
    let pdfUrl = template.pdf_data;
    if (!pdfUrl) {
      pdfUrl = generateDefaultSamplePdf(template.title, template.category);
    }

    setActiveEditingDoc({
      template: { ...template, pdf_data: pdfUrl },
      submission,
    });
  };

  // Manejar eliminación de plantilla
  const handleDeleteTemplate = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar permanentemente la plantilla "${title}"?`)) return;
    await deletePdfTemplate(effectiveTenantId, id);
    loadData();
    toast.addToast("Plantilla eliminada correctamente", "success");
  };

  // Manejar eliminación de submission
  const handleDeleteSubmission = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar el registro rellenado de "${title}"?`)) return;
    await deletePdfSubmission(effectiveTenantId, id);
    loadData();
    toast.addToast("Registro eliminado con éxito", "success");
  };

  // Descarga directa de documento rellenado
  const handleDownloadSubmission = (sub: TherapistPdfSubmission) => {
    if (!sub.filled_pdf_data) {
      toast.addToast("El archivo no tiene datos descargables", "error");
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

  // ── AGRUPAR SECCIONES BAJO SU PLANTILLA MATRIZ ──
  const childSections = templates.filter((t) => !!t.parent_template_id);
  const sectionsByParent: Record<string, TherapistPdfTemplate[]> = {};

  childSections.forEach((sec) => {
    const pId = sec.parent_template_id!;
    if (!sectionsByParent[pId]) sectionsByParent[pId] = [];
    sectionsByParent[pId].push(sec);
  });

  // Ordenar secciones por section_order
  Object.keys(sectionsByParent).forEach((pId) => {
    sectionsByParent[pId].sort((a, b) => (a.section_order || 0) - (b.section_order || 0));
  });

  // Plantillas Raíz (solo las matrices o documentos sin padre)
  const rootTemplates = templates.filter((t) => !t.parent_template_id);

  // Secciones huérfanas (cuyo padre no existe en la base de datos)
  const orphanSections = childSections.filter(
    (s) => !rootTemplates.some((r) => r.id === s.parent_template_id)
  );

  // Filtros aplicados a documentos principales
  const filteredRootTemplates = rootTemplates.filter((t) => {
    const childs = sectionsByParent[t.id] || [];
    const matchChild = childs.some(
      (c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase())
    );

    const matchQuery =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      matchChild;

    const matchCat = filterCategory === "all" || t.category === filterCategory;
    return matchQuery && matchCat;
  });

  const filteredOrphans = orphanSections.filter((s) => {
    const matchQuery =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || s.category === filterCategory;
    return matchQuery && matchCat;
  });

  const filteredSubmissions = submissions.filter((s) => {
    const matchQuery =
      s.template_title.toLowerCase().includes(search.toLowerCase()) ||
      (s.patient_name || "").toLowerCase().includes(search.toLowerCase()) ||
      s.therapist_name.toLowerCase().includes(search.toLowerCase());
    return matchQuery;
  });

  // Si hay un editor activo a pantalla completa
  if (activeEditingDoc) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
        <PdfViewerEditor
          templateId={activeEditingDoc.template.id}
          templateTitle={activeEditingDoc.template.title}
          pdfDataUrl={activeEditingDoc.template.pdf_data}
          tenantId={effectiveTenantId}
          therapistId={profile?.id || "admin"}
          therapistName={adminName}
          therapistRole={adminRole}
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
      {/* ── HEADER PRINCIPAL ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-semibold">
            <Sparkles size={13} />
            Módulo Clínico Avanzado
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">PDF Terapeutas & Formatos Clínicos</h1>
          <p className="text-xs sm:text-sm text-indigo-200/80 max-w-xl">
            Sube y organiza PDFs por secciones ordenadas, asígnalos a los terapeutas para que escriban sobre el documento y consulta el historial completado con fecha y hora.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowAssignModal(true);
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
          >
            <Upload size={16} /> Subir Nuevo PDF
          </button>
        </div>
      </div>

      {/* ── PESTAÑAS Y BUSCADOR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "templates"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Layers size={15} />
            Documentos y Secciones ({templates.length})
          </button>

          <button
            onClick={() => setActiveTab("submissions")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === "submissions"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <CheckCircle size={15} />
            Historial de Rellenados ({submissions.length})
          </button>
        </div>

        {/* Buscador */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar formato o sección..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {activeTab === "templates" && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl text-xs px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-700"
            >
              <option value="all">Todas las categorías</option>
              <option value="Evaluación">Evaluación</option>
              <option value="Fisioterapia">Fisioterapia</option>
              <option value="Consentimientos">Consentimientos</option>
              <option value="Seguimiento">Seguimiento</option>
            </select>
          )}
        </div>
      </div>

      {/* ── TAB 1: PLANTILLAS Y SECCIONES AGRUPADAS ── */}
      {activeTab === "templates" && (
        <div>
          {filteredRootTemplates.length === 0 && filteredOrphans.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
                <FileText size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">No hay documentos cargados</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Sube el primer PDF clínico de tu centro para que los terapeutas puedan rellenarlo o divídelo en secciones ordenadas.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowAssignModal(true);
                }}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 inline-flex items-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <Upload size={14} /> Subir Plantilla PDF
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
              {/* 1. PLANTILLAS MATRIZ Y DOCUMENTOS PRINCIPALES */}
              {filteredRootTemplates.map((tpl) => {
                const sections = sectionsByParent[tpl.id] || [];
                const hasSections = sections.length > 0;
                const isExpanded = expandedParents[tpl.id] ?? true;

                return (
                  <div
                    key={tpl.id}
                    className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase tracking-wider">
                            {tpl.category}
                          </span>
                          {hasSections && (
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 uppercase tracking-wider flex items-center gap-1">
                              <Folder size={11} className="text-amber-600" />
                              {sections.length} Secciones
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {tpl.file_size_bytes ? `${Math.round(tpl.file_size_bytes / 1024)} KB` : "PDF"}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {tpl.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {tpl.description || "Formato clínico digital para registro y evaluación de pacientes."}
                        </p>
                      </div>

                      {/* ── SECCIONES ANIDADAS Y ORDENADAS ── */}
                      {hasSections ? (
                        <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/70 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                              <Layers size={13} className="text-amber-600" />
                              Secciones Organizadas ({sections.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleExpand(tpl.id)}
                              className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5"
                            >
                              {isExpanded ? (
                                <>Ocultar <ChevronUp size={13} /></>
                              ) : (
                                <>Ver Todas <ChevronDown size={13} /></>
                              )}
                            </button>
                          </div>

                          {/* Lista ordenada de secciones */}
                          {isExpanded && (
                            <div className="space-y-2 pt-1">
                              {sections.map((sec, idx) => (
                                <div
                                  key={sec.id}
                                  className="p-2.5 bg-white rounded-xl border border-amber-200/80 flex items-center justify-between gap-2 text-xs shadow-2xs hover:border-indigo-400 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      {sec.section_order || idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-800 text-xs truncate">{sec.title}</p>
                                      <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                        <span className="font-semibold text-indigo-700">
                                          👤 {getAssignedNamesText(sec)}
                                        </span>
                                        <span className="text-slate-400 font-mono">({sec.page_range || "Páginas"})</span>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => {
                                        setEditingTemplate(sec);
                                        setShowAssignModal(true);
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200"
                                      title="Editar asignación de sección"
                                    >
                                      <Edit size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenFillEditor(sec)}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 shadow-2xs"
                                    >
                                      <PenTool size={11} /> Abrir
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTemplate(sec.id, sec.title)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                      title="Eliminar sección"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Asignación cuando no tiene secciones */
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                            <UserCheck size={14} className="text-indigo-600" />
                            <span className="truncate">
                              Asignado a: <strong className="text-indigo-900">{getAssignedNamesText(tpl)}</strong>
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Subido por: {tpl.created_by_name || "Administrador"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ── ACCIONES PRINCIPALES DEL DOCUMENTO MATRIZ ── */}
                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingTemplate(tpl);
                            setShowAssignModal(true);
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Editar asignación del documento"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => setSplittingTemplate(tpl)}
                          className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Editar PDF por Secciones (Dividir y Organizar)"
                        >
                          <Scissors size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar documento completo"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSplittingTemplate(tpl)}
                          className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl flex items-center gap-1 border border-amber-200/80 transition-colors"
                          title="Dividir en secciones ordenadas"
                        >
                          <Scissors size={12} />
                          {hasSections ? "Re-Dividir" : "Secciones"}
                        </button>
                        <button
                          onClick={() => handleOpenFillEditor(tpl)}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 active:scale-95 transition-all"
                        >
                          <PenTool size={13} />
                          Abrir
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 2. SECCIONES DIRECTAS (HUÉRFANAS) */}
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

                    <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100 text-xs space-y-1">
                      <p className="font-semibold text-slate-700">
                        Asignado a: <strong className="text-indigo-800">{getAssignedNamesText(orphan)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTemplate(orphan);
                          setShowAssignModal(true);
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Editar asignación"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(orphan.id, orphan.title)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar sección"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenFillEditor(orphan)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 active:scale-95 transition-all"
                    >
                      <PenTool size={13} />
                      Abrir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: HISTORIAL DE DOCUMENTOS RELLENADOS (SUBMISSIONS) ── */}
      {activeTab === "submissions" && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">Documentos Completados por Terapeutas</h3>
              <p className="text-xs text-slate-500">Historial con hora, fecha y firma digital registrada.</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl">
              {submissions.length} Registros
            </span>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-16 p-8 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Clock size={20} />
              </div>
              <p className="text-sm font-semibold text-slate-700">No hay registros de documentos completados</p>
              <p className="text-xs text-slate-400">Los envíos completados por los terapeutas se listarán aquí.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Documento / Formato</th>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Terapeuta</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                            <FileText size={15} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{sub.template_title}</p>
                            {sub.notes && (
                              <p className="text-[10px] text-slate-400 line-clamp-1 italic max-w-xs">
                                "{sub.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {sub.patient_name ? (
                          <span className="font-semibold text-slate-800">{sub.patient_name}</span>
                        ) : (
                          <span className="text-slate-400 italic">General / Sin Paciente</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-800">{sub.therapist_name}</p>
                          <p className="text-[10px] text-indigo-500 uppercase">{sub.therapist_role}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-600">
                          {sub.filled_date_formatted || new Date(sub.filled_at).toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={11} />
                          Completado
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownloadSubmission(sub)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                            title="Descargar PDF rellenado"
                          >
                            <Download size={13} />
                            Descargar
                          </button>
                          <button
                            onClick={() => handleDeleteSubmission(sub.id, sub.template_title)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar registro"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Subida / Asignación */}
      {showAssignModal && (
        <AssignPdfModal
          tenantId={effectiveTenantId}
          adminName={adminName}
          therapists={therapists}
          initialTemplate={editingTemplate}
          onSaved={() => {
            loadData();
          }}
          onClose={() => {
            setShowAssignModal(false);
            setEditingTemplate(null);
          }}
        />
      )}

      {/* Modal para Editar y Dividir PDF por Secciones */}
      {splittingTemplate && (
        <SplitPdfModal
          template={splittingTemplate}
          tenantId={effectiveTenantId}
          adminName={adminName}
          therapists={therapists}
          onSaved={() => {
            loadData();
          }}
          onClose={() => {
            setSplittingTemplate(null);
          }}
        />
      )}
    </div>
  );
}
