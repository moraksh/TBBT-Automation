import Link from "next/link";
import { ResumeTool } from "../../resume-tool";

export default function ResumeFormatterPage() {
  return (
    <main className="tool-page">
      <nav className="tool-topbar" aria-label="Tool navigation">
        <Link className="brand compact-brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <strong>The BlackBox Talent</strong>
            <small>Automation Command Center</small>
          </span>
        </Link>
        <Link className="ghost-button" href="/">
          Back to tools
        </Link>
      </nav>
      <ResumeTool />
    </main>
  );
}
