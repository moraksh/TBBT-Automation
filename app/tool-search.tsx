"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const tools = [
  {
    href: "/tools/resume-formatter",
    name: "Resume Formatter",
    description:
      "Paste candidate details, auto-populate the TBBT resume template, review, and export a consistent client-ready PDF.",
    keywords: "resume formatter candidate pdf cv template profile proofreading client delivery",
  },
];

export function ToolSearch() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTools = useMemo(
    () =>
      tools.filter((tool) =>
        `${tool.name} ${tool.description} ${tool.keywords}`.toLowerCase().includes(normalizedQuery),
      ),
    [normalizedQuery],
  );

  return (
    <>
      <div className="tools-header">
        <div>
          <h2>Tools</h2>
          <p>One stop for repeat work, formatting, screening, and delivery tasks.</p>
        </div>
        <label className="tool-search">
          <span>Search tools</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by task or tool name"
          />
        </label>
      </div>

      <div className="tools-grid">
        {filteredTools.map((tool) => (
          <article className="tool-card" key={tool.href}>
            <div>
              <h3>{tool.name}</h3>
              <p>{tool.description}</p>
            </div>
            <Link className="primary-button" href={tool.href}>
              Start
            </Link>
          </article>
        ))}
        {filteredTools.length === 0 ? <p className="empty-tools">No tools found.</p> : null}
      </div>
    </>
  );
}
