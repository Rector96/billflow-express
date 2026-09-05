import { BRAND } from "@/lib/brand";

export function LegalPrivacyContent() {
  return (
    <article className="space-y-7 px-5 py-6 text-sm leading-7 text-muted-foreground sm:px-8">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Legal</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-2 text-xs">Last updated: August 27, 2026</p>
      </div>

      <p>
        This Privacy Policy explains how {BRAND.name} collects, uses, stores, and protects your
        information when you use our website, mobile experience, and bill payment services.
      </p>

      <Section title="Information we collect">
        <p>
          We may collect information you provide when you create an account or contact us, including
          your name, phone number, email address, and support messages.
        </p>
        <p>
          When you use our services, we receive transaction details such as the service provider,
          amount, reference, status, and payment method. We also collect device, log, and usage
          information needed to keep the service reliable and secure.
        </p>
      </Section>

      <Section title="How we use your information">
        <p>
          We use your information to create and manage your account, process bill payments and
          wallet transactions, provide support, verify activity, prevent fraud, and improve our
          products.
        </p>
        <p>
          We may also send service messages about your account, transactions, security, or material
          changes to our terms. We do not use your information for unrelated marketing without a
          lawful basis or your consent where required.
        </p>
      </Section>

      <Section title="Sharing and service providers">
        <p>
          We share information only when needed to provide the service, comply with law, protect our
          users, or operate our business. This may include payment processors, bill providers,
          hosting providers, fraud prevention services, and professional advisers.
        </p>
        <p>
          We do not sell your personal information. Service providers are expected to protect
          information and use it only for the services they provide to us.
        </p>
      </Section>

      <Section title="Security and retention">
        <p>
          We use administrative, technical, and organizational safeguards designed to protect your
          information. No online service can guarantee absolute security, so please keep your
          password and transaction PIN confidential.
        </p>
        <p>
          We retain information for as long as necessary to provide our services, meet legal and
          regulatory obligations, resolve disputes, and enforce our agreements.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <p>
          Depending on where you live, you may have rights to access, correct, delete, or restrict
          use of your personal information. You may also close your account, subject to information
          we must retain by law.
        </p>
        <p>
          To make a privacy request or ask a question, contact support through the app. We may need
          to verify your identity before completing a request.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update this policy from time to time. The updated version will be posted here with
          a new effective date. Your continued use of {BRAND.name} after an update means you
          acknowledge the revised policy.
        </p>
        <p>
          For privacy questions, contact the {BRAND.name} support team through the support channel
          in your account.
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
