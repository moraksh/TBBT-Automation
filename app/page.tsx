import { ResumeTool } from "./resume-tool";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#050506]">
      <section className="hero-shell">
        <nav className="topbar" aria-label="Primary">
          <a className="brand" href="https://theblackboxtalent.com/">
            <span className="brand-mark" aria-hidden="true" />
            <span>
              <strong>The BlackBox Talent</strong>
              <small>Automation Command Center</small>
            </span>
          </a>
          <a className="nav-cta" href="#tools">Open Workspace</a>
        </nav>

        <div className="hero-copy">
          <p className="eyebrow">Premium <span /> Internal automation hub</p>
          <h1>TBBT tools, built inside the BlackBox experience.</h1>
          <p className="hero-lede">
            A branded workspace for day-to-day recruitment automation, ready to
            host each tool as we add it: intake, shortlisting, screening,
            reporting, and client delivery.
          </p>
        </div>
      </section>

      <ResumeTool />
    </main>
  );
}
