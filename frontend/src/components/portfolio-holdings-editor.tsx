"use client";

import { memo, useCallback, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PortfolioHolding } from "@/lib/types";

export type PortfolioHoldingDraft = {
  id: string;
  ticker: string;
  weightInput: string;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `holding-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createPortfolioHoldingDraft(ticker = "", weightPercent = "50"): PortfolioHoldingDraft {
  return { id: createId(), ticker, weightInput: weightPercent };
}

export function parseHoldingsForSubmit(drafts: PortfolioHoldingDraft[]): { holdings: PortfolioHolding[] } | { error: string } {
  const withTickers = drafts.filter((row) => row.ticker.trim());
  if (!withTickers.length) {
    return { error: "Add at least one portfolio holding." };
  }

  const holdings: PortfolioHolding[] = [];
  for (const row of withTickers) {
    const weight = parseWeightPercent(row.weightInput);
    if (weight === null) {
      return { error: `Enter a positive weight (%) for ${row.ticker.trim().toUpperCase() || "each holding"}.` };
    }
    holdings.push({
      ticker: row.ticker.trim().toUpperCase(),
      weight
    });
  }

  return { holdings };
}

function parseWeightPercent(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function validateWeightInput(value: string): string | null {
  if (!value.trim()) {
    return "Enter a positive weight (%).";
  }
  if (parseWeightPercent(value) === null) {
    return "Use a positive number, e.g. 25 or 12.5.";
  }
  return null;
}

type RowProps = {
  row: PortfolioHoldingDraft;
  canRemove: boolean;
  weightError?: string;
  onTickerChange: (id: string, value: string) => void;
  onWeightChange: (id: string, value: string) => void;
  onWeightBlur: (id: string, value: string) => void;
  onRemove: (id: string) => void;
};

const PortfolioHoldingRow = memo(function PortfolioHoldingRow({
  row,
  canRemove,
  weightError,
  onTickerChange,
  onWeightChange,
  onWeightBlur,
  onRemove
}: RowProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_112px_40px] sm:items-start">
      <div>
        <Input
          value={row.ticker}
          onChange={(event) => onTickerChange(row.id, event.target.value)}
          placeholder="Ticker"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Ticker symbol"
        />
      </div>
      <div>
        <Input
          type="text"
          inputMode="decimal"
          value={row.weightInput}
          onChange={(event) => onWeightChange(row.id, event.target.value)}
          onBlur={(event) => onWeightBlur(row.id, event.target.value)}
          placeholder="50"
          aria-label="Portfolio weight percent"
          aria-invalid={weightError ? true : undefined}
          aria-describedby={weightError ? `${row.id}-weight-error` : undefined}
        />
        {weightError ? (
          <p id={`${row.id}-weight-error`} className="mt-1 text-xs text-rose">
            {weightError}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-[44px] sm:min-h-[40px]"
        onClick={() => onRemove(row.id)}
        disabled={!canRemove}
        aria-label={`Remove ${row.ticker || "holding"}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
});

export function PortfolioHoldingsEditor({
  holdings,
  onChange
}: {
  holdings: PortfolioHoldingDraft[];
  onChange: (holdings: PortfolioHoldingDraft[]) => void;
}) {
  const [weightErrors, setWeightErrors] = useState<Record<string, string>>({});

  const updateRow = useCallback(
    (id: string, patch: Partial<Pick<PortfolioHoldingDraft, "ticker" | "weightInput">>) => {
      onChange(holdings.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    },
    [holdings, onChange]
  );

  const handleTickerChange = useCallback(
    (id: string, value: string) => {
      updateRow(id, { ticker: value });
    },
    [updateRow]
  );

  const handleWeightChange = useCallback(
    (id: string, value: string) => {
      updateRow(id, { weightInput: value });
      setWeightErrors((current) => {
        if (!current[id]) {
          return current;
        }
        const next = { ...current };
        delete next[id];
        return next;
      });
    },
    [updateRow]
  );

  const handleWeightBlur = useCallback((id: string, value: string) => {
    const message = validateWeightInput(value);
    setWeightErrors((current) => {
      const next = { ...current };
      if (message) {
        next[id] = message;
      } else {
        delete next[id];
      }
      return next;
    });
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      onChange(holdings.filter((row) => row.id !== id));
      setWeightErrors((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    },
    [holdings, onChange]
  );

  const handleAdd = useCallback(() => {
    onChange([...holdings, createPortfolioHoldingDraft("", "10")]);
  }, [holdings, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className="text-xs font-semibold uppercase text-muted">Holdings</label>
          <p className="mt-1 text-xs text-muted">Enter tickers and weight (%) — values are normalized automatically.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>
      <div className="hidden text-xs font-semibold uppercase text-muted sm:grid sm:grid-cols-[1fr_112px_40px] sm:gap-2">
        <span>Ticker</span>
        <span>Weight (%)</span>
        <span className="sr-only">Remove</span>
      </div>
      <div className="space-y-2">
        {holdings.map((row) => (
          <PortfolioHoldingRow
            key={row.id}
            row={row}
            canRemove={holdings.length > 1}
            weightError={weightErrors[row.id]}
            onTickerChange={handleTickerChange}
            onWeightChange={handleWeightChange}
            onWeightBlur={handleWeightBlur}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  );
}
