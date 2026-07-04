-- ============================================================
-- MIGRACIÓN 018: Portal de Terapia Física y Rehabilitación
-- CentroYB SaaS — Gestión clínica de rehabilitación física
-- ============================================================

-- Tabla de historias clínicas de terapia física (evaluación inicial)
CREATE TABLE IF NOT EXISTS physical_therapy_histories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  
  -- Bloques de datos clínicos estructurados en JSONB
  identification_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  physical_measures JSONB NOT NULL DEFAULT '{}'::jsonb,
  exploration_general JSONB NOT NULL DEFAULT '{}'::jsonb,
  exploration_structural JSONB NOT NULL DEFAULT '{}'::jsonb,
  gait_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  articular_evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  muscular_evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  neurological_evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  treatment_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de sesiones de terapia física (seguimiento y evolución diaria)
CREATE TABLE IF NOT EXISTS physical_therapy_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  history_id UUID REFERENCES physical_therapy_histories(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  
  session_number INT NOT NULL,
  treatment_applied TEXT NOT NULL,
  pain_level_eva INT NOT NULL CHECK (pain_level_eva BETWEEN 0 AND 10),
  observations TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_pt_histories_tenant ON physical_therapy_histories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pt_histories_patient ON physical_therapy_histories(patient_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_tenant ON physical_therapy_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_patient ON physical_therapy_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_history ON physical_therapy_sessions(history_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE physical_therapy_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_therapy_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para historias clínicas
CREATE POLICY "pt_histories_select" ON physical_therapy_histories FOR SELECT TO authenticated
  USING (tenant_id = public.get_tenant_id());

CREATE POLICY "pt_histories_insert" ON physical_therapy_histories FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "pt_histories_update" ON physical_therapy_histories FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id());

CREATE POLICY "pt_histories_delete" ON physical_therapy_histories FOR DELETE TO authenticated
  USING (tenant_id = public.get_tenant_id());

-- Políticas RLS para sesiones diarias
CREATE POLICY "pt_sessions_select" ON physical_therapy_sessions FOR SELECT TO authenticated
  USING (tenant_id = public.get_tenant_id());

CREATE POLICY "pt_sessions_insert" ON physical_therapy_sessions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "pt_sessions_update" ON physical_therapy_sessions FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id());

CREATE POLICY "pt_sessions_delete" ON physical_therapy_sessions FOR DELETE TO authenticated
  USING (tenant_id = public.get_tenant_id());

-- Triggers para mantener actualizado updated_at
CREATE TRIGGER update_pt_histories_updated_at 
  BEFORE UPDATE ON physical_therapy_histories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Triggers de auditoría
CREATE TRIGGER audit_pt_histories 
  AFTER INSERT OR UPDATE OR DELETE ON physical_therapy_histories 
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_pt_sessions 
  AFTER INSERT OR UPDATE OR DELETE ON physical_therapy_sessions 
  FOR EACH ROW EXECUTE FUNCTION log_audit();
