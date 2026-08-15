// ============================================================
// Utilidades de PDF — Renderizado, fusión de texto, marcas y firmas
// YinbaoYB SaaS
// ============================================================

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import jsPDF from "jspdf";
import type { PdfAnnotation } from "./pdf-storage";

/**
 * Convierte un color HEX (ej. #4F46E5) a formato rgb(0..1, 0..1, 0..1) para pdf-lib
 */
function hexToRgbPdf(hex: string) {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(clean.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(clean.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
}

/**
 * Genera un PDF clínico base con membrete si se usa una plantilla de inicio
 */
export function generateDefaultSamplePdf(title: string, category: string): string {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header con barra de gradiente
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(0, 0, pageWidth, 24, "F");

  // Título del Centro
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("CENTRO TERAPÉUTICO YB", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Gestión Clínica y Evaluación Integral", 14, 18);

  // Categoría badge
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(pageWidth - 55, 6, 45, 12, 2, 2, "F");
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(category.toUpperCase(), pageWidth - 32, 14, { align: "center" });

  // Título del Formulario
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 38);

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(14, 43, pageWidth - 14, 43);

  // Sección 1: Datos Generales
  doc.setFillColor(249, 250, 251);
  doc.rect(14, 48, pageWidth - 28, 30, "F");
  doc.rect(14, 48, pageWidth - 28, 30, "S");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55, 65, 81);
  doc.text("I. DATOS DEL PACIENTE Y ATENCIÓN", 18, 55);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Nombre del Paciente: _____________________________________   Fecha: ____ / ____ / ________", 18, 64);
  doc.text("Edad / Documento: _______________________________________   Terapeuta: __________________", 18, 72);

  // Sección 2: Desarrollo Clínico / Evaluación
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55, 65, 81);
  doc.text("II. REGISTRO CLÍNICO Y OBSERVACIONES TERAPÉUTICAS", 14, 88);

  // Cajas para escribir
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(75, 85, 99);
  doc.text("1. Motivo de Consulta y Antecedentes Relevantes:", 14, 96);
  doc.rect(14, 100, pageWidth - 28, 40);

  doc.text("2. Objetivos Trabajados y Desempeño:", 14, 148);
  doc.rect(14, 152, pageWidth - 28, 45);

  doc.text("3. Indicaciones para el Hogar y Plan de Continuidad:", 14, 205);
  doc.rect(14, 209, pageWidth - 28, 40);

  // Casillas de verificación de estado
  doc.text("Estado de la Sesión / Evaluación:", 14, 257);
  doc.setFont("helvetica", "normal");
  doc.rect(14, 260, 4, 4);
  doc.text("Completada", 21, 263.5);

  doc.rect(60, 260, 4, 4);
  doc.text("Requiere Refuerzo", 67, 263.5);

  doc.rect(120, 260, 4, 4);
  doc.text("En Progreso", 127, 263.5);

  // Sección de Firma
  doc.line(pageWidth - 75, 280, pageWidth - 15, 280);
  doc.setFontSize(8);
  doc.text("Firma y Sello del Terapeuta", pageWidth - 45, 285, { align: "center" });

  return doc.output("datauristring");
}

/**
 * Fusión de todas las anotaciones (textos, checks, firmas) sobre el PDF original
 * retornando una cadena Data URI lista para previsualizar, guardar o descargar.
 */
export async function mergeAnnotationsIntoPdf(
  originalPdfBase64: string,
  annotations: PdfAnnotation[],
  metadata?: {
    therapistName?: string;
    therapistRole?: string;
    patientName?: string;
    dateFormatted?: string;
  }
): Promise<string> {
  // Limpiar prefijo data uri si existe
  const base64Data = originalPdfBase64.includes(",")
    ? originalPdfBase64.split(",")[1]
    : originalPdfBase64;

  const pdfBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const pageIndex = (ann.page || 1) - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Convertir coordenadas relativas (%) a puntos de PDF (0,0 está abajo a la izquierda en PDF)
    const pdfX = (ann.x / 100) * width;
    const pdfY = height - (ann.y / 100) * height;

    if (ann.type === "text" && ann.text) {
      const fontSize = ann.fontSize || 11;
      const fontColor = hexToRgbPdf(ann.color || "#111827");

      // Ajustar línea por línea si contiene saltos de línea
      const lines = ann.text.split("\n");
      lines.forEach((line, lineIdx) => {
        page.drawText(line, {
          x: pdfX,
          y: pdfY - (lineIdx * (fontSize + 3)) - (fontSize * 0.8),
          size: fontSize,
          font: helveticaFont,
          color: fontColor,
        });
      });
    } else if (ann.type === "checkbox") {
      const boxSize = 12;
      const centerY = pdfY - boxSize;
      
      // Dibujar caja o check
      if (ann.checked) {
        page.drawText("X", {
          x: pdfX + 2,
          y: centerY + 1,
          size: 11,
          font: helveticaBold,
          color: rgb(0.1, 0.5, 0.2),
        });
      }
    } else if (ann.type === "signature" && ann.signatureDataUrl) {
      try {
        const sigBase64 = ann.signatureDataUrl.includes(",")
          ? ann.signatureDataUrl.split(",")[1]
          : ann.signatureDataUrl;
        const sigBytes = Uint8Array.from(atob(sigBase64), (c) => c.charCodeAt(0));
        const sigImage = await pdfDoc.embedPng(sigBytes);

        const sigWidth = ann.width || 120;
        const sigHeight = ann.height || 50;

        page.drawImage(sigImage, {
          x: pdfX,
          y: pdfY - sigHeight,
          width: sigWidth,
          height: sigHeight,
        });
      } catch (err) {
        console.error("Error al incrustar firma en PDF:", err);
      }
    }
  }

  // Estampar pie de página con trazabilidad y firma digital
  if (metadata && pages.length > 0) {
    const lastPage = pages[pages.length - 1];
    const { width } = lastPage.getSize();
    const stampText = `[Registro Digital] Rellenado por: ${metadata.therapistName || "Terapeuta"} | Paciente: ${metadata.patientName || "N/A"} | Fecha: ${metadata.dateFormatted || new Date().toLocaleString()} | Centro YB`;

    lastPage.drawText(stampText, {
      x: 20,
      y: 10,
      size: 7,
      font: helveticaFont,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  const savedBytes = await pdfDoc.save();
  let binary = "";
  const len = savedBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(savedBytes[i]);
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

async function getPdfBytes(pdfInput: string): Promise<Uint8Array> {
  if (pdfInput.startsWith("http://") || pdfInput.startsWith("https://") || pdfInput.startsWith("/")) {
    const res = await fetch(pdfInput);
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  }
  const base64Data = pdfInput.includes(",") ? pdfInput.split(",")[1] : pdfInput;
  return Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
}

/**
 * Obtiene la cantidad total de páginas de un documento PDF base64 o URL
 */
export async function getPdfPageCount(pdfInput: string): Promise<number> {
  try {
    const pdfBytes = await getPdfBytes(pdfInput);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (err) {
    console.error("Error obteniendo conteo de páginas:", err);
    return 1;
  }
}

/**
 * Extrae páginas específicas de un PDF original y crea un nuevo archivo PDF independiente
 * @param originalPdfInput PDF base64 o URL original
 * @param pageNumbers Números de página (1-indexed, ej. [1, 2, 3])
 */
export async function extractPdfPages(
  originalPdfInput: string,
  pageNumbers: number[]
): Promise<string> {
  const pdfBytes = await getPdfBytes(originalPdfInput);
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  const totalPages = srcDoc.getPageCount();
  // Convertir de 1-indexed a 0-indexed y filtrar rangos válidos
  const indicesToCopy = pageNumbers
    .map((p) => p - 1)
    .filter((idx) => idx >= 0 && idx < totalPages);

  if (indicesToCopy.length === 0) {
    throw new Error("No se seleccionaron páginas válidas para extraer.");
  }

  const copiedPages = await newDoc.copyPages(srcDoc, indicesToCopy);
  copiedPages.forEach((page) => newDoc.addPage(page));

  const newPdfBytes = await newDoc.save();
  let binary = "";
  const len = newPdfBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(newPdfBytes[i]);
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}
