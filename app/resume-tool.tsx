"use client";

import { ChangeEvent, ReactNode, useMemo, useRef, useState } from "react";

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

const samplePrompt = `Paste candidate notes here. Example:
Name: Priya Sharma
Current Title: Senior Talent Acquisition Manager
Location: Dubai, UAE
Phone: +971 50 000 0000
Email: priya@example.com
LinkedIn: linkedin.com/in/priya

Executive Summary:
Senior recruitment leader with experience across technology, retail, and professional services.

Career Highlights:
- Built regional hiring process for 200+ annual hires
- Reduced time-to-shortlist by 45%

Core Expertise:
Executive Search, Stakeholder Management, ATS, Screening, Market Mapping

Professional Experience:
Senior Talent Acquisition Manager, Example Group, 2021 - Present
- Led end-to-end recruitment for leadership and specialist roles
- Partnered with business heads to define role scorecards

Achievements:
- Improved candidate response rate by 30%

Education:
MBA, Human Resources

Technology / Additional Skills / Language:
LinkedIn Recruiter, Greenhouse, Workday, English, Hindi

Alignment with the role applying:
Strong match for recruitment automation, client communication, and shortlist delivery.`;

const sectionMap: Array<[keyof ResumeData, string[]]> = [
  ["summary", ["executive summary", "summary"]],
  ["highlights", ["career highlights", "highlights"]],
  ["expertise", ["core expertise", "expertise"]],
  ["experience", ["professional experience", "experience"]],
  ["achievements", ["achievements", "achievement"]],
  ["education", ["education", "certification", "qualifications"]],
  ["additionalSkills", ["technology", "additional skills", "language", "skills"]],
  ["alignment", ["alignment with the role", "alignment"]],
];

function cleanValue(value: string) {
  return value.replace(/^[\s:|-]+/, "").trim();
}

function findLineValue(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = line.match(new RegExp(`^\\s*${escaped}\\s*[:|-]\\s*(.+)$`, "i"));
      if (match?.[1]) return cleanValue(match[1]);
    }
  }
  return "";
}

function extractSection(text: string, labels: string[]) {
  const lines = text.split(/\r?\n/);
  const labelPatterns = sectionMap.flatMap(([, aliases]) => aliases);
  let start = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const normalized = lines[i].trim().replace(/:$/, "").toLowerCase();
    const isSectionHeader = labels.some(
      (label) =>
        normalized === label ||
        normalized.startsWith(`${label}:`) ||
        normalized.startsWith(`${label} /`) ||
        normalized.startsWith(`${label} `),
    );
    if (isSectionHeader) {
      start = i + 1;
      break;
    }
  }

  if (start < 0) return "";

  const result: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const normalized = lines[i].trim().replace(/:$/, "").toLowerCase();
    const isNextSection = labelPatterns.some(
      (label) =>
        normalized === label ||
        normalized.startsWith(`${label}:`) ||
        normalized.startsWith(`${label} /`) ||
        normalized.startsWith(`${label} `),
    );
    if (isNextSection) break;
    result.push(lines[i]);
  }

  return result.join("\n").trim();
}

function inferName(text: string) {
  const explicit = findLineValue(text, ["name", "candidate name"]);
  if (explicit) return explicit;

  const firstUsefulLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.includes("@") && !line.toLowerCase().startsWith("summary"));

  return firstUsefulLine || "";
}

function parseCandidateText(text: string): ResumeData {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,5}\d{2,4}/)?.[0] || "";
  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,]+/i)?.[0] || "";

  const parsed = { ...emptyResume };
  parsed.candidateName = inferName(text);
  parsed.title = findLineValue(text, ["current title", "title", "position", "role"]);
  parsed.location = findLineValue(text, ["location", "geography"]);
  parsed.phone = findLineValue(text, ["phone", "mobile", "m"]) || phone;
  parsed.email = findLineValue(text, ["email"]) || email;
  parsed.linkedin = findLineValue(text, ["linkedin"]) || linkedin;

  for (const [key, labels] of sectionMap) {
    parsed[key] = extractSection(text, labels);
  }

  if (!parsed.summary) {
    parsed.summary = text
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 35)
      .slice(0, 2)
      .join("\n");
  }

  return parsed;
}

function toList(value: string, splitCommas = false) {
  const splitter = splitCommas ? /\r?\n|;|,/ : /\r?\n|;/;
  return value
    .split(splitter)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function TextField({
  label,
  field,
  data,
  setData,
  rows = 2,
}: {
  label: string;
  field: keyof ResumeData;
  data: ResumeData;
  setData: (data: ResumeData) => void;
  rows?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={data[field]}
        onChange={(event) => setData({ ...data, [field]: event.target.value })}
      />
    </label>
  );
}

export function ResumeTool() {
  const [rawText, setRawText] = useState("");
  const [data, setData] = useState<ResumeData>(emptyResume);
  const [layout, setLayout] = useState<"full" | "blind">("full");
  const [photo, setPhoto] = useState("");
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiError, setAiError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBlind = layout === "blind";
  const expertise = useMemo(() => toList(data.expertise, true), [data.expertise]);
  const highlights = useMemo(() => toList(data.highlights), [data.highlights]);
  const experience = useMemo(() => toList(data.experience), [data.experience]);
  const achievements = useMemo(() => toList(data.achievements), [data.achievements]);
  const education = useMemo(() => toList(data.education), [data.education]);

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function formatResetTime(resetAt: string) {
    const date = new Date(resetAt);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZoneName: "short",
    }).format(date);
  }

  async function handleAiParse() {
    setAiError("");

    if (!rawText.trim()) {
      setAiError("Paste candidate information before using AI auto-fill.");
      return;
    }

    setIsAiParsing(true);
    try {
      const response = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const payload = (await response.json()) as { data?: ResumeData; error?: string; resetAt?: string };

      if (!response.ok || !payload.data) {
        const resetTime = payload.resetAt ? ` Try again after ${formatResetTime(payload.resetAt)}.` : "";
        setAiError(`${payload.error || "AI auto-fill failed. Please try again."}${resetTime}`);
        return;
      }

      setData(payload.data);
    } catch {
      setAiError("AI auto-fill could not connect right now. Please try again or use basic auto-fill.");
    } finally {
      setIsAiParsing(false);
    }
  }

  return (
    <section className="resume-tool" id="tools" aria-label="Resume formatter tool">
      <div className="tool-heading">
        <h1>Resume Formatter</h1>
        <p>Paste candidate information, populate the template, proofread, then export a client-ready PDF.</p>
      </div>

      <div className="tool-workspace">
        <div className="input-panel">
          <label className="field">
            <span>Candidate information</span>
            <textarea
              className="raw-input"
              rows={14}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={samplePrompt}
            />
          </label>

          <div className="button-row">
            <button type="button" className="primary-button" onClick={handleAiParse} disabled={isAiParsing}>
              {isAiParsing ? "Reading with AI..." : "AI auto-fill"}
            </button>
            <button type="button" className="ghost-button" onClick={() => setData(parseCandidateText(rawText))}>
              Basic auto-fill
            </button>
            <button type="button" className="ghost-button" onClick={() => setRawText(samplePrompt)}>
              Load example
            </button>
          </div>
          {aiError ? <p className="tool-error">{aiError}</p> : null}

          <div className="layout-toggle" aria-label="Resume layout">
            <button type="button" className={layout === "full" ? "active" : ""} onClick={() => setLayout("full")}>
              Full profile
            </button>
            <button type="button" className={layout === "blind" ? "active" : ""} onClick={() => setLayout("blind")}>
              Blind profile
            </button>
          </div>

          <input ref={fileInputRef} className="hidden-file" type="file" accept="image/*" onChange={handlePhoto} />
          <button type="button" className="ghost-button full-width" onClick={() => fileInputRef.current?.click()}>
            Add candidate photo
          </button>

          <div className="field-grid">
            <TextField label="Candidate Name" field="candidateName" data={data} setData={setData} />
            <TextField label="Current Title / Position" field="title" data={data} setData={setData} />
            <TextField label="Location" field="location" data={data} setData={setData} />
            <TextField label="Phone" field="phone" data={data} setData={setData} />
            <TextField label="Email" field="email" data={data} setData={setData} />
            <TextField label="LinkedIn" field="linkedin" data={data} setData={setData} />
          </div>

          <TextField label="Executive Summary" field="summary" data={data} setData={setData} rows={4} />
          <TextField label="Career Highlights" field="highlights" data={data} setData={setData} rows={4} />
          <TextField label="Core Expertise" field="expertise" data={data} setData={setData} rows={3} />
          <TextField label="Professional Experience" field="experience" data={data} setData={setData} rows={5} />
          <TextField label="Achievements" field="achievements" data={data} setData={setData} rows={3} />
          <TextField label="Education / Certification / Qualifications" field="education" data={data} setData={setData} rows={3} />
          <TextField label="Technology / Additional Skills / Language" field="additionalSkills" data={data} setData={setData} rows={3} />
          <TextField label="Alignment with the role applying" field="alignment" data={data} setData={setData} rows={3} />
        </div>

        <div className="preview-panel">
          <div className="preview-toolbar">
            <div>
              <strong>Proofing canvas</strong>
              <span>{isBlind ? "Blind candidate layout" : "Full candidate layout"}</span>
            </div>
            <button type="button" className="primary-button" onClick={() => window.print()}>
              Generate PDF
            </button>
          </div>

          <div className="resume-document" aria-label="Resume preview">
          <article className="resume-page" aria-label="Resume preview page 1">
            <header className="resume-header">
              <img className="resume-logo" src="/tbbt-logo.png" alt="The BlackBox Talent" />
            </header>

            <section className="candidate-intro">
              <div>
                <h3>{isBlind ? "Confidential Candidate Profile" : data.candidateName || "Candidate Name"}</h3>
                <p>{data.title || "Current Title or Position Applying | Certificate | Geography Covered"}</p>
                {!isBlind ? (
                  <p className="contact-line">
                    {[data.location, data.phone ? `M: ${data.phone}` : "", data.email ? `Email: ${data.email}` : "", data.linkedin].filter(Boolean).join(" | ") ||
                      "Location | M: (+971) _____________ | Email: _______________ | LinkedIn"}
                  </p>
                ) : (
                  <p className="contact-line">Identity hidden for client review</p>
                )}
              </div>
              {!isBlind ? (
                <div className="photo-frame">
                  {photo ? <img className="candidate-photo" src={photo} alt="Candidate" /> : <span>Picture optional</span>}
                </div>
              ) : null}
            </section>

            <ResumeSection title="Executive Summary OR Summary">
              <p>{data.summary || "Text to be added"}</p>
            </ResumeSection>

            <ResumeSection title="Career Highlights">
              <BulletList items={highlights} fallback="Text to be added" />
            </ResumeSection>

            <ResumeSection title="Core Expertise">
              <div className="expertise-grid">
                {(expertise.length ? expertise : ["Skill 1", "Skill 2", "Skill 3", "Skill 4"]).slice(0, 8).map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </ResumeSection>

            <ResumeSection title="Professional Experience">
              <BulletList items={experience} fallback="Company Name (Duration Dates)\nCurrent Title - Location\nBullets to be added" />
            </ResumeSection>
            <ResumeFooter page="1" />
          </article>

          <article className="resume-page" aria-label="Resume preview page 2">
            <header className="resume-header second-page">
              <img className="resume-logo" src="/tbbt-logo.png" alt="The BlackBox Talent" />
            </header>
            <ResumeSection title="Achievements">
              <BulletList items={achievements} fallback="Bullets to be added" />
            </ResumeSection>

            <ResumeSection title="Education / Certification / Qualifications">
              <BulletList items={education} fallback="Bullets to be added" />
            </ResumeSection>

            <ResumeSection title="Technology / Additional Skills / Language">
              <p>{data.additionalSkills || "Text to be added"}</p>
            </ResumeSection>

            <ResumeSection title="Alignment with the role applying">
              <p>{data.alignment || "Text to be added"}</p>
            </ResumeSection>
            <ResumeFooter page="2" />
          </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResumeFooter({ page }: { page: string }) {
  return (
    <footer className="resume-footer">
      <span>The Blackbox Talent FZCO, Dubai, United Arab Emirates. M: +971 55 773 6808 E: info@theblackboxtalent.com</span>
      <strong>{page}</strong>
    </footer>
  );
}

function ResumeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="resume-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function BulletList({ items, fallback }: { items: string[]; fallback: string }) {
  const list = items.length ? items : fallback.split("\n");
  return (
    <ul>
      {list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
