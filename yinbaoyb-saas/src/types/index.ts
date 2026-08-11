// ============================================================
// YinbaoYB SaaS — Tipos principales
// ============================================================

// ── Roles ──────────────────────────────────────────────────
export type UserRole =
  | "super_admin"
  | "director"
  | "coordinador"
  | "terapeuta"
  | "fisioterapeuta"
  | "admin"
  | "paciente"
  | "padre";

// ── Tenant (Centro terapéutico) ────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  plan: "basico" | "profesional" | "avanzado";
  created_at: string;
}

// ── Perfil de usuario ──────────────────────────────────────
export interface Profile {
  id: string; // = auth.users.id
  tenant_id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Paciente ───────────────────────────────────────────────
export interface Patient {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  document_number?: string;
  birth_date?: string;
  gender?: "M" | "F" | "O" | "X";
  phone?: string;
  email?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  reason_for_consultation?: string;
  primary_diagnosis?: string; // CIE-10 / DSM-5 code
  primary_diagnosis_desc?: string;
  secondary_diagnoses?: string[];
  current_medication?: string;
  medical_history?: string;
  insurance_provider?: string;
  insurance_policy?: string;
  therapist_id?: string; // profile.id del terapeuta asignado principal
  secondary_therapist_ids?: string[]; // terapeutas adicionales (equipo multidisciplinario)
  status: "activo" | "alta" | "abandonado" | "lista_espera";
  active: boolean;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

// ── Terapeuta ──────────────────────────────────────────────
export interface Therapist {
  id: string; // = profile.id donde role = 'terapeuta'
  specialty?: string;
  license_number?: string;
  certifications?: string[];
  therapeutic_approach?: string[];
  weekly_availability?: WeekSchedule;
  max_patients?: number;
  active: boolean;
}

// ── Agenda / Citas ─────────────────────────────────────────
export type AppointmentType =
  | "individual"
  | "grupal"
  | "taller"
  | "evaluacion"
  | "supervision";

export type AppointmentStatus =
  | "programada"
  | "confirmada"
  | "completada"
  | "cancelada"
  | "no_asistio"
  | "reprogramada";

export interface Appointment {
  id: string;
  tenant_id: string;
  patient_id: string;
  therapist_id: string;
  type: AppointmentType;
  status: AppointmentStatus;
  date: string; // ISO date
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Notas clínicas ─────────────────────────────────────────
export type NoteFormat = "SOAP" | "BIRP" | "DAP" | "libre" | "progreso";

export interface ClinicalNote {
  id: string;
  tenant_id: string;
  patient_id: string;
  appointment_id?: string;
  therapist_id: string;
  format: NoteFormat;
  // SOAP fields
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  // BIRP fields
  behavior?: string;
  intervention?: string;
  response?: string;
  // DAP fields
  data?: string;
  // General
  mood?: string;
  tasks_assigned?: string;
  next_objective?: string;
  // Free form
  content?: string;
  // Progress
  progress_score?: number; // 1-10
  signed: boolean;
  signed_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Plan de tratamiento ────────────────────────────────────
export type ObjectiveStatus = "pendiente" | "en_progreso" | "alcanzado" | "abandonado";

export interface TreatmentObjective {
  id: string;
  treatment_plan_id: string;
  description: string;
  target_date?: string;
  status: ObjectiveStatus;
  progress_percentage: number; // 0-100
  created_at: string;
  updated_at: string;
}

export interface TreatmentPlan {
  id: string;
  tenant_id: string;
  patient_id: string;
  therapist_id: string;
  objectives: TreatmentObjective[];
  notes?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

// ── Escalas clínicas ───────────────────────────────────────
export type ScaleType = "PHQ-9" | "GAD-7" | "PCL-5" | "BDI-II" | "SRS" | "ORS" | "custom";

export interface ClinicalScale {
  id: string;
  tenant_id: string;
  type: ScaleType;
  custom_name?: string;
  questions: ScaleQuestion[];
  max_score: number;
  risk_threshold?: number; // Alerta si supera este valor
}

export interface ScaleQuestion {
  id: string;
  text: string;
  options: { label: string; value: number }[];
}

export interface ScaleResult {
  id: string;
  tenant_id: string;
  patient_id: string;
  scale_type: ScaleType;
  therapist_id?: string;
  answers: Record<string, number>; // question_id → value
  total_score: number;
  risk_alert: boolean;
  notes?: string;
  completed_at: string;
}

// ── Horario semanal ────────────────────────────────────────
export interface WeekSchedule {
  monday?: DaySlot[];
  tuesday?: DaySlot[];
  wednesday?: DaySlot[];
  thursday?: DaySlot[];
  friday?: DaySlot[];
  saturday?: DaySlot[];
  sunday?: DaySlot[];
}

export interface DaySlot {
  start: string; // HH:mm
  end: string; // HH:mm
}

// ── Dashboard KPIs ─────────────────────────────────────────
export interface DashboardKPIs {
  active_patients: number;
  sessions_completed: number;
  sessions_scheduled: number;
  no_show_rate: number;
  therapist_occupancy: number;
  new_admissions: number;
  discharges: number;
  revenue_billed: number;
  revenue_collected: number;
  avg_waitlist_days: number;
}

// ── Padre-Acudiente ────────────────────────────────────────
export interface ParentPatient {
  id: string;
  parent_id: string;
  patient_id: string;
  tenant_id: string;
  relationship: "madre" | "padre" | "tutor" | "otro";
  can_view_notes: boolean;
  can_view_scales: boolean;
  can_view_appointments: boolean;
  created_at: string;
}

// ── Relación con info del paciente para el padre ───────────
export interface ParentChild {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  active: boolean;
  diagnosis?: string | null;
  date_of_birth?: string | null;
  therapist_id?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  relationship?: string;
}