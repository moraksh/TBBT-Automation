import { ToolSearch } from "./tool-search";

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

        <div className="hero-copy">
          <p className="eyebrow">Internal automation hub</p>
          <h1>TBBT tools, built inside the BlackBox experience.</h1>
          <p className="hero-lede">
            A branded workspace for day-to-day recruitment automation, ready to
            host each tool as we add it: intake, shortlisting, screening,
            reporting, and client delivery.
          </p>
        </div>
      </section>

      <section className="tools-section" aria-label="Automation tools">
        <ToolSearch />
      </section>
    </main>
  );
}
