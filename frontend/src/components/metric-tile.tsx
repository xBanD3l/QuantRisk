"use client";

import { glossaryForLabel } from "@/lib/metrics-glossary";
import { MetricInfo } from "@/components/metric-info";
import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  tone,
  compact,
  onExplain,
  className
}: {
  label: string;
  value: string;
  tone?: "risk";
  compact?: boolean;
  onExplain?: (prompt: string) => void;
  className?: string;
}) {
  const glossary = glossaryForLabel(label);

  return (
    <div className={cn("rounded-md border border-line bg-panel p-4", compact && "p-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase text-muted">{label}</p>
        {glossary ? (
          <span className="group/info shrink-0">
            <MetricInfo entry={glossary} />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 break-words font-semibold",
          compact ? "text-lg" : "text-xl",
          tone === "risk" ? "text-rose" : "text-text"
        )}
      >
        {value}
      </p>
      {glossary && onExplain ? (
        <button
          type="button"
          onClick={() => onExplain(`Explain ${glossary.title.toLowerCase()} for this analysis.`)}
          className="mt-2 text-xs font-medium text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          Explain
        </button>
      ) : null}
    </div>
  );
}
