'use client';

/**
 * ContactForm — posts to the real public POST /v1/contact endpoint. Shows a
 * success state only after the request is accepted; surfaces errors clearly.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import { contactApi } from '../../lib/api-client';

export function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = useMutation({
    mutationFn: () => {
      const company = form.company.trim();
      return contactApi.submit({ name: form.name.trim(), email: form.email.trim(), message: form.message.trim(), ...(company ? { company } : {}) });
    },
  });

  const valid = form.name.trim() && /.+@.+\..+/.test(form.email) && form.message.trim().length > 2;

  if (submit.isSuccess) {
    return (
      <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-8 text-center" data-testid="contact-success">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="font-semibold text-lg">Thanks, {form.name.split(' ')[0] || 'there'}!</h3>
        <p className="text-sm text-muted-foreground mt-1">Your message is in. We will get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid && !submit.isPending) submit.mutate(); }}
      className="border border-border rounded-2xl p-6 bg-card space-y-4" data-testid="contact-form"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name"><input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Jane Doe" /></Field>
        <Field label="Work email"><input required type="email" value={form.email} onChange={set('email')} className={inputCls} placeholder="jane@company.com" /></Field>
      </div>
      <Field label="Company (optional)"><input value={form.company} onChange={set('company')} className={inputCls} placeholder="Acme Inc." /></Field>
      <Field label="Message">
        <textarea required value={form.message} onChange={set('message')} rows={5} className={inputCls} placeholder="Tell us what you are looking to build…" />
      </Field>

      {submit.isError && (
        <p className="text-sm text-destructive">Something went wrong. Please try again or email us directly.</p>
      )}

      <button type="submit" disabled={!valid || submit.isPending}
        className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
        {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send message
      </button>
    </form>
  );
}

const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
