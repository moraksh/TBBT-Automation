import { NextResponse } from "next/server";
import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";

export const runtime = "nodejs";

const maxFileSize = 8 * 1024 * 1024;

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a CV file first." }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return NextResponse.json({ error: "CV file is too large. Upload a file under 8 MB." }, { status: 413 });
  }

  const extension = fileExtension(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  try {
    if (file.type === "application/pdf" || extension === "pdf") {
      const result = await pdf(buffer);
      text = result.text || "";
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      extension === "docx"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || "";
    } else if (file.type.startsWith("text/") || extension === "txt" || extension === "text") {
      text = buffer.toString("utf8");
    } else if (extension === "doc") {
      return NextResponse.json(
        { error: "Old .doc files are not supported yet. Save it as DOCX or PDF and upload again." },
        { status: 415 },
      );
    } else {
      return NextResponse.json({ error: "Upload a PDF, DOCX, or text CV." }, { status: 415 });
    }
  } catch {
    return NextResponse.json({ error: "Could not extract text from this CV. Try another PDF or DOCX file." }, { status: 422 });
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    return NextResponse.json(
      { error: "This PDF looks scanned or image-based. Please upload a text-based PDF/DOCX or copy-paste the CV text." },
      { status: 422 },
    );
  }

  return NextResponse.json({ text: normalized });
}
