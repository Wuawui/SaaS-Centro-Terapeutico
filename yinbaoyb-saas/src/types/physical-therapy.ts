// ============================================================
// TIPOS DE DATOS: TERAPIA FÍSICA Y REHABILITACIÓN COMPLETA
// Basados en el Formulario Fisioterapéutico de 35 Páginas (FISIOJOY)
// ============================================================

export type CenterType = "pediatric" | "physical_therapy" | "hybrid";

export interface IdentificationData {
  no_expediente?: string;
  cama_cubiculo?: string;
  fecha?: string;
  hora?: string;
  escolaridad?: string;
  ocupacion?: string;
  domicilio?: string;
  telefono?: string;
  tel_emergencia?: string;
  tipo_sangre?: string;
  religion?: string;
  nacionalidad?: string;
  estado_civil?: string;
  lugar_radicacion?: string;
  medico_tratante?: string;
  remision?: string;
  
  // Paciente Deportivo
  es_paciente_deportivo?: boolean;
  deporte_disciplina?: string;
  deporte_categoria?: string;
  deporte_alto_rendimiento?: "Si" | "No";
  deporte_entrenador?: string;
  deporte_competitivo?: "Si" | "No";
  deporte_club?: string;
  
  // Resumen del caso
  motivo_consulta?: string;
  diagnostico_medico?: string;
  mecanismo_lesion?: string;
  tratamientos_previos?: string;
}

export interface PhysicalMeasures {
  peso?: string;
  talla?: string;
  estatura?: string;
  imc?: string;
  temperatura?: string;
  f_cardiaca?: string;
  f_respiratoria?: string;
  tension_arterial?: string;
}

export interface MedicalHistory {
  heredofamiliares?: {
    diabetes?: boolean;
    neurologica?: boolean;
    has?: boolean;
    neoplasias?: boolean;
    cardiopatias?: boolean;
    reumaticas?: boolean;
    respiratorias?: boolean;
    geneticas?: boolean;
    endocrinologicas?: boolean;
    especifique?: string;
  };
  patologicos?: {
    diabetes?: boolean;
    alergias?: boolean;
    accidentes?: boolean;
    neoplasias?: boolean;
    cardiopatias?: boolean;
    cirugias?: boolean;
    respiratorias?: boolean;
    dolor_cabeza?: boolean;
    malformaciones?: boolean;
    neurologicas?: boolean;
    convulsiones?: boolean;
    traumatismos?: boolean;
    infecciosas?: boolean;
    reumaticas?: boolean;
    hospitalizaciones?: boolean;
    especifique?: string;
  };
  no_patologicos?: {
    toxicomanias?: boolean;
    inmunizaciones?: boolean;
    automedicacion?: boolean;
    trastornos_sueno?: boolean;
    alimentacion?: string;
    habitacion?: string;
    habitos_higienicos?: string;
    actividad_fisica?: string;
    ocupacion_ambiente?: string;
    ocio?: string;
  };
  gineco_obstetricos?: {
    menarca?: string;
    dismenorreas?: boolean;
    gesta_actual?: boolean;
    num_gestas?: number;
    num_partos?: number;
    cesareas?: number;
    abortos?: number;
    nacidos_vivos?: number;
    menopausia?: boolean;
  };
  perinatales_pediatrico?: {
    num_embarazo?: number;
    embarazo_multiple?: boolean;
    alimentacion_embarazo?: string;
    medicamentos?: string;
    control_perinatal?: boolean;
    periodo_intrauterino?: "inmaduro" | "pretermino" | "termino" | "postermino";
    parto_cesarea?: string;
    problemas_parto?: string;
    incubadora?: boolean;
    peso_nacimiento?: string;
    apgar_score?: string;
  };
}

export interface ExplorationGeneral {
  marcha_tipo?: "Libre" | "Claudicante" | "Con ayuda" | "Espástica" | "Atáxica" | "Otra";
  marcha_especifique?: string;
  movilidad_tipo?: "Independiente" | "Dependiente" | "Silla de ruedas" | "Andadera" | "Muletas o bastón" | "Otra";
  facies_tipo?: "Normal" | "Dolorosa" | "Ansiosa" | "Pálida" | "Cianótica" | "Robicunada" | "Ictericia" | "Lúpica" | "Hipertiroidea" | "Hipotiroidea" | "Otra";
  actitud_tipo?: "Neutra" | "Colaboradora" | "Pesimista" | "Agresiva" | "Otra";
  
  // EVA Pain Scale (0-10)
  eva_dolor?: number; // 0 a 10
  eva_segmento?: string;
  semiologia_circunstancias?: string;
  semiologia_tipo?: string;
  semiologia_antiguedad?: string;
  semiologia_localizacion?: string;
  semiologia_irradiacion?: string;
  semiologia_aumento?: string;
  semiologia_atenuantes?: string;
  semiologia_duracion?: string;
  semiologia_actividades_dificiles?: string;
}

export interface PostureAndGait {
  biotipo?: "Ectomorfo" | "Mesomorfo" | "Endomorfo";
  postura_tipo?: "Ideal" | "Cifolordótica" | "Espalda arqueada" | "Militar" | "Aplanada";
  vista_anterior_observaciones?: string;
  vista_lateral_observaciones?: string;
  vista_posterior_observaciones?: string;
  
  gait_apoyo?: {
    contacto_inicial?: boolean;
    respuesta_carga?: boolean;
    apoyo_medio?: boolean;
    especifique?: string;
  };
  gait_balanceo?: {
    pre_balanceo?: boolean;
    balanceo_inicial?: boolean;
    balanceo_medio?: boolean;
    balanceo_final?: boolean;
  };
  gait_cuantitativo?: {
    longitud_paso_der?: string;
    longitud_paso_izq?: string;
    longitud_zancada_der?: string;
    longitud_zancada_izq?: string;
    anchura_paso?: string;
    cadencia_pasos_min?: string;
    velocidad_m_seg?: string;
  };
}

export interface ArticularJointEval {
  segment?: string; // ej. Hombro, Codo, Muñeca, Cadera, Rodilla, Tobillo
  movement?: string; // ej. Flexión, Extensión, Abducción
  normal_range?: string; // ej. 0-150°
  left_active?: string;
  left_passive?: string;
  right_active?: string;
  right_passive?: string;
}

export interface DanielsMuscleEval {
  muscle_group?: string; // ej. Flexores de codo, Extensores de rodilla
  left_grade?: number; // Escala 0 a 5
  right_grade?: number; // Escala 0 a 5
  observations?: string;
}

export interface NeurologicalEval {
  glasgow_ocular?: number; // 1-4
  glasgow_verbal?: number; // 1-5
  glasgow_motor?: number; // 1-6
  glasgow_total?: number; // 3-15
  
  ashworth_grade?: "0" | "1" | "+1" | "2" | "3" | "4"; // Hipertonía
  campbell_grade?: "Normal (0)" | "Hipotonía leve (-1)" | "Hipotonía moderada (-2)" | "Hipotonía severa (-3)";
  
  asia_impairment_scale?: "A" | "B" | "C" | "D" | "E";
  asia_notes?: string;
  
  pares_craneales_observaciones?: string;
}

export interface TreatmentPlanCIF {
  padecimiento_actual?: string;
  diagnostico_cif?: string; // Clasificación Internacional del Funcionamiento
  pronostico?: string;
  objetivos_generales?: string;
  objetivos_especificos?: string;
  
  // Prescripción
  total_sesiones_rec?: number;
  sesiones_semanales_rec?: number;
  duracion_sesion_min?: number;
  tecnicas_aplicadas?: string; // Electroterapia, Terapia manual, etc.
}

export interface PhysicalTherapyHistory {
  id?: string;
  tenant_id?: string;
  patient_id: string;
  therapist_id?: string;
  identification_data: IdentificationData;
  physical_measures: PhysicalMeasures;
  medical_history: MedicalHistory;
  exploration_general: ExplorationGeneral;
  posture_gait_analysis: PostureAndGait;
  articular_evaluation: ArticularJointEval[];
  muscular_evaluation: DanielsMuscleEval[];
  neurological_evaluation: NeurologicalEval;
  complementary_tests?: Record<string, any>;
  treatment_plan: TreatmentPlanCIF;
  created_at?: string;
  updated_at?: string;
}

export interface PhysicalTherapySession {
  id?: string;
  tenant_id?: string;
  history_id: string;
  patient_id: string;
  therapist_id?: string;
  session_number: number;
  pain_level_before_eva?: number;
  pain_level_after_eva?: number;
  treatment_applied: string;
  observations?: string;
  created_at?: string;
}
