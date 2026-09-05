/** Smooth-scroll the primary action into view (mobile-friendly). */
export function scrollIntoAction(id = "pay-action") {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  });
}

/** After a step change: jump to top of content, then ensure CTA is visible. */
export function scrollForNewStep(actionId = "pay-action") {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.setTimeout(() => scrollIntoAction(actionId), 280);
}
