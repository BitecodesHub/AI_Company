'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { signIn, signUp } from '../../../../src/lib/auth-client';
import { Eye, EyeOff, ArrowRight, Zap } from 'lucide-react';

// Demo workspace credentials. Intentionally public — this is a throwaway demo
// account so anyone can explore the product with zero sign-up friction.
const DEMO_EMAIL = 'test@bitecodes.com';
const DEMO_PASSWORD = 'Test1234!';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type DemoPhase = 'idle' | 'typing' | 'charging' | 'boom';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoPhase, setDemoPhase] = useState<DemoPhase>('idle');
  // Guard async demo sequence against running after the user navigates away.
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const busy = loading || demoPhase !== 'idle';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? 'Invalid email or password.');
      } else {
        router.push('/app/dashboard');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Type a string into a controlled field, one character at a time, for the
  // "watch it fill in" effect. Instant when the user prefers reduced motion.
  async function typeInto(setter: (v: string) => void, text: string, perChar: number) {
    if (prefersReducedMotion()) {
      setter(text);
      return;
    }
    for (let i = 1; i <= text.length; i++) {
      if (!aliveRef.current) return;
      setter(text.slice(0, i));
      await wait(perChar);
    }
  }

  async function runDemoLogin() {
    if (busy) return;
    const reduced = prefersReducedMotion();
    setError('');
    setEmail('');
    setPassword('');
    setShowPwd(true); // reveal the demo password as it types in
    setDemoPhase('typing');

    try {
      await typeInto(setEmail, DEMO_EMAIL, 42);
      await wait(reduced ? 0 : 130);
      await typeInto(setPassword, DEMO_PASSWORD, 70);
      await wait(reduced ? 0 : 260);
      if (!aliveRef.current) return;

      setDemoPhase('charging');

      let result = await signIn.email({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      if (result.error) {
        // First run against a fresh database: provision the demo account, then retry.
        await signUp.email({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: 'Demo User' });
        result = await signIn.email({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      }
      if (!aliveRef.current) return;
      if (result.error) throw new Error(result.error.message ?? 'Demo sign-in failed');

      setDemoPhase('boom');
      await wait(reduced ? 150 : 1050);
      if (!aliveRef.current) return;
      router.push('/app/dashboard');
    } catch {
      if (!aliveRef.current) return;
      setDemoPhase('idle');
      setShowPwd(false);
      setError(
        'Demo login is not ready yet — the workspace may still be starting up. Please try again in a moment.',
      );
    }
  }

  const showStage = demoPhase === 'charging' || demoPhase === 'boom';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 group mb-6">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="font-bold text-xl tracking-tight">Bitecodes</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1 text-sm">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-7 shadow-xl shadow-black/5">
          {/* One-click demo */}
          <button
            type="button"
            onClick={runDemoLogin}
            disabled={busy}
            className="group relative w-full overflow-hidden rounded-xl py-2.5 text-sm font-semibold text-white
                       bg-gradient-to-r from-primary to-violet-600 shadow-lg shadow-primary/30
                       hover:shadow-xl hover:shadow-primary/40 transition-all duration-300
                       disabled:opacity-70 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" fill="currentColor" />
            One-click Demo Login
            <span
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r
                         from-transparent via-white/30 to-transparent transition-transform duration-700
                         group-hover:translate-x-full"
            />
          </button>
          <p className="text-center text-xs text-muted-foreground mt-2 mb-5">
            Instant access — no sign-up required
          </p>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground">
              <span className="bg-card px-3">or sign in with email</span>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-destructive/8 border border-destructive/20 text-destructive text-sm rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" required autoComplete="email" readOnly={busy}
                className="w-full border border-border bg-background rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-muted-foreground/60" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" htmlFor="password">Password</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <input id="password" type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  autoComplete="current-password" readOnly={busy}
                  className="w-full border border-border bg-background rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-muted-foreground/60 pr-10" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} disabled={busy}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy}
              className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm shadow-primary/30">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs text-muted-foreground">
              <span className="bg-card px-3">or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => signIn.social({ provider: 'google' })}
              className="flex items-center justify-center gap-2 border border-border bg-background rounded-xl py-2.5 text-sm hover:bg-muted transition-colors font-medium disabled:opacity-60">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button type="button" disabled={busy} onClick={() => signIn.social({ provider: 'github' })}
              className="flex items-center justify-center gap-2 border border-border bg-background rounded-xl py-2.5 text-sm hover:bg-muted transition-colors font-medium disabled:opacity-60">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              GitHub
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary font-medium hover:underline">Create one free</Link>
        </p>
      </div>

      {/* ── Suspense → boom demo-login stage ───────────────────────────── */}
      {showStage && (
        <div className="demo-stage" role="status" aria-live="polite">
          {demoPhase === 'charging' ? (
            <>
              <div className="relative flex items-center justify-center">
                <span className="demo-ring" />
                <span className="demo-ring r2" />
                <span className="demo-ring r3" />
                <span className="demo-orb" />
                <Zap className="absolute w-7 h-7 text-white" fill="currentColor" />
              </div>
              <p className="demo-rise mt-12 text-sm font-semibold text-foreground">
                Charging your demo workspace…
              </p>
              <p
                className="demo-rise mt-1 text-xs text-muted-foreground"
                style={{ animationDelay: '120ms' }}
              >
                Signing in as {DEMO_EMAIL}
              </p>
            </>
          ) : (
            <>
              <div className="demo-flash" />
              <div className="demo-shockwave" />
              {Array.from({ length: 16 }).map((_, i) => {
                const angle = (i / 16) * Math.PI * 2;
                const dist = 200 + (i % 4) * 46;
                const style = {
                  '--dx': `${Math.cos(angle) * dist}px`,
                  '--dy': `${Math.sin(angle) * dist}px`,
                  animationDelay: `${(i % 5) * 18}ms`,
                } as unknown as React.CSSProperties;
                return <span key={i} className="demo-particle" style={style} />;
              })}
              <p
                className="demo-rise relative text-2xl font-bold tracking-tight text-foreground"
                style={{ animationDelay: '220ms' }}
              >
                Welcome aboard
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
