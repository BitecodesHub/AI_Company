import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of Service — Bitecodes' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Last updated: {new Date().getFullYear()}</p>
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">1. Acceptance</h2>
            <p>By using Bitecodes you agree to these terms. If you are using the service on behalf of a company, you represent you have authority to bind that company.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">2. Permitted use</h2>
            <p>You may use Bitecodes for lawful purposes only. You agree not to use it to transmit unlawful, harmful, or deceptive content, or to violate the rights of others.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">3. Service availability</h2>
            <p>We provide the service on a best-effort basis. We may modify, suspend, or discontinue features with reasonable notice.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">4. Billing</h2>
            <p>Paid plans are billed in advance. Refunds are provided within 7 days of a charge for unused capacity. Contact <a href="mailto:billing@bitecodes.com" className="text-primary underline underline-offset-2">billing@bitecodes.com</a> for disputes.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">5. Governing law</h2>
            <p>These terms are governed by the laws of the jurisdiction where Bitecodes is incorporated. Disputes shall be resolved by binding arbitration.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
