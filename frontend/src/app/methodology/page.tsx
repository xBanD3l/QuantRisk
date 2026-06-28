"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { fetchMethodologies } from "@/lib/api";
import type { ModelMethodology } from "@/lib/types";

export default function MethodologyIndexPage() {
  const [entries, setEntries] = useState<ModelMethodology[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMethodologies()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load methodology."));
  }, []);

  return (
    <main className="min-h-screen bg-ink text-text">
      <header className="border-b border-line bg-[#0b0e12] px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Model Methodology</h1>
            <p className="text-sm text-muted">Purpose, assumptions, equations, and references for each quant model.</p>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-teal hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to workstation
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-4 p-5">
        {error ? <p className="text-sm text-rose">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {entries.map((entry) => (
            <Link
              key={entry.model}
              href={`/methodology/${encodeURIComponent(entry.model)}`}
              className="rounded-md border border-line bg-panel p-5 transition hover:border-teal/40 hover:bg-panel2"
            >
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-teal" aria-hidden="true" />
                <h2 className="font-semibold">{entry.model}</h2>
              </div>
              <p className="text-sm leading-6 text-muted">{entry.purpose}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
