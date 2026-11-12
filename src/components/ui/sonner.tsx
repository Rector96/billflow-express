import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      closeButton
      duration={4200}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[min(420px,calc(100vw-24px))] group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:border-border/80 group-[.toaster]:bg-card group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:text-card-foreground group-[.toaster]:shadow-[0_12px_36px_-14px_rgba(15,23,42,0.28)]",
          title: "text-[13px] font-semibold leading-snug",
          description: "mt-1 text-xs leading-relaxed text-muted-foreground",
          icon: "size-4 shrink-0",
          closeButton:
            "border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
          success: "border-success/25 bg-success-soft",
          error: "border-destructive/20 bg-destructive-soft",
          warning: "border-warning/25 bg-warning-soft",
          info: "border-info/20 bg-info-soft",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
