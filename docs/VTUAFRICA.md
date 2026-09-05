# VTUAfrica integration (RockPay)

VTUAfrica is **wired** as optional fallback / exam support. It stays **inactive** until you add a Portal Owner API key.

**VTpass remains the primary provider** for airtime, data, cable TV, and electricity on `feature/rockpay-pricing`.

## Official documentation

- Exam pins: https://vtuafrica.com.ng/api/exam-pins.php
- Data: https://vtuafrica.com.ng/api/data.php
- API hub: https://vtuafrica.com.ng/api/
- Airtime2Cash: https://vtuafrica.com.ng/api/airtime2cash.php

### Exam PIN purchase (Portal Owner)

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://vtuafrica.com.ng/portal/api-test/exam-pin/` |
| Live | `https://vtuafrica.com.ng/portal/api/exam-pin/` |

**Query parameters:** `apikey`, `service` (`waec` \| `neco` \| `nabteb` \| `jamb`), `product_code`, `quantity`, `ref`  
JAMB also: `profilecode`, `sender` (email), `phone`

### Product codes (official)

| Product | service | product_code |
|---------|---------|--------------|
| WAEC Result Checking PIN | waec | 1 |
| WAEC GCE Registration PIN | waec | 2 |
| NECO Result Checking Token | neco | 1 |
| NABTEB Result Checking PIN | nabteb | 1 |
| JAMB UTME Registration PIN | jamb | 1 |

## Activate when API is ready

1. Pay for / upgrade VTUAfrica Portal Owner API access.
2. Set on Netlify (server only):
   - `VTUAFRICA_API_KEY=...`
   - `VTUAFRICA_MODE=sandbox` (or live when ready)
3. Leave empty until then — **no VTUAfrica calls**; VTpass only.

See also: `docs/VTUAFRICA_FLOW_COMPARE.md` for UX comparison with RockPay flows.
