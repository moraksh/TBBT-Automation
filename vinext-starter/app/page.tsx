const toolSlots = [
  {
    label: "01",
    title: "Candidate Intake",
    description: "Collect JDs, CVs, notes, and client context into one clean brief.",
    state: "Ready for first tool",
  },
  {
    label: "02",
    title: "CV Shortlisting",
    description: "Rank candidates by skills, experience, availability, and fit.",
    state: "Coming next",
  },
  {
    label: "03",
    title: "Screening Assistant",
    description: "Prepare questions, capture answers, and draft recruiter summaries.",
    state: "Planned",
  },
  {
    label: "04",
    title: "Client Updates",
    description: "Turn recruiter notes into polished updates and shortlist packs.",
    state: "Planned",
  },
];

const metrics = [
  ["8.5K+", "Curated professionals"],
  ["85%", "Successful placements"],
  ["48hr", "Shortlist target"],
  ["130+", "Partner organizations"],
];

const queue = [
  ["Priority", "Build first automation module"],
  ["Owner", "TBBT operations team"],
  ["Mode", "Human intelligence + AI intelligence"],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050506] text-white">
      <section className="hero-shell">
        <nav className="topbar" aria-label="Primary">
          <a className="brand" href="https://theblackboxtalent.com/">
            <span className="brand-mark">T</span>
            <span>
              <strong>The BlackBox Talent</strong>
              <small>Automation Command Center</small>
            </span>
          </a>
          <div className="nav-links" aria-label="Workspace sections">
            <a href="#tools">Tools</a>
            <a href="#workflow">Workflow</a>
            <a href="#connectivity">Connectivity</a>
          </div>
          <a className="nav-cta" href="#tools">Open Workspace</a>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Internal automation hub</p>
            <h1>TBBT tools, built inside the BlackBox experience.</h1>
            <p className="hero-lede">
              A branded workspace for day-to-day recruitment automation, ready
              to host each tool as we add it: intake, shortlisting, screening,
              reporting, and client delivery.
            </p>
            <div className="hero-actions">
              <a href="#tools" className="primary-action">Start with Tool 01</a>
              <a href="#connectivity" className="secondary-action">Deployment needs</a>
            </div>
          </div>

          <div className="command-panel" aria-label="Automation dashboard preview">
            <div className="panel-header">
              <div>
                <span className="live-dot" />
                Operations desk
              </div>
              <strong>LIVE</strong>
            </div>
            <div className="score-card">
              <span>Recruitment time saved</span>
              <strong>40-50%</strong>
              <p>Automation handles repetitive work while recruiters focus on judgment.</p>
            </div>
            <div className="mini-grid">
              {metrics.map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="trusted-band" aria-label="Platform summary">
        <p>Built for the same TBBT promise: faster decisions, cleaner workflows, smarter hiring.</p>
      </section>

      <section className="content-band" id="tools">
        <div className="section-heading">
          <p className="eyebrow">Tool library</p>
          <h2>One workspace, many automations.</h2>
          <span>
            The first module slot is intentionally ready. Tell me the first tool,
            and I’ll wire it into this experience.
          </span>
        </div>

        <div className="tool-grid">
          {toolSlots.map((tool) => (
            <article className="tool-card" key={tool.label}>
              <div className="tool-number">{tool.label}</div>
              <div>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
              </div>
              <span>{tool.state}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-band" id="workflow">
        <div className="workflow-copy">
          <p className="eyebrow">Human + AI intelligence</p>
          <h2>Recruiters stay in control. Automation clears the repetitive work.</h2>
        </div>
        <div className="workflow-panel">
          {queue.map(([label, value]) => (
            <div className="queue-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="connectivity-band" id="connectivity">
        <div>
          <p className="eyebrow">Connectivity</p>
          <h2>Ready for Vercel, domain, and tool integrations.</h2>
        </div>
        <div className="connectivity-list">
          <span>Vercel project access</span>
          <span>Domain/DNS access when they are ready</span>
          <span>Tool-specific APIs, credentials, and workflows</span>
        </div>
      </section>
    </main>
  );
}
