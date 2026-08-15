"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Upload,
  Save,
  User,
  Calendar,
  Clock,
  ChevronLeft,
  CheckCircle,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { TherapistPdfSubmission } from "@/lib/pdf-storage";
import { savePdfSubmission } from "@/lib/pdf-storage";

interface PatientOption {
  id: string;
  name: string;
}

interface PdfViewerEditorProps {
  templateId: string;
  templateTitle: string;
  pdfDataUrl: string;
  tenantId: string;
  therapistId: string;
  therapistName: string;
  therapistRole: string;
  patients?: PatientOption[];
  onSaved?: (submission: TherapistPdfSubmission) => void;
  onClose?: () => void;
}

export function PdfViewerEditor({
  templateId,
  templateTitle,
  pdfDataUrl,
  tenantId,
  therapistId,
  therapistName,
  therapistRole,
  patients = [],
  onSaved,
  onClose,
}: PdfViewerEditorProps) {
  const toast = useToast();

  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [showUploadCompletedModal, setShowUploadCompletedModal] = useState(false);
  const [completedPdfData, setCompletedPdfData] = useState<string>("");
  const [completedFileName, setCompletedFileName] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Crear Blob URL para renderizado rápido y nativo con soporte de formularios editables
  useEffect(() => {
    if (!pdfDataUrl) return;

    try {
      if (pdfDataUrl.startsWith("data:")) {
        const parts = pdfDataUrl.split(",");
        const byteString = atob(parts[1]);
        const mimeString = parts[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      } else {
        setBlobUrl(pdfDataUrl);
      }
    } catch (e) {
      console.error("Error creando Blob URL:", e);
      setBlobUrl(pdfDataUrl);
    }
  }, [pdfDataUrl]);

  // Descargar el PDF original para rellenar
  const handleDownloadOriginal = () => {
    const link = document.createElement("a");
    link.href = pdfDataUrl;
    link.download = `${templateTitle.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.addToast("Descargando PDF editable...", "info");
  };

  // Abrir PDF en pestaña independiente para rellenar a pantalla completa
  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    }
  };

  // Carga de archivo completado/rellenado por el terapeuta
  const handleCompletedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.addToast("Por favor selecciona un archivo PDF", "error");
      return;
    }

    setCompletedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setCompletedPdfData(data);
      toast.addToast("PDF completado listo para guardar", "success");
    };
    reader.readAsDataURL(file);
  };

  // Guardar PDF en el sistema con hora, fecha, autor y paciente
  const handleSaveToSystem = async () => {
    setSaving(true);
    try {
      const now = new Date();
      const formattedDate = now.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const patientObj = patients.find((p) => p.id === selectedPatientId);
      const finalPdf = completedPdfData || pdfDataUrl;

      const submission: TherapistPdfSubmission = {
        id: "sub_" + Date.now(),
        template_id: templateId,
        template_title: templateTitle,
        tenant_id: tenantId,
        therapist_id: therapistId,
        therapist_name: therapistName,
        therapist_role: therapistRole,
        patient_id: selectedPatientId || null,
        patient_name: patientObj ? patientObj.name : null,
        filled_at: now.toISOString(),
        filled_date_formatted: formattedDate,
        annotations: [],
        filled_pdf_data: finalPdf,
        status: "completado",
        notes: notes.trim(),
      };

      await savePdfSubmission(submission);
      toast.addToast(`PDF guardado con éxito en el sistema (${formattedDate})`, "success");

      if (onSaved) {
        onSaved(submission);
      }
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      console.error("Error al guardar:", err);
      toast.addToast("Error al guardar en el sistema: " + err.message, "error");
    } finally {
      setSaving(false);
      setShowUploadCompletedModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
      {/* ── BARRA SUPERIOR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-800/95 border-b border-slate-700 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              title="Volver"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <FileText size={18} className="text-indigo-400" />
              {templateTitle}
            </h2>
            <p className="text-[11px] text-slate-400">
              Terapeuta: <span className="text-indigo-300 font-semibold">{therapistName}</span> • Formato Editable Nativo
            </p>
          </div>
        </div>

        {/* Selector de Paciente */}
        {patients.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-700/60 px-3.5 py-2 rounded-2xl border border-slate-600/60">
            <User size={15} className="text-indigo-400" />
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer font-medium"
            >
              <option value="" className="bg-slate-800 text-slate-300">
                -- Seleccionar Paciente a Evaluar --
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-800 text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadOriginal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white transition-all shadow-sm"
            title="Descargar PDF para rellenar en Acrobat o tu lector favorito"
          >
            <Download size={15} /> Descargar
          </button>

          <button
            onClick={handleOpenInNewTab}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 transition-all"
            title="Abrir en pestaña completa"
          >
            <ExternalLink size={15} /> Pantalla Completa
          </button>

          <button
            onClick={() => setShowUploadCompletedModal(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
          >
            <Save size={15} /> Guardar en el Sistema
          </button>
        </div>
      </div>

      {/* ── VISOR DE PDF NATIVO ── */}
      <div className="flex-1 bg-slate-950 p-4 flex flex-col items-center justify-center overflow-hidden">
        {blobUrl ? (
          <iframe
            src={`${blobUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full rounded-2xl border border-slate-800 shadow-2xl bg-white"
            title="Visor de PDF Editable"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Cargando documento PDF...</p>
          </div>
        )}
      </div>

      {/* ── MODAL PARA GUARDAR PDF COMPLETADO ── */}
      {showUploadCompletedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-lg w-full p-6 text-white space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <CheckCircle className="text-emerald-400" size={20} />
                Guardar PDF en el Sistema
              </h3>
              <button
                onClick={() => setShowUploadCompletedModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Información de Trazabilidad */}
              <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/60 space-y-2">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Trazabilidad del Registro:</p>
                <div className="grid grid-cols-2 gap-2 text-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Terapeuta:</span>
                    <strong className="text-white">{therapistName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Fecha y Hora:</span>
                    <strong className="text-indigo-300 font-mono">
                      {new Date().toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Selección de Paciente */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Paciente Vinculado</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- Registro General / Sin Paciente Específico --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opción para adjuntar el archivo rellenado si lo editó en Acrobat */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Adjuntar Versión Rellenada / Firmada (Opcional)
                </label>
                <div className="border border-dashed border-slate-700 rounded-xl p-3 text-center bg-slate-950/40">
                  {completedFileName ? (
                    <p className="text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle size={14} /> {completedFileName}
                    </p>
                  ) : (
                    <label className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer inline-flex items-center gap-1.5">
                      <Upload size={14} /> Subir PDF rellenado desde tu equipo
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleCompletedFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Si rellenaste el formato directamente en la ventana o deseas guardar el registro de atención, presiona Guardar.
                </p>
              </div>

              {/* Observaciones o Notas */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Observaciones de la Sesión</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej. Paciente completó la evaluación con buena tolerancia..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowUploadCompletedModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveToSystem}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "Guardando..." : "Confirmar y Guardar en Sistema"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
