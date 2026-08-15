"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/providers/SessionProvider";
import { useParentData } from "@/hooks/useParentData";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { InteractiveTour, type TourStep } from "@/components/ui/InteractiveTour";
import { TutorialModal } from "@/components/ui/TutorialModal";
import dynamic from "next/dynamic";

const EvolutionChart = dynamic(() => import("@/features/clinical/components/EvolutionChart"), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-[300px]">
      <div className="animate-spin h-6 w-6 border-4 border-emerald-600 border-t-transparent rounded-full" />
    </div>
  )
});

const MOTIVATIONAL_QUOTES = [
  "Cada pequeño paso es un avance gigante en su desarrollo.",
  "El progreso de hoy es el cimiento del mañana.",
  "La constancia y el amor son las mejores herramientas.",
  "Celebra cada logro, no importa lo pequeño que parezca.",
  "Estamos juntos acompañándolo/a en este hermoso proceso.",
  "Tu comprensión y apoyo son la pieza clave de su evolución.",
  "Los grandes resultados toman tiempo, paciencia y dedicación.",
  "No hay límites para lo que juntos podemos alcanzar."
];

const TOUR_STEPS: TourStep[] = [
  {
    target: "#tour-parent-welcome",
    title: "🏠 Portal de Padres",
    content: "¡Te damos la bienvenida a tu espacio familiar! Desde aquí podrás hacer un seguimiento del progreso terapéutico de tu hijo.",
    placement: "bottom"
  },
  {
    target: "#tour-parent-child",
    title: "👦 Información del Niño",
    content: "Muestra la ficha de tu hijo, su estado activo en la clínica, diagnóstico y el terapeuta asignado para su estimulación.",
    placement: "bottom"
  },
  {
    target: "#tour-parent-chart",
    title: "📈 Evolución Clínica Visual",
    content: "Una gráfica interactiva que te mostrará cómo ha ido progresando el menor a lo largo de las sesiones.",
    placement: "top"
  },
  {
    target: "#tour-parent-actions",
    title: "⚡ Acciones Rápidas",
    content: "Accede con un solo clic a la interpretación de sesiones generada por IA, al historial de escalas completadas y al calendario de próximas citas.",
    placement: "top"
  }
];

export default function ParentDashboard() {
  const { profile } = useSession();
  const { children, lastNote, lastScale, nextAppointment, loading, error } = useParentData();
  const [quote, setQuote] = useState(MOTIVATIONAL_QUOTES[0]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Escoger frase aleatoria solo en el cliente para evitar hidratación fallida
    setQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
  }, []);

  const profileName = profile?.first_name || "";

  if (loading) return <PageLoading text="Cargando portal de padres..." color="text-emerald-600" />;

  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">Error: {error}</div>;

  if (children.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">👨‍👩‍👧</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Bienvenido/a, {profileName}</h2>
        <p className="text-gray-500">Aún no tienes pacientes vinculados. Contacta al centro terapéutico para que vinculen tu cuenta.</p>
      </div>
    );
  }

  const child = children[0];
  const childName = `${child.first_name} ${child.last_name}`;
  const patientId = child.id || child.patient_id;

  return (
    <div className="space-y-6">
      <div id="tour-parent-welcome" className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between min-h-[140px] relative overflow-hidden gap-4">
        {/* Adorno brillante de fondo */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 w-full md:w-3/4">
          <h1 className="text-2xl font-bold">¡Hola, {profileName}! 👋</h1>
          <p className="text-emerald-100 mt-2 text-sm italic border-l-2 border-emerald-300 pl-3 py-1">
            "{quote}"
          </p>
        </div>
        <div className="relative z-10 flex-shrink-0">
          <button 
            onClick={() => setShowTutorial(true)}
            className="px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs rounded-xl backdrop-blur-md transition-all inline-flex items-center gap-1.5 border border-white/20 hover:scale-105 active:scale-[0.98] cursor-pointer"
          >
            📖 Tutorial del Portal
          </button>
        </div>
      </div>

      <div id="tour-parent-child" className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">
            {child.first_name[0]}{child.last_name[0]}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{childName}</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${child.status === "activo" ? "bg-green-50 text-green-700" : child.status === "alta" ? "bg-blue-50 text-blue-700" : "bg-yellow-50 text-yellow-700"}`}>
              {child.status === "activo" ? "Activo" : child.status === "alta" ? "Dado de alta" : child.status === "lista_espera" ? "En espera" : child.status}
            </span>
            {child.primary_diagnosis && <p className="text-xs text-gray-500 mt-0.5">{child.primary_diagnosis}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico principal de evolución */}
        <div id="tour-parent-chart" className="lg:col-span-2">
           <EvolutionChart patientId={patientId} />
        </div>

        {/* Links de acción */}
        <div id="tour-parent-actions" className="space-y-4">
          <Link href="/parent/notes" className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">✨</span>
              <h3 className="text-sm font-semibold text-gray-900">Análisis IA Disponible</h3>
            </div>
            {lastNote ? (
              <div>
                <p className="text-xs text-gray-500">Última sesión: {new Date(lastNote.created_at).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</p>
                <div className="mt-2 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  Ver interpretación clínica →
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin sesiones aún</p>
            )}
          </Link>

          <Link href="/parent/session-logs" className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🏃</span>
              <h3 className="text-sm font-semibold text-gray-900">Bitácora de Evolución</h3>
            </div>
            <p className="text-xs text-gray-500">Consulta el registro diario de avances y ejercicios terapéuticos.</p>
            <div className="mt-2 text-[11px] font-medium text-indigo-600 flex items-center gap-1">
              Ver sesiones y ejercicios →
            </div>
          </Link>

          <Link href="/parent/appointments" className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📅</span>
              <h3 className="text-sm font-semibold text-gray-900">Próxima cita</h3>
            </div>
            {nextAppointment ? (
              <div>
                <p className="text-sm font-medium text-gray-900">{new Date(nextAppointment.date).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</p>
                <p className="text-xs text-gray-500">{nextAppointment.start_time?.slice(0, 5)} - {nextAppointment.end_time?.slice(0, 5)}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin citas programadas</p>
            )}
          </Link>
        </div>
      </div>
      
      <TutorialModal role="parent" isOpen={showTutorial} onClose={() => setShowTutorial(false)} onStartTour={() => setShowTour(true)} />
      <InteractiveTour steps={TOUR_STEPS} isOpen={showTour} onClose={() => setShowTour(false)} accentColor="emerald-600" />
    </div>
  );
}