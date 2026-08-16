"use client";

import { ChangeEvent, CSSProperties, Dispatch, MouseEvent, ReactNode, SetStateAction, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlignmentType, BorderStyle, Document, ImageRun, LevelFormat, Packer, Paragraph, Table, TableCell, TableRow, TextRun, UnderlineType, WidthType } from "docx";

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
  forcePageBreakBefore?: boolean;
};

type EditableResumeProps = {
  unit: ResumeUnit;
  forceTitle?: string;
  data: ResumeData;
  isBlind: boolean;
  setData: Dispatch<SetStateAction<ResumeData>>;
  togglePageBreakBefore: (unitId: string) => void;
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
  ["summary", ["executive profile", "executive summary", "summary"]],
  ["highlights", ["career highlights", "highlights"]],
  ["expertise", ["core competencies", "core expertise", "expertise"]],
  ["experience", ["professional experience", "work experience", "experience"]],
  ["achievements", ["achievements", "achievement"]],
  ["education", ["education", "certification", "qualifications"]],
  ["additionalSkills", ["technology", "additional skills", "language", "skills"]],
  ["alignment", ["alignment with the role", "alignment"]],
];

function cleanValue(value: string) {
  return normalizeResumeText(value).replace(/^[\s:|-]+/, "").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeResumeText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s*[\u2022•]\s*/g, "\n- ")
    .replace(/([.!?])(?=[A-Z])/g, "$1 ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,.;:])(?=\S)/g, "$1 ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanResumeLine(value: string) {
  return normalizeResumeText(value)
    .replace(/^(key\s+)?highlights?\s*:\s*/i, "")
    .replace(/^(responsibilities|my responsibilities|duties|achievements?)\s*:\s*/i, "")
    .trim();
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
  const result: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const normalized = lines[i].trim().replace(/:$/, "").toLowerCase();
    const sectionLabel = labels.find(
      (label) => normalized === label || normalized.startsWith(`${label}:`) || normalized.startsWith(`${label} /`) || normalized.startsWith(`${label} `),
    );
    const isSectionHeader = Boolean(sectionLabel);
    if (isSectionHeader) {
      start = i + 1;
      const sameLineValue = cleanValue(lines[i].slice(sectionLabel?.length || 0));
      if (sameLineValue) result.push(sameLineValue);
      break;
    }
  }

  if (start < 0) return "";

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

  const ignoredLines = new Set([
    "contact",
    "languages",
    "language",
    "summary",
    "executive summary",
    "executive profile",
    "core expertise",
    "core competencies",
    "experience",
    "professional experience",
  ]);

  const firstUsefulLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => {
      const normalized = line.toLowerCase().replace(/:$/, "");
      if (!line || ignoredLines.has(normalized)) return false;
      if (line.includes("@") || /linkedin\.com|https?:\/\//i.test(line)) return false;
      if (/^(english|french|arabic|hindi|urdu|spanish|german|mandarin|cantonese)\b/i.test(line)) return false;
      if (/^page \d+ of \d+$/i.test(line)) return false;
      return line.split(/\s+/).length >= 2;
    });

  return firstUsefulLine || "";
}

function parseCandidateText(text: string): ResumeData {
  const normalizedText = normalizeResumeText(text);
  const email = normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = normalizedText.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,5}\d{2,4}/)?.[0] || "";
  const linkedin = normalizedText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,]+/i)?.[0] || "";

  const parsed = { ...emptyResume };
  parsed.candidateName = inferName(normalizedText);
  parsed.title = findLineValue(normalizedText, ["current title", "title", "position", "role"]);
  parsed.location = findLineValue(normalizedText, ["location", "geography"]);
  parsed.phone = findLineValue(normalizedText, ["phone", "mobile", "m"]) || phone;
  parsed.email = findLineValue(normalizedText, ["email"]) || email;
  parsed.linkedin = findLineValue(normalizedText, ["linkedin"]) || linkedin;

  for (const [key, labels] of sectionMap) {
    parsed[key] = extractSection(normalizedText, labels);
  }

  const normalizedLines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const nameIndex = normalizedLines.findIndex((line) => line === parsed.candidateName);
  if (nameIndex >= 0) {
    const nextLine = normalizedLines[nameIndex + 1] || "";
    const followingLine = normalizedLines[nameIndex + 2] || "";
    if (!parsed.title && nextLine && !nextLine.includes("@") && !/linkedin\.com|^page \d+ of \d+$/i.test(nextLine)) parsed.title = nextLine;
    if (!parsed.location && followingLine && /,/.test(followingLine)) parsed.location = followingLine;
  }

  if (!parsed.summary) {
    parsed.summary = normalizedText
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 35)
      .slice(0, 2)
      .join("\n");
  }

  return parsed;
}

function toList(value: string, splitCommas = false) {
  const splitter = splitCommas ? /\r?\n|;|,|\s\|\s/ : /\r?\n|;/;
  return normalizeResumeText(value)
    .split(splitter)
    .map((line) => cleanResumeLine(line).replace(/^[-*\u2022\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function toLines(value: string) {
  return normalizeResumeText(value)
    .split(/\r?\n|;/)
    .map((line) => {
      const bulletPrefix = /^[-*\u2022]/.test(line.trim()) ? "- " : "";
      return `${bulletPrefix}${cleanResumeLine(line).replace(/^[-*\u2022\s]+/, "")}`.trim();
    })
    .filter(Boolean);
}

function listToField(items: string[]) {
  return items.map((item) => normalizeResumeText(item).trim()).filter(Boolean).join("\n");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return (value || "TBBT Resume").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

function docText(text: string, options: { bold?: boolean; color?: string; size?: number; underline?: boolean } = {}) {
  return new TextRun({
    text,
    bold: options.bold,
    color: options.color || "000000",
    size: options.size || 20,
    font: "Arial",
    underline: options.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

function docHeading(text: string) {
  return new Paragraph({
    spacing: { before: 220, after: 110 },
    children: [docText(text, { bold: true, color: "6D1265", size: 22 })],
  });
}

function docParagraph(text: string, bold = false, spacing: { before?: number; after?: number; line?: number } = {}) {
  return new Paragraph({
    spacing: { after: spacing.after ?? 95, before: spacing.before, line: spacing.line ?? 280 },
    children: [docText(text, { bold })],
  });
}

function docBullet(text: string) {
  return new Paragraph({
    numbering: { reference: "resume-bullets", level: 0 },
    indent: { left: 360, hanging: 180 },
    spacing: { after: 70, line: 260 },
    children: [docText(text)],
  });
}

function isExperienceBullet(item: string) {
  return (
    /^[-*\u2022]/.test(item) ||
    /^(achieved|advised|applied|assessed|built|collaborated|conducted|converted|coordinated|created|defined|delivered|designed|developed|directed|discussed|drove|embedded|ensured|established|executed|fostered|identified|implemented|improved|introduced|lead|led|leveraged|maintained|managed|monitored|optimised|optimized|oversaw|owned|partnered|played|prepared|promoted|provided|raised|resolved|revamped|reviewed|served|streamlined|strengthened|supported|supervised|worked)\b/i.test(item)
  );
}

function isCompanyExperienceLine(item: string) {
  const text = item.trim();
  if (!text || isExperienceBullet(text)) return false;
  return /\b(present|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|\d{4})\b/i.test(text) || text === text.toUpperCase();
}

function splitExperienceLead(item: string) {
  const text = item.replace(/^[-*\u2022\s]+/, "").trim();
  const pipeIndex = text.indexOf("|");
  if (pipeIndex >= 0) {
    return {
      lead: text.slice(0, pipeIndex).trim(),
      rest: text.slice(pipeIndex).trim(),
    };
  }

  return { lead: text, rest: "" };
}

function formatExperienceLead(item: string, isBlind: boolean) {
  const { lead, rest } = splitExperienceLead(item);
  return {
    lead: isBlind ? "Confidential" : lead,
    rest,
  };
}

function docExperienceLine(text: string, isBlind: boolean, spacing: { before?: number; after?: number; line?: number } = {}) {
  const { lead, rest } = formatExperienceLead(text, isBlind);
  return new Paragraph({
    spacing: { after: spacing.after ?? 55, before: spacing.before, line: spacing.line ?? 260 },
    children: [
      docText(lead, { bold: true }),
      ...(rest ? [docText(` ${rest}`)] : []),
    ],
  });
}

function buildWordDocument({
  data,
  isBlind,
  contactDetails,
  logoData,
  expertise,
  highlights,
  experience,
  achievements,
  education,
}: {
  data: ResumeData;
  isBlind: boolean;
  contactDetails: string[];
  logoData?: Uint8Array;
  expertise: string[];
  highlights: string[];
  experience: string[];
  achievements: string[];
  education: string[];
}) {
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: logoData
        ? [new ImageRun({ data: logoData, type: "png", transformation: { width: 164, height: 32 } })]
        : [docText("THE BLACKBOX TALENT", { bold: true, size: 22 })],
    }),
  ];

  if (isBlind) {
    children.push(docHeading("Confidential"));
    if (data.title) children.push(docParagraph(data.title));
  } else {
    children.push(docHeading(data.candidateName));
    if (data.title) children.push(docParagraph(data.title));
  }
  if (contactDetails.length) children.push(docParagraph(contactDetails.join(" | ")));

  if (data.summary) {
    children.push(docHeading("Executive Summary"), docParagraph(data.summary));
  }
  if (highlights.length) {
    children.push(docHeading("Career Highlights"), docParagraph(highlights.join(" ")));
  }
  if (expertise.length) {
    const rows = [];
    const columnWidths = [38, 26, 36];
    for (let i = 0; i < expertise.length; i += 3) {
      rows.push(
        new TableRow({
          children: expertise.slice(i, i + 3).map(
            (skill, cellIndex) =>
              new TableCell({
                width: { size: columnWidths[cellIndex] || 33, type: WidthType.PERCENTAGE },
                margins: { top: 45, bottom: 45, left: 0, right: 120 },
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                },
                children: [docParagraph(skill)],
              }),
          ),
        }),
      );
    }
    children.push(docHeading("Core Expertise"), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  }
  if (experience.length) {
    children.push(docHeading("Professional Experience"));
    let companyCount = 0;
    experience.forEach((item) => {
      const isBullet = isExperienceBullet(item);
      const text = item.replace(/^[-*\u2022\s]+/, "").trim();
      const isCompanyLine = isCompanyExperienceLine(text);
      if (isBullet) {
        children.push(docBullet(text));
        return;
      }

      children.push(
        isCompanyLine
          ? docExperienceLine(text, isBlind, { before: companyCount > 0 ? 180 : 0, after: 55 })
          : docParagraph(text, false, { after: 55 }),
      );
      if (isCompanyLine) companyCount += 1;
    });
  }
  if (achievements.length) children.push(docHeading("Achievements"), ...achievements.map(docBullet));
  if (education.length) children.push(docHeading("Education / Certification / Qualifications"), ...education.map((item) => docParagraph(item)));
  if (data.additionalSkills) children.push(docHeading("Technology / Additional Skills / Language"), docParagraph(data.additionalSkills));
  if (data.alignment) children.push(docHeading("Alignment with the role applying"), docParagraph(data.alignment));

  return new Document({
    numbering: {
      config: [
        {
          reference: "resume-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 360, hanging: 180 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 900, bottom: 720, left: 900 },
          },
        },
        children,
      },
    ],
  });
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
  const [isExtractingCv, setIsExtractingCv] = useState(false);
  const [uploadedCvFile, setUploadedCvFile] = useState<File | null>(null);
  const [forcedPageBreakIds, setForcedPageBreakIds] = useState<string[]>([]);
  const [pageBreakHistory, setPageBreakHistory] = useState<string[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const previewDocumentRef = useRef<HTMLDivElement>(null);

  const isBlind = layout === "blind";
  const expertise = useMemo(() => toList(data.expertise, true), [data.expertise]);
  const highlights = useMemo(() => toList(data.highlights), [data.highlights]);
  const experience = useMemo(() => toLines(data.experience), [data.experience]);
  const achievements = useMemo(() => toList(data.achievements), [data.achievements]);
  const education = useMemo(() => toList(data.education), [data.education]);
  const contactDetails = useMemo(
    () => (isBlind ? [] : [data.location, data.phone ? `M: ${data.phone}` : "", data.email ? `Email: ${data.email}` : "", data.linkedin].filter(Boolean)),
    [data.email, data.linkedin, data.location, data.phone, isBlind],
  );
  const resumeUnits = useMemo(
    () => buildResumeUnits({ data, isBlind, contactDetails, photo, expertise, highlights, experience, achievements, education, forcedPageBreakIds }),
    [achievements, contactDetails, data, education, experience, expertise, forcedPageBreakIds, highlights, isBlind, photo],
  );
  const measureRef = useRef<HTMLDivElement>(null);
  const firstPageBodyRef = useRef<HTMLDivElement>(null);
  const laterPageBodyRef = useRef<HTMLDivElement>(null);
  const renderedPageBodyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [pages, setPages] = useState<ResumeUnit[][]>([]);

  useEffect(() => {
    function updateMobileScale() {
      if (typeof window === "undefined") return;
      const isMobile = window.innerWidth <= 720;
      const widthScale = isMobile ? (window.innerWidth - 32) / 794 : (window.innerWidth - 760) / 794;
      const nextScale = isMobile ? Math.min(1, Math.max(0.34, widthScale)) : Math.min(1, Math.max(0.78, widthScale));
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

    const measuredNodes = new Map(
      Array.from(measureRef.current.querySelectorAll<HTMLElement>("[data-measure-unit]")).map((node) => [
        node.dataset.measureUnit || "",
        node,
      ]),
    );
    const continuedNodes = new Map(
      Array.from(measureRef.current.querySelectorAll<HTMLElement>("[data-measure-continued]")).map((node) => [
        node.dataset.measureContinued || "",
        node,
      ]),
    );
    const firstPageLimit = Math.floor(firstPageBodyRef.current?.getBoundingClientRect().height || 0);
    const laterPageLimit = Math.floor(laterPageBodyRef.current?.getBoundingClientRect().height || firstPageLimit || 0);
    const defaultLimit = Math.max(firstPageLimit, laterPageLimit, 900);
    const nextPages: ResumeUnit[][] = [];
    let currentPage: ResumeUnit[] = [];
    let currentHeight = 0;

    function pageLimit(pageIndex: number) {
      return (pageIndex === 0 ? firstPageLimit : laterPageLimit) || defaultLimit;
    }

    function unitHeight(unit: ResumeUnit, isFirstOnPage: boolean) {
      const node = isFirstOnPage && !unit.title && unit.sectionTitle ? continuedNodes.get(unit.id) : measuredNodes.get(unit.id);
      return Math.ceil(node?.getBoundingClientRect().height || 0) + 2;
    }

    resumeUnits.forEach((unit, unitIndex) => {
      const currentPageIndex = nextPages.length;
      const measuredHeight = unitHeight(unit, currentPage.length === 0);
      const limit = pageLimit(currentPageIndex);
      let requiredHeight = measuredHeight;

      if (unit.kind === "experienceItem" && isCompanyExperienceLine(unit.text || "")) {
        const keepWithUnits: ResumeUnit[] = [];
        for (const nextUnit of resumeUnits.slice(unitIndex + 1)) {
          if (nextUnit.kind !== "experienceItem" || isCompanyExperienceLine(nextUnit.text || "")) break;
          keepWithUnits.push(nextUnit);
          if (keepWithUnits.length === 1) break;
        }
        requiredHeight += keepWithUnits.reduce((height, nextUnit) => height + unitHeight(nextUnit, false), 0);
      }

      const shouldStartNewPage = currentPage.length > 0 && (unit.forcePageBreakBefore || currentHeight + requiredHeight > limit);

      if (shouldStartNewPage) {
        nextPages.push(currentPage);
        currentPage = [];
        currentHeight = unitHeight(unit, true);
      } else {
        currentHeight += measuredHeight;
      }

      currentPage.push(unit);
    });

    if (currentPage.length) nextPages.push(currentPage);
    setPages(nextPages.length ? nextPages : [[]]);
  }, [hasCanvas, resumeUnits]);

  useLayoutEffect(() => {
    if (!hasCanvas || pages.length < 2 || !measureRef.current) return;

    const measuredNodes = new Map(
      Array.from(measureRef.current.querySelectorAll<HTMLElement>("[data-measure-unit]")).map((node) => [
        node.dataset.measureUnit || "",
        node,
      ]),
    );
    const nextPages = pages.map((page) => [...page]);
    let changed = false;

    function measuredNormalHeight(unit: ResumeUnit) {
      return Math.ceil(measuredNodes.get(unit.id)?.getBoundingClientRect().height || 0) + 1;
    }

    function requiredPullHeight(unit: ResumeUnit, sourcePage: ResumeUnit[]) {
      let height = measuredNormalHeight(unit);

      if (unit.kind === "experienceItem" && isCompanyExperienceLine(unit.text || "")) {
        const nextUnit = sourcePage[1];
        if (nextUnit?.kind === "experienceItem" && !isCompanyExperienceLine(nextUnit.text || "")) {
          height += measuredNormalHeight(nextUnit);
        }
      }

      return height;
    }

    function renderedContentHeight(body: HTMLDivElement) {
      const bodyTop = body.getBoundingClientRect().top;
      const childBottoms = Array.from(body.children).map((child) => (child as HTMLElement).getBoundingClientRect().bottom - bodyTop);
      return Math.max(0, ...childBottoms.map(Math.ceil));
    }

    for (let pageIndex = 0; pageIndex < nextPages.length - 1; pageIndex += 1) {
      const body = renderedPageBodyRefs.current[pageIndex];
      const limit = Math.floor(body?.clientHeight || 0);
      if (!body || !limit) continue;

      let usedHeight = renderedContentHeight(body);
      const targetPage = nextPages[pageIndex];
      const sourcePage = nextPages[pageIndex + 1];

      while (sourcePage.length) {
        const candidate = sourcePage[0];
        if (candidate.forcePageBreakBefore) break;

        const candidateHeight = measuredNormalHeight(candidate);
        const candidateRequiredHeight = requiredPullHeight(candidate, sourcePage);
        if (usedHeight + candidateRequiredHeight > limit) break;

        targetPage.push(candidate);
        sourcePage.shift();
        usedHeight += candidateHeight;
        changed = true;
      }
    }

    if (changed) setPages(nextPages.filter((page) => page.length));
  }, [hasCanvas, pages]);

  useEffect(() => {
    function handleUndo(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest("input, textarea, [contenteditable='true']"));
      if (isEditing || !pageBreakHistory.length) return;

      event.preventDefault();
      undoLastPageBreak();
    }

    window.addEventListener("keydown", handleUndo);
    return () => window.removeEventListener("keydown", handleUndo);
  }, [pageBreakHistory]);

  useEffect(() => {
    if (!hasCanvas) return;
    previewDocumentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [hasCanvas, layout, mobilePreviewScale]);

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

  async function handleCvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAiError("");
    setIsExtractingCv(true);
    setUploadedCvFile(file);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extract-cv", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { text?: string; error?: string; resetAt?: string };

      if (!response.ok || !payload.text) {
        const resetTime = payload.resetAt ? ` Try again after ${formatResetTime(payload.resetAt)}.` : "";
        setAiError(`${payload.error || "Could not read this CV. Try a PDF, DOCX, image, or text file."}${resetTime}`);
        return;
      }

      setRawText(payload.text);
      setData(parseCandidateText(payload.text));
      setHasCanvas(true);
    } catch {
      setAiError("CV upload could not be read right now. Try copy-pasting the candidate details.");
    } finally {
      setIsExtractingCv(false);
    }
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

    if (!rawText.trim() && !uploadedCvFile) {
      setAiError("Paste candidate information before using AI auto-fill.");
      return;
    }

    setIsAiParsing(true);
    try {
      const shouldSendFile =
        uploadedCvFile &&
        (
          uploadedCvFile.type === "application/pdf" ||
          uploadedCvFile.type.startsWith("image/") ||
          /\.(pdf|jpg|jpeg|png|webp)$/i.test(uploadedCvFile.name)
        );
      let response: Response;

      if (shouldSendFile) {
        const formData = new FormData();
        formData.append("file", uploadedCvFile);
        formData.append("text", rawText);
        response = await fetch("/api/parse-resume", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/parse-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText }),
        });
      }
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
    setUploadedCvFile(null);
    setData(parseCandidateText(samplePrompt));
    setHasCanvas(true);
    setAiError("");
  }

  async function handleDownloadWord() {
    const logoData = await fetch("/tbbt-logo.png")
      .then((response) => response.arrayBuffer())
      .then((buffer) => new Uint8Array(buffer))
      .catch(() => undefined);
    const document = buildWordDocument({ data, isBlind, contactDetails, logoData, expertise, highlights, experience, achievements, education });
    const blob = await Packer.toBlob(document);
    downloadBlob(blob, `${safeFilename(isBlind ? data.title : data.candidateName)}.docx`);
  }

  function togglePageBreakBefore(unitId: string) {
    setForcedPageBreakIds((ids) => {
      setPageBreakHistory((history) => [...history, ids].slice(-20));
      return ids.includes(unitId) ? ids.filter((id) => id !== unitId) : [...ids, unitId];
    });
  }

  function undoLastPageBreak() {
    setPageBreakHistory((history) => {
      const previousIds = history.at(-1);
      if (!previousIds) return history;
      setForcedPageBreakIds(previousIds);
      return history.slice(0, -1);
    });
  }

  function clearPageBreaks() {
    setForcedPageBreakIds((ids) => {
      if (ids.length) setPageBreakHistory((history) => [...history, ids].slice(-20));
      return [];
    });
  }

  function scrollToPreviewDocument() {
    previewDocumentRef.current?.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    previewDocumentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
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

          <input
            ref={cvInputRef}
            className="hidden-file"
            type="file"
            accept=".pdf,.docx,.txt,.text,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp"
            onChange={handleCvUpload}
          />

          <div className="button-row">
            <button type="button" className="ghost-button" onClick={() => cvInputRef.current?.click()} disabled={isExtractingCv}>
              {isExtractingCv ? "Reading CV..." : "Upload CV"}
            </button>
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
                <div className="preview-actions">
                  <button type="button" className="ghost-button" onClick={scrollToPreviewDocument}>
                    Show first page
                  </button>
                  <button type="button" className="ghost-button" onClick={undoLastPageBreak} disabled={!pageBreakHistory.length}>
                    Undo last change
                  </button>
                  <button type="button" className="ghost-button" onClick={clearPageBreaks} disabled={!forcedPageBreakIds.length}>
                    Clear page breaks
                  </button>
                  <button type="button" className="primary-button" onClick={() => window.print()}>
                    Download PDF
                  </button>
                  <button type="button" className="ghost-button" onClick={handleDownloadWord}>
                    Download Word
                  </button>
                </div>
              </div>

              <div
                className="resume-document"
                aria-label="Resume preview"
                ref={previewDocumentRef}
                style={{ "--preview-scale": mobilePreviewScale } as CSSProperties}
              >
                <div className="measure-page" ref={measureRef} aria-hidden="true">
                  {resumeUnits.map((unit) => (
                    <div data-measure-unit={unit.id} key={`normal-${unit.id}`}>
                      <ResumeUnitContent unit={unit} />
                    </div>
                  ))}
                  {resumeUnits
                    .filter((unit) => !unit.title && unit.sectionTitle)
                    .map((unit) => (
                      <div data-measure-continued={unit.id} key={`continued-${unit.id}`}>
                        <ResumeUnitContent unit={unit} forceTitle={`${unit.sectionTitle} Continued`} />
                      </div>
                    ))}
                </div>
                <article className="resume-page measure-shell" aria-hidden="true">
                  <ResumeHeader />
                  <div className="resume-page-body" ref={firstPageBodyRef} />
                </article>
                <article className="resume-page measure-shell" aria-hidden="true">
                  <div className="resume-page-body" ref={laterPageBodyRef} />
                </article>

                {(pages.length ? pages : [resumeUnits]).map((pageUnits, index) => (
                  <div className="resume-page-frame" key={`page-${index}`}>
                    <article className="resume-page" aria-label={`Resume preview page ${index + 1}`}>
                      {index === 0 ? <ResumeHeader /> : null}
                      <div
                        className="resume-page-body"
                        ref={(node) => {
                          renderedPageBodyRefs.current[index] = node;
                        }}
                      >
                        {pageUnits.map((unit) => (
                          <EditableResumeUnitContent
                            data={data}
                            forceTitle={!unit.title && unit.sectionTitle && pageUnits[0].id === unit.id ? `${unit.sectionTitle} Continued` : undefined}
                            isBlind={isBlind}
                            setData={setData}
                            togglePageBreakBefore={togglePageBreakBefore}
                            unit={unit}
                            key={unit.id}
                          />
                        ))}
                      </div>
                    </article>
                  </div>
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
  forcedPageBreakIds,
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
  forcedPageBreakIds: string[];
}) {
  const units: ResumeUnit[] = [];
  units.push({
    id: "intro",
    kind: "intro",
    text: JSON.stringify({
      name: isBlind ? "Confidential" : data.candidateName,
      title: data.title,
      contact: contactDetails.join(" | "),
      photo: "",
    }),
  });

  if (data.summary) units.push({ id: "summary", kind: "paragraph", title: "Executive Summary", text: data.summary });
  highlights.forEach((item, index) =>
    units.push({ id: `highlight-${index}`, kind: "listItem", sectionTitle: "Career Highlights", title: index === 0 ? "Career Highlights" : undefined, text: item }),
  );
  if (expertise.length) units.push({ id: "expertise", kind: "expertise", title: "Core Expertise", items: expertise.slice(0, 9) });
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

  return units.map((unit) => ({ ...unit, forcePageBreakBefore: forcedPageBreakIds.includes(unit.id) }));
}

function ResumeHeader() {
  return (
    <header className="resume-header">
      <img className="resume-logo" src="/tbbt-logo.png" alt="The BlackBox Talent" />
    </header>
  );
}

function EditableResumeUnitContent({ unit, forceTitle, data, isBlind, setData, togglePageBreakBefore }: EditableResumeProps) {
  function updateField(field: keyof ResumeData, value: string) {
    setData((currentData) => ({ ...currentData, [field]: value.trim() }));
  }

  function updateListField(field: keyof ResumeData, items: string[]) {
    setData((currentData) => ({ ...currentData, [field]: listToField(items) }));
  }

  function listForUnit(field: keyof ResumeData, sourceData = data) {
    return field === "expertise" ? toList(sourceData[field], true) : field === "experience" ? toLines(sourceData[field]) : toList(sourceData[field]);
  }

  function updateListItem(field: keyof ResumeData, index: number, value: string) {
    setData((currentData) => {
      const items = listForUnit(field, currentData);
      items[index] = value.trim();
      return { ...currentData, [field]: listToField(items) };
    });
  }

  function addListItem(field: keyof ResumeData, index: number, value = "New item") {
    setData((currentData) => {
      const items = listForUnit(field, currentData);
      items.splice(index + 1, 0, value);
      return { ...currentData, [field]: listToField(items) };
    });
  }

  function removeListItem(field: keyof ResumeData, index: number) {
    setData((currentData) => ({
      ...currentData,
      [field]: listToField(listForUnit(field, currentData).filter((_, itemIndex) => itemIndex !== index)),
    }));
  }

  function removeBlock(field: keyof ResumeData) {
    setData((currentData) => ({ ...currentData, [field]: "" }));
  }

  function preventEditBlur(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  const pageBreakAction = (
    <button type="button" className={unit.forcePageBreakBefore ? "active" : ""} onClick={() => togglePageBreakBefore(unit.id)}>
      {unit.forcePageBreakBefore ? "Undo next page" : "Next page"}
    </button>
  );
  const headingPageBreakAction = unit.title ? pageBreakAction : null;
  const inlinePageBreakAction = unit.title ? null : pageBreakAction;

  if (unit.kind === "intro") {
    const intro = JSON.parse(unit.text || "{}") as { name?: string; title?: string; contact?: string; photo?: string };
    return (
      <section className={`candidate-intro editable-resume-block ${isBlind ? "blind-intro" : ""}`}>
        <div>
          {intro.name ? (
            <h3
              contentEditable={!isBlind}
              suppressContentEditableWarning
              onBlur={(event) => {
                if (!isBlind) updateField("candidateName", event.currentTarget.innerText);
              }}
            >
              {intro.name}
            </h3>
          ) : null}
          {intro.title ? (
            <p contentEditable suppressContentEditableWarning onBlur={(event) => updateField("title", event.currentTarget.innerText)}>
              {intro.title}
            </p>
          ) : null}
          {intro.contact ? <p className="contact-line">{intro.contact}</p> : null}
        </div>
      </section>
    );
  }

  if (unit.kind === "expertise") {
    const items = toList(data.expertise, true).slice(0, 9);
    return (
      <ResumeSection title={unit.title || "Core Expertise"} actions={headingPageBreakAction}>
        <div className="editable-resume-block">
          <div className="resume-edit-actions no-print">
            <button type="button" onClick={() => addListItem("expertise", items.length - 1, "New skill")}>Add skill</button>
            <button type="button" onMouseDown={preventEditBlur} onClick={() => removeBlock("expertise")}>Remove block</button>
          </div>
          <div className="expertise-table">
            {items.map((skill, index) => (
              <span
                contentEditable
                suppressContentEditableWarning
                key={`${skill}-${index}`}
                onBlur={(event) => updateListItem("expertise", index, event.currentTarget.innerText)}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && event.currentTarget.innerText.trim() === "") removeListItem("expertise", index);
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </ResumeSection>
    );
  }

  if (unit.kind === "experienceItem") {
    const index = Number(unit.id.replace("experience-", ""));
    const items = toLines(data.experience);
    const item = items[index] || unit.text || "";
    const isBullet = isExperienceBullet(item);
    const isCompanyLine = isCompanyExperienceLine(item);
    const text = item.replace(/^[-*\u2022\s]+/, "").trim();

    return (
      <ResumeSection title={forceTitle || unit.title} actions={headingPageBreakAction}>
        <div className="editable-resume-block">
          <div className="resume-edit-actions no-print">
            <button type="button" onClick={() => addListItem("experience", index, "- New responsibility")}>Add line</button>
            {inlinePageBreakAction}
            <button type="button" onClick={() => removeListItem("experience", index)}>Remove</button>
          </div>
          <div className="experience-list">
            <p
              className={isBullet ? "experience-bullet" : isCompanyLine ? "experience-meta experience-company" : "experience-meta experience-role"}
              contentEditable
              suppressContentEditableWarning
              onBlur={(event) => updateListItem("experience", index, isBullet ? `- ${event.currentTarget.innerText}` : event.currentTarget.innerText)}
            >
              {isCompanyLine ? <ExperienceLineText text={text} isBlind={isBlind} /> : text}
            </p>
          </div>
        </div>
      </ResumeSection>
    );
  }

  if (unit.kind === "listItem") {
    const field = unit.id.startsWith("highlight-")
      ? "highlights"
      : unit.id.startsWith("achievement-")
        ? "achievements"
        : "education";
    const index = Number(unit.id.split("-").at(-1));
    const items = listForUnit(field);
    const value = items[index] || unit.text || "";

    return (
      <ResumeSection title={forceTitle || unit.title} actions={headingPageBreakAction}>
        <div className="editable-resume-block">
          <div className="resume-edit-actions no-print">
            <button type="button" onClick={() => addListItem(field, index)}>Add line</button>
            {inlinePageBreakAction}
            <button type="button" onClick={() => removeListItem(field, index)}>Remove</button>
          </div>
          {field === "highlights" || field === "achievements" || field === "education" ? (
            <p contentEditable suppressContentEditableWarning onBlur={(event) => updateListItem(field, index, event.currentTarget.innerText)}>
              {value}
            </p>
          ) : (
            <BulletList
              items={[value]}
              onBlur={(nextValue) => updateListItem(field, index, nextValue)}
            />
          )}
        </div>
      </ResumeSection>
    );
  }

  const field = unit.id === "summary" ? "summary" : unit.id === "additional-skills" ? "additionalSkills" : unit.id === "alignment" ? "alignment" : null;
  if (field) {
    return (
      <ResumeSection title={forceTitle || unit.title} actions={headingPageBreakAction}>
        <div className="editable-resume-block">
          <div className="resume-edit-actions no-print">
            {inlinePageBreakAction}
            <button type="button" onMouseDown={preventEditBlur} onClick={() => removeBlock(field)}>Remove block</button>
          </div>
          <p contentEditable suppressContentEditableWarning onBlur={(event) => updateField(field, event.currentTarget.innerText)}>
            {data[field]}
          </p>
        </div>
      </ResumeSection>
    );
  }

  return <ResumeUnitContent unit={unit} forceTitle={forceTitle} />;
}

function ResumeUnitContent({ unit, forceTitle }: { unit: ResumeUnit; forceTitle?: string }) {
  if (unit.kind === "intro") {
    const intro = JSON.parse(unit.text || "{}") as { name?: string; title?: string; contact?: string; photo?: string };
    return (
      <section className={`candidate-intro ${intro.name === "Confidential" ? "blind-intro" : ""}`}>
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
          <div className="expertise-table">
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
    const isPlainLine = unit.id.startsWith("highlight-") || unit.id.startsWith("achievement-") || unit.id.startsWith("education-");

    return (
      <ResumeSection title={forceTitle || unit.title}>
        {isPlainLine ? <p>{unit.text}</p> : <BulletList items={unit.text ? [unit.text] : []} />}
      </ResumeSection>
    );
  }

  return (
    <ResumeSection title={forceTitle || unit.title}>
      <p>{unit.text}</p>
    </ResumeSection>
  );
}

function ResumeSection({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="resume-section">
      {title ? (
        <div className="resume-section-heading">
          <h4>{title}</h4>
          {actions ? <div className="resume-edit-actions heading-actions no-print">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function BulletList({ items, onBlur }: { items: string[]; onBlur?: (value: string) => void }) {
  return (
    <ul>
      {items.map((item) => (
        <li
          contentEditable={Boolean(onBlur)}
          suppressContentEditableWarning
          key={item}
          onBlur={onBlur ? (event) => onBlur(event.currentTarget.innerText) : undefined}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function ExperienceList({ items }: { items: string[] }) {
  return (
    <div className="experience-list">
      {items.map((item) => {
        const isBullet = isExperienceBullet(item);
        const isCompanyLine = isCompanyExperienceLine(item);
        const text = item.replace(/^[-*\u2022\s]+/, "").trim();
        return isBullet ? (
          <p className="experience-bullet" key={item}>{text}</p>
        ) : (
          <p className={isCompanyLine ? "experience-meta experience-company" : "experience-meta experience-role"} key={item}>
            {isCompanyLine ? <ExperienceLineText text={text} isBlind={text.startsWith("Confidential")} /> : text}
          </p>
        );
      })}
    </div>
  );
}

function ExperienceLineText({ text, isBlind }: { text: string; isBlind: boolean }) {
  const { lead, rest } = formatExperienceLead(text, isBlind);
  return (
    <>
      <strong className="experience-lead">{lead}</strong>
      {rest ? <span> {rest}</span> : null}
    </>
  );
}
