import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PDF_DIR = path.join(process.cwd(), ".data", "pdfs");

function ensurePdfDir() {
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    ensurePdfDir();
    const filePath = path.join(PDF_DIR, `${id}.pdf`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, error: "PDF no encontrado" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${id}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
