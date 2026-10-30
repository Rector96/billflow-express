import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/app/app-shell";
import { BRAND } from "@/lib/brand";
import welcomePhoto from "@/assets/rockpay-welcome.jpg";

type AuthShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

/**
 * Full-viewport auth layout.
 * Mobile: single column form (no scroll when content fits).
 * Desktop: two columns — lifestyle photo + form panel.
 */
export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <main className="auth-split fixed inset-0 z-50 flex h-dvh w-full overflow-hidden bg-background">
      {/* Left visual panel — desktop only */}
      <aside className="auth-panel-visual relative hidden h-full w-[48%] shrink-0 overflow-hidden lg:block">
        <img
          src={welcomePhoto}
          alt=""
          className="auth-hero-img absolute inset-0 h-full w-full object-cover"
        />
        <div className="auth-hero-shade pointer-events-none absolute inset-0" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
          <Link to="/" className="flex items-center gap-2.5 text-white">
            <BrandMark className="size-10 rounded-xl shadow-lg" />
            <span className="font-display text-2xl font-bold tracking-tight">
              {BRAND.name}
              <span className="text-violet-200">.</span>
            </span>
          </Link>
          <div className="auth-hero-copy max-w-md text-white">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              {BRAND.tagline}
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight xl:text-4xl">
              Pay bills.
              <br />
              Stay connected.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              Electricity, airtime, data and more — one simple wallet.
            </p>
          </div>
        </div>
      </aside>

      {/* Right form panel */}
      <section className="auth-panel-form relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="auth-blob auth-blob--a pointer-events-none opacity-60 lg:opacity-40" aria-hidden="true" />
        <div className="auth-blob auth-blob--b pointer-events-none opacity-60 lg:opacity-40" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col px-6 py-6 sm:px-8 lg:max-w-lg lg:px-12 lg:py-10">
          {/* Mobile brand */}
          <header className="mb-6 flex shrink-0 items-center gap-2.5 lg:hidden">
            <BrandMark className="size-9 rounded-xl" />
            <span className="font-display text-xl font-bold tracking-tight text-[#1e1b4b]">
              {BRAND.name}
            </span>
          </header>

          {(title || subtitle) && (
            <div className="auth-form-enter mb-6 shrink-0 lg:mb-8">
              {title ? (
                <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-tight text-[#0f172a] sm:text-[2rem]">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="mt-2 max-w-sm text-[0.95rem] leading-relaxed text-slate-500">
                  {subtitle}
                </p>
              ) : null}
            </div>
          )}

          <div className="auth-form-enter auth-form-enter-delay min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
