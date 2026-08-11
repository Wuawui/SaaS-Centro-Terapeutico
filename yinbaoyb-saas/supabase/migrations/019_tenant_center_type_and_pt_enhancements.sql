-- ============================================================
-- MIGRACIÓN 019: Tipo de Centro y Mejoras al Portal de Terapia Física
-- CentroYB SaaS — Clasificación Multi-Centro y RLS para Fisioterapia
-- ============================================================

-- 1. Agregar clasificación de centro a la tabla de tenants (pediatric | physical_therapy | hybrid)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'center_type'
  ) THEN
    ALTER TABLE tenants ADD COLUMN center_type TEXT DEFAULT 'pediatric' CHECK (center_type IN ('pediatric', 'physical_therapy', 'hybrid'));
  END IF;
END $$;

-- 2. Asegurar columnas adicionales de evolución de dolor en sesiones de terapia física
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'physical_therapy_sessions' AND column_name = 'pain_level_before_eva'
  ) THEN
    ALTER TABLE physical_therapy_sessions ADD COLUMN pain_level_before_eva INT DEFAULT 0 CHECK (pain_level_before_eva BETWEEN 0 AND 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'physical_therapy_sessions' AND column_name = 'pain_level_after_eva'
  ) THEN
    ALTER TABLE physical_therapy_sessions ADD COLUMN pain_level_after_eva INT DEFAULT 0 CHECK (pain_level_after_eva BETWEEN 0 AND 10);
  END IF;
END $$;

-- 3. Índices optimizados para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pt_histories_patient_tenant ON physical_therapy_histories(patient_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_patient_history ON physical_therapy_sessions(patient_id, history_id);
