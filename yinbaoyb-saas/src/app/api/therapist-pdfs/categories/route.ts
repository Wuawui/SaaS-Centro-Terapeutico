import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const CATEGORIES_FILE = path.join(DATA_DIR, "pdf_categories.json");

const DEFAULT_CATEGORIES = [
  "Evaluación Inicial",
  "Fisioterapia / Rehabilitación",
  "Consentimientos y Autorizaciones",
  "Seguimiento y Evolución",
  "Terapia de Lenguaje",
  "Terapia Ocupacional",
  "Informes Generales",
];

function ensureStorage(): string[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CATEGORIES_FILE)) {
      fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(DEFAULT_CATEGORIES, null, 2), "utf-8");
      return DEFAULT_CATEGORIES;
    }
    const raw = fs.readFileSync(CATEGORIES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading categories:", e);
    return DEFAULT_CATEGORIES;
  }
}

function saveStorage(categories: string[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(categories, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving categories:", e);
  }
}

// GET: Obtener todas las categorías
export async function GET() {
  const categories = ensureStorage();
  return NextResponse.json({ categories });
}

// POST: Agregar una nueva categoría personalizada
export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Nombre de categoría inválido" }, { status: 400 });
    }
    const cleanName = name.trim();
    const categories = ensureStorage();
    if (!categories.includes(cleanName)) {
      categories.push(cleanName);
      saveStorage(categories);
    }
    return NextResponse.json({ success: true, categories });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: Eliminar una categoría
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "Nombre no proporcionado" }, { status: 400 });
    }
    const categories = ensureStorage();
    const filtered = categories.filter((c) => c !== name);
    saveStorage(filtered);
    return NextResponse.json({ success: true, categories: filtered });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
