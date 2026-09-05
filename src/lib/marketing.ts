/**
 * Marketing & onboarding content — edit THIS file to change promo copy/images.
 *
 * Images:
 * - Prefer files under /public/marketing/ (e.g. /marketing/slide-1.jpg)
 * - Or paste a full https URL (CDN / Unsplash)
 *
 * Home promos: edit HOME_PROMOS array. Set enabled: false to hide a card.
 */

export type OnboardingSlide = {
  title: string;
  body: string;
  /** Path under public/ or absolute URL */
  image: string;
  imageAlt: string;
};

export type HomePromo = {
  id: string;
  enabled: boolean;
  title: string;
  body: string;
  /** Optional background image */
  image?: string;
  /** Internal path e.g. /pay/electricity or /wallet/fund */
  ctaTo?: string;
  ctaLabel?: string;
};

/** Welcome carousel (first open only). Max 4 slides recommended. */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    title: "Pay Your Bills Easily",
    body: "Electricity, cable TV, education and more — all in one place.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Person paying with a phone",
  },
  {
    title: "One Wallet. Everything You Need.",
    body: "Fund once and pay anytime — airtime, data, power and cable.",
    image:
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Person using mobile banking on a phone",
  },
  {
    title: "Fast & Secure",
    body: "Your PIN protects every payment. Transactions are recorded safely.",
    image:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Secure mobile payment experience",
  },
];

/** Home screen promo cards (below wallet / above services). */
export const HOME_PROMOS: HomePromo[] = [
  {
    id: "fund-wallet",
    enabled: true,
    title: "Fund your wallet",
    body: "Top up in seconds and pay bills without stress.",
    image:
      "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80",
    ctaTo: "/wallet/fund",
    ctaLabel: "Fund now",
  },
  {
    id: "exam-pins",
    enabled: true,
    title: "Exam result PINs",
    body: "Buy WAEC & JAMB PINs and get them on your receipt.",
    ctaTo: "/pay/education",
    ctaLabel: "Get PIN",
  },
];
