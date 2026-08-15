import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface TherapistPdfTemplate {
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

const DATA_DIR = path.join(process.cwd(), ".data");
const PDF_DIR = path.join(DATA_DIR, "pdfs");
const TEMPLATES_FILE = path.join(DATA_DIR, "pdf_templates.json");

function ensureDirectoryAndFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMPLATES_FILE)) {
    const starters: TherapistPdfTemplate[] = [
      {
        id: "tpl_eval_integral_sample",
        tenant_id: "00000000-0000-0000-0000-000000000001",
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
        tenant_id: "00000000-0000-0000-0000-000000000001",
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
        tenant_id: "00000000-0000-0000-0000-000000000001",
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
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(starters, null, 2), "utf8");
  }
}

function readTemplates(): TherapistPdfTemplate[] {
  ensureDirectoryAndFile();
  try {
    const raw = fs.readFileSync(TEMPLATES_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error leyendo templates:", err);
    return [];
  }
}

function writeTemplates(templates: TherapistPdfTemplate[]) {
  ensureDirectoryAndFile();
  fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), "utf8");
}

export async function GET(req: NextRequest) {
  try {
    const templates = readTemplates();
    return NextResponse.json({ success: true, templates });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const template = body as TherapistPdfTemplate;

    if (!template.id) {
      template.id = "tpl_" + Date.now();
    }

    ensureDirectoryAndFile();

    // Si trae datos de PDF en base64, guardarlos en el disco físico
    if (template.pdf_data && template.pdf_data.startsWith("data:application/pdf;base64,")) {
      try {
        const base64Data = template.pdf_data.replace(/^data:application\/pdf;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const filePath = path.join(PDF_DIR, `${template.id}.pdf`);
        fs.writeFileSync(filePath, buffer);
        // Almacenar ruta de servicio para no engordar el archivo json
        template.pdf_data = `/api/therapist-pdfs/files?id=${template.id}`;
      } catch (fErr) {
        console.error("Error guardando archivo binario de PDF:", fErr);
      }
    }

    const current = readTemplates();
    const existingIndex = current.findIndex((t) => t.id === template.id);

    if (existingIndex >= 0) {
      current[existingIndex] = { ...current[existingIndex], ...template };
    } else {
      current.unshift(template);
    }

    writeTemplates(current);
    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    console.error("Error en POST templates:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const current = readTemplates();
    const filtered = current.filter((t) => t.id !== id && t.parent_template_id !== id);
    writeTemplates(filtered);

    // Eliminar archivo del disco si existe
    try {
      const filePath = path.join(PDF_DIR, `${id}.pdf`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
