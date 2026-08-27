import { BRAND } from "@/lib/brand";

export function LegalTermsContent() {
  return (
    <article className="space-y-7 px-5 py-6 text-sm leading-7 text-muted-foreground sm:px-8">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Legal</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
          Terms &amp; Conditions
        </h1>
        <p className="mt-2 text-xs">Last updated: August 27, 2026</p>
      </div>

      <p>
        These Terms &amp; Conditions govern your use of {BRAND.name}. By creating an account or
        using our services, you agree to these terms.
      </p>

      <Section title="Our service">
        <p>
          {BRAND.name} provides tools that let you fund a wallet and pay supported bills and
          services. We may add, change, suspend, or discontinue features, providers, or service
          availability at any time.
        </p>
        <p>
          Payments are subject to the information and confirmation shown before you authorize a
          transaction. A transaction is not complete until our systems show it as successful.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You must provide accurate information and keep your login details and transaction PIN
          secure. You are responsible for activity performed through your account and must tell us
          promptly if you suspect unauthorized access.
        </p>
        <p>
          You must be legally able to enter these terms. Do not use the service for unlawful
          activity, fraud, abuse, or attempts to disrupt or gain unauthorized access to our systems.
        </p>
      </Section>

      <Section title="Payments, reversals, and refunds">
        <p>
          You authorize us and our payment partners to process the amounts you confirm. Fees,
          limits, and provider requirements may apply and will be shown where relevant.
        </p>
        <p>
          If a payment fails, is delayed, or is reversed, we will provide the status available to us
          and may investigate with the relevant provider. Refunds and reversals are handled under
          the applicable provider and payment network rules.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          You may not use {BRAND.name} to impersonate another person, violate a provider's rules,
          interfere with the service, upload malicious code, or attempt to bypass security or
          transaction controls.
        </p>
        <p>
          We may restrict, suspend, or close an account where we reasonably believe these terms,
          applicable law, or security requirements have been breached.
        </p>
      </Section>

      <Section title="Disclaimers and liability">
        <p>
          We work to keep the service accurate and available, but we do not guarantee uninterrupted
          operation or that every provider will always be available. Third-party services are
          subject to their own terms and availability.
        </p>
        <p>
          To the extent permitted by law, {BRAND.name} is not liable for indirect or consequential
          loss arising from your use of the service. Nothing in these terms limits liability that
          cannot legally be limited.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update these terms by posting a revised version. If you continue to use{" "}
          {BRAND.name} after the effective date, you accept the revised terms.
        </p>
        <p>
          Questions about these terms can be sent to the {BRAND.name} support team through your
          account.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-extrabold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
