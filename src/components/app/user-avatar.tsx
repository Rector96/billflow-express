import { initialsOf } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-16 text-xl",
} as const;

export function UserAvatar({ name, src, size = "md", className }: UserAvatarProps) {
  const initials = initialsOf(name?.trim() || "U");

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary/20 bg-gradient-to-br from-primary to-primary-deep font-extrabold text-primary-foreground shadow-sm",
        sizes[size],
        className,
      )}
      aria-label={name ? `${name} avatar` : "Account avatar"}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}
