"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import type { MetricGlossaryEntry } from "@/lib/metrics-glossary";
import { cn } from "@/lib/utils";

export function MetricInfo({
  entry,
  className
}: {
  entry: MetricGlossaryEntry;
  className?: string;
}) {
  const tooltipId = `metric-info-${entry.id}`;

  return (
    <span className={cn("group/info relative inline-flex", className)}>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted transition hover:bg-panel2 hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        aria-describedby={tooltipId}
        aria-label={`Learn about ${entry.title}`}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-left shadow-workstation group-hover/info:block group-focus-within/info:block sm:w-72"
      >
        <span className="block text-xs font-semibold text-text">{entry.title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted">{entry.definition}</span>
        <span className="mt-2 block text-xs leading-5 text-body-secondary">
          <span className="font-medium text-text">Why it matters:</span> {entry.whyItMatters}
        </span>
        <span className="mt-2 block text-xs leading-5 text-body-secondary">
          <span className="font-medium text-text">Example:</span> {entry.example}
        </span>
        {entry.methodologyPath ? (
          <Link
            href={entry.methodologyPath}
            className="pointer-events-auto mt-2 inline-block text-xs font-medium text-teal hover:underline"
          >
            View methodology
          </Link>
        ) : null}
      </span>
    </span>
  );
}
