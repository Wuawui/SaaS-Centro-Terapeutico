"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_TYPE_COLORS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_COLORS,
  DAY_NAMES,
  MONTH_NAMES,
  APPOINTMENT_COLOR_MAP,
  parseAppointmentNotes,
} from "@/lib/constants";
import { getDateRange, getWeekDates as getWeekDatesUtil, getMonthWeeks as getMonthWeeksUtil } from "@/lib/data/queries";

interface Appointment {
  id: string;
  patient_id: string;
  type: string;
  status: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  patients?: { first_name: string; last_name: string } | null;
}

export default function TherapistAgendaPage() {
  const supabase = createClient();
  const { user, tenantId } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedApt, setSelectedApt] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantId || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { start: startDate, end: endDate } = getDateRange(selectedDate, view);

    const { data } = await supabase.from("appointments")
      .select("id, patient_id, type, status, date, start_time, end_time, notes, patients!appointments_patient_id_fkey(first_name, last_name)")
      .eq("tenant_id", tenantId).eq("therapist_id", user.id)
      .gte("date", startDate).lte("date", endDate).order("date").order("start_time");
    setAppointments((data || []) as unknown as Appointment[]);
    setLoading(false);
  }, [selectedDate, view, tenantId, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const byDate = appointments.reduce((acc, apt) => { if (!acc[apt.date]) acc[apt.date] = []; acc[apt.date].push(apt); return acc; }, {} as Record<string, Appointment[]>);

  const dayNames = DAY_NAMES;
  const monthNames = MONTH_NAMES;
  const typeColors = APPOINTMENT_TYPE_COLORS;
  const colorMap = APPOINTMENT_COLOR_MAP;
  const typeLabels = APPOINTMENT_TYPE_LABELS;
  const statusLabels = APPOINTMENT_STATUS_LABELS;
  const statusColors = APPOINTMENT_STATUS_COLORS;

  function navDate(dir: number) {
    const d = new Date(selectedDate + "T12:00:00");
    if (view === "day") d.setDate(d.getDate() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setSelectedDate(d.toISOString().split("T")[0]);
  }

  const dateLabel = () => {
    const d = new Date(selectedDate + "T12:00:00");
    if (view === "day") return `${d.getDate()} de ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (view === "week") {
      const w = getWeekDatesUtil(selectedDate);
      const s = new Date(w[0] + "T12:00:00"), e = new Date(w[6] + "T12:00:00");
      return `${s.getDate()} ${monthNames[s.getMonth()]} - ${e.getDate()} ${monthNames[e.getMonth()]} ${e.getFullYear()}`;
    }
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  const isToday = (d: string) => d === new Date().toISOString().split("T")[0];
  const todayApts = appointments.filter(a => a.date === new Date().toISOString().split("T")[0] && a.status !== "cancelada");
  const pending = todayApts.filter(a => a.status === "programada" || a.status === "confirmada").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Agenda</h1>
          <p className="text-sm text-gray-500 mt-1">{pending} cita{pending !== 1 ? "s" : ""} pendiente{pending !== 1 ? "s" : ""} hoy</p>
        </div>
        <Link href="/therapist/clinical" className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 inline-flex items-center gap-2">
          📋 Registrar nota de sesión
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navDate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-sm font-semibold text-gray-900 min-w-[140px] text-center">{dateLabel()}</h2>
            <button onClick={() => navDate(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} className="px-3 py-1.5 text-xs font-medium bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100">Hoy</button>
          </div>
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex bg-gray-100 rounded-lg p-0.5 min-w-max">
              {(["day", "week", "month"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${view === v ? "bg-white text-teal-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar views — SOLO LECTURA */}
      {loading ? (
        <PageLoading text="Cargando agenda..." color="text-teal-600" />
      ) : view === "day" ? (
        <div className="space-y-3">
          {(byDate[selectedDate] || []).length === 0 ? (
            <EmptyState icon="📅" title="Sin citas para este día" />
          ) : byDate[selectedDate].map(apt => {
            const pName = (apt.patients as any) ? `${(apt.patients as any).first_name} ${(apt.patients as any).last_name}` : "Paciente";
            const { color: customColorId, text: notesText } = parseAppointmentNotes(apt.notes);
            const colorClasses = (customColorId && colorMap[customColorId]) || typeColors[apt.type] || "bg-gray-100 text-gray-700";
            return (
              <div key={apt.id} className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-sm" onClick={() => setSelectedApt(selectedApt === apt.id ? null : apt.id)}>
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold text-gray-900">{apt.start_time?.slice(0, 5)}</p>
                    <p className="text-xs text-gray-500">{apt.end_time?.slice(0, 5)}</p>
                  </div>
                  <div className="h-10 w-0.5 bg-gray-200" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{pName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorClasses}`}>{typeLabels[apt.type] || apt.type}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[apt.status] || "bg-gray-100"}`}>{statusLabels[apt.status] || apt.status}</span>
                    </div>
                  </div>
                </div>
                {selectedApt === apt.id && notesText && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{notesText}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : view === "week" ? (
        <div className="overflow-x-auto -mx-1">
          <div className="grid grid-cols-7 gap-2 min-w-[560px]">
          {getWeekDatesUtil(selectedDate).map(date => {
            const d = new Date(date + "T12:00:00");
            const apts = byDate[date] || [];
            const isT = isToday(date);
            return (
              <div key={date} className={`rounded-xl border ${isT ? "border-teal-300 bg-teal-50/30" : "border-gray-200 bg-white"} min-h-[120px]`}>
                <div 
                  className={`text-center py-2 border-b ${isT ? "border-teal-200 hover:bg-teal-100/30" : "border-gray-100 hover:bg-gray-50"} cursor-pointer transition-colors`}
                  onClick={() => { setSelectedDate(date); setView("day"); }}
                  title="Ver todo el día"
                >
                  <p className="text-[10px] text-gray-500 uppercase">{dayNames[d.getDay()]}</p>
                  <p className={`text-lg font-bold ${isT ? "text-teal-600" : "text-gray-900"}`}>{d.getDate()}</p>
                </div>
                <div className="p-1.5 space-y-1">
                  {apts.filter(a => a.status !== "cancelada").slice(0, 3).map(apt => {
                    const { color: customColorId } = parseAppointmentNotes(apt.notes);
                    const colorClasses = (customColorId && colorMap[customColorId]) || typeColors[apt.type] || "bg-gray-100 text-gray-700";
                    return (
                      <div key={apt.id} className={`px-1.5 py-1 rounded text-[10px] border ${colorClasses}`}>
                        <p className="font-medium truncate">{apt.start_time?.slice(0, 5)}</p>
                        <p className="truncate">{(apt.patients as any)?.first_name || "?"}</p>
                      </div>
                    );
                  })}
                  {apts.filter(a => a.status !== "cancelada").length > 3 && (
                    <button 
                      onClick={() => { setSelectedDate(date); setView("day"); }}
                      className="w-full text-center text-[10px] text-teal-600 hover:text-teal-800 hover:underline font-semibold mt-1 py-0.5 transition-colors cursor-pointer"
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
        <div className="overflow-x-auto -mx-1">
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden min-w-[560px]">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => <div key={d} className="bg-gray-50 text-center py-2 text-xs font-medium text-gray-500">{d}</div>)}
          {getMonthWeeksUtil(selectedDate).flat().map((date) => {
            const dd = new Date(date + "T12:00:00");
            const apts = byDate[date] || [];
            const isCurrentMonth = dd.getMonth() === new Date(selectedDate + "T12:00:00").getMonth();
            const isT = isToday(date);
            return (
              <div key={date} className={`bg-white p-1.5 min-h-[80px] ${!isCurrentMonth ? "opacity-40" : ""} ${isT ? "ring-2 ring-teal-400 ring-inset" : ""}`} onClick={() => { setSelectedDate(date); setView("day"); }}>
                <p className={`text-xs font-medium mb-1 ${isT ? "text-teal-600" : "text-gray-700"}`}>{dd.getDate()}</p>
                {apts.filter(a => a.status !== "cancelada").slice(0, 2).map(apt => {
                  const { color: customColorId } = parseAppointmentNotes(apt.notes);
                  const colorClasses = (customColorId && colorMap[customColorId]) || typeColors[apt.type] || "bg-gray-100 text-gray-700";
                  const bgClass = colorClasses.split(" ")[0];
                  const textClass = colorClasses.split(" ")[1];
                  return (
                    <div key={apt.id} className={`px-1 py-0.5 rounded text-[9px] mb-0.5 ${bgClass} ${textClass}`}>
                      {apt.start_time?.slice(0, 5)} {(apt.patients as any)?.first_name?.charAt(0) || ""}
                    </div>
                  );
                })}
                {apts.filter(a => a.status !== "cancelada").length > 2 && <p className="text-[9px] text-gray-400">+{apts.filter(a => a.status !== "cancelada").length - 2}</p>}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">📋 <strong>Solo lectura.</strong> La agenda es gestionada por el administrador. Para registrar la evolución de un paciente después de una sesión, ve a <Link href="/therapist/clinical" className="text-teal-600 hover:underline font-medium">Notas Clínicas</Link>.</p>
      </div>
    </div>
  );
}