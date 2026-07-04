"use client";

import React, { useState } from "react";
import { 
  CheckCircle, 
  Clock, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Edit3, 
  Calendar 
} from "lucide-react";
import FormattedNoteContent from "./FormattedNoteContent";

interface ClinicalNoteCardProps {
  id: string;
  format: string;
  content: string;
  signed: boolean;
  createdAt: string;
  patientName?: string;
  therapistName?: string;
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
  onSign
}: ClinicalNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signing, setSigning] = useState(false);

  const formatKey = format?.toLowerCase() || "libre";
  const formatLabel = noteFormatLabels[formatKey] || format || "Nota";
  const formatColorClass = noteFormatColors[formatKey] || "bg-slate-50 text-slate-700 border-slate-100";

  // Clean raw content for copy to clipboard
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanText = content
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

  // Get patient initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const isLongNote = content?.length > 320;

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
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-2.5">
          {/* Created Date */}
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <Calendar className="h-3.5 w-3.5 text-slate-350" />
            <span>{formattedDate} · {formattedTime}</span>
          </div>

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

      {/* Card Body */}
      <div className="p-5">
        <div 
          className={`relative transition-all duration-300 overflow-hidden ${
            isLongNote && !isExpanded ? "max-h-[200px]" : "max-h-[2500px]"
          }`}
        >
          <FormattedNoteContent content={content} />
          
          {/* Fade out gradient for collapsed state */}
          {isLongNote && !isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/10 border-t border-slate-50/50 rounded-b-2xl">
        <div className="flex items-center gap-2">
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
    </div>
  );
}
