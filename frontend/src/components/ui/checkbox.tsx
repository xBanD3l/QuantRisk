import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 text-sm text-text", className)}>
      <span className="relative grid h-4 w-4 place-items-center rounded border border-line bg-[#0d1014]">
        <input type="checkbox" className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" {...props} />
        <Check className="h-3 w-3 text-teal opacity-0 peer-checked:opacity-100" aria-hidden="true" />
      </span>
      <span>{label}</span>
    </label>
  );
}

