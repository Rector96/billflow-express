# VTUAfrica services vs RockPay flows

Source: https://vtuafrica.com.ng/api/

## VTUAfrica catalog

| Service | API idea | Customer UX |
|---------|----------|-------------|
| **Airtime VTU** | network, phone, amount, ref | Network → phone → amount → pay |
| **Data** | service + plan + phone | Network → phone → plan → pay |
| **Cable** | verify smartcard → bouquet | Provider → IUC → verify → package → pay |
| **Electricity** | disco + meter + amount | Disco → type → meter → verify → amount → pay |
| **Exam pins** | WAEC/NECO/JAMB/NABTEB | Exam → product → qty → pay → PIN on receipt |
| **Airtime2Cash** | verify → transfer to their line → confirm | Network → amount → sender phone → deposit number → transfer → confirm |
| **Bank / Bet** | transfer / betting | Optional later |

RockPay: **VTpass primary**; VTUAfrica optional failover when `VTUAFRICA_API_KEY` is set.

## RockPay vs market

| Service | RockPay steps | Status |
|---------|---------------|--------|
| Airtime | Network → phone → face-value amount → confirm → PIN → result | Live |
| Data | Network → phone → plan → confirm → PIN → result | Live |
| Electricity | Disco → meter type → meter → verify → amount → confirm → PIN/Paystack | Live |
| Cable | Provider → IUC → verify → package → confirm → PIN/Paystack | Live |
| Education/Exam | Exam → product → qty → confirm → PIN → result (no phone) | Live |
| **Airtime2Cash** | Not built | Needs VTUAfrica key + dedicated UX |

## Airtime2Cash note

Not buying airtime. User **sends airtime** to a number VTUAfrica returns, then confirms. Fraud-sensitive. Ship only with API key + clear copy.

## UX

Auto-scroll on step change; auto-continue when 4-digit PIN is entered.
