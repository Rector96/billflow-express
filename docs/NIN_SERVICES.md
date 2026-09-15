# NIN Services (RockPay) — product reference

**Status:** Demo UI only  
**Route:** `/nin`  
**Component:** `src/components/app/nin-services-flow.tsx`

## Why these products (not TIN)

| Product | Complexity | User demand | Decision |
|---------|------------|-------------|----------|
| **Retrieve NIN** | Very low | Very high (lost NIN / *346#) | **Ship** |
| **Print NIN Slip** | Low | Very high (banks, jobs, schools) | **Ship** |
| Personal TIN | Medium; NIN often acts as Tax ID under newer rules | Medium | **Skip for now** |
| Corporate TIN | High (CAC docs, FIRS) | Lower retail volume | **Skip** |
| Plastic NIN card shipping | Logistics / partners | Medium | **Later** |
| NIN data modification | Physical NIMC centre | — | **Never pure online** |

## Flows

### A. Retrieve NIN
```
choose service → phone (or tracking ID) → confirm → pay (demo) → show NIN result
```
Fields: registered phone (required), optional DOB / tracking ID.

### B. Print NIN Slip
```
choose service → enter 11-digit NIN + phone → confirm identity → pay (demo) → slip ready
```
Demo generates a reference and a “download slip” placeholder (no real PDF until connected).

## Pricing (demo defaults — change in code)

| Service | Demo price |
|---------|------------|
| Retrieve NIN | ₦300 |
| Print NIN Slip | ₦500 |

## Going live (later)

1. Licensed / partner NIMC or aggregator API only — do not scrape official portals.
2. Wallet debit after successful lookup/slip generation.
3. Store minimal audit log (who requested what, when) — privacy sensitive.
4. Never email full NIN in plain text without user consent.
