"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { fetchMethodology } from "@/lib/api";
import type { ModelMethodology } from "@/lib/types";

export default function MethodologyDetailPage() {
  const params = useParams<{ model: string }>();
  const model = decodeURIComponent(params.model);
  const [entry, setEntry] = useState<ModelMethodology | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMethodology(model)
      .then(setEntry)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load methodology."));
  }, [model]);

  return (
    <main className="min-h-screen bg-ink text-text">
      <header className="border-b border-line bg-[#0b0e12] px-5 py-4">
        <div className="mx-auto max-w-4xl">
          <Link href="/methodology" className="inline-flex items-center gap-2 text-sm text-teal hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All models
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">{entry?.model ?? model}</h1>
        </div>
      </header>

      <section className="mx-auto max-w-4xl space-y-8 p-5">
        {error ? <p className="text-sm text-rose">{error}</p> : null}
        {entry ? (
          <>
            <MethodSection title="Purpose" body={entry.purpose} />
            <MethodList title="Mathematical Assumptions" items={entry.assumptions} />
            <MethodList title="Equations" items={entry.equations} mono />
            <MethodList title="Strengths" items={entry.strengths} />
            <MethodList title="Weaknesses" items={entry.weaknesses} />
            <MethodSection title="Computational Complexity" body={entry.complexity} />
            <MethodList title="References" items={entry.references} />
          </>
        ) : null}
      </section>
    </main>
  );
}

function MethodSection({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase text-muted">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-[#d6dce3]">{body}</p>
    </div>
  );
}

function MethodList({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase text-muted">{title}</h2>
      <ul className="mt-2 space-y-2 text-sm leading-7 text-[#d6dce3]">
        {items.map((item) => (
          <li key={item} className={mono ? "font-mono text-xs" : undefined}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
