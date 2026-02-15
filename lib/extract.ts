import { PDFParse } from "pdf-parse";
import path from "node:path";
import { pathToFileURL } from "node:url";

let isPdfWorkerConfigured = false;

function configurePdfWorker(): void {
  if (isPdfWorkerConfigured) return;

  const workerAbsPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  );

  PDFParse.setWorker(pathToFileURL(workerAbsPath).href);
  isPdfWorkerConfigured = true;
}

function getStandardFontDataUrl(): string {
  const standardFontsDir = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "standard_fonts"
  );
  return `${pathToFileURL(standardFontsDir).href}/`;
}

export async function extractTextFromHtml(html: string): Promise<string> {
  // Remove script and style tags
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Strip all tags, keep text content
  const text = withoutScripts
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, "$1\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  configurePdfWorker();

  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    standardFontDataUrl: getStandardFontDataUrl(),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  try {
    const result = await parser.getText();
    return result.text.replace(/\s+\n/g, "\n").trim();
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromPlainFile(
  buffer: Buffer,
  encoding: BufferEncoding = "utf8"
): Promise<string> {
  return buffer.toString(encoding);
}

