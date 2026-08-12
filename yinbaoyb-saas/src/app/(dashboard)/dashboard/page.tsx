"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/providers/SessionProvider";
import { DashboardSkeleton } from "@/components/ui/Skeletons";
import { KPICard } from "@/features/dashboard/components/KPICard";
import { AppointmentCard } from "@/features/appointments/components/AppointmentCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TutorialModal } from "@/components/ui/TutorialModal";
import { InteractiveTour, type TourStep } from "@/components/ui/InteractiveTour";
import { getDashboardStats, getTodayAppointments, getRecentPatients, type DashboardStats } from "@/lib/data/queries";
import {
  Users,
  CalendarDays,
  ClipboardCheck,
  AlertTriangle,
  Activity,
  Plus,
} from "lucide-react";

const TOUR_STEPS: TourStep[] = [
  {
    target: "#tour-header",
    title: "👋 ¡Te damos la bienvenida al Centro Terapéutico!",
    content: "Este es tu panel general de administración. Aquí podrás coordinar toda la clínica de un de vista rápido y supervisar el trabajo de tu equipo.",
    placement: "bottom"
  },
  {
    target: '[data-tour="sidebar-dashboard"]',
    title: "📊 Panel Principal (Dashboard)",
    content: "Esta es tu pantalla de inicio actual. Te muestra estadísticas en tiempo real, accesos rápidos y actividades del día.",
    placement: "right"
  },
  {
    target: '[data-tour="sidebar-agenda"]',
    title: "📅 Agenda Global",
    content: "Accede al calendario general de consultorios. Puedes agendar citas para cualquier terapeuta, revisar conflictos de horarios y reordenar el calendario.",
    placement: "right"
  },
  {
    target: '[data-tour="sidebar-pacientes"]',
    title: "👥 Directorio de Pacientes",
    content: "Gestiona las fichas técnicas de los niños. Aquí creas nuevos perfiles de pacientes, asignas terapeutas y vinculas a los padres.",
    placement: "right"
  },
  {
    target: '[data-tour="sidebar-terapeutas"]',
    title: "👩‍⚕️ Nómina de Profesionales",
    content: "Registra a los terapeutas de tu centro. Configura sus especialidades, bloquea sus días de vacaciones y personaliza sus colores para la agenda.",
    placement: "right"
  },
  {
    target: '[data-tour="sidebar-clínico"]',
    title: "📋 Auditoría Clínica",
    content: "Audita y supervisa el trabajo de tu equipo. Revisa las notas de evolución de las sesiones (SOAP, BIRP, DAP) y califica cuestionarios psicométricos.",
    placement: "right"
  },
  {
    target: '[data-tour="sidebar-usuarios"]',
    title: "👤 Permisos y Cuentas de Usuarios",
    content: "Crea accesos seguros para secretarios, terapeutas, contadores y coordinadores de sede, regulando sus permisos dentro del sistema.",
    placement: "right"
  },
  {
    target: "#tour-kpis",
    title: "📊 Indicadores Clave (KPIs)",
    content: "Monitorea pacientes activos, citas agendadas hoy, notas clínicas sin firmar y alertas por test psicométricos elevados (riesgo clínico).",
    placement: "bottom"
  },
  {
    target: "#tour-actions",
    title: "⚡ Acciones Rápidas",
    content: "Crea citas rápidamente, da de alta nuevos pacientes o redacta notas clínicas instantáneas con estas tarjetas de atajos rápidos.",
    placement: "bottom"
  },
  {
    target: "#tour-appointments",
    title: "📅 Agenda del Día",
    content: "Aquí verás los bloques de horas ocupados por todos los terapeutas hoy. Haz clic en 'Ver agenda' para abrir el calendario de la semana.",
    placement: "top"
  },
  {
    target: "#tour-patients",
    title: "👥 Fichas de Pacientes Recientes",
    content: "Visualiza de forma cronológica a los últimos pacientes atendidos o registrados y haz clic en ellos para ver sus detalles de contacto y evolución.",
    placement: "top"
  }
];

export default function DashboardPage() {
  const supabase = createClient();
  const { profile, tenantId, isTherapist } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayApts, setTodayApts] = useState<any[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTour, setShowTour] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const therapistId = isTherapist ? profile?.id : undefined;

      const [statsData, aptsData, patientsData] = await Promise.all([
        getDashboardStats(supabase, tenantId, therapistId),
        getTodayAppointments(supabase, tenantId, therapistId),
        getRecentPatients(supabase, tenantId, therapistId),
      ]);

      setStats(statsData);
      setTodayApts(aptsData);
      setRecentPatients(patientsData);
    } catch (err) {
      console.error("Error loading dashboard:", err);
    }
    setLoading(false);
  }, [tenantId, isTherapist, profile?.id]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) return <DashboardSkeleton />;

  const kpis = [
    {
      name: isTherapist ? "Mis pacientes" : "Pacientes activos",
      value: stats?.activePatients ?? 0,
      sub: isTherapist ? "Asignados a ti" : (stats ? `de ${stats.totalPatients} totales` : ""),
      icon: Users,
      color: "bg-blue-50 text-blue-600",
      href: "/patients",
    },
    {
      name: "Citas hoy",
      value: stats?.todayAppointments ?? 0,
      sub: stats ? `${stats.weekAppointments} esta semana` : "",
      icon: CalendarDays,
      color: "bg-green-50 text-green-600",
      href: "/agenda",
    },
    {
      name: "Notas sin firmar",
      value: stats?.pendingNotes ?? 0,
      sub: "Pendientes de revisión",
      icon: ClipboardCheck,
      color: "bg-yellow-50 text-yellow-600",
      href: "/patients",
    },
    {
      name: "Alertas clínicas",
      value: stats?.clinicalAlerts ?? 0,
      sub: "Escalas con riesgo",
      icon: AlertTriangle,
      color: "bg-red-50 text-red-600",
      href: "/patients",
    },
  ];

  const tourSteps = isTherapist
    ? TOUR_STEPS.filter(s => s.target !== "#tour-actions")
    : TOUR_STEPS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div id="tour-header">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isTherapist ? "Tu resumen personal" : "Resumen del centro"} — Bienvenido, {profile?.first_name || ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowTutorial(true)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-indigo-100/30 hover:from-indigo-100 hover:to-indigo-250/40 rounded-xl transition-all duration-200 inline-flex items-center gap-1.5 border border-indigo-100 shadow-sm shadow-indigo-50/50 cursor-pointer"
          >
            📖 Tutorial
          </button>
          <button 
            onClick={loadDashboard} 
            className="text-xs text-gray-600 hover:text-indigo-600 font-medium px-3 py-1.5 bg-white border border-gray-200/60 rounded-xl hover:bg-gray-50 transition-all duration-200 cursor-pointer inline-flex items-center gap-1 shadow-sm"
          >
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div id="tour-kpis" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.name} {...kpi} />
        ))}
      </div>

      {/* Quick Actions */}
      {!isTherapist && (
        <div id="tour-actions" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/agenda"
            className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-indigo-50/10 border border-gray-200 hover:border-indigo-200/60 rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group shadow-sm"
          >
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
              <Plus className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-900 transition-colors">Nueva Cita</p>
              <p className="text-[11px] text-gray-500 group-hover:text-indigo-600/70 transition-colors">Agendar desde el calendario</p>
            </div>
          </Link>
          <Link
            href="/patients/new"
            className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-emerald-50/10 border border-gray-200 hover:border-emerald-200/60 rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group shadow-sm"
          >
            <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm shadow-emerald-200">
              <Users className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 group-hover:text-emerald-900 transition-colors">Nuevo Paciente</p>
              <p className="text-[11px] text-gray-500 group-hover:text-emerald-600/70 transition-colors">Registrar datos del paciente</p>
            </div>
          </Link>
          <Link
            href="/patients"
            className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-amber-50/10 border border-gray-200 hover:border-amber-200/60 rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group shadow-sm"
          >
            <div className="h-9 w-9 rounded-xl bg-amber-600 flex items-center justify-center shadow-sm shadow-amber-200">
              <ClipboardCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 group-hover:text-amber-900 transition-colors">Nueva Nota</p>
              <p className="text-[11px] text-gray-500 group-hover:text-amber-600/70 transition-colors">Escribir nota clínica</p>
            </div>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's appointments */}
        <div id="tour-appointments" className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Citas de hoy</h2>
            </div>
            <Link href="/agenda" className="text-xs text-indigo-600 hover:text-indigo-700">Ver agenda →</Link>
          </div>

          {todayApts.length === 0 ? (
            <EmptyState icon="📅" title="Sin citas programadas" description="Agenda la primera cita del día desde el calendario" actionLabel="Ir a Agenda" actionHref="/agenda" />
          ) : (
            <div className="space-y-3">
              {todayApts.map((apt: any) => (
                <AppointmentCard key={apt.id} appointment={apt} compact />
              ))}
            </div>
          )}
        </div>

        {/* Recent patients */}
        <div id="tour-patients" className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Pacientes recientes</h2>
            </div>
            <Link href="/patients" className="text-xs text-indigo-600 hover:text-indigo-700">Ver todos →</Link>
          </div>

          {recentPatients.length === 0 ? (
            <EmptyState icon="👥" title="Sin pacientes registrados" description="Comienza registrando a tu primer paciente" actionLabel="Registrar paciente" actionHref="/patients/new" />
          ) : (
            <div className="space-y-3">
              {recentPatients.map((p: any) => (
                <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm flex-shrink-0">
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.first_name} {p.last_name}</p>
                    <StatusBadge type="patient" status={p.status} />
                  </div>
                  <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <TutorialModal role={isTherapist ? "therapist" : "admin"} isOpen={showTutorial} onClose={() => setShowTutorial(false)} onStartTour={() => setShowTour(true)} />
      <InteractiveTour steps={tourSteps} isOpen={showTour} onClose={() => setShowTour(false)} accentColor="indigo-600" />
    </div>
  );
}