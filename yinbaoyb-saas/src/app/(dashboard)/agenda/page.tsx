"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_TYPE_COLORS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  DAY_NAMES,
  MONTH_NAMES,
  APPOINTMENT_COLOR_MAP,
  APPOINTMENT_COLOR_OPTIONS,
  parseAppointmentNotes,
} from "@/lib/constants";
import { getDateRange, getWeekDates, getMonthWeeks } from "@/lib/data/queries";
import Link from "next/link";

interface Appointment {
  id: string;
  patient_id: string;
  therapist_id: string;
  type: string;
  status: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  patients?: { first_name: string; last_name: string } | null;
  profiles?: { first_name: string; last_name: string } | null;
}

interface TherapistOption {
  id: string;
  first_name: string;
  last_name: string;
}

const typeLabels = APPOINTMENT_TYPE_LABELS;
const typeColors = APPOINTMENT_TYPE_COLORS;
const statusLabels = APPOINTMENT_STATUS_LABELS;
const statusColors = APPOINTMENT_STATUS_COLORS;
const colorMap = APPOINTMENT_COLOR_MAP;
const colorOptions = APPOINTMENT_COLOR_OPTIONS;

export default function AgendaPage() {
  const supabase = createClient();
  const { tenantId, user } = useSession();
  const toast = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterTherapist, setFilterTherapist] = useState("all");

  // New appointment form
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [form, setForm] = useState({
    patient_search: "",
    patient_id: "",
    therapist_id: "",
    type: "individual",
    date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_time: "10:00",
    notes: "",
    color: "",
  });
  const [patientResults, setPatientResults] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [allPatients, setAllPatients] = useState<{ id: string; first_name: string; last_name: string }[]>([]);

  // Edit appointment
  const [editApt, setEditApt] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [showWeeklyGrid, setShowWeeklyGrid] = useState(false);
  const [weeklyAppointments, setWeeklyAppointments] = useState<Appointment[]>([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  async function loadWeeklyData() {
    if (!tenantId) return;
    setWeeklyLoading(true);
    const dates = getWeekDates(selectedDate);
    const startDate = dates[0];
    const endDate = dates[6];

    let query = supabase
      .from("appointments")
      .select("id, patient_id, therapist_id, type, status, date, start_time, end_time, notes, patients(first_name, last_name), profiles!appointments_therapist_id_fkey(first_name, last_name)")
      .eq("tenant_id", tenantId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (filterTherapist !== "all") {
      query = query.eq("therapist_id", filterTherapist);
    }

    const { data } = await query;
    if (data) {
      setWeeklyAppointments(data as unknown as Appointment[]);
    } else {
      setWeeklyAppointments([]);
    }
    setWeeklyLoading(false);
  }

  useEffect(() => {
    if (showWeeklyGrid) {
      loadWeeklyData();
    }
  }, [showWeeklyGrid, selectedDate, filterTherapist, tenantId]);

  useEffect(() => { loadData(); }, [selectedDate, filterTherapist]);

  async function loadData() {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Load therapists
    const { data: tData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("tenant_id", tenantId)
      .in("role", ["terapeuta", "fisioterapeuta", "coordinador", "director", "super_admin"]);
    if (tData) setTherapists(tData as TherapistOption[]);

    // Load patients
    const { data: pData } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("first_name", { ascending: true });
    if (pData) setAllPatients(pData);

    // Calculate date range based on view
    const { start: startDate, end: endDate } = getDateRange(selectedDate, view);

    // Load appointments
    let query = supabase
      .from("appointments")
      .select("id, patient_id, therapist_id, type, status, date, start_time, end_time, notes, patients(first_name, last_name), profiles!appointments_therapist_id_fkey(first_name, last_name)")
      .eq("tenant_id", tenantId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (filterTherapist !== "all") {
      query = query.eq("therapist_id", filterTherapist);
    }

    const { data: aData } = await query;
    if (aData) setAppointments(aData as unknown as Appointment[]);
    setLoading(false);
  }

  // Search patients - (Replaced by direct select, kept for safety but unused)
  async function searchPatients(query: string) {
    setForm({ ...form, patient_search: query, patient_id: "" });
  }

  // Check conflicts
  async function checkConflict(therapistId: string, date: string, startTime: string, endTime: string, excludeId?: string) {
    setConflict(null);
    const { data } = await supabase
      .from("appointments")
      .select("id, start_time, end_time, patients(first_name, last_name)")
      .eq("therapist_id", therapistId)
      .eq("date", date)
      .neq("status", "cancelada")
      .not("id", "eq", excludeId || "00000000");

    if (data && data.length > 0) {
      for (const apt of data) {
        if (startTime < (apt as any).end_time && endTime > (apt as any).start_time) {
          const pName = (apt as any).patients ? `${(apt as any).patients.first_name} ${(apt as any).patients.last_name}` : "otro paciente";
          setConflict(`Conflicto: ${(apt as any).start_time}-${(apt as any).end_time} con ${pName}`);
          return;
        }
      }
    }
    setConflict(null);
  }

  // Create appointment
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_id || !form.therapist_id) {
      setError("Selecciona un paciente y un terapeuta");
      return;
    }
    setSaving(true);
    setError(null);

    const notesPayload = form.color
      ? JSON.stringify({ color: form.color, text: form.notes })
      : form.notes || null;

    const { error: insertError } = await supabase.from("appointments").insert({
      tenant_id: tenantId!,
      patient_id: form.patient_id,
      therapist_id: form.therapist_id,
      type: form.type,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      notes: notesPayload,
      status: "programada",
    });

    if (insertError) { setError(insertError.message); setSaving(false); return; }
    setShowNewForm(false);
    setForm({ patient_search: "", patient_id: "", therapist_id: "", type: "individual", date: selectedDate, start_time: "09:00", end_time: "10:00", notes: "", color: "" });
    setSaving(false);
    loadData();
  }

  // Update appointment color
  async function handleColorUpdate(aptId: string, currentNotes: string | null, newColor: string) {
    const { color: _, text: notesText } = parseAppointmentNotes(currentNotes);
    const notesPayload = newColor
      ? JSON.stringify({ color: newColor, text: notesText })
      : notesText || null;

    const { error: err } = await supabase
      .from("appointments")
      .update({ notes: notesPayload })
      .eq("id", aptId);

    if (err) { toast.addToast("Error: " + err.message, "error"); return; }
    loadData();
  }

  // Delete all appointments for the current tenant
  async function handleDeleteAll() {
    if (!tenantId) return;
    
    // First confirmation
    const firstConfirm = confirm(
      "¿Estás seguro de que deseas eliminar TODAS las citas del calendario? Esta acción no se puede deshacer."
    );
    if (!firstConfirm) return;
    
    // Second confirmation
    const secondConfirm = prompt(
      "Para confirmar la eliminación completa, escribe la palabra 'ELIMINAR' en mayúsculas:"
    );
    if (secondConfirm !== "ELIMINAR") {
      toast.addToast("Confirmación incorrecta. No se eliminaron las citas.", "error");
      return;
    }
    
    setLoading(true);
    const { error: err } = await supabase
      .from("appointments")
      .delete()
      .eq("tenant_id", tenantId);
      
    if (err) {
      toast.addToast("Error al vaciar el calendario: " + err.message, "error");
      setLoading(false);
      return;
    }
    
    toast.addToast("El calendario ha sido vaciado con éxito.", "success");
    loadData();
  }

  // Update status
  async function handleStatusUpdate(aptId: string, newStatus: string) {
    const { error: err } = await supabase.from("appointments").update({ status: newStatus }).eq("id", aptId);
    if (err) { toast.addToast("Error: " + err.message, "error"); return; }
    setEditApt(null);
    loadData();
  }

  // Delete appointment
  async function handleDelete(aptId: string) {
    if (!confirm("¿Eliminar esta cita?")) return;
    const { error: err } = await supabase.from("appointments").delete().eq("id", aptId);
    if (err) { toast.addToast("Error: " + err.message, "error"); return; }
    loadData();
  }

  // Download schedule as visual planner PDF
  function downloadPDF() {
    const sortedApts = [...appointments]
      .filter(a => a.status !== "cancelada")
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

    const dayNamesLong = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const dayNamesES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthNamesES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

    const formatDateFull = (dateStr: string) => {
      const d = new Date(dateStr + "T12:00:00");
      return `${dayNamesLong[d.getDay()]}, ${d.getDate()} de ${monthNamesES[d.getMonth()]} de ${d.getFullYear()}`;
    };
    const getDay = (dateStr: string) => new Date(dateStr + "T12:00:00").getDate().toString();
    const getDayShort = (dateStr: string) => dayNamesES[new Date(dateStr + "T12:00:00").getDay()];

    // Group by date
    const grouped: Record<string, typeof sortedApts> = {};
    sortedApts.forEach(a => { if (!grouped[a.date]) grouped[a.date] = []; grouped[a.date].push(a); });

    const statusCfg: Record<string, {label:string;bg:string;color:string;dot:string}> = {
      programada: {label:"Programada",  bg:"#fef3c7",color:"#92400e",dot:"#f59e0b"},
      confirmada: {label:"Confirmada",  bg:"#d1fae5",color:"#065f46",dot:"#10b981"},
      completada: {label:"Completada",  bg:"#e0e7ff",color:"#3730a3",dot:"#6366f1"},
      no_asistio: {label:"No asistió",  bg:"#fee2e2",color:"#991b1b",dot:"#ef4444"},
    };
    const typeCfg: Record<string, {label:string;accent:string}> = {
      individual:  {label:"Individual",  accent:"#6366f1"},
      grupal:      {label:"Grupal",      accent:"#f59e0b"},
      evaluacion:  {label:"Evaluación",  accent:"#8b5cf6"},
      seguimiento: {label:"Seguimiento", accent:"#10b981"},
      taller:      {label:"Taller",      accent:"#f97316"},
      online:      {label:"Online",      accent:"#0ea5e9"},
    };

    const dates = Object.keys(grouped).sort();
    let dayBlocks = "";

    if (dates.length === 0) {
      dayBlocks = `<div style="text-align:center;padding:60px;color:#94a3b8;font-size:15px">Sin citas para este período</div>`;
    } else {
      dates.forEach(date => {
        const apts = grouped[date];
        let cards = "";
        apts.forEach(apt => {
          const pName = (apt.patients as any) ? `${(apt.patients as any).first_name} ${(apt.patients as any).last_name}` : "—";
          const tName = (apt.profiles as any) ? `${(apt.profiles as any).first_name} ${(apt.profiles as any).last_name}` : "—";
          const st = statusCfg[apt.status] || {label:apt.status,bg:"#f1f5f9",color:"#475569",dot:"#94a3b8"};
          const tp = typeCfg[apt.type] || {label:apt.type,accent:"#64748b"};
          const [sh,sm] = apt.start_time.split(":").map(Number);
          const [eh,em] = apt.end_time.split(":").map(Number);
          const durMin = (eh*60+em)-(sh*60+sm);
          cards += `<div style="display:flex;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);margin-bottom:10px;border:1px solid #e2e8f0">
            <div style="width:88px;min-width:88px;background:${tp.accent};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 8px;gap:3px">
              <span style="font-size:19px;font-weight:800;color:#fff;line-height:1">${apt.start_time.slice(0,5)}</span>
              <span style="font-size:11px;color:rgba(255,255,255,.6)">│</span>
              <span style="font-size:16px;font-weight:700;color:rgba(255,255,255,.9);line-height:1">${apt.end_time.slice(0,5)}</span>
              <span style="margin-top:6px;font-size:10px;color:rgba(255,255,255,.65);background:rgba(0,0,0,.15);border-radius:99px;padding:2px 7px">${durMin} min</span>
            </div>
            <div style="flex:1;background:#fff;padding:14px 18px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
                <span style="font-size:16px;font-weight:700;color:#0f172a;line-height:1.3">${pName}</span>
                <span style="white-space:nowrap;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:${st.bg};color:${st.color}"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${st.dot};vertical-align:middle;margin-right:4px"></span>${st.label}</span>
              </div>
              <div style="display:flex;align-items:center;gap:18px">
                <span style="font-size:13px;color:#64748b">👨‍⚕️ <span style="color:#374151;font-weight:500">${tName}</span></span>
                <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#6b7280"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:${tp.accent}"></span>${tp.label}</span>
              </div>
            </div>
          </div>`;
        });

        dayBlocks += `<div style="margin-bottom:28px;break-inside:avoid">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
            <div style="width:56px;height:56px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;color:#fff">
              <span style="font-size:10px;font-weight:700;letter-spacing:.07em;opacity:.75;text-transform:uppercase">${getDayShort(date)}</span>
              <span style="font-size:26px;font-weight:800;line-height:1">${getDay(date)}</span>
            </div>
            <div>
              <div style="font-size:17px;font-weight:700;color:#1e293b">${formatDateFull(date)}</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px">${apts.length} cita${apts.length !== 1 ? "s" : ""} programada${apts.length !== 1 ? "s" : ""}</div>
            </div>
          </div>
          ${cards}
        </div>`;
      });
    }

    const periodLabel = dateLabel();
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><title>Agenda — ${periodLabel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1e293b;background:#f1f5f9}
.page{max-width:760px;margin:0 auto;padding:32px 20px}
.hero{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:18px;padding:28px 32px;margin-bottom:36px;display:flex;justify-content:space-between;align-items:center;color:#fff}
.hero h1{font-size:28px;font-weight:800;margin-bottom:4px}
.hero p{font-size:14px;opacity:.7}
.hero-stat{background:rgba(255,255,255,.2);border-radius:12px;padding:10px 20px;text-align:center}
.hero-stat .n{font-size:32px;font-weight:800;line-height:1}
.hero-stat .l{font-size:11px;opacity:.7;margin-top:2px}
.foot{margin-top:32px;border-top:1px solid #e2e8f0;padding-top:14px;text-align:right;font-size:11px;color:#94a3b8}
@media print{
  body{background:#fff}
  .page{padding:16px}
  .hero,[style*="background:"]{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style></head>
<body><div class="page">
  <div class="hero">
    <div><h1>📅 Agenda de Citas</h1><p>${periodLabel}</p></div>
    <div class="hero-stat"><div class="n">${sortedApts.length}</div><div class="l">cita${sortedApts.length!==1?"s":""}</div></div>
  </div>
  ${dayBlocks}
  <div class="foot">Generado el ${new Date().toLocaleDateString("es-EC",{day:"numeric",month:"long",year:"numeric"})} — CentroYB</div>
</div><script>window.onload=()=>{window.print()}<\/script></body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  // Helper to determine therapy area code (TO, TL, ET, Con, etc.) based on therapist and notes
  const getTherapyBadge = (apt: Appointment) => {
    const notesText = (apt.notes || "").toLowerCase();
    if (notesText.includes("[to]") || notesText.includes("terapia ocupacional") || notesText.includes("ocupacional")) return "TO";
    if (notesText.includes("[tl]") || notesText.includes("lenguaje") || notesText.includes("habla")) return "TL";
    if (notesText.includes("[et]") || notesText.includes("temprana") || notesText.includes("estimulacion")) return "ET";
    if (notesText.includes("[con]") || notesText.includes("consulta")) return "Con";

    const tSpecialty = (apt.profiles as any)?.specialty?.toLowerCase() || "";
    if (tSpecialty.includes("ocupacional") || tSpecialty.includes("to")) return "TO";
    if (tSpecialty.includes("lenguaje") || tSpecialty.includes("habla") || tSpecialty.includes("tl")) return "TL";
    if (tSpecialty.includes("temprana") || tSpecialty.includes("estimulacion")) return "ET";
    if (tSpecialty.includes("psicolog") || tSpecialty.includes("conductual")) return "Psi";

    if (apt.profiles) {
      const fn = (apt.profiles as any).first_name || "";
      const ln = (apt.profiles as any).last_name || "";
      if (fn && ln) return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();
    }
    return "TO";
  };

  // Helper to get color classes for React UI badges
  const getTherapyBadgeColor = (badge: string) => {
    const b = badge.toUpperCase();
    if (b === "TO") return "bg-cyan-100 text-cyan-800 border-cyan-200";
    if (b === "TL") return "bg-amber-100 text-amber-800 border-amber-250";
    if (b === "ET") return "bg-purple-100 text-purple-800 border-purple-250";
    if (b === "CON") return "bg-emerald-100 text-emerald-800 border-emerald-250";
    if (b === "PSI") return "bg-pink-100 text-pink-800 border-pink-250";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  // Download weekly grid as a high-fidelity tabular PDF
  function downloadWeeklyGridPDF() {
    const dates = getWeekDatesLocal().slice(0, 6); // Monday to Saturday
    const weekApts = weeklyAppointments.filter(a => dates.includes(a.date) && a.status !== "cancelada");

    const getApptStyle = (apt: Appointment) => {
      const { color: customColorId } = parseAppointmentNotes(apt.notes);
      
      const colors: Record<string, { bg: string; text: string; border: string }> = {
        indigo: { bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe" },
        purple: { bg: "#f3e8ff", text: "#6b21a8", border: "#e9d5ff" },
        emerald: { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" },
        pink: { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8" },
        amber: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
        blue: { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
        rose: { bg: "#ffe4e6", text: "#9f1239", border: "#fecdd3" },
        teal: { bg: "#ccfbf1", text: "#115e59", border: "#99f6e4" },
      };
      
      if (customColorId && colors[customColorId]) {
        return colors[customColorId];
      }
      
      const typeColorsHex: Record<string, { bg: string; text: string; border: string }> = {
        individual: { bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe" },
        grupal: { bg: "#f3e8ff", text: "#6b21a8", border: "#e9d5ff" },
        taller: { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" },
        evaluacion: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
        supervision: { bg: "#fce7f3", text: "#9d174d", border: "#fbcfe8" },
      };
      
      return typeColorsHex[apt.type] || { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" };
    };

    // Gather hour slots
    const slotsMap = new Map<string, { start: string; end: string }>();
    weekApts.forEach(a => {
      const st = a.start_time.slice(0, 5);
      const et = a.end_time.slice(0, 5);
      const key = `${st} a ${et}`;
      slotsMap.set(key, { start: st, end: et });
    });

    let hourSlots = Array.from(slotsMap.values()).sort((a, b) => a.start.localeCompare(b.start));
    if (hourSlots.length === 0) {
      hourSlots = [
        { start: "08:00", end: "09:00" },
        { start: "09:00", end: "10:00" },
        { start: "10:00", end: "11:00" },
        { start: "11:00", end: "12:00" },
        { start: "12:00", end: "13:00" },
        { start: "13:00", end: "14:00" },
        { start: "14:00", end: "15:00" },
        { start: "15:00", end: "16:00" },
        { start: "16:00", end: "17:00" },
        { start: "17:00", end: "18:00" }
      ];
    }

    const dayNamesES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    
    // Generate headers
    let thHeaders = `<th style="width:110px">HORA</th>`;
    dates.forEach((date, idx) => {
      const d = new Date(date + "T12:00:00");
      thHeaders += `<th>${dayNamesES[idx]}<br/><span style="font-size:9px;opacity:0.8">${d.getDate()}/${d.getMonth()+1}</span></th>`;
    });

    // Generate table rows
    let tableRows = "";
    hourSlots.forEach(slot => {
      let rowCells = `<td class="hour-cell">${slot.start} a ${slot.end}</td>`;
      dates.forEach(date => {
        const cellApts = weekApts.filter(a => a.date === date && a.start_time.startsWith(slot.start));
        let cellContent = "";
        
        if (cellApts.length > 0) {
          cellApts.forEach(apt => {
            const badge = getTherapyBadge(apt);
            const apptStyle = getApptStyle(apt);
            const pName = (apt.patients as any) ? (apt.patients as any).first_name : "Paciente";
            cellContent += `<span class="appt-badge" style="background-color: ${apptStyle.bg}; color: ${apptStyle.text}; border-color: ${apptStyle.border}">${pName} <span style="font-size:8px;opacity:0.85">${badge}</span></span>`;
          });
        }
        rowCells += `<td>${cellContent || "—"}</td>`;
      });
      tableRows += `<tr>${rowCells}</tr>`;
    });

    const periodLabel = dateLabel();
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Horario Semanal — ${periodLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 25px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid #312e81; padding-bottom: 12px; }
    .header h1 { font-size: 20px; font-weight: 800; color: #1e1b4b; text-transform: uppercase; }
    .header p { font-size: 12px; color: #64748b; font-weight: 550; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; vertical-align: middle; }
    th { background-color: #1e1b4b; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 10px; tracking: 0.05em; }
    .hour-cell { background-color: #f8fafc; font-weight: 700; color: #334155; width: 110px; }
    .appt-badge { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 3px 7px; margin: 3px; border-radius: 5px; font-weight: 700; font-size: 10px; border: 1px solid; }
    
    .badge-to { background-color: #cffafe; color: #0891b2; border-color: #a5f3fc; }
    .badge-tl { background-color: #fef3c7; color: #d97706; border-color: #fde68a; }
    .badge-et { background-color: #f3e8ff; color: #7c3aed; border-color: #e9d5ff; }
    .badge-con { background-color: #d1fae5; color: #059669; border-color: #a7f3d0; }
    .badge-psi { background-color: #fce7f3; color: #db2777; border-color: #fbcfe8; }
    .badge-default { background-color: #f1f5f9; color: #475569; border-color: #e2e8f0; }
    
    @media print {
      body { padding: 0; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #1e1b4b !important; color: #fff !important; }
      .hour-cell { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: #f8fafc !important; }
      .appt-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📅 Horario Semanal de Citas</h1>
      <p>Período: ${periodLabel}</p>
    </div>
    <div style="font-size:11px;color:#64748b;text-align:right">
      <p>Generado el ${new Date().toLocaleDateString("es-EC")}</p>
      <p>Total: ${weekApts.length} cita${weekApts.length!==1?"s":""}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>${thHeaders}</tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  <script>
    window.onload = () => { window.print(); }
  </script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  // Get day names
  const dayNames = DAY_NAMES;
  const monthNames = MONTH_NAMES;

  // Group appointments by date
  const byDate = appointments.reduce((acc, apt) => {
    if (!acc[apt.date]) acc[apt.date] = [];
    acc[apt.date].push(apt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  // Get week dates
  function getWeekDatesLocal() {
    return getWeekDates(selectedDate);
  }

  // Get month dates as weeks
  function getMonthWeeksLocal() {
    return getMonthWeeks(selectedDate);
  }

  const isToday = (date: string) => date === new Date().toISOString().split("T")[0];
  const isSelected = (date: string) => date === selectedDate;

  // Navigate dates
  function navDate(direction: number) {
    const d = new Date(selectedDate + "T12:00:00");
    if (view === "day") d.setDate(d.getDate() + direction);
    else if (view === "week") d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    setSelectedDate(d.toISOString().split("T")[0]);
  }

  function goToToday() { setSelectedDate(new Date().toISOString().split("T")[0]); }

  const dateLabel = () => {
    const d = new Date(selectedDate + "T12:00:00");
    if (view === "day") return `${d.getDate()} de ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (view === "week") {
      const dates = getWeekDatesLocal();
      const s = new Date(dates[0] + "T12:00:00");
      const e = new Date(dates[6] + "T12:00:00");
      return `${s.getDate()} ${monthNames[s.getMonth()]} - ${e.getDate()} ${monthNames[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  const todayApts = appointments.filter(a => a.date === new Date().toISOString().split("T")[0] && a.status !== "cancelada");
  const pendingCount = todayApts.filter(a => a.status === "programada" || a.status === "confirmada").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pendingCount} cita{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""} hoy
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {appointments.length > 0 && (
            <>
              <button
                onClick={() => setShowWeeklyGrid(true)}
                className="bg-indigo-55 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-100 inline-flex items-center gap-2"
              >
                📅 Ver Horario Semanal
              </button>
              <button
                onClick={downloadPDF}
                className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-100 inline-flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Descargar PDF
              </button>
              <button onClick={handleDeleteAll} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 inline-flex items-center gap-2">
                🗑️ Vaciar Calendario
              </button>
            </>
          )}
          <button onClick={() => { setShowNewForm(true); setForm({ ...form, date: selectedDate }); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 inline-flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nueva Cita
          </button>
        </div>
      </div>

      {/* New appointment form */}
      {showNewForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Nueva Cita</h2>
            <button onClick={() => setShowNewForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          {conflict && <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">⚠️ {conflict}</div>}
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient select */}
            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paciente *</label>
              <select value={form.patient_id} required onChange={e => setForm({ ...form, patient_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                <option value="">-- Seleccionar paciente registrado --</option>
                {allPatients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta *</label>
              <select value={form.therapist_id} onChange={e => { setForm({ ...form, therapist_id: e.target.value }); if (form.date && form.start_time && form.end_time) checkConflict(e.target.value, form.date, form.start_time, form.end_time); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Seleccionar...</option>
                {therapists.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cita</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input type="date" value={form.date} onChange={e => { setForm({ ...form, date: e.target.value }); if (form.therapist_id && form.start_time && form.end_time) checkConflict(form.therapist_id, e.target.value, form.start_time, form.end_time); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio *</label>
                <input type="time" value={form.start_time} onChange={e => { setForm({ ...form, start_time: e.target.value }); if (form.therapist_id && form.date && form.end_time) checkConflict(form.therapist_id, form.date, e.target.value, form.end_time); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin *</label>
                <input type="time" value={form.end_time} onChange={e => { setForm({ ...form, end_time: e.target.value }); if (form.therapist_id && form.date && form.start_time) checkConflict(form.therapist_id, form.date, form.start_time, e.target.value); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Color de la cita</label>
              <div className="flex gap-2 flex-wrap items-center mt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, color: "" })}
                  className={`h-7 w-7 rounded-full border border-gray-300 relative flex items-center justify-center bg-white transition-all hover:scale-105`}
                  title="Color por defecto"
                >
                  {form.color === "" && <span className="text-xs text-gray-600 font-bold">✓</span>}
                </button>
                {colorOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.id })}
                    className={`h-7 w-7 rounded-full border ${c.classes.split(" ")[0]} ${c.classes.split(" ")[2]} flex items-center justify-center transition-all hover:scale-105`}
                    title={c.name}
                  >
                    {form.color === c.id && <span className="text-xs font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowNewForm(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving || !!conflict} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Guardando..." : conflict ? "Resolver conflicto" : "Crear Cita"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button onClick={() => navDate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">{dateLabel()}</h2>
            <button onClick={() => navDate(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={goToToday} className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100">Hoy</button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View toggle */}
            <div className="overflow-x-auto scrollbar-none">
              <div className="flex bg-gray-100 rounded-lg p-0.5 min-w-max">
                {(["day", "week", "month"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${view === v ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
                  </button>
                ))}
              </div>
            </div>
            {/* Therapist filter */}
            <select value={filterTherapist} onChange={e => setFilterTherapist(e.target.value)} className="flex-1 min-w-0 px-3 py-1.5 border border-gray-300 rounded-lg text-xs">
              <option value="all">Todos los terapeutas</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* CALENDAR VIEWS */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><svg className="animate-spin h-6 w-6 text-indigo-600" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : view === "day" ? (
        /* DAY VIEW */
        <div className="space-y-3">
          {(byDate[selectedDate] || []).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-sm text-gray-500">Sin citas para este día</p>
            </div>
          ) : byDate[selectedDate].map(renderAppointment)}
        </div>
      ) : view === "week" ? (
        /* WEEK VIEW */
        <div className="overflow-x-auto -mx-1">
          <div className="grid grid-cols-7 gap-2 min-w-[560px]">
          {getWeekDatesLocal().map(date => {
            const d = new Date(date + "T12:00:00");
            const apts = byDate[date] || [];
            const isT = isToday(date);
            return (
              <div key={date} className={`rounded-xl border ${isT ? "border-indigo-300 bg-indigo-50/30" : "border-gray-200 bg-white"} min-h-[120px]`}>
                <div 
                  className={`text-center py-2 border-b ${isT ? "border-indigo-200 hover:bg-indigo-100/30" : "border-gray-100 hover:bg-gray-50"} cursor-pointer transition-colors`}
                  onClick={() => { setSelectedDate(date); setView("day"); }}
                  title="Ver todo el día"
                >
                  <p className="text-[10px] text-gray-500 uppercase">{dayNames[d.getDay()]}</p>
                  <p className={`text-lg font-bold ${isT ? "text-indigo-600" : "text-gray-900"}`}>{d.getDate()}</p>
                </div>
                <div className="p-1.5 space-y-1">
                  {apts.filter(a => a.status !== "cancelada").slice(0, 3).map(apt => {
                    const { color: customColorId } = parseAppointmentNotes(apt.notes);
                    const colorClasses = (customColorId && colorMap[customColorId]) || typeColors[apt.type] || "bg-gray-100 text-gray-700";
                    return (
                      <div key={apt.id} className={`px-1.5 py-1 rounded text-[10px] border ${colorClasses}`} onClick={() => setEditApt(editApt === apt.id ? null : apt.id)}>
                        <p className="font-medium truncate">{apt.start_time}</p>
                        <p className="truncate">{(apt.patients as any)?.first_name || "?"}</p>
                      </div>
                    );
                  })}
                  {apts.filter(a => a.status !== "cancelada").length > 3 && (
                    <button 
                      onClick={() => { setSelectedDate(date); setView("day"); }}
                      className="w-full text-center text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-semibold mt-1 py-0.5 transition-colors cursor-pointer"
                      title="Ver todas las citas de este día"
                    >
                      +{apts.filter(a => a.status !== "cancelada").length - 3} más
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        /* MONTH VIEW */
        <div className="overflow-x-auto -mx-1">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => <div key={d} className="bg-gray-50 text-center py-2 text-xs font-medium text-gray-500">{d}</div>)}
              {getMonthWeeksLocal().flat().map((date, i) => {
                const d = new Date(date + "T12:00:00");
                const apts = byDate[date] || [];
                const isCurrentMonth = d.getMonth() === new Date(selectedDate + "T12:00:00").getMonth();
                const isT = isToday(date);
                return (
                  <div key={i} className={`bg-white p-1.5 min-h-[80px] ${!isCurrentMonth ? "opacity-40" : ""} ${isT ? "ring-2 ring-indigo-400 ring-inset" : ""}`} onClick={() => { setSelectedDate(date); setView("day"); }}>
                    <p className={`text-xs font-medium mb-1 ${isT ? "text-indigo-600" : "text-gray-700"}`}>{d.getDate()}</p>
                    {apts.filter(a => a.status !== "cancelada").slice(0, 2).map(apt => {
                      const { color: customColorId } = parseAppointmentNotes(apt.notes);
                      const colorClasses = (customColorId && colorMap[customColorId]) || typeColors[apt.type] || "bg-gray-100 text-gray-700";
                      const bgClass = colorClasses.split(" ")[0];
                      const textClass = colorClasses.split(" ")[1];
                      return (
                        <div key={apt.id} className={`px-1 py-0.5 rounded text-[9px] mb-0.5 ${bgClass} ${textClass}`}>
                          {apt.start_time} {(apt.patients as any)?.first_name?.charAt(0) || ""}
                        </div>
                      );
                    })}
                    {apts.filter(a => a.status !== "cancelada").length > 2 && <p className="text-[9px] text-gray-400">+{apts.filter(a => a.status !== "cancelada").length - 2}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Appointment detail/edit popup */}
      {editApt && (() => {
        const apt = appointments.find(a => a.id === editApt);
        if (!apt) return null;
        const pName = (apt.patients as any) ? `${(apt.patients as any).first_name} ${(apt.patients as any).last_name}` : "Paciente";
        const tName = (apt.profiles as any) ? `${(apt.profiles as any).first_name} ${(apt.profiles as any).last_name}` : "Terapeuta";
        const d = new Date(apt.date + "T12:00:00");
        const { color: customColorId, text: notesText } = parseAppointmentNotes(apt.notes);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditApt(null)}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Detalle de Cita</h3>
                <button onClick={() => setEditApt(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${(customColorId && colorMap[customColorId]) || typeColors[apt.type] || "bg-gray-100"}`}>{typeLabels[apt.type] || apt.type}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[apt.status] || "bg-gray-100"}`}>{statusLabels[apt.status] || apt.status}</span>
                </div>
                <p className="text-sm"><span className="text-gray-500">Paciente:</span> <span className="font-medium">{pName}</span></p>
                <p className="text-sm"><span className="text-gray-500">Terapeuta:</span> <span className="font-medium">{tName}</span></p>
                <p className="text-sm"><span className="text-gray-500">Fecha:</span> {d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}</p>
                <p className="text-sm"><span className="text-gray-500">Hora:</span> {apt.start_time} - {apt.end_time}</p>
                {notesText && <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{notesText}</p>}
                
                {/* Botón WhatsApp de Recordatorio Instantáneo */}
                <div className="pt-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hola, te recordamos desde el centro terapéutico que ${pName} tiene su sesión programada para el ${d.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })} a las ${apt.start_time} con ${tName}. ¡Te esperamos!`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 cursor-pointer"
                  >
                    <span>💬</span> Enviar Recordatorio por WhatsApp
                  </a>
                </div>
              </div>
              {/* Status actions */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Cambiar estado</p>
                <div className="flex flex-wrap gap-2">
                  {apt.status !== "confirmada" && <button onClick={() => handleStatusUpdate(apt.id, "confirmada")} className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100">Confirmar</button>}
                  {apt.status !== "completada" && <button onClick={() => handleStatusUpdate(apt.id, "completada")} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Completada</button>}
                  <button onClick={() => handleStatusUpdate(apt.id, "no_asistio")} className="px-3 py-1.5 text-xs bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100">No asistió</button>
                  <button onClick={() => handleStatusUpdate(apt.id, "cancelada")} className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100">Cancelar</button>
                </div>
              </div>
              {/* Color actions */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Color de la cita</p>
                <div className="flex gap-2 flex-wrap items-center mt-1">
                  <button
                    type="button"
                    onClick={() => handleColorUpdate(apt.id, apt.notes, "")}
                    className={`h-7 w-7 rounded-full border border-gray-300 relative flex items-center justify-center bg-white transition-all hover:scale-105`}
                    title="Color por defecto"
                  >
                    {customColorId === null && <span className="text-xs text-gray-600 font-bold">✓</span>}
                  </button>
                  {colorOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleColorUpdate(apt.id, apt.notes, c.id)}
                      className={`h-7 w-7 rounded-full border ${c.classes.split(" ")[0]} ${c.classes.split(" ")[2]} flex items-center justify-center transition-all hover:scale-105`}
                      title={c.name}
                    >
                      {customColorId === c.id && <span className="text-xs font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 mt-3">
                <button onClick={() => { handleDelete(apt.id); setEditApt(null); }} className="px-3 py-1.5 text-xs text-red-700 bg-red-50 rounded-lg hover:bg-red-100">Eliminar cita</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Weekly Grid Modal */}
      {showWeeklyGrid && (() => {
        const dates = getWeekDatesLocal().slice(0, 6); // Monday to Saturday
        const weekApts = weeklyAppointments.filter(a => dates.includes(a.date) && a.status !== "cancelada");

        // Gather hour slots
        const slotsMap = new Map<string, { start: string; end: string }>();
        weekApts.forEach(a => {
          const st = a.start_time.slice(0, 5);
          const et = a.end_time.slice(0, 5);
          const key = `${st} a ${et}`;
          slotsMap.set(key, { start: st, end: et });
        });

        let hourSlots = Array.from(slotsMap.values()).sort((a, b) => a.start.localeCompare(b.start));
        if (hourSlots.length === 0) {
          hourSlots = [
            { start: "08:00", end: "09:00" },
            { start: "09:00", end: "10:00" },
            { start: "10:00", end: "11:00" },
            { start: "11:00", end: "12:00" },
            { start: "12:00", end: "13:00" },
            { start: "13:00", end: "14:00" },
            { start: "14:00", end: "15:00" },
            { start: "15:00", end: "16:00" },
            { start: "16:00", end: "17:00" },
            { start: "17:00", end: "18:00" }
          ];
        }

        const dayNamesES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowWeeklyGrid(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>📅 Horario Semanal de Citas</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Período: {dateLabel()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadWeeklyGridPDF}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 inline-flex items-center gap-2 transition-colors hover:shadow-md disabled:opacity-50"
                    disabled={weeklyLoading}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Descargar Horario (PDF)
                  </button>
                  <button
                    onClick={() => setShowWeeklyGrid(false)}
                    className="text-gray-400 hover:text-gray-600 text-lg px-2 py-1 font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Table Content */}
              <div className="p-6 overflow-auto max-h-[calc(90vh-100px)]">
                {weeklyLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : weekApts.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <p className="text-4xl mb-2">📅</p>
                    <p className="text-sm font-medium">Sin citas registradas para esta semana</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full border-collapse text-left text-xs text-gray-500">
                      <thead className="bg-gray-50 text-[10px] text-gray-700 uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-3 border border-gray-200 text-center w-32 bg-gray-50 font-bold text-gray-800">HORA</th>
                          {dates.map((date, idx) => {
                            const d = new Date(date + "T12:00:00");
                            return (
                              <th key={date} className="px-4 py-3 border border-gray-200 text-center font-bold text-gray-800">
                                {dayNamesES[idx]}
                                <span className="block text-[9px] font-normal text-gray-400 mt-0.5">{d.getDate()}/{d.getMonth()+1}</span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {hourSlots.map((slot, sIdx) => (
                          <tr key={sIdx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 border border-gray-200 text-center font-bold text-gray-700 bg-slate-50/50">
                              {slot.start} a {slot.end}
                            </td>
                            {dates.map(date => {
                              const cellApts = weekApts.filter(a => a.date === date && a.start_time.startsWith(slot.start));
                              return (
                                <td key={date} className="px-3 py-2 border border-gray-200 text-center min-w-[120px]">
                                  {cellApts.length > 0 ? (
                                    <div className="flex flex-col gap-1.5 justify-center items-center">
                                      {cellApts.map(apt => {
                                        const badge = getTherapyBadge(apt);
                                        const { color: customColorId } = parseAppointmentNotes(apt.notes);
                                        const badgeColorClass = (customColorId && colorMap[customColorId]) || typeColors[apt.type] || "bg-gray-100 text-gray-700 border-gray-200";
                                        const pName = (apt.patients as any) ? `${(apt.patients as any).first_name} ${(apt.patients as any).last_name}` : "Paciente";
                                        return (
                                          <div
                                            key={apt.id}
                                            onClick={() => { setEditApt(apt.id); setShowWeeklyGrid(false); }}
                                            className={`w-full max-w-[160px] px-2 py-1.5 rounded-lg border text-[10px] text-center font-bold shadow-sm transition-all hover:scale-105 hover:shadow cursor-pointer ${badgeColorClass}`}
                                            title={`Terapeuta: ${(apt.profiles as any) ? `${(apt.profiles as any).first_name} ${(apt.profiles as any).last_name}` : "—"}`}
                                          >
                                            <div className="truncate">{pName}</div>
                                            <div className="text-[8px] opacity-75 mt-0.5 uppercase tracking-wide">{badge}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 font-medium">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
            </div>
          </div>
        );
      })()}
    </div>
  );

  function renderAppointment(apt: Appointment) {
    const pName = (apt.patients as any) ? `${(apt.patients as any).first_name} ${(apt.patients as any).last_name}` : "Paciente";
    const tName = (apt.profiles as any) ? `${(apt.profiles as any).first_name} ${(apt.profiles as any).last_name}` : "Terapeuta";
    const { color: customColorId } = parseAppointmentNotes(apt.notes);
    const colorClasses = (customColorId && colorMap[customColorId]) || typeColors[apt.type] || "bg-gray-100 text-gray-700";
    return (
      <div key={apt.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm cursor-pointer" onClick={() => setEditApt(editApt === apt.id ? null : apt.id)}>
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[60px]">
            <p className="text-lg font-bold text-gray-900">{apt.start_time}</p>
            <p className="text-xs text-gray-500">{apt.end_time}</p>
          </div>
          <div className="h-10 w-0.5 bg-gray-200" />
          <div>
            <p className="font-medium text-gray-900">{pName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorClasses}`}>{typeLabels[apt.type] || apt.type}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[apt.status] || "bg-gray-100"}`}>{statusLabels[apt.status] || apt.status}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">{tName}</p>
      </div>
    );
  }
}