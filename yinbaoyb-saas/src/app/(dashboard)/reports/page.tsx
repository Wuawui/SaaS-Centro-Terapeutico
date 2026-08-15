"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { PATIENT_STATUS_CONFIG, APPOINTMENT_TYPE_LABELS } from "@/lib/constants";
import { FileBarChart, Download, Calendar, Users, ClipboardCheck, AlertTriangle, TrendingUp } from "lucide-react";

interface ReportData {
  totalPatients: number;
  activePatients: number;
  inactivePatients: number;
  waitlistPatients: number;
  dischargedPatients: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  totalNotes: number;
  unsignedNotes: number;
  totalAlerts: number;
  totalTherapists: number;
  appointmentsByType: Record<string, number>;
  patientsByStatus: Record<string, number>;
  monthName: string;
}

export default function ReportsPage() {
  const supabase = createClient();
  const { user, tenantId, isTherapist } = useSession();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
    if (!user || !tenantId) { setLoading(false); return; }

      const tid = tenantId;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const monthEnd = now.toISOString().split("T")[0];
      const monthName = now.toLocaleDateString("es-EC", { month: "long", year: "numeric" });

      // Build queries based on period
      let startDate = monthStart;
      if (period === "quarter") {
        const q = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), q * 3, 1).toISOString().split("T")[0];
      } else if (period === "year") {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      }

      // Patients
      const [patientsRes, activeRes, waitlistRes, dischargedRes, inactiveRes] = await Promise.all([
        supabase.from("patients").select("id, status", { count: "exact" }).eq("tenant_id", tid).eq("active", true),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("active", true).eq("status", "activo"),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "lista_espera"),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "alta"),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("active", false),
      ]);

      const patientData = patientsRes.data || [];
      const patientsByStatus: Record<string, number> = {};
      patientData.forEach((p: { status: string }) => {
        patientsByStatus[p.status] = (patientsByStatus[p.status] || 0) + 1;
      });

      // Appointments in period
      const aptFilter = isTherapist
        ? { column: "therapist_id", value: user.id }
        : null;

      let aptQuery = supabase.from("appointments").select("id, type, status").eq("tenant_id", tid).gte("date", startDate).lte("date", monthEnd);
      if (aptFilter) aptQuery = aptQuery.eq(aptFilter.column, aptFilter.value);
      const { data: aptData } = await aptQuery;

      const appointmentsByType: Record<string, number> = {};
      let completed = 0, cancelled = 0, noShow = 0;
      (aptData || []).forEach((a: { type: string; status: string }) => {
        appointmentsByType[a.type] = (appointmentsByType[a.type] || 0) + 1;
        if (a.status === "completada") completed++;
        if (a.status === "cancelada") cancelled++;
        if (a.status === "no_asistio") noShow++;
      });

      // Notes
      let notesQuery = supabase.from("clinical_notes").select("id, signed", { count: "exact" }).eq("tenant_id", tid);
      if (isTherapist) notesQuery = notesQuery.eq("therapist_id", user.id);
      const { count: totalNotes, data: notesData } = await notesQuery;

      // Alerts
      let alertsQuery = supabase.from("scale_results").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("risk_alert", true);
      if (isTherapist) alertsQuery = alertsQuery.eq("therapist_id", user.id);
      const { count: totalAlerts } = await alertsQuery;

      // Therapists
      const { count: totalTherapists } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", tid).in("role", ["terapeuta", "fisioterapeuta"]).eq("active", true);

      setData({
        totalPatients: patientsRes.count || 0,
        activePatients: activeRes.count || 0,
        inactivePatients: inactiveRes.count || 0,
        waitlistPatients: waitlistRes.count || 0,
        dischargedPatients: dischargedRes.count || 0,
        totalAppointments: (aptData || []).length,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
        totalNotes: totalNotes || 0,
        unsignedNotes: (notesData || []).filter((n: { signed: boolean }) => !n.signed).length,
        totalAlerts: totalAlerts || 0,
        totalTherapists: totalTherapists || 0,
        appointmentsByType,
        patientsByStatus,
        monthName,
      });
    } catch (err) {
      console.error("Error loading report:", err);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { loadReport(); }, [loadReport]);

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Métrica", "Valor"],
      ["Pacientes totales", data.totalPatients],
      ["Pacientes activos", data.activePatients],
      ["Pacientes en lista de espera", data.waitlistPatients],
      ["Pacientes dados de alta", data.dischargedPatients],
      ["Pacientes inactivos", data.inactivePatients],
      ["Total citas", data.totalAppointments],
      ["Citas completadas", data.completedAppointments],
      ["Citas canceladas", data.cancelledAppointments],
      ["Citas no asistidas", data.noShowAppointments],
      ["Notas clínicas", data.totalNotes],
      ["Notas sin firmar", data.unsignedNotes],
      ["Alertas clínicas", data.totalAlerts],
      ["Terapeutas activos", data.totalTherapists],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${period}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <PageLoading text="Generando reporte..." />;

  if (!data) return <div className="p-6 text-center text-gray-500">No se pudieron cargar los datos</div>;

  const statusLabels: Record<string, string> = Object.fromEntries(
    Object.entries(PATIENT_STATUS_CONFIG).map(([k, v]) => [k, v.label])
  );
  const typeLabels = APPOINTMENT_TYPE_LABELS;
  const complianceRate = data.totalAppointments > 0
    ? Math.round((data.completedAppointments / data.totalAppointments) * 100)
    : 0;
  const noShowRate = data.totalAppointments > 0
    ? Math.round((data.noShowAppointments / data.totalAppointments) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{data.monthName}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex bg-gray-100 rounded-lg p-1 min-w-max">
              {(["month", "quarter", "year"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
                    period === p ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {p === "month" ? "Mes" : p === "quarter" ? "Trimestre" : "Año"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={loadReport} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pacientes activos", value: data.activePatients, icon: Users, color: "bg-blue-50 text-blue-600", sub: `${data.totalPatients} totales` },
          { label: "Citas completadas", value: data.completedAppointments, icon: Calendar, color: "bg-green-50 text-green-600", sub: `${complianceRate}% cumplimiento` },
          { label: "Notas sin firmar", value: data.unsignedNotes, icon: ClipboardCheck, color: "bg-yellow-50 text-yellow-600", sub: `de ${data.totalNotes} totales` },
          { label: "Alertas clínicas", value: data.totalAlerts, icon: AlertTriangle, color: "bg-red-50 text-red-600", sub: "Escalas con riesgo" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-[11px] text-gray-500">{kpi.label}</p>
                <p className="text-[10px] text-gray-400">{kpi.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pacientes por estado */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Pacientes por estado</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(data.patientsByStatus).map(([status, count]) => {
              const pct = data.totalPatients > 0 ? Math.round((count / data.totalPatients) * 100) : 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28">{statusLabels[status] || status}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                  <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
            {Object.keys(data.patientsByStatus).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos</p>
            )}
          </div>
        </div>

        {/* Citas por tipo */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Citas por tipo</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(data.appointmentsByType).map(([type, count]) => {
              const pct = data.totalAppointments > 0 ? Math.round((count / data.totalAppointments) * 100) : 0;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28">{typeLabels[type] || type}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                  <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
            {Object.keys(data.appointmentsByType).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Sin citas en el período</p>
            )}
          </div>
        </div>
      </div>

      {/* Resumen de cumplimiento */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-indigo-900">Indicadores de cumplimiento</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-700">{complianceRate}%</p>
            <p className="text-xs text-indigo-600">Cumplimiento citas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-700">{noShowRate}%</p>
            <p className="text-xs text-indigo-600">No asistencias</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-700">{data.totalTherapists}</p>
            <p className="text-xs text-indigo-600">Terapeutas activos</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${data.unsignedNotes > 0 ? "text-yellow-600" : "text-indigo-700"}`}>{data.unsignedNotes}</p>
            <p className="text-xs text-indigo-600">Notas pendientes</p>
          </div>
        </div>
      </div>
    </div>
  );
}