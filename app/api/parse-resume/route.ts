import { NextResponse } from "next/server";

type ResumeData = {
  candidateName: string;
  title: string;
  location: string;
  phone: string;
  email: string;
  linkedin: string;
  summary: string;
  highlights: string;
  expertise: string;
  experience: string;
  achievements: string;
  education: string;
  additionalSkills: string;
  alignment: string;
};

const resumeSchema = {
  type: "object",
  properties: {
    candidateName: { type: "string" },
    title: { type: "string" },
    location: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    linkedin: { type: "string" },
    summary: { type: "string" },
    highlights: { type: "string" },
    expertise: { type: "string" },
    experience: { type: "string" },
    achievements: { type: "string" },
    education: { type: "string" },
    additionalSkills: { type: "string" },
    alignment: { type: "string" },
  },
  required: [
    "candidateName",
    "title",
    "location",
    "phone",
    "email",
    "linkedin",
    "summary",
    "highlights",
    "expertise",
    "experience",
    "achievements",
    "education",
    "additionalSkills",
    "alignment",
  ],
};

const emptyResume: ResumeData = {
  candidateName: "",
  title: "",
  location: "",
  phone: "",
  email: "",
  linkedin: "",
  summary: "",
  highlights: "",
  expertise: "",
  experience: "",
  achievements: "",
  education: "",
  additionalSkills: "",
  alignment: "",
};

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

function normalizeResumeData(value: unknown): ResumeData {
  if (!value || typeof value !== "object") return emptyResume;

  const source = value as Partial<Record<keyof ResumeData, unknown>>;
  return Object.fromEntries(
    Object.keys(emptyResume).map((key) => {
      const field = key as keyof ResumeData;
      const rawValue = source[field];
      return [field, typeof rawValue === "string" ? rawValue.trim() : ""];
    }),
  ) as ResumeData;
}

function quotaResponse() {
  return NextResponse.json(
    {
      error: "Gemini free-tier limit reached for today. Please try again after the reset time shown below.",
      resetAt: getNextPacificMidnightIso(),
    },
    { status: 429 },
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key is not configured. Add GEMINI_API_KEY in Vercel environment variables." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "Paste candidate information before using AI auto-fill." }, { status: 400 });
  }

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
            {
              text: `Extract this candidate information into the TBBT resume fields.

Rules:
- Use only details that appear in the candidate text.
- Do not add, invent, embellish, infer, rewrite, or improve facts.
- Put information under the best matching field.
- Preserve wording as much as possible.
- If a field is missing, return an empty string.
- Return JSON only.

Candidate text:
${text}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: resumeSchema,
      },
    }),
  }).catch((error: unknown) => {
    throw new Error(error instanceof Error ? error.message : "Gemini request failed");
  });

  const payload = await response.json().catch(() => null);
  const googleError = payload?.error;
  const googleStatus = typeof googleError?.status === "string" ? googleError.status : "";

  if (response.status === 429 || googleStatus === "RESOURCE_EXHAUSTED") {
    return quotaResponse();
  }

  if (response.status === 401 || response.status === 403) {
    return NextResponse.json(
      { error: "Gemini API key was rejected. Please check GEMINI_API_KEY in Vercel." },
      { status: response.status },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: googleError?.message || "Gemini could not parse this resume right now. Please try again." },
      { status: response.status },
    );
  }

  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== "string") {
    return NextResponse.json({ error: "Gemini returned an empty response. Please try again." }, { status: 502 });
  }

  try {
    return NextResponse.json({ data: normalizeResumeData(JSON.parse(content)) });
  } catch {
    return NextResponse.json({ error: "Gemini returned unreadable data. Please try again." }, { status: 502 });
  }
}
