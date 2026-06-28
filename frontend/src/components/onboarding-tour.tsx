"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "qca-tour-complete";

const STEPS = [
  {
    title: "Welcome to Quant Committee AI",
    body: "Run independent quantitative models, compare risk metrics, and review an AI committee synthesis grounded in model outputs."
  },
  {
    title: "Run an analysis",
    body: "Open the Workstation, enter a ticker, choose models, and click Run Analysis. Live progress appears when streaming is supported."
  },
  {
    title: "Read the dashboard",
    body: "Results flow from overview and risk metrics to model comparison, charts, committee discussion, and the final consensus verdict."
  },
  {
    title: "Ask grounded questions",
    body: "Use the research assistant to ask about VaR, models, assumptions, and committee conclusions for the current analysis only."
  }
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  function finish() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  if (!open) {
    return null;
  }

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-workstation">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">Quick tour · {step + 1}/{STEPS.length}</p>
            <h2 id="tour-title" className="mt-2 text-xl font-semibold">
              {current.title}
            </h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={finish} aria-label="Skip tour">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-sm leading-7 text-muted">{current.body}</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep((value) => value - 1)}>
                Back
              </Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button type="button" size="sm" onClick={() => setStep((value) => value + 1)}>
                Next
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={finish}>
                Get started
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
