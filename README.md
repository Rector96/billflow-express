# BillFlow Express (RockPay)

## Branch: `rockPay-pricing` — Latest Platform Updates

This branch integrates the core **RockPay Pricing Engine** alongside a comprehensive **UI/UX Modernization** across the entire platform:

### 1. UI/UX Modernization & Streamlined Design
- **Refined Typography & Hierarchy**: Adopted `Plus Jakarta Sans` with balanced optical line heights and tabular figures for all monetary and transaction amounts. Reduced oversized fonts for a calm, comfortable reading experience.
- **Minimalist, De-cluttered Interface**: Removed unnecessary marketing prose, redundant helper paragraphs, and visual clutter across Home, Services, Wallet, History, and Profile pages.
- **Restyled Navigation**: Compact floating navigation dock on mobile and responsive side navigation on desktop with subtle borders and clear active states.
- **Modern Components**: Restyled wallet cards, quick funding chips, service grid tiles, search bars, filter pills, and bottom drawers.

### 2. Pricing & Margin Engine (`src/lib/pricing.server.ts`)
- Configurable service markups (fixed fee or percentage margin) across airtime, mobile data, electricity, cable TV, and exam scratch cards.
- Server-side calculation ensures pricing rules are applied securely and audited per transaction.
- Real-time transaction profit tracking (`src/lib/transaction-profits.server.ts`) records gross customer payments, vendor fulfillment costs, and net margins.

### 3. Payment Methods (Wallet & Direct Paystack)
- **Dual Payment Rails**: Users can pay seamlessly using their funded wallet balance or via direct Paystack checkout (`src/lib/direct-bill.functions.ts`).
- **Provider Routing & Automatic Failover**: Integrated routing between VTpass and VTUAfrica (`src/lib/vendor-router.server.ts`) with automated retry logic and fallback mechanisms.
- **PIN Verification & Security**: 4-digit transaction PIN protection with fast pinpad interaction and session security.

### 4. Admin & Backoffice Tools
- **Pricing Manager**: Admin UI (`/admin/settings`) to manage active rules, markups, and minimum/maximum transaction thresholds.
- **Transaction & Margin Monitoring**: Detailed transaction audit trails (`/admin/transactions`), vendor status reconciliation, and customer care ticket resolution.

---

Build V1 UI/UX — Mobile-First Nigerian Bill Payment App

Build the complete frontend UI/UX and navigation experience for a modern Nigerian bill-payment web application.

IMPORTANT: This first phase is UI/UX ONLY.

Do NOT integrate VTpass yet.
Do NOT integrate Paystack, Flutterwave, or any payment gateway yet.
Do NOT process real money.
Do NOT create real wallet transactions.
Do NOT connect external APIs.

Use realistic demo/mock data so every screen and button can be clicked and demonstrated.

The goal of this phase is to create a polished, premium, extremely easy-to-use mobile-first fintech web app that feels like a native Android/iOS application.

I have attached a visual reference image. Use it as the primary visual direction for the application's UI/UX, spacing, cards, navigation, typography hierarchy, rounded corners, purple visual identity, and overall premium fintech feel.

Do not copy another company's branding. Create an original product using the visual direction of the reference.

Use a temporary product name such as BillPay throughout the interface until I provide the final brand name. Make the name easy to replace globally later.

1. CORE DESIGN PRINCIPLE

The application must feel:

Extremely simple

Fast

Modern

Premium

Trustworthy

Clean

Mobile-first

Easy for a first-time Nigerian user

Similar in usability to a modern fintech mobile application

Original and not a copy of OPay, PalmPay, Moniepoint, or any other existing brand

The user should be able to open the app and understand what to do within a few seconds.

The main philosophy is:

Open → See balance → Choose service → Pay → Get confirmation

Do not overcrowd the interface.

Do not use unnecessary menus.

Do not create complicated forms.

Use large touch-friendly buttons and clear visual hierarchy.

2. RESPONSIVE DESIGN

Design mobile-first.

Primary design targets:

390 × 844

360 × 800

430 × 932

The mobile experience is the priority.

Then make the application responsive for:

Tablets

Laptops

Desktop screens

Do not simply stretch the mobile layout on desktop.

On desktop, use a professional sidebar navigation while maintaining the same visual language and functionality.

3. VISUAL DESIGN SYSTEM

Use a premium purple fintech visual identity.

Suggested palette:

Primary: deep purple
Secondary: violet
Background: very light gray / white
Cards: white
Primary text: dark charcoal
Secondary text: muted gray
Success: green
Error: red
Warning: amber

Use purple gradients sparingly for hero cards and important elements.

Do not make every element purple.

The interface should have plenty of white space.

Use:

Rounded cards

Soft shadows

Subtle borders

Large readable typography

Modern icons

Smooth but subtle animations

Large touch targets

Consistent spacing

Clear button hierarchy

Avoid:

Excessive gradients

Excessive animations

Tiny buttons

Tiny text

Crowded screens

Unnecessary popups

Old-fashioned banking UI

Huge desktop-style tables on mobile

4. APPLICATION STRUCTURE

Create these major sections:

Splash

Onboarding

Sign Up

Login

OTP Verification

Forgot Password

Home

Services

Electricity

Cable TV

Education

Airtime

Data

Wallet

Fund Wallet

Transaction History

Transaction Details

Payment Confirmation

Payment Processing

Payment Successful

Payment Failed

Payment Pending

Saved Payments

Notifications

Profile

Security

Support

Report Transaction

All screens must have working frontend navigation using demo data.

5. SPLASH SCREEN

Create a clean splash screen.

Display:

BillPay

Tagline:

Simple. Fast. Secure.

Use the application logo/mark area.

Keep the splash screen minimal.

After a short delay, navigate to onboarding for a new user or login/home for an existing demo user.

6. ONBOARDING

Create 3 onboarding screens.

Screen 1

Title:

Pay Your Bills Easily

Description:

Electricity, cable TV, education and more — all in one place.

Button:

Next

Secondary action:

Skip

Screen 2

Title:

One Wallet. Everything You Need.

Description:

Fund your wallet once and use it whenever you need to pay.

Button:

Next

Secondary action:

Skip

Screen 3

Title:

Fast & Secure

Description:

Your payments and transactions are safely recorded.

Button:

Get Started

Use attractive but minimal illustrations/icons.

7. AUTHENTICATION

Create polished mobile authentication screens.

Sign Up

Title:

Create your account

Fields:

Full Name
Phone Number
Email
Password
Confirm Password

Checkbox:

I agree to the Terms & Conditions and Privacy Policy.

Primary button:

Create Account

Below:

Already have an account?

Login

Use frontend validation with demo behavior.

8. OTP SCREEN

Title:

Verify your account

Description:

We've sent a verification code to your phone/email.

Create a 6-digit OTP interface.

Buttons:

Verify

Resend Code

Use demo OTP behavior for now.

9. LOGIN

Title:

Welcome Back 👋

Fields:

Phone or Email
Password

Primary button:

Login

Secondary:

Forgot Password?

Bottom:

Don't have an account?

Sign Up

10. FORGOT PASSWORD

Create the complete frontend flow:

Forgot Password

→ Enter phone/email

→ Send Code

→ OTP

→ New Password

→ Confirm Password

→ Password Reset Success

→ Login

Use mock/demo behavior only.

11. MAIN MOBILE NAVIGATION

The main authenticated application must use a fixed bottom navigation bar.

Use exactly:

Home
Wallet
Pay
History
Profile

The center Pay button should be visually prominent.

Example structure:

Home | Wallet | Pay | History | Profile

The navigation must remain accessible throughout the main authenticated experience.

Make sure it does not cover content when the keyboard is open.

12. HOME DASHBOARD

This is the most important screen.

Recreate the visual direction of the attached reference.

Top header:

Good evening, Pablo 👋

Right side:

Profile avatar
Notification bell

Use a realistic demo profile.

Wallet Card

Large premium card.

Display:

Wallet Balance

₦25,450.00

Eye icon.

Eye icon behavior:

Visible:

₦25,450.00

Hidden:

₦••••••

Primary button:

- Fund Wallet

13. PAY BILLS SECTION

Title:

Pay Bills

Create a clean grid of service cards.

Services:

⚡ Electricity
📺 Cable TV
🎓 Education
📱 Airtime
📶 Data
••• More

Use attractive modern icons.

Cards should be large enough to tap easily.

14. QUICK PAY SECTION

Title:

Quick Pay

Right side:

See All

Create saved-payment cards.

Example:

Home Electricity

AEDC
Meter ••••901

Button:

Pay

Second example:

My DSTV

Smartcard ••••123

Button:

Pay

These should be interactive.

Tapping Pay should start the relevant payment flow using demo data.

15. RECENT TRANSACTIONS ON HOME

Title:

Recent Transactions

Right side:

See All

Show realistic demo transactions:

Electricity
-₦10,000
Successful

DSTV
-₦15,000
Successful

Wallet Funded
+₦20,000
Successful

Data Purchase
-₦2,500
Successful

Each transaction should be clickable.

16. SERVICES SCREEN

Create a dedicated Services screen.

Header:

Back button
Title:

Services

Search field:

Search services

Grid:

Electricity
Cable TV
Education
Airtime
Data
Internet
Water
Insurance
Exam Pins
More

Use clean service icons.

Tapping each service should navigate to its relevant screen.

17. ELECTRICITY FLOW

Create the complete frontend flow.

Step 1 — Select Provider

Title:

Pay Electricity

Field:

Select electricity provider

Show demo providers:

AEDC
EKEDC
IKEDC
PHED
JED
KEDCO
Kaduna Electric

Primary button:

Continue

Step 2 — Meter Number

Title:

Electricity

Field:

Meter Number

Placeholder:

Enter your meter number

Optional helper card:

How to find your meter number

Primary:

Continue

When Continue is clicked, simulate verification.

Step 3 — Customer Verification

Show loading state first:

Verifying meter...

Then show:

✓ Customer Found

Customer Name:

John Doe

Address:

23, Allen Avenue, Ikeja, Lagos

Meter Number:

12345678901

Provider:

AEDC

Primary:

Continue

Step 4 — Amount

Title:

Enter Amount

Large amount input:

₦10,000

Quick amount buttons:

₦1,000
₦5,000
₦10,000
₦20,000

Custom amount input should also work.

Primary:

Continue

Step 5 — Confirm Payment

Title:

Confirm Payment

Show:

AEDC Electricity

Customer:

John Doe

Meter:

••••••8901

Amount:

₦10,000

Payment Method:

Wallet Balance

Current Balance:

₦25,450

Balance After:

₦15,450

Primary button:

Pay ₦10,000

18. PAYMENT PIN SCREEN

Create a polished PIN interface.

Title:

Enter Transaction PIN

Description:

Enter your 4-digit PIN to authorize this payment.

Create:

● ● ● ●

Use a mobile numeric keypad style if appropriate.

Button:

Confirm

For demo purposes, accept a mock PIN.

Do not display PIN in plain text.

19. PAYMENT PROCESSING SCREEN

Create a beautiful processing state.

Show:

Loading animation

Title:

Processing Payment

Description:

Your payment is being processed. Please don't close this page.

Show transaction amount and service.

Do not make the loading animation excessive.

After the demo delay, navigate to success.

20. PAYMENT SUCCESS SCREEN

Create a premium success screen.

Large green success icon.

Title:

Payment Successful

Description:

Your electricity payment was successful.

Show:

AEDC Electricity

Customer:

John Doe

Meter:

••••••8901

Amount:

₦10,000

Date:

13 Aug 2026

Time:

8:14 PM

Transaction ID:

TXN-123456

If demonstrating an electricity token, show:

Electricity Token

1234 5678 9012 3456

Buttons:

Copy Token

Share Receipt

Done

Done returns to Home.

21. PAYMENT FAILED SCREEN

Create a clear failure state.

Red error icon.

Title:

Payment Failed

Description:

We couldn't complete your payment.

Show transaction ID.

Buttons:

Try Again

Contact Support

Back Home

22. PAYMENT PENDING SCREEN

Create a separate pending state.

Amber/loading icon.

Title:

Payment Pending

Description:

Your payment is still being processed.

Show:

Transaction ID
Service
Amount
Date

Buttons:

Refresh Status

View Transaction

Contact Support

23. CABLE TV FLOW

Build the same polished step-by-step UX.

Flow:

Cable TV

→ Select provider

→ Enter Smartcard/IUC number

→ Verify customer

→ Select package

→ Confirm payment

→ Transaction PIN

→ Processing

→ Success/Pending/Failed

Demo providers:

DSTV
GOtv
StarTimes

Demo customer:

John Doe

Use realistic package cards.

Example:

Premium
₦29,000

Compact Plus
₦19,000

Compact
₦12,000

Make the package selection visually attractive.

24. EDUCATION FLOW

Build:

Education

→ Select service

→ Select product

→ Enter required details

→ Confirm

→ Transaction PIN

→ Processing

→ Success

Use demo education products.

Do not connect to any real provider yet.

25. AIRTIME FLOW

Build the complete frontend even though real API integration will come later.

Flow:

Airtime

→ Select network

→ Enter phone number

→ Amount

→ Confirm

→ PIN

→ Processing

→ Success

Networks:

MTN
Airtel
Glo
9mobile

Quick amounts:

₦100
₦200
₦500
₦1,000
₦2,000

26. DATA FLOW

Build:

Data

→ Select network

→ Enter phone number

→ Select bundle

→ Confirm

→ PIN

→ Processing

→ Success

Use realistic demo bundles.

27. WALLET SCREEN

Bottom navigation:

Wallet

Large balance card:

Available Balance

₦25,450.00

Buttons:

- Fund Wallet

Withdraw

For V1, Withdraw can display:

Coming Soon

Do not implement withdrawal functionality yet.

28. QUICK FUND

Create:

₦1,000
₦5,000
₦10,000
₦20,000

and:

Custom Amount

Primary:

Continue

Since this is UI-only, after Continue show a realistic mock payment flow.

Do not connect a real gateway.

29. WALLET ACTIVITY

Show:

Wallet Funded
+₦10,000
Successful

Electricity Payment
-₦10,000
Successful

Cable TV
-₦15,000
Successful

Data
-₦2,500
Successful

30. HISTORY SCREEN

Title:

Transactions

Filter tabs:

All
Successful
Pending
Failed

Transaction cards must show:

Icon
Service
Amount
Status
Date/time

Tapping one opens Transaction Details.

31. TRANSACTION DETAILS

Title:

Transaction Details

Show status prominently.

Example:

✓ Successful

Electricity Payment

₦10,000

Transaction ID:

TXN-123456

Service:

AEDC Electricity

Customer:

John Doe

Meter:

••••••8901

Date:

13 Aug 2026

Time:

8:14 PM

Payment Method:

Wallet

Buttons:

Share Receipt

Download Receipt

Report Problem

32. SAVED PAYMENTS

Create:

Title:

Saved Payments

Cards:

Home Electricity
AEDC ••••901
Pay

Office Electricity
AEDC ••••4521
Pay

My DSTV
DSTV ••••123
Pay

Allow:

Add New

For UI-only phase, adding a saved payment can use mock data.

33. NOTIFICATIONS

Create notification screen.

Examples:

✓ Electricity payment successful.

✓ Wallet funded with ₦10,000.

⚠ Your transaction is still pending.

🎉 Welcome to BillPay.

Notifications should be visually differentiated by type.

34. PROFILE SCREEN

Header:

Profile avatar

Pablo Emmanuel

Phone number

Then menu cards:

Personal Information
Change Password
Transaction PIN
Security
Saved Payments
Notifications
Support
Terms & Conditions
Privacy Policy
Logout

35. PERSONAL INFORMATION

Fields:

Full Name
Phone Number
Email

Button:

Save Changes

Use demo state.

36. SECURITY

Options:

Change Password
Change Transaction PIN
Biometric Login
Login Sessions
Logout From All Devices

Use appropriate toggles and confirmation dialogs.

37. SUPPORT

Title:

How can we help?

Cards:

💬 Contact Support
📄 FAQs
⚠ Report Transaction
📧 Email Support

Make the interface friendly and professional.

38. REPORT TRANSACTION

Flow:

Transaction Details

→ Report Problem

Show options:

Payment not received
Wrong amount
Transaction pending
Token not received
Other

Text area:

Tell us what happened

Button:

Submit Report

After submission:

✓ Report Submitted

Show ticket ID.

39. DESKTOP ADMIN UI PREVIEW

For this UI-only phase, create the visual structure of an admin dashboard using mock data.

Desktop-first admin layout:

Sidebar:

Dashboard
Users
Wallets
Transactions
Services
Pricing
Support
Reports
Notifications
Settings

Dashboard cards:

Total Users
Wallet Deposits
Bill Payments
Revenue
Successful Transactions
Pending Transactions
Failed Transactions

Create charts using mock data.

No real backend yet.

40. MICRO-INTERACTIONS

Use subtle, premium animations.

Examples:

Cards gently animate when tapped

Buttons have pressed states

Page transitions are smooth

Success screen has a subtle success animation

Skeleton loading for simulated data

Toast notifications

Bottom navigation transitions

Do NOT over-animate the app.

Performance is more important than visual effects.

41. UX RULES

Follow these rules throughout the entire application:

Every screen must have one obvious primary action.

Never make users guess what to do next.

Use clear button labels.

Keep forms short.

Avoid unnecessary fields.

Use inline validation.

Show loading states.

Show success states.

Show failure states.

Show pending states.

Never silently fail.

Make every important action reversible where appropriate.

Use confirmation before payment.

Never make the user enter information unnecessarily.

Use saved payments for repeat bills.

Keep important information visible.

Maintain consistent spacing and typography.

Make touch targets comfortable for mobile users.

42. ACCESSIBILITY

Ensure:

Good text contrast

Readable font sizes

Large touch targets

Clear error messages

Icons are accompanied by labels where necessary

Forms have clear labels

Keyboard navigation works on desktop

Focus states are visible

43. PERFORMANCE

The UI must feel extremely fast.

Use:

Optimized assets

Lazy loading where appropriate

Lightweight icons

Efficient component structure

Skeleton loaders

Avoid unnecessary re-renders

Avoid excessive third-party libraries

Do not sacrifice performance for animations.

44. IMPORTANT — DEMO DATA ONLY

For this phase, create realistic mock data.

Example user:

Name: Pablo Emmanuel

Wallet:

₦25,450.00

Recent transactions:

AEDC Electricity — ₦10,000 — Successful
DSTV — ₦15,000 — Successful
Wallet Funding — +₦20,000 — Successful
Data — ₦2,500 — Successful

All payment buttons should work using simulated frontend flows.

For example:

Pay Electricity

→ Confirmation

→ PIN

→ Processing

→ Success

This allows me to test the entire UX before real integrations are added.

45. DO NOT BUILD YET

Do NOT implement:

VTpass API

Real electricity payments

Real cable payments

Real education payments

Real airtime

Real data

Real wallet funding

Paystack

Flutterwave

Bank transfers

Real withdrawals

Real transaction processing

Production financial logic

API keys

Secrets

Webhooks

These will be implemented in later phases.

46. CODE QUALITY

Build the UI with a clean reusable component architecture.

Create reusable components for:

Buttons

Cards

Inputs

Service cards

Transaction cards

Status badges

Bottom navigation

Headers

Wallet cards

Modals

Toasts

Loading states

Empty states

Error states

Do not duplicate components unnecessarily.

Use a consistent design system throughout the application.

47. FINAL REQUIREMENT

Before considering this phase complete, make sure I can use the application as a realistic demo:

New user

→ Sign Up

→ OTP

→ Home

→ Wallet

→ Fund Wallet demo

→ Home

→ Electricity

→ Select provider

→ Meter number

→ Verify customer

→ Amount

→ Confirm

→ PIN

→ Processing

→ Success

→ Transaction History

→ Transaction Details

→ Report Transaction

Also test:

Cable TV flow
Education flow
Airtime flow
Data flow
Profile
Security
Notifications
Saved Payments

Everything should feel like one coherent application.

Do not build a generic dashboard.

Build a polished, premium, mobile-first Nigerian bill-payment application based on the attached UI/UX reference.

The most important priorities are:

1. Ease of use
2. Beautiful mobile UI
3. Fast perceived performance
4. Clear payment flows
5. Consistency
6. Responsive design
7. Professional fintech-quality UX

Again: THIS PHASE IS UI/UX ONLY. DO NOT CONNECT REAL APIS OR REAL MONEY.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cc2fd9a5-4f30-4901-a0f0-e25c6d7453a8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
