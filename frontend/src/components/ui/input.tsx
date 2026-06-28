import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-line bg-[#0d1014] px-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

