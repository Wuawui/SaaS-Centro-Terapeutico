// ============================================================
// PDF Terapeutas — Almacenamiento Global y Sincronizado
// YinbaoYB SaaS
// ============================================================

export interface PdfAnnotation {
  id: string;
  page: number; // 1-indexed
  type: "text" | "checkbox" | "signature";
  x: number; // Porcentaje relativo al ancho (0 a 100%)
  y: number; // Porcentaje relativo al alto (0 a 100%)
  text?: string;
  checked?: boolean;
  signatureDataUrl?: string;
  fontSize?: number;
  color?: string;
  width?: number;
  height?: number;
}

export interface TherapistPdfTemplate {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  category: string;
  pdf_data: string;
  filename: string;
  file_size_bytes: number;
  assigned_to: "all" | "specialty" | "therapists";
  assigned_therapist_ids: string[];
  assigned_specialties: string[];
  created_at: string;
  created_by_name: string;
  parent_template_id?: string | null;
  parent_title?: string | null;
  section_order?: number;
  page_range?: string;
  has_sections?: boolean;
}

export interface TherapistPdfSubmission {
  id: string;
  template_id: string;
  template_title: string;
  tenant_id: string;
  therapist_id: string;
  therapist_name: string;
  therapist_role: string;
  patient_id?: string | null;
  patient_name?: string | null;
  filled_at: string;
  filled_date_formatted: string;
  annotations: PdfAnnotation[];
  filled_pdf_data: string;
  status: "completado" | "borrador";
  notes?: string;
}

const DB_NAME = "CentroYB_PdfDB";
const DB_VERSION = 1;
const STORE_TEMPLATES = "pdf_templates";
const STORE_SUBMISSIONS = "pdf_submissions";

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB no está disponible en este entorno"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error("Error abriendo IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SUBMISSIONS)) {
        db.createObjectStore(STORE_SUBMISSIONS, { keyPath: "id" });
      }
    };
  });
}

function getStarterTemplates(tenantId: string): TherapistPdfTemplate[] {
  return [
    {
      id: "tpl_eval_integral_sample",
      tenant_id: tenantId,
      title: "Ficha de Evaluación Inicial y Diagnóstico",
      description: "Formato clínico estandarizado para evaluación diagnóstica, motivo de consulta y plan de abordaje.",
      category: "Evaluación",
      pdf_data: "",
      filename: "Ficha_Evaluacion_Inicial.pdf",
      file_size_bytes: 45200,
      assigned_to: "all",
      assigned_therapist_ids: [],
      assigned_specialties: ["Terapia Integral", "Fisioterapia", "Lenguaje"],
      created_at: new Date().toISOString(),
      created_by_name: "Administración CentroYB",
    },
    {
      id: "tpl_consent_sample",
      tenant_id: tenantId,
      title: "Consentimiento Informado de Tratamiento Terapéutico",
      description: "Formato de autorización legal y consentimiento firmado por el terapeuta y el representante.",
      category: "Consentimientos",
      pdf_data: "",
      filename: "Consentimiento_Informado_Terapeutico.pdf",
      file_size_bytes: 38400,
      assigned_to: "all",
      assigned_therapist_ids: [],
      assigned_specialties: [],
      created_at: new Date().toISOString(),
      created_by_name: "Administración CentroYB",
    },
    {
      id: "tpl_physio_sample",
      tenant_id: tenantId,
      title: "Plan de Intervención y Seguimiento Kinesiológico",
      description: "Hoja de evolución para terapia física, arcos de movimiento y fuerza muscular.",
      category: "Fisioterapia",
      pdf_data: "",
      filename: "Seguimiento_Fisioterapia.pdf",
      file_size_bytes: 51200,
      assigned_to: "all",
      assigned_therapist_ids: [],
      assigned_specialties: ["Fisioterapia", "Terapia Física / Rehabilitación", "Terapia Integral"],
      created_at: new Date().toISOString(),
      created_by_name: "Administración CentroYB",
    },
  ];
}

// ── Métodos de Plantillas (Templates) ─────────────

export async function getPdfTemplates(tenantId?: string): Promise<TherapistPdfTemplate[]> {
  // 1. Intentar obtener del Servidor Central
  try {
    const res = await fetch("/api/therapist-pdfs/templates", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.templates) && data.templates.length > 0) {
        // Sincronizar en IndexedDB
        try {
          const db = await openIndexedDB();
          const tx = db.transaction(STORE_TEMPLATES, "readwrite");
          const store = tx.objectStore(STORE_TEMPLATES);
          data.templates.forEach((t: TherapistPdfTemplate) => store.put(t));
        } catch (_) {}
        return data.templates;
      }
    }
  } catch (apiErr) {
    console.warn("Fallo fetch API templates, usando IndexedDB:", apiErr);
  }

  // 2. Fallback a IndexedDB local
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_TEMPLATES, "readonly");
      const store = tx.objectStore(STORE_TEMPLATES);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as TherapistPdfTemplate[]) || [];
        if (all.length === 0) {
          const starters = getStarterTemplates(tenantId || "00000000-0000-0000-0000-000000000001");
          resolve(starters);
          return;
        }
        resolve(all);
      };

      req.onerror = () => {
        resolve(getStarterTemplates(tenantId || "00000000-0000-0000-0000-000000000001"));
      };
    });
  } catch (err) {
    console.error("IndexedDB error:", err);
    return getStarterTemplates(tenantId || "00000000-0000-0000-0000-000000000001");
  }
}

export async function savePdfTemplate(template: TherapistPdfTemplate): Promise<void> {
  // 1. Guardar en Servidor Central para que todas las pestañas y navegadores lo vean
  try {
    await fetch("/api/therapist-pdfs/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    });
  } catch (apiErr) {
    console.warn("Fallo guardado en API templates:", apiErr);
  }

  // 2. Guardar en IndexedDB local
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, "readwrite");
      const store = tx.objectStore(STORE_TEMPLATES);
      const req = store.put(template);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Error guardando plantilla en IndexedDB"));
    });
  } catch (err) {
    console.error("Error al guardar plantilla en IndexedDB:", err);
  }
}

export async function deletePdfTemplate(tenantId: string, templateId: string): Promise<void> {
  try {
    await fetch(`/api/therapist-pdfs/templates?id=${encodeURIComponent(templateId)}`, {
      method: "DELETE",
    });
  } catch (apiErr) {
    console.warn("Fallo delete en API templates:", apiErr);
  }

  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, "readwrite");
      const store = tx.objectStore(STORE_TEMPLATES);
      const req = store.delete(templateId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Error eliminando plantilla en IndexedDB"));
    });
  } catch (err) {
    console.error("Error al eliminar plantilla en IndexedDB:", err);
  }
}

// ── Métodos de Documentos Rellenados (Submissions) ─

export async function getPdfSubmissions(tenantId?: string): Promise<TherapistPdfSubmission[]> {
  try {
    const res = await fetch("/api/therapist-pdfs/submissions", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.submissions)) {
        return data.submissions;
      }
    }
  } catch (_) {}

  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SUBMISSIONS, "readonly");
      const store = tx.objectStore(STORE_SUBMISSIONS);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as TherapistPdfSubmission[]) || [];
        resolve(all.sort((a, b) => new Date(b.filled_at).getTime() - new Date(a.filled_at).getTime()));
      };

      req.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.error("IndexedDB error:", err);
    return [];
  }
}

export async function savePdfSubmission(submission: TherapistPdfSubmission): Promise<void> {
  try {
    await fetch("/api/therapist-pdfs/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
  } catch (_) {}

  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SUBMISSIONS, "readwrite");
      const store = tx.objectStore(STORE_SUBMISSIONS);
      const req = store.put(submission);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Error guardando documento en IndexedDB"));
    });
  } catch (err) {
    console.error("Error al guardar submission en IndexedDB:", err);
  }
}

export async function deletePdfSubmission(tenantId: string, submissionId: string): Promise<void> {
  try {
    await fetch(`/api/therapist-pdfs/submissions?id=${encodeURIComponent(submissionId)}`, {
      method: "DELETE",
    });
  } catch (_) {}

  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SUBMISSIONS, "readwrite");
      const store = tx.objectStore(STORE_SUBMISSIONS);
      const req = store.delete(submissionId);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Error eliminando documento en IndexedDB"));
    });
  } catch (err) {
    console.error("Error al eliminar documento en IndexedDB:", err);
  }
}

// ── Helper para comparar especialidades clínicas ──

export function isSpecialtyMatch(therapistSpec: string, assignedSpec: string): boolean {
  if (!therapistSpec || !assignedSpec) return false;
  const t = therapistSpec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const a = assignedSpec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (t === a || t.includes(a) || a.includes(t)) return true;

  // Fisioterapia / Terapia Física / Kinesiología / Rehabilitación
  const isPhysioT = t.includes("fisio") || t.includes("fisica") || t.includes("kinesio") || t.includes("rehab");
  const isPhysioA = a.includes("fisio") || a.includes("fisica") || a.includes("kinesio") || a.includes("rehab");
  if (isPhysioT && isPhysioA) return true;

  // Terapia Integral / Estimulación / Atención Temprana
  const isIntegralT = t.includes("integral") || t.includes("temprana") || t.includes("estimulacion") || t.includes("general") || t.includes("clinica");
  const isIntegralA = a.includes("integral") || a.includes("temprana") || a.includes("estimulacion") || a.includes("general") || a.includes("clinica");
  if (isIntegralT && isIntegralA) return true;

  // Terapia de Lenguaje / Fonoaudiología
  const isLangT = t.includes("lenguaje") || t.includes("fono") || t.includes("habla");
  const isLangA = a.includes("lenguaje") || a.includes("fono") || a.includes("habla");
  if (isLangT && isLangA) return true;

  // Terapia Ocupacional
  const isOcupT = t.includes("ocupacion");
  const isOcupA = a.includes("ocupacion");
  if (isOcupT && isOcupA) return true;

  // Psicología / Conductual / Psicopedagogía
  const isPsicoT = t.includes("psico") || t.includes("conduct") || t.includes("pedagog");
  const isPsicoA = a.includes("psico") || a.includes("conduct") || a.includes("pedagog");
  if (isPsicoT && isPsicoA) return true;

  return false;
}

// ── Helper para filtrar plantillas accesibles por un terapeuta ─

export function getAssignedTemplatesForTherapist(
  templates: TherapistPdfTemplate[],
  therapistId: string,
  therapistSpecialty?: string,
  therapistRole?: string,
  therapistName?: string
): TherapistPdfTemplate[] {
  // Roles administrativos tienen acceso completo
  if (therapistRole && ["super_admin", "director", "coordinador", "admin"].includes(therapistRole)) {
    return templates;
  }

  return templates.filter((tpl) => {
    // 1. Asignado a todos
    if (!tpl.assigned_to || tpl.assigned_to === "all") return true;

    // 2. Asignado a terapeutas específicos por ID o Nombre
    if (tpl.assigned_to === "therapists") {
      if (Array.isArray(tpl.assigned_therapist_ids)) {
        if (!therapistId && !therapistName) return true;
        if (therapistId && tpl.assigned_therapist_ids.includes(therapistId)) return true;

        if (therapistName) {
          const normT = therapistName.toLowerCase().trim();
          const matchName = tpl.assigned_therapist_ids.some((id) =>
            normT.includes(id.toLowerCase()) || id.toLowerCase().includes(normT)
          );
          if (matchName) return true;
        }

        if (tpl.assigned_therapist_ids.length === 0) return true;
      } else {
        return true;
      }
      return false;
    }

    // 3. Asignado por especialidad
    if (tpl.assigned_to === "specialty") {
      if (!tpl.assigned_specialties || tpl.assigned_specialties.length === 0) return true;
      
      const effectiveSpec =
        therapistSpecialty ||
        (therapistRole === "fisioterapeuta" ? "Fisioterapia" : "Terapia Integral");
      if (tpl.assigned_specialties.some((s) => isSpecialtyMatch(effectiveSpec, s))) {
        return true;
      }
      return false;
    }

    return false;
  });
}
