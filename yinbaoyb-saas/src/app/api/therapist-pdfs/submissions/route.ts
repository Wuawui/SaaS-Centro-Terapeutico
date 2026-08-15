import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface TherapistPdfSubmission {
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
  annotations: any[];
  filled_pdf_data: string;
  status: "completado" | "borrador";
  notes?: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "pdf_submissions.json");

function ensureDirectoryAndFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify([], null, 2), "utf8");
  }
}

function readSubmissions(): TherapistPdfSubmission[] {
  ensureDirectoryAndFile();
  try {
    const raw = fs.readFileSync(SUBMISSIONS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error leyendo submissions:", err);
    return [];
  }
}

function writeSubmissions(submissions: TherapistPdfSubmission[]) {
  ensureDirectoryAndFile();
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), "utf8");
}

export async function GET(req: NextRequest) {
  try {
    const submissions = readSubmissions();
    return NextResponse.json({ success: true, submissions });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const submission = body as TherapistPdfSubmission;

    if (!submission.id) {
      submission.id = "sub_" + Date.now();
    }

    const current = readSubmissions();
    const existingIndex = current.findIndex((s) => s.id === submission.id);

    if (existingIndex >= 0) {
      current[existingIndex] = { ...current[existingIndex], ...submission };
    } else {
      current.unshift(submission);
    }

    writeSubmissions(current);
    return NextResponse.json({ success: true, submission });
  } catch (err: any) {
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

    const current = readSubmissions();
    const filtered = current.filter((s) => s.id !== id);
    writeSubmissions(filtered);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
