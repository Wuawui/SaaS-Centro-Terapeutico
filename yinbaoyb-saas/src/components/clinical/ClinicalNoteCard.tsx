"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckCircle, 
  Clock, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Edit3, 
  Calendar,
  Lock,
  Unlock,
  AlertCircle,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FormattedNoteContent from "./FormattedNoteContent";

interface ClinicalNoteCardProps {
  id: string;
  format: string;
  content: string;
  signed: boolean;
  createdAt: string;
  patientName?: string;
  therapistName?: string;
  isAdmin?: boolean;
  onSign?: (id: string) => void | Promise<void>;
}

const noteFormatLabels: Record<string, string> = {
  soap: "SOAP",
  birp: "BIRP",
  dap: "DAP",
  libre: "Nota Libre",
  progreso: "Progreso"
};

const noteFormatColors: Record<string, string> = {
  soap: "bg-violet-50 text-violet-700 border-violet-100",
  birp: "bg-sky-50 text-sky-700 border-sky-100",
  dap: "bg-indigo-50 text-indigo-700 border-indigo-100",
  libre: "bg-teal-50 text-teal-700 border-teal-100",
  progreso: "bg-emerald-50 text-emerald-700 border-emerald-100"
};

export default function ClinicalNoteCard({
  id,
  format,
  content,
  signed,
  createdAt,
  patientName,
  therapistName,
  isAdmin: propIsAdmin,
  onSign
}: ClinicalNoteCardProps) {
  const supabase = createClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signing, setSigning] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Modal & Edit States
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [editContentText, setEditContentText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (prof) setUserRole(prof.role);
      }
    }
    fetchRole();
  }, []);

  const isAdminRole = propIsAdmin || ["admin", "director", "coordinador", "super_admin"].includes(userRole || "");

  // Parse payload metadata if content is JSON wrapper
  let parsedBody = content || "";
  let editRequested = false;
  let editReason = "";
  let editApproved = false;

  try {
    if (content && content.trim().startsWith("{")) {
      const parsed = JSON.parse(content);
      if (parsed.body !== undefined) {
        parsedBody = parsed.body;
        editRequested = !!parsed.edit_requested;
        editReason = parsed.edit_reason || "";
        editApproved = !!parsed.edit_approved;
      }
    }
  } catch (e) {
    parsedBody = content || "";
  }

  const formatKey = format?.toLowerCase() || "libre";
  const formatLabel = noteFormatLabels[formatKey] || format || "Nota";
  const formatColorClass = noteFormatColors[formatKey] || "bg-slate-50 text-slate-700 border-slate-100";

  // Clean raw content for copy to clipboard
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanText = parsedBody
      .replace(/\*\*/g, "")
      .replace(/---/g, "")
      .trim();
    
    navigator.clipboard.writeText(cleanText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSign || signing) return;
    setSigning(true);
    try {
      await onSign(id);
    } catch (err) {
      console.error("Error signing note:", err);
    } finally {
      setSigning(false);
    }
  };

  // Submit edit authorization request to Admin
  const handleSendEditRequest = async () => {
    if (!requestReason.trim()) return;
    setActionLoading(true);
    const updatedPayload = JSON.stringify({
      body: parsedBody,
      edit_requested: true,
      edit_reason: requestReason.trim(),
      edit_approved: false,
      requested_at: new Date().toISOString()
    });

    const { error: err } = await supabase
      .from("clinical_notes")
      .update({ content: updatedPayload })
      .eq("id", id);

    setActionLoading(false);
    if (err) {
      alert("Error al solicitar edición: " + err.message);
    } else {
      setShowRequestModal(false);
      window.location.reload();
    }
  };

  // Admin approves edit request
  const handleAdminApprove = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionLoading(true);
    const updatedPayload = JSON.stringify({
      body: parsedBody,
      edit_requested: false,
      edit_approved: true,
      edit_reason: editReason
    });

    const { error: err } = await supabase
      .from("clinical_notes")
      .update({ content: updatedPayload })
      .eq("id", id);

    setActionLoading(false);
    if (err) {
      alert("Error al autorizar la edición: " + err.message);
    } else {
      window.location.reload();
    }
  };

  // Admin rejects edit request
  const handleAdminReject = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionLoading(true);
    const updatedPayload = JSON.stringify({
      body: parsedBody,
      edit_requested: false,
      edit_approved: false
    });

    const { error: err } = await supabase
      .from("clinical_notes")
      .update({ content: updatedPayload })
      .eq("id", id);

    setActionLoading(false);
    if (err) {
      alert("Error al rechazar la solicitud: " + err.message);
    } else {
      window.location.reload();
    }
  };

  // Open Edit Modal with current body
  const handleOpenEditModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContentText(parsedBody);
    setShowEditModal(true);
  };

  // Save the edited content
  const handleSaveNoteEdit = async () => {
    if (!editContentText.trim()) return;
    setActionLoading(true);
    const updatedPayload = JSON.stringify({
      body: editContentText.trim(),
      edit_requested: false,
      edit_approved: false
    });

    const { error: err } = await supabase
      .from("clinical_notes")
      .update({ content: updatedPayload })
      .eq("id", id);

    setActionLoading(false);
    if (err) {
      alert("Error al guardar los cambios: " + err.message);
    } else {
      setShowEditModal(false);
      window.location.reload();
    }
  };

  // Get patient initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const isLongNote = parsedBody?.length > 320;

  // Formatted date string
  const dateObj = new Date(createdAt);
  const formattedDate = dateObj.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  const formattedTime = dateObj.toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  return (
    <div 
      className={`group bg-white rounded-2xl border border-slate-100 shadow-soft transition-all duration-300 hover:shadow-float ${
        signed 
          ? "border-l-4 border-l-emerald-500" 
          : "border-l-4 border-l-amber-500"
      }`}
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 pb-3 border-b border-slate-50 bg-slate-50/20">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Format Badge */}
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${formatColorClass} shadow-sm flex items-center gap-1.5`}>
            <FileText className="h-3 w-3" />
            {formatLabel}
          </span>

          {/* Therapist Info */}
          {therapistName && (
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <span className="text-xs font-medium text-slate-500">👨‍⚕️ {therapistName}</span>
            </div>
          )}

          {/* Patient Info (If global search dashboard) */}
          {patientName && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shadow-indigo-500/10">
                {getInitials(patientName)}
              </div>
              <span className="text-sm font-semibold text-slate-800 font-outfit">{patientName}</span>
            </div>
          )}
        </div>

        {/* Date and Status badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Created Date */}
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <Calendar className="h-3.5 w-3.5 text-slate-350" />
            <span>{formattedDate} · {formattedTime}</span>
          </div>

          {/* Edit Request Status Badge */}
          {editRequested && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs animate-pulse">
              <Clock className="h-3 w-3 text-amber-700" />
              Edición Solicitada al Admin
            </span>
          )}

          {editApproved && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-xs">
              <Unlock className="h-3 w-3 text-indigo-700" />
              Edición Autorizada
            </span>
          )}

          {/* Sign Status */}
          {signed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100/60 shadow-sm">
              <CheckCircle className="h-3 w-3 text-emerald-600" />
              Firmada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100/60 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-led" />
              Pendiente
            </span>
          )}
        </div>
      </div>

      {/* Edit Request Banner for Admin */}
      {editRequested && isAdminRole && (
        <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-amber-900">Solicitud de Edición de Nota</p>
              <p className="text-amber-800">Motivo: <em>"{editReason || "Sin motivo especificado"}"</em></p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleAdminApprove}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              ✅ Autorizar
            </button>
            <button
              onClick={handleAdminReject}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              ❌ Rechazar
            </button>
          </div>
        </div>
      )}

      {/* Card Body */}
      <div className="p-5">
        <div 
          className={`relative transition-all duration-300 overflow-hidden ${
            isLongNote && !isExpanded ? "max-h-[200px]" : "max-h-[2500px]"
          }`}
        >
          <FormattedNoteContent content={parsedBody} />
          
          {/* Fade out gradient for collapsed state */}
          {isLongNote && !isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-slate-50/10 border-t border-slate-50/50 rounded-b-2xl gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
              copied 
                ? "bg-emerald-50 text-emerald-700 border-emerald-250 shadow-sm" 
                : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-800"
            }`}
            title="Copiar contenido de la nota"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </>
            )}
          </button>

          {/* Sign Action Button (If allowed & unsigned) */}
          {!signed && onSign && (
            <button
              onClick={handleSignClick}
              disabled={signing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 text-amber-750 border border-amber-250/60 hover:bg-amber-100 hover:text-amber-800 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Edit3 className="h-3.5 w-3.5 text-amber-600" />
              {signing ? "Firmando..." : "Firmar nota"}
            </button>
          )}

          {/* Edit Authorization & Edit Button */}
          {isAdminRole ? (
            <button
              onClick={handleOpenEditModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer shadow-sm"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Editar Nota (Admin)
            </button>
          ) : editApproved ? (
            <button
              onClick={handleOpenEditModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-sm"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Editar Nota (Autorizado)
            </button>
          ) : editRequested ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              Esperando autorización del Admin...
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowRequestModal(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer border border-slate-300"
            >
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              Solicitar Edición al Admin
            </button>
          )}
        </div>

        {/* Expand/Collapse Button */}
        {isLongNote && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            {isExpanded ? (
              <>
                Contraer
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Ver nota completa
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Modal: Solicitar Autorización al Admin */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-outfit flex items-center gap-2">
                🔒 Solicitar Autorización de Edición
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Las notas clínicas están protegidas. Para modificar esta nota (pendiente o firmada), envía el motivo al Administrador para su autorización.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-outfit">
                Motivo del cambio o corrección <span className="text-red-500">*</span>
              </label>
              <textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                rows={3}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Ej: Corregir diagnóstico, tipografía o detallar actividades de la sesión..."
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendEditRequest}
                disabled={actionLoading || !requestReason.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Enviando..." : "Enviar Solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Nota Clínica (Admin / Autorizado) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-outfit flex items-center gap-2">
                ✏️ Editar Contenido de Nota Clínica
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 font-outfit">
                Contenido de la Nota
              </label>
              <textarea
                value={editContentText}
                onChange={(e) => setEditContentText(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNoteEdit}
                disabled={actionLoading || !editContentText.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm disabled:opacity-50"
              >
                {actionLoading ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
