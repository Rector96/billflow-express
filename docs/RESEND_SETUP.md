# Resend setup (hub emails)

RockPay sends lifecycle emails when **RESEND_API_KEY** and **RESEND_FROM** are set on the server (Netlify env).

## Events

| Event | When |
|--------|------|
| **paid** | New hub order submitted (demo pay / real pay later) |
| **digital_ready** | Staff attaches document or marks successful |
| **dispatched** | Staff marks dispatched on Dispatch queue |
| **delivered** | Staff marks delivered |

If keys are missing, the app **skips email** and still uses in-app notifications.

## Netlify env

```
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM=RockPay <orders@your-verified-domain.com>
RESEND_REPLY_TO=support@your-domain.com
```

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain (DNS)
3. Create an API key
4. Add the three vars on Netlify → Environment → Production (and Deploy preview if needed)
5. Redeploy

## Test

1. Complete a demo CAC/NIN order as a user with a real email on the account
2. Staff: Hub orders → Attach document → customer should get **digital_ready** email
3. Staff: Dispatch → Dispatched → **dispatched** email

Check Resend dashboard → Emails for delivery status.
