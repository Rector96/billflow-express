# RockPay Platform Map

**Repo:** `Rector96/billflow-express`  
**Primary branch for product work:** `feature/rockpay-pricing`  
**Audience:** engineers, product, and any AI agent onboarding to this codebase.

This file is the **single source of truth** for *what the platform is*, *what works*, *what is demo*, and *what not to build next*.

---

## 1. Product identity

RockPay is a **Nigeria-focused utility + identity + formalisation hub** — not e-commerce.

| Pillar | Examples | Monetisation |
|--------|----------|----------------|
| **Instant VTU / bills** | Airtime, data, electricity, cable, exam PINs | Margin / commission on provider APIs |
| **Assisted formalisation** | CAC Business Name | Flat package fee (e.g. ₦27,500) |
| **Identity convenience** | Retrieve NIN, print NIN slip | Small convenience fee |
| **Wallet** | Fund, pay, history, receipts | Float + convenience |

**Out of scope for now:** marketplace / physical goods e-commerce, MLM reseller tiers, full bank.

---

## 2. Maturity levels (read this before coding)

| Level | Meaning |
|-------|---------|
| **L0** | Idea / docs only |
| **L1** | UI demo — no real money, no external API |
| **L2** | Wired to APIs/DB; sandbox or limited pilot |
| **L3** | Production path with ops (requery, admin, refunds) |
| **L4** | Scale (monitoring, multi-provider, SLAs) |

### Current inventory

| Area | Level | Notes |
|------|-------|-------|
| Wallet + Paystack funding | ~L2–L3 | Depends on env keys + Netlify |
| Airtime / data / electricity / cable (VTpass) | ~L2–L3 | Harden pending→success; live catalogue |
| Exam PINs (WAEC/NECO/NABTEB/JAMB) | ~L2 | Quantity flows; live variations |
| Pricing rules + admin pricing UI | ~L2 | Safety floor, face-value airtime |
| Admin (users, txs, care, reconciliation) | ~L2 | Expand user detail / suspend |
| Care tickets + notifications | ~L2 | |
| Receipts / share | ~L2 | |
| PWA shell | ~L2 | |
| **CAC Business Name** | **L1 demo** | `/cac` — full form, no filing/pay |
| **NIN Retrieve + Print Slip** | **L1 demo** | `/nin` — no NIMC |
| Plastic NIN card | **L0** | Manual partner model only |
| Corporate TIN / Ltd CAC | **L0** | Deferred |
| VTUAfrica | **L0–L1** | Optional; inactive until credentials |

---

## 3. Key routes & docs

| Path | Doc |
|------|-----|
| `/pay/$slug` | Bill flows (airtime, data, utilities) |
| `/cac` | `docs/CAC_BUSINESS_NAME.md` |
| `/nin` | `docs/NIN_SERVICES.md` |
| `/admin/*` | Ops |
| This file | `docs/PLATFORM.md` |

**Flags:** `CAC_DEMO_MODE`, `NIN_DEMO_MODE` in flow components — keep `true` until backend is connected.

---

## 4. NIN card: automated or manual?

### What can be API / automated
- **NIN verification** (enterprise NIMC Verification Service API — application + VPN, not open public).
- **Digital NIN slip / mobile ID** via official NIMC channels (user self-service or licensed integrators).
- **Retrieve NIN** officially often via USSD `*346#` (₦20 network fee) or Mobile ID app — third parties need lawful access.

### What is mostly **manual / operational**
- **Plastic / laminated “NIN card”** sold by private agents (₦1,000–₦3,000+):
  1. User pays on platform  
  2. User provides NIN + photo/slip  
  3. **Human or partner print shop** produces card  
  4. Pickup / courier delivery  
- There is **no public “print plastic NIN card” API** for random apps. Official **National e-ID / GMPC** is a separate NIMC–bank programme, not a drop-in VTU product.

### RockPay recommendation
| Product | Model |
|---------|--------|
| Retrieve NIN | Demo now → later licensed/partner API only |
| Print digital slip | Demo now → partner or user-guided official print |
| Plastic card | **Assisted ops** (order queue + partner printers), not pure automation |

---

## 5. High-demand paid services (hub roadmap)

Prioritised for **fast delivery + willingness to pay** (not e-commerce):

### Tier A — already in DNA / ship hard
1. **Data + airtime** (huge daily spend; honest face-value + margin on data)
2. **Electricity + cable**
3. **Exam PINs** (seasonal spikes)
4. **Wallet funding**

### Tier B — high fee, form-based (assisted)
5. **CAC Business Name** (demo live; go-live = pay + admin + certificate)
6. **NIN retrieve / slip** (demo live)
7. **Company name search / verify** (cheap, high search volume)

### Tier C — later
8. Plastic NIN card via **partners**  
9. TIN assist only if still needed after NIN=Tax ID rules  
10. Ltd CAC, annual returns  
11. SME tools engineers pay for: **invoice PDF**, **receipt branding**, **team wallet**, **API for agents** (reseller later if policy allows)

### Explicitly deprioritise
- Full online store / physical goods  
- Unlicensed scraping of NIMC/CAC portals  
- Blind multi-provider failover without requery  

---

## 6. Engineering rules

1. **No false success** — wallet debit only with clear provider outcome or explicit pending.  
2. **Demos stay demos** until `*_DEMO_MODE = false` and backend exists.  
3. **One vertical production-ready** beats five half-wired demos.  
4. Prefer **provider APIs** (VTpass, Paystack, licensed identity) over HTML scraping.  
5. Admin must support: search users, txs, Care, pricing, reconciliation.

---

## 7. Suggested next work (product order)

1. Harden **VTU pending → terminal status** + live catalogues.  
2. CAC **L2–L3**: storage, payment, admin queue, email.  
3. NIN **L2** only with lawful partner.  
4. Optional plastic card as **ops queue**, not fake automation.  

---

*Last updated for branch `feature/rockpay-pricing`. Update this file when maturity levels change.*
