import Link from "next/link";

export default function Home() {
  return (
    <main className="app-shell">
      <section className="hero-shell">
        <nav className="topbar" aria-label="Primary">
          <a className="brand" href="https://theblackboxtalent.com/">
            <span className="brand-mark" aria-hidden="true" />
            <span>
              <strong>The BlackBox Talent</strong>
              <small>Automation Command Center</small>
            </span>
          </a>
        </nav>
      </section>

      <section className="tools-grid" aria-label="Automation tools">
        <Link className="tool-card" href="/tools/resume-formatter">
          <span>Resume Formatter</span>
        </Link>
      </section>
    </main>
  );
}
