import { NextResponse } from "next/server";
import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { createWorker } from "tesseract.js";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function getPacificParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function getNextPacificMidnightIso() {
  const pacificNow = getPacificParts(new Date());
  const year = Number(pacificNow.year);
  const month = Number(pacificNow.month);
  const day = Number(pacificNow.day);
  const candidates = [7, 8].map((utcHour) => new Date(Date.UTC(year, month - 1, day + 1, utcHour)));
  const reset = candidates.find((candidate) => {
    const parts = getPacificParts(candidate);
    return Number(parts.hour) === 0 && Number(parts.minute) === 0;
  });

  return (reset || candidates[1]).toISOString();
}

function wordCount(value: string) {
  return (value.match(/[A-Za-z0-9]+/g) || []).length;
}

function isUsefulResumeText(value: string) {
  const normalized = normalizeText(value);
  return normalized.length > 250 && wordCount(normalized) > 35;
}

function mimeTypeFor(file: File, extension: string) {
  if (file.type) return file.type;
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

function isImageFile(file: File, extension: string) {
  return file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(extension);
}

async function extractWithTesseract(buffer: Buffer) {
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(buffer);
    return {
      text: result.data.text || "",
      confidence: typeof result.data.confidence === "number" ? result.data.confidence : 0,
    };
  } finally {
    await worker.terminate();
  }
}

async function extractWithGemini({ buffer, file, extension, localText }: { buffer: Buffer; file: File; extension: string; localText?: string }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_OCR_MODEL || "gemini-3.6-flash";

  if (!apiKey) return { text: "", error: "Gemini API key is not configured. Add GEMINI_API_KEY in Vercel environment variables." };

  const prompt = localText
    ? `Extract the complete CV/resume text from this document image. Use the local OCR text below only as backup, fix OCR mistakes from the visual document, preserve sections such as Summary, Work Experience, Education, Certifications, Expertise and Accomplishments, and return one clean de-duplicated plain text CV. Do not add facts.\n\nLocal OCR text:\n${localText}`
    : "Extract the complete CV/resume text from this file. Preserve sections such as Summary, Work Experience, Education, Certifications, Expertise and Accomplishments. Return clean plain text only. Do not add facts.";

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeTypeFor(file, extension),
                data: buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);
  const googleError = payload?.error;
  const googleStatus = typeof googleError?.status === "string" ? googleError.status : "";

  if (response.status === 429 || googleStatus === "RESOURCE_EXHAUSTED") {
    return {
      text: "",
      error: "Gemini free-tier limit reached for OCR fallback. Please try again after the reset time shown below.",
      resetAt: getNextPacificMidnightIso(),
    };
  }

  if (!response.ok) return { text: "", error: googleError?.message || "Gemini OCR fallback could not read this CV." };

  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { text: typeof content === "string" ? content : "" };
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
  let localOcrText = "";

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
    } else if (isImageFile(file, extension)) {
      const ocr = await extractWithTesseract(buffer);
      localOcrText = ocr.text;
      text = ocr.confidence >= 70 && isUsefulResumeText(ocr.text) ? ocr.text : "";
    } else if (extension === "doc") {
      return NextResponse.json(
        { error: "Old .doc files are not supported yet. Save it as DOCX or PDF and upload again." },
        { status: 415 },
      );
    } else {
      return NextResponse.json({ error: "Upload a PDF, DOCX, text, or image CV." }, { status: 415 });
    }
  } catch {
    return NextResponse.json({ error: "Could not extract text from this CV. Try another PDF or DOCX file." }, { status: 422 });
  }

  let normalized = normalizeText(text);
  if (!isUsefulResumeText(normalized) && (extension === "pdf" || isImageFile(file, extension))) {
    const gemini = await extractWithGemini({ buffer, file, extension, localText: normalizeText(localOcrText || normalized) });
    if (gemini.resetAt) {
      return NextResponse.json({ error: gemini.error, resetAt: gemini.resetAt }, { status: 429 });
    }
    if (gemini.error && !normalized) {
      return NextResponse.json({ error: gemini.error }, { status: 422 });
    }
    normalized = normalizeText(gemini.text || normalized);
  }

  if (!normalized) {
    return NextResponse.json(
      { error: "This CV looks scanned or image-based, and OCR could not read enough text. Try a clearer PDF/image or copy-paste the CV text." },
      { status: 422 },
    );
  }

  return NextResponse.json({ text: normalized });
}
