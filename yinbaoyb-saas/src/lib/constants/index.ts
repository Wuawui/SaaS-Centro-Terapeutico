// ============================================================
// CentroYB — Constantes centralizadas
// Single source of truth para labels, colores y configuración.
// Reemplaza ~5 duplicaciones en dashboard, therapist, agenda, etc.
// ============================================================

import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  UserCog,
  UserPlus,
  Settings,
  Bell,
  FileBarChart,
  UserCircle,
  Archive,
  MessageSquare,
  Sparkles,
  Activity,
  type LucideIcon,
} from "lucide-react";

// ── Appointment ────────────────────────────────────────────

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  grupal: "Grupal",
  taller: "Taller",
  evaluacion: "Evaluación",
  supervision: "Supervisión",
};

export const APPOINTMENT_TYPE_COLORS: Record<string, string> = {
  individual: "bg-indigo-100 text-indigo-700 border-indigo-200",
  grupal: "bg-purple-100 text-purple-700 border-purple-200",
  taller: "bg-emerald-100 text-emerald-700 border-emerald-200",
  evaluacion: "bg-amber-100 text-amber-700 border-amber-200",
  supervision: "bg-pink-100 text-pink-700 border-pink-200",
};

export const APPOINTMENT_COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
  rose: "bg-rose-100 text-rose-700 border-rose-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  sky: "bg-sky-100 text-sky-700 border-sky-200",
};

export const APPOINTMENT_COLOR_OPTIONS = [
  { id: "indigo", name: "Indigo/Azul", classes: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { id: "purple", name: "Púrpura", classes: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "emerald", name: "Esmeralda/Verde", classes: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "amber", name: "Ámbar/Amarillo", classes: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "pink", name: "Rosado", classes: "bg-pink-100 text-pink-700 border-pink-200" },
  { id: "rose", name: "Rosa/Rojo", classes: "bg-rose-100 text-rose-700 border-rose-200" },
  { id: "teal", name: "Azul verde/Teal", classes: "bg-teal-100 text-teal-700 border-teal-200" },
  { id: "sky", name: "Cielo/Celeste", classes: "bg-sky-100 text-sky-700 border-sky-200" },
];

export function parseAppointmentNotes(notes: string | null): { color: string | null; text: string } {
  if (!notes) return { color: null, text: "" };
  if (notes.startsWith("{") && notes.endsWith("}")) {
    try {
      const parsed = JSON.parse(notes);
      if (typeof parsed === "object" && parsed !== null) {
        return {
          color: parsed.color || null,
          text: parsed.text || "",
        };
      }
    } catch (e) {
      // Fallback
    }
  }
  return { color: null, text: notes };
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
  reprogramada: "Reprogramada",
};

export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  programada: "bg-blue-50 text-blue-700",
  confirmada: "bg-green-50 text-green-700",
  completada: "bg-gray-100 text-gray-600",
  cancelada: "bg-red-50 text-red-700",
  no_asistio: "bg-orange-50 text-orange-700",
  reprogramada: "bg-yellow-50 text-yellow-700",
};

// ── Patient ────────────────────────────────────────────────

export const PATIENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  activo: { label: "Activo", color: "bg-green-50 text-green-700" },
  alta: { label: "Alta", color: "bg-blue-50 text-blue-700" },
  abandonado: { label: "Abandonó", color: "bg-red-50 text-red-700" },
  lista_espera: { label: "En espera", color: "bg-yellow-50 text-yellow-700" },
};

// ── Clinical Notes ─────────────────────────────────────────

export const NOTE_FORMAT_CONFIG: Record<string, {
  label: string;
  icon: string;
  color: string;
  fields: { key: string; label: string; placeholder: string }[];
}> = {
  SOAP: {
    label: "SOAP", icon: "📝", color: "bg-blue-50 text-blue-700 border-blue-200",
    fields: [
      { key: "subjective", label: "Subjetivo", placeholder: "¿Qué refiere el paciente? ¿Cómo se siente?" },
      { key: "objective", label: "Objetivo", placeholder: "Observaciones conductuales, apariencia, estado emocional..." },
      { key: "assessment", label: "Evaluación", placeholder: "Tu interpretación clínica, hipótesis diagnóstica..." },
      { key: "plan", label: "Plan", placeholder: "Plan de tratamiento, técnicas a usar, próxima sesión..." },
    ],
  },
  BIRP: {
    label: "BIRP", icon: "🔄", color: "bg-purple-50 text-purple-700 border-purple-200",
    fields: [
      { key: "behavior", label: "Conducta", placeholder: "Comportamiento observable del paciente durante la sesión..." },
      { key: "intervention", label: "Intervención", placeholder: "Técnicas utilizadas, ejercicios, abordaje..." },
      { key: "response", label: "Respuesta", placeholder: "Cómo respondió el paciente a la intervención..." },
      { key: "plan", label: "Plan", placeholder: "Plan para la próxima sesión, tareas asignadas..." },
    ],
  },
  DAP: {
    label: "DAP", icon: "📋", color: "bg-green-50 text-green-700 border-green-200",
    fields: [
      { key: "data", label: "Datos", placeholder: "Datos objetivos: lo que el paciente dijo e hizo..." },
      { key: "assessment", label: "Evaluación", placeholder: "Tu análisis profesional de los datos..." },
      { key: "plan", label: "Plan", placeholder: "Plan de acción, próximos pasos..." },
    ],
  },
  libre: {
    label: "Nota Libre", icon: "✍️", color: "bg-gray-50 text-gray-700 border-gray-200",
    fields: [
      { key: "content", label: "Contenido", placeholder: "Escribe tu nota libremente..." },
    ],
  },
  progreso: {
    label: "Progreso", icon: "📈", color: "bg-amber-50 text-amber-700 border-amber-200",
    fields: [
      { key: "mood", label: "Estado de ánimo", placeholder: "¿Cómo se encuentra el paciente hoy?" },
      { key: "content", label: "Progreso observado", placeholder: "Avances, retrocesos, cambios notables..." },
      { key: "tasks_assigned", label: "Tareas asignadas", placeholder: "Ejercicios o tareas para la próxima semana..." },
      { key: "next_objective", label: "Próximo objetivo", placeholder: "Meta para la próxima sesión..." },
    ],
  },
};

export const NOTE_FORMAT_LABELS: Record<string, string> = {
  soap: "SOAP", SOAP: "SOAP",
  birp: "BIRP", BIRP: "BIRP",
  dap: "DAP", DAP: "DAP",
  libre: "Libre",
  progreso: "Progreso",
};

export const NOTE_FORMAT_COLORS: Record<string, string> = {
  soap: "bg-blue-50 text-blue-700",
  SOAP: "bg-blue-50 text-blue-700",
  birp: "bg-purple-50 text-purple-700",
  BIRP: "bg-purple-50 text-purple-700",
  dap: "bg-amber-50 text-amber-700",
  DAP: "bg-amber-50 text-amber-700",
  libre: "bg-gray-50 text-gray-700",
  progreso: "bg-green-50 text-green-700",
};

// ── Roles ──────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Administrador",
  director: "Director de Sede",
  coordinador: "Coordinador Clínico",
  terapeuta: "Terapeuta (Integral / Atención Temprana)",
  fisioterapeuta: "Fisioterapeuta (Terapia Física)",
  admin: "Administrativo",
  paciente: "👶 Niños (Pacientes de Terapias)",
  padre: "Padre/Acudiente",
};

export const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-50 text-red-700",
  director: "bg-purple-50 text-purple-700",
  coordinador: "bg-blue-50 text-blue-700",
  terapeuta: "bg-indigo-50 text-indigo-700",
  fisioterapeuta: "bg-teal-50 text-teal-700 border border-teal-200",
  admin: "bg-gray-50 text-gray-700",
  padre: "bg-emerald-50 text-emerald-700",
  paciente: "bg-yellow-50 text-yellow-700",
};

// ── Navigation ─────────────────────────────────────────────

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
  section?: string;
}

export const ADMIN_NAV: NavItem[] = [
  // ── PRINCIPAL
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "Principal", roles: ["super_admin", "director", "coordinador", "terapeuta", "fisioterapeuta", "admin"] },
  { name: "Agenda", href: "/agenda", icon: CalendarDays, section: "Principal", roles: ["super_admin", "director", "coordinador", "terapeuta", "fisioterapeuta", "admin"] },
  // ── CLÍNICA
  { name: "Pacientes", href: "/patients", icon: Users, section: "Clínica", roles: ["super_admin", "director", "coordinador", "terapeuta", "fisioterapeuta", "admin"] },
  { name: "Terapeutas", href: "/therapists", icon: UserCog, section: "Clínica", roles: ["super_admin", "director", "coordinador", "admin"] },
  // ── ADMINISTRACIÓN
  { name: "Usuarios", href: "/users", icon: UserPlus, section: "Administración", roles: ["super_admin", "director", "coordinador", "admin"] },
  { name: "Reportes", href: "/reports", icon: FileBarChart, section: "Administración", roles: ["super_admin", "director", "coordinador", "admin"] },
  { name: "Análisis IA", href: "/ai-reports", icon: Sparkles, section: "Administración", roles: ["super_admin", "director", "coordinador", "admin"] },
  { name: "Respaldo", href: "/backups", icon: Archive, section: "Administración", roles: ["super_admin", "director", "admin"] },
  { name: "Configuración", href: "/settings", icon: Settings, section: "Administración", roles: ["super_admin", "director", "admin"] },
];

export const THERAPIST_NAV: NavItem[] = [
  { name: "Dashboard", href: "/therapist", icon: LayoutDashboard, section: "Mi Día" },
  { name: "Mi Agenda", href: "/therapist/agenda", icon: CalendarDays, section: "Mi Día" },
  { name: "Pacientes", href: "/therapist/patients", icon: Users, section: "Mis Pacientes" },
  { name: "Notas Clínicas", href: "/therapist/clinical", icon: ClipboardList, section: "Mis Pacientes" },
  { name: "Mi Perfil", href: "/therapist/profile", icon: UserCircle, section: "Cuenta" },
];

export const PARENT_NAV: NavItem[] = [
  { name: "Inicio", href: "/parent", icon: LayoutDashboard, section: "Inicio" },
  { name: "Citas", href: "/parent/appointments", icon: CalendarDays, section: "Mi Hijo/a" },
  { name: "Sesiones y Comentarios", href: "/parent/session-logs", icon: MessageSquare, section: "Mi Hijo/a" },
  { name: "Evolución IA", href: "/parent/notes", icon: ClipboardList, section: "Mi Hijo/a" },
  { name: "Perfil del Niño", href: "/parent/child", icon: Users, section: "Mi Hijo/a" },
  { name: "Mi Perfil", href: "/parent/profile", icon: UserCircle, section: "Cuenta" },
];

// ── Calendar ───────────────────────────────────────────────

export const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Risk assessment (scales) ───────────────────────────────

export function getRiskLevel(score: number, maxScore: number) {
  const pct = maxScore ? (score / maxScore) * 100 : 0;
  if (pct >= 70) return { emoji: "🔴", text: "Riesgo alto", color: "text-red-600", bgColor: "bg-red-500" };
  if (pct >= 40) return { emoji: "🟡", text: "Riesgo moderado", color: "text-yellow-600", bgColor: "bg-yellow-500" };
  return { emoji: "🟢", text: "Bajo riesgo", color: "text-green-600", bgColor: "bg-green-500" };
}

// ── Color Schemes for Sidebar ──────────────────────────────

export type ColorScheme = "indigo" | "teal" | "emerald";

export const COLOR_SCHEMES: Record<ColorScheme, {
  bg: string;
  logoBg: string;
  activeItem: string;
  hoverItem: string;
  textMuted: string;
  border: string;
  accent: string;
}> = {
  indigo: {
    bg: "bg-indigo-950",
    logoBg: "bg-indigo-500",
    activeItem: "bg-indigo-900 text-white",
    hoverItem: "text-indigo-200 hover:bg-indigo-900/50 hover:text-white",
    textMuted: "text-indigo-300",
    border: "border-indigo-800",
    accent: "bg-indigo-500",
  },
  teal: {
    bg: "bg-teal-900",
    logoBg: "bg-teal-500",
    activeItem: "bg-teal-800 text-white",
    hoverItem: "text-teal-200 hover:bg-teal-800/50 hover:text-white",
    textMuted: "text-teal-300",
    border: "border-teal-700",
    accent: "bg-teal-500",
  },
  emerald: {
    bg: "bg-emerald-900",
    logoBg: "bg-emerald-500",
    activeItem: "bg-emerald-800 text-white",
    hoverItem: "text-emerald-200 hover:bg-emerald-800/50 hover:text-white",
    textMuted: "text-emerald-300",
    border: "border-emerald-700",
    accent: "bg-emerald-500",
  },
};
