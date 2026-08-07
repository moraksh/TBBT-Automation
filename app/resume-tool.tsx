"use client";

import { ChangeEvent, CSSProperties, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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

type ResumeUnit = {
  id: string;
  title?: string;
  sectionTitle?: string;
  kind: "intro" | "paragraph" | "listItem" | "expertise" | "experienceItem";
  text?: string;
  items?: string[];
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

function toLines(value: string) {
  return value
    .split(/\r?\n|;/)
    .map((line) => line.trim())
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
  const [hasCanvas, setHasCanvas] = useState(false);
  const [isMobileProofingOpen, setIsMobileProofingOpen] = useState(false);
  const [mobilePreviewScale, setMobilePreviewScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBlind = layout === "blind";
  const expertise = useMemo(() => toList(data.expertise, true), [data.expertise]);
  const highlights = useMemo(() => toList(data.highlights), [data.highlights]);
  const experience = useMemo(() => toLines(data.experience), [data.experience]);
  const achievements = useMemo(() => toList(data.achievements), [data.achievements]);
  const education = useMemo(() => toList(data.education), [data.education]);
  const contactDetails = useMemo(
    () => [data.location, data.phone ? `M: ${data.phone}` : "", data.email ? `Email: ${data.email}` : "", data.linkedin].filter(Boolean),
    [data.email, data.linkedin, data.location, data.phone],
  );
  const resumeUnits = useMemo(
    () => buildResumeUnits({ data, isBlind, contactDetails, photo, expertise, highlights, experience, achievements, education }),
    [achievements, contactDetails, data, education, experience, expertise, highlights, isBlind, photo],
  );
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<ResumeUnit[][]>([]);

  useEffect(() => {
    function updateMobileScale() {
      if (typeof window === "undefined") return;
      const nextScale = window.innerWidth <= 720 ? Math.min(1, Math.max(0.34, (window.innerWidth - 32) / 794)) : 1;
      setMobilePreviewScale(nextScale);
    }

    updateMobileScale();
    window.addEventListener("resize", updateMobileScale);
    return () => window.removeEventListener("resize", updateMobileScale);
  }, []);

  useLayoutEffect(() => {
    if (!hasCanvas || !measureRef.current) {
      setPages([]);
      return;
    }

    const measuredNodes = Array.from(measureRef.current.querySelectorAll<HTMLElement>("[data-measure-unit]"));
    const firstPageLimit = 920;
    const laterPageLimit = 950;
    const nextPages: ResumeUnit[][] = [];
    let currentPage: ResumeUnit[] = [];
    let currentHeight = 0;

    resumeUnits.forEach((unit, index) => {
      const measuredHeight = measuredNodes[index]?.offsetHeight || 0;
      const limit = nextPages.length === 0 ? firstPageLimit : laterPageLimit;
      const shouldStartNewPage = currentPage.length > 0 && currentHeight + measuredHeight > limit;

      if (shouldStartNewPage) {
        nextPages.push(currentPage);
        currentPage = [];
        currentHeight = 0;
      }

      currentPage.push(unit);
      currentHeight += measuredHeight;
    });

    if (currentPage.length) nextPages.push(currentPage);
    setPages(nextPages.length ? nextPages : [[]]);
  }, [hasCanvas, resumeUnits]);

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result || ""));
      setHasCanvas(true);
    };
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
      setHasCanvas(true);
    } catch {
      setAiError("AI auto-fill could not connect right now. Please try again or use basic auto-fill.");
    } finally {
      setIsAiParsing(false);
    }
  }

  function handleBasicParse() {
    setData(parseCandidateText(rawText));
    setHasCanvas(true);
  }

  function handleLoadExample() {
    setRawText(samplePrompt);
    setData(parseCandidateText(samplePrompt));
    setHasCanvas(true);
    setAiError("");
  }

  return (
    <section className="resume-tool" id="tools" aria-label="Resume formatter tool">
      <div className="tool-heading">
        <h1>Resume Formatter</h1>
        <p>Paste candidate information, populate the template, review, then export a client-ready PDF.</p>
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
            <button type="button" className="ghost-button" onClick={handleBasicParse}>
              Basic auto-fill
            </button>
            <button type="button" className="ghost-button" onClick={handleLoadExample}>
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

          {hasCanvas ? (
            <button
              type="button"
              className="primary-button full-width mobile-proofing-button"
              onClick={() => setIsMobileProofingOpen((isOpen) => !isOpen)}
            >
              {isMobileProofingOpen ? "Hide proofing" : "Show proofing"}
            </button>
          ) : null}

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

        <div className={`preview-panel ${isMobileProofingOpen ? "mobile-proofing-open" : ""}`}>
          {!hasCanvas ? (
            <div className="canvas-empty">
              <strong>Paste the candidate information</strong>
              <p>Use AI auto-fill, Basic auto-fill, or Load example to create the proofing canvas.</p>
            </div>
          ) : (
            <>
              <div className="preview-toolbar">
                <div>
                  <strong>Proofing canvas</strong>
                  <span>{isBlind ? "Blind candidate layout" : "Full candidate layout"}</span>
                </div>
                <button type="button" className="primary-button" onClick={() => window.print()}>
                  Generate PDF
                </button>
              </div>

              <div
                className="resume-document"
                aria-label="Resume preview"
                style={{ zoom: mobilePreviewScale } as CSSProperties}
              >
                <div className="measure-page" ref={measureRef} aria-hidden="true">
                  {resumeUnits.map((unit) => (
                    <div data-measure-unit key={unit.id}>
                      <ResumeUnitContent unit={unit} />
                    </div>
                  ))}
                </div>

                {(pages.length ? pages : [resumeUnits]).map((pageUnits, index) => (
                  <article className="resume-page" aria-label={`Resume preview page ${index + 1}`} key={`page-${index}`}>
                    <ResumeHeader compact={index > 0} />
                    <div className="resume-page-body">
                      {pageUnits.map((unit) => (
                        <ResumeUnitContent
                          forceTitle={!unit.title && unit.sectionTitle && pageUnits[0].id === unit.id ? `${unit.sectionTitle} Continued` : undefined}
                          unit={unit}
                          key={unit.id}
                        />
                      ))}
                    </div>
                    <ResumeFooter page={String(index + 1)} />
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function buildResumeUnits({
  data,
  isBlind,
  contactDetails,
  photo,
  expertise,
  highlights,
  experience,
  achievements,
  education,
}: {
  data: ResumeData;
  isBlind: boolean;
  contactDetails: string[];
  photo: string;
  expertise: string[];
  highlights: string[];
  experience: string[];
  achievements: string[];
  education: string[];
}) {
  const units: ResumeUnit[] = [];
  units.push({
    id: "intro",
    kind: "intro",
    text: JSON.stringify({
      name: isBlind ? "Confidential Candidate Profile" : data.candidateName,
      title: data.title,
      contact: isBlind ? "Identity hidden for client review" : contactDetails.join(" | "),
      photo: !isBlind ? photo : "",
    }),
  });

  if (data.summary) units.push({ id: "summary", kind: "paragraph", title: "Executive Summary OR Summary", text: data.summary });
  highlights.forEach((item, index) =>
    units.push({ id: `highlight-${index}`, kind: "listItem", sectionTitle: "Career Highlights", title: index === 0 ? "Career Highlights" : undefined, text: item }),
  );
  if (expertise.length) units.push({ id: "expertise", kind: "expertise", title: "Core Expertise", items: expertise });
  experience.forEach((item, index) =>
    units.push({
      id: `experience-${index}`,
      kind: "experienceItem",
      sectionTitle: "Professional Experience",
      title: index === 0 ? "Professional Experience" : undefined,
      text: item,
    }),
  );
  achievements.forEach((item, index) =>
    units.push({ id: `achievement-${index}`, kind: "listItem", sectionTitle: "Achievements", title: index === 0 ? "Achievements" : undefined, text: item }),
  );
  education.forEach((item, index) =>
    units.push({
      id: `education-${index}`,
      kind: "listItem",
      sectionTitle: "Education / Certification / Qualifications",
      title: index === 0 ? "Education / Certification / Qualifications" : undefined,
      text: item,
    }),
  );
  if (data.additionalSkills) units.push({ id: "additional-skills", kind: "paragraph", title: "Technology / Additional Skills / Language", text: data.additionalSkills });
  if (data.alignment) units.push({ id: "alignment", kind: "paragraph", title: "Alignment with the role applying", text: data.alignment });

  return units;
}

function ResumeHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={compact ? "resume-header second-page" : "resume-header"}>
      <img className="resume-logo" src="/tbbt-logo.png" alt="The BlackBox Talent" />
    </header>
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

function ResumeUnitContent({ unit, forceTitle }: { unit: ResumeUnit; forceTitle?: string }) {
  if (unit.kind === "intro") {
    const intro = JSON.parse(unit.text || "{}") as { name?: string; title?: string; contact?: string; photo?: string };
    return (
      <section className="candidate-intro">
        <div>
          {intro.name ? <h3>{intro.name}</h3> : null}
          {intro.title ? <p>{intro.title}</p> : null}
          {intro.contact ? <p className="contact-line">{intro.contact}</p> : null}
        </div>
        {intro.photo ? (
          <div className="photo-frame">
            <img className="candidate-photo" src={intro.photo} alt="Candidate" />
          </div>
        ) : null}
      </section>
    );
  }

  if (unit.kind === "expertise") {
    return (
      <ResumeSection title={unit.title || "Core Expertise"}>
        <div className="expertise-grid">
          {(unit.items || []).map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </ResumeSection>
    );
  }

  if (unit.kind === "experienceItem") {
    return (
      <ResumeSection title={forceTitle || unit.title}>
        <ExperienceList items={unit.text ? [unit.text] : []} />
      </ResumeSection>
    );
  }

  if (unit.kind === "listItem") {
    return (
      <ResumeSection title={forceTitle || unit.title}>
        <BulletList items={unit.text ? [unit.text] : []} />
      </ResumeSection>
    );
  }

  return (
    <ResumeSection title={forceTitle || unit.title}>
      <p>{unit.text}</p>
    </ResumeSection>
  );
}

function ResumeSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="resume-section">
      {title ? <h4>{title}</h4> : null}
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ExperienceList({ items }: { items: string[] }) {
  return (
    <div className="experience-list">
      {items.map((item) => {
        const isBullet = /^[-*•]/.test(item) || /^(managed|developed|led|created|implemented|coordinated|collaborated|worked|supported|delivered|improved|built|designed)\b/i.test(item);
        const text = item.replace(/^[-*•\s]+/, "").trim();

        return isBullet ? (
          <p className="experience-bullet" key={item}>{text}</p>
        ) : (
          <p className="experience-meta" key={item}>{text}</p>
        );
      })}
    </div>
  );
}
