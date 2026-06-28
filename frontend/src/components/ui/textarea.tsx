import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-none rounded-md border border-line bg-[#0d1014] px-3 py-2 text-sm text-text outline-none transition placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/20",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

