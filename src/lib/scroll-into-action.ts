/** Scroll helpers for pay flows (mobile web + AppShell bottom nav). */

export function scrollIntoAction(id = "pay-action") {
  if (typeof window === "undefined") return;

  const run = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const rect = el.getBoundingClientRect();
      const navPad = 96;
      if (rect.bottom > window.innerHeight - navPad) {
        window.scrollBy({
          top: rect.bottom - (window.innerHeight - navPad) + 12,
          behavior: "smooth",
        });
      }
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}

/** New step: jump to top, then bring primary action into view. */
export function scrollForNewStep(actionId = "pay-action") {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  window.setTimeout(() => scrollIntoAction(actionId), 120);
  window.setTimeout(() => scrollIntoAction(actionId), 360);
}
