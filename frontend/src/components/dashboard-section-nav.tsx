"use client";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "risk-metrics", label: "Risk Metrics" },
  { id: "model-comparison", label: "Models" },
  { id: "charts", label: "Charts" },
  { id: "committee", label: "Committee" },
  { id: "consensus", label: "Verdict" },
  { id: "research-assistant", label: "Ask AI" },
  { id: "performance", label: "Performance" }
] as const;

export function DashboardSectionNav() {
  return (
    <nav aria-label="Analysis sections" className="sticky top-0 z-10 -mx-5 mb-6 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur lg:-mx-7 lg:px-7">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={cn(
              "whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition",
              "hover:border-teal/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            )}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function DashboardSection({
  id,
  title,
  eyebrow,
  children,
  className
}: {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 border-b border-line pb-6", className)} aria-labelledby={`${id}-heading`}>
      {eyebrow ? <p className="text-sm font-medium text-teal">{eyebrow}</p> : null}
      <h2 id={`${id}-heading`} className={cn("text-base font-semibold", eyebrow ? "mt-1" : "")}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
