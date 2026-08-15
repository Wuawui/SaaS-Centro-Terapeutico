"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Plus,
  Calendar,
  User,
  Clock,
  CheckCircle,
  Eye,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  getPdfTemplates,
  getPdfSubmissions,
  deletePdfSubmission,
  getAssignedTemplatesForTherapist,
  type TherapistPdfTemplate,
  type TherapistPdfSubmission,
} from "@/lib/pdf-storage";
import dynamic from "next/dynamic";

const PdfViewerEditor = dynamic(
  () => import("@/components/pdf/PdfViewerEditor").then((mod) => mod.PdfViewerEditor),
  { ssr: false }
);
import { generateDefaultSamplePdf } from "@/lib/pdf-editor-utils";

interface PatientPdfFormsTabProps {
  patientId: string;
  patientName: string;
  tenantId: string;
  therapistId: string;
  therapistName: string;
  therapistRole: string;
}

export function PatientPdfFormsTab({
  patientId,
  patientName,
  tenantId,
  therapistId,
  therapistName,
  therapistRole,
}: PatientPdfFormsTabProps) {
  const toast = useToast();

  const [submissions, setSubmissions] = useState<TherapistPdfSubmission[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<TherapistPdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal para seleccionar plantilla a rellenar
  const [showSelectTemplateModal, setShowSelectTemplateModal] = useState(false);
  const [activeEditingDoc, setActiveEditingDoc] = useState<TherapistPdfTemplate | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allSubs = await getPdfSubmissions(tenantId);
      // Filtrar submissions de este paciente específico
      const patientSubs = allSubs.filter((s) => s.patient_id === patientId);
      setSubmissions(patientSubs);

      const allTpls = await getPdfTemplates(tenantId);
      const isAdmin = ["super_admin", "director", "coordinador", "admin"].includes(therapistRole);
      const filteredTpls = isAdmin
        ? allTpls
        : getAssignedTemplatesForTherapist(allTpls, therapistId, undefined, therapistRole);
      setAvailableTemplates(filteredTpls);
    } catch (err) {
      console.error("Error al cargar formatos del paciente:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId, tenantId, therapistId, therapistRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Abrir editor con la plantilla seleccionada para este paciente
  const handleStartFill = (template: TherapistPdfTemplate) => {
    let pdfUrl = template.pdf_data;
    if (!pdfUrl) {
      pdfUrl = generateDefaultSamplePdf(template.title, template.category);
    }
    setActiveEditingDoc({ ...template, pdf_data: pdfUrl });
    setShowSelectTemplateModal(false);
  };

  // Descargar PDF completado
  const handleDownload = (sub: TherapistPdfSubmission) => {
    if (!sub.filled_pdf_data) {
      toast.addToast("El archivo no tiene datos descargables", "error");
      return;
    }
    const link = document.createElement("a");
    link.href = sub.filled_pdf_data;
    link.download = `${sub.template_title.replace(/\s+/g, "_")}_${patientName.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.addToast("Descargando PDF completado...", "success");
  };

  // Eliminar registro
  const handleDelete = async (subId: string, title: string) => {
    if (!confirm(`¿Eliminar el registro "${title}" de este paciente?`)) return;
    await deletePdfSubmission(tenantId, subId);
    loadData();
    toast.addToast("Registro eliminado con éxito", "success");
  };

  // Editor a pantalla completa
  if (activeEditingDoc) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col animate-fadeIn">
        <PdfViewerEditor
          templateId={activeEditingDoc.id}
          templateTitle={activeEditingDoc.title}
          pdfDataUrl={activeEditingDoc.pdf_data}
          tenantId={tenantId}
          therapistId={therapistId}
          therapistName={therapistName}
          therapistRole={therapistRole}
          patients={[{ id: patientId, name: patientName }]}
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
    <div className="space-y-5">
      {/* ── HEADER DE LA PESTAÑA ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/60 p-5 rounded-2xl border border-indigo-100">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-indigo-600" size={18} />
            Formatos Clínicos y Evaluaciones PDF
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Documentos y consentimientos completados y firmados para el paciente:{" "}
            <strong className="text-indigo-900">{patientName}</strong>
          </p>
        </div>

        <button
          onClick={() => setShowSelectTemplateModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 inline-flex items-center gap-2 transition-all active:scale-95"
        >
          <Plus size={15} /> Rellenar Formato PDF
        </button>
      </div>

      {/* ── LISTADO DE DOCUMENTOS COMPLETADOS ── */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">
          <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Cargando documentos...</p>
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <FileText size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-700">No hay formatos PDF guardados para este paciente</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Rellena una evaluación inicial, consentimiento o ficha de seguimiento para archivarla en su expediente.
            </p>
          </div>
          <button
            onClick={() => setShowSelectTemplateModal(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Seleccionar Formato
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle size={11} /> Completado
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock size={12} />
                    {sub.filled_date_formatted || new Date(sub.filled_at).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{sub.template_title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rellenado por: <strong className="text-slate-700">{sub.therapist_name}</strong>{" "}
                    <span className="text-[10px] text-slate-400 uppercase">({sub.therapist_role})</span>
                  </p>
                </div>

                {sub.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl italic">
                    "{sub.notes}"
                  </p>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleDelete(sub.id, sub.template_title)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>

                <button
                  onClick={() => handleDownload(sub)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Download size={13} />
                  Descargar PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL PARA SELECCIONAR FORMATO A RELLENAR ── */}
      {showSelectTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={18} />
                  Seleccionar Formato Clínico
                </h3>
                <p className="text-xs text-slate-500">
                  Para el paciente: <strong className="text-slate-800">{patientName}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowSelectTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {availableTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleStartFill(tpl)}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                      {tpl.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 mt-1">
                      {tpl.title}
                    </h4>
                  </div>
                  <button className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    Rellenar
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowSelectTemplateModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
