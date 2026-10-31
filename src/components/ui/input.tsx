import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm shadow-black/[0.03] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:font-normal placeholder:text-muted-foreground/75 hover:border-muted-foreground/40 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:shadow-none aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-destructive/10 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-muted-foreground disabled:opacity-80 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
