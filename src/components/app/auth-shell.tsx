import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/app/app-shell";
import { BRAND } from "@/lib/brand";

type AuthShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

/** Responsive, full-viewport authentication layout shared by login and signup. */
export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <main className="auth-split fixed inset-0 z-50 flex h-dvh w-full overflow-hidden bg-background">
      <aside className="auth-panel-visual relative hidden h-full w-[48%] shrink-0 overflow-hidden brand-gradient text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-[30rem] rounded-full border border-white/10" />
        <Link to="/" className="relative z-10 flex items-center gap-2.5 text-white">
          <BrandMark className="size-10 rounded-xl shadow-lg" />
          <span className="font-display text-2xl font-bold tracking-tight">
            {BRAND.name}<span className="text-violet-200">.</span>
          </span>
        </Link>
        <div className="auth-hero-copy relative z-10 max-w-md text-white">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            {BRAND.tagline}
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight xl:text-4xl">
            Pay bills.
            <br />
            Stay in control.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            Electricity, education and essential services — together in one secure wallet.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/65">Simple payments. Clear records. One RockPay.</p>
      </aside>

      <section className="auth-panel-form relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="auth-blob auth-blob--a pointer-events-none opacity-60 lg:opacity-40" aria-hidden="true" />
        <div className="auth-blob auth-blob--b pointer-events-none opacity-60 lg:opacity-40" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col px-6 py-6 sm:px-8 lg:max-w-lg lg:px-12 lg:py-10">
          <header className="mb-6 flex shrink-0 items-center gap-2.5 lg:hidden">
            <BrandMark className="size-9 rounded-xl" />
            <span className="font-display text-xl font-bold tracking-tight text-[#1e1b4b]">{BRAND.name}</span>
          </header>
          {(title || subtitle) && (
            <div className="auth-form-enter mb-6 shrink-0 lg:mb-8">
              {title ? <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-tight text-[#0f172a] sm:text-[2rem]">{title}</h1> : null}
              {subtitle ? <p className="mt-2 max-w-sm text-[0.95rem] leading-relaxed text-slate-500">{subtitle}</p> : null}
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
