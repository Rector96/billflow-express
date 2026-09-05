/** Bring primary pay CTA into view (mobile + AppShell bottom nav). */

export function scrollIntoAction(id = "pay-action") {
  if (typeof window === "undefined") return;

  const run = () => {
    const el = document.getElementById(id);
    if (!el) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      return;
    }
    const rect = el.getBoundingClientRect();
    const pad = 120;
    if (rect.top < pad) {
      window.scrollBy({ top: rect.top - pad, behavior: "smooth" });
    } else if (rect.bottom > window.innerHeight - 8) {
      window.scrollBy({ top: rect.bottom - window.innerHeight + 16, behavior: "smooth" });
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(run));
}

/** New step: scroll near top of form. */
export function scrollForNewStep(actionId = "pay-action") {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  window.setTimeout(() => scrollIntoAction(actionId), 150);
  window.setTimeout(() => scrollIntoAction(actionId), 400);
}
