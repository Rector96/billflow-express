# VTUAfrica integration (RockPay)

VTUAfrica is **wired** for examination pins. It stays **inactive** until you add a Portal Owner API key.

VTpass remains the live provider for airtime, data, cable TV, and electricity.

## Official documentation used

- Exam pins: https://vtuafrica.com.ng/api/exam-pins.php
- Data: https://vtuafrica.com.ng/api/data.php
- API hub: https://vtuafrica.com.ng/api/

### Exam PIN purchase (Portal Owner)

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://vtuafrica.com.ng/portal/api-test/exam-pin/` |
| Live | `https://vtuafrica.com.ng/portal/api/exam-pin/` |

**Query parameters:** `apikey`, `service` (`waec` \| `neco` \| `nabteb` \| `jamb`), `product_code`, `quantity`, `ref`  
JAMB also: `profilecode`, `sender` (email), `phone`

**Success sample:** `code: 101`, `description.Status: Completed`, `description.pins: "..."`

### Product codes (official)

| Product | service | product_code |
|---------|---------|--------------|
| WAEC Result Checking PIN | waec | 1 |
| WAEC GCE Registration PIN | waec | 2 |
| WAEC Verification PIN | waec | 3 |
| NECO Result Checking Token | neco | 1 |
| NECO GCE Registration PIN | neco | 2 |
| NABTEB Result Checking PIN | nabteb | 1 |
| NABTEB GCE Registration PIN | nabteb | 2 |
| JAMB UTME Registration PIN | jamb | 1 |
| JAMB Direct Entry Registration PIN | jamb | 2 |

## Activate when your API is ready

1. Upgrade to **Portal Owner** on VTUAfrica and create an API key (upgraded users only).
2. Netlify → Site settings → Environment variables:

```bash
VTUAFRICA_API_KEY=your_key_here
VTUAFRICA_MODE=sandbox
# optional override:
# VTUAFRICA_BASE_URL=https://vtuafrica.com.ng/portal/api-test
```

3. Redeploy the site.
4. Call `getBillVendorStatus` — `vtuafrica.active` should be `true`.
5. `listExamPinProducts` returns `purchaseEnabled: true`.
6. `purchaseExamPin` will debit wallet + call `/exam-pin/`.

Until the key exists, catalogue listing still works; purchase returns a clear “not active yet” error and **does not** charge the user for a failed vendor call in that path (purchase is rejected before debit).

## Server modules

| File | Purpose |
|------|---------|
| `src/lib/vtuafrica.server.ts` | Config, static product matrix, purchase, JAMB verify |
| `src/lib/exam.functions.ts` | `listExamPinProducts`, `purchaseExamPin`, `getBillVendorStatus` |
| `src/lib/vtpass.server.ts` | Unchanged primary bill/VTU path |
| `src/lib/margins.server.ts` | +₦100 default on `exam_pin` category |

## Switching sandbox → live

```bash
VTUAFRICA_MODE=live
# or
VTUAFRICA_BASE_URL=https://vtuafrica.com.ng/portal/api
```

Redeploy after changing env vars.
