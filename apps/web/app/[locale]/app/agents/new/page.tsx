'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Bot, Sparkles } from 'lucide-react';
import { agentsApi, ApiError } from '../../../../../src/lib/api-client';
import { DisclosureSection } from '../../../../../src/components/ui/disclosure-section';

type CostTier = 'auto' | 'fast' | 'smart';
type Mode = 'sandbox' | 'production';

const inputCls =
  'w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary';

export default function NewAgentPage() {
  const router = useRouter();
  // Essentials
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [goal, setGoal] = useState('');
  // Advanced (sensible defaults — most users never touch these)
  const [costTier, setCostTier] = useState<CostTier>('auto');
  const [mode, setMode] = useState<Mode>('sandbox');
  const [defaultModel, setDefaultModel] = useState('');
  // Expert / guardrails
  const [promptInjectionScan, setPromptInjectionScan] = useState(true);
  const [piiMask, setPiiMask] = useState(false);
  const [maxCost, setMaxCost] = useState('0.5');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !role) { setError('Name and role are required.'); return; }
    setLoading(true);
    setError('');
    try {
      const agent = await agentsApi.create({
        name,
        role,
        goal,
        costTier,
        mode,
        ...(defaultModel.trim() ? { defaultModel: defaultModel.trim() } : {}),
        guardrails: {
          promptInjectionScan,
          piiMask,
          maxCostUsdPerRun: Number(maxCost) > 0 ? Number(maxCost) : 0.5,
        },
      });
      router.push(`/app/agents/${agent.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Your session expired. Please sign in again.');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to create agent. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const templates = [
    { icon: '📱', title: 'Social Media Manager', role: 'Social media specialist', goal: 'Create, schedule, and publish engaging social content across all platforms in brand voice' },
    { icon: '✍️', title: 'Blog Writer', role: 'Content writer', goal: 'Research topics and write SEO-optimized blog posts with proper structure and internal links' },
    { icon: '💬', title: 'Customer Support', role: 'Customer support specialist', goal: 'Reply to customer inquiries, DMs, and comments with empathy and brand voice' },
    { icon: '📊', title: 'Analytics Reporter', role: 'Data analyst', goal: 'Analyze content and campaign performance and provide actionable insights weekly' },
  ];

  const costTiers: Array<{ value: CostTier; label: string; hint: string }> = [
    { value: 'auto', label: 'Auto', hint: 'Pick the best model per task (recommended)' },
    { value: 'fast', label: 'Fast', hint: 'Cheaper and lower latency' },
    { value: 'smart', label: 'Smart', hint: 'Highest quality, higher cost' },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/app/agents" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">New Agent</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Create an agent</h1>
      <p className="text-muted-foreground mb-8">Give it a name and a job. Everything else has smart defaults you can tune later.</p>

      {/* Templates */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Start from a template
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => { setName(t.title); setRole(t.role); setGoal(t.goal); }}
              className="text-left border border-border rounded-xl p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors group"
            >
              <div className="text-2xl mb-2">{t.icon}</div>
              <div className="font-medium text-sm">{t.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.goal}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex items-center gap-4 mb-8">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-muted-foreground">or build from scratch</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Form */}
      <form onSubmit={handleCreate} className="space-y-5">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">{error}</div>
        )}

        {/* ── Essentials ───────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="name">Agent name <span className="text-destructive">*</span></label>
          <input id="name" value={name} onChange={e => setName(e.target.value)} required
            placeholder="e.g. Social Media Manager" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="role">Role <span className="text-destructive">*</span></label>
          <input id="role" value={role} onChange={e => setRole(e.target.value)} required
            placeholder="e.g. You are an expert social media strategist" className={inputCls} />
          <p className="text-xs text-muted-foreground mt-1">Describe what this agent is and what it specialises in.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="goal">Goal</label>
          <textarea id="goal" value={goal} onChange={e => setGoal(e.target.value)} rows={3}
            placeholder="e.g. Help the team create and schedule engaging social content that drives engagement"
            className={`${inputCls} resize-none`} />
        </div>

        {/* ── Advanced (collapsed) ─────────────────────────────────── */}
        <DisclosureSection title="Advanced settings" level="advanced">
          <div>
            <span className="block text-sm font-medium mb-2">Model intelligence</span>
            <div className="grid grid-cols-3 gap-2">
              {costTiers.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setCostTier(t.value)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    costTier === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border hover:bg-muted'
                  }`}
                >
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium mb-2">Execution mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('sandbox')}
                className={`text-left rounded-lg border p-3 transition-colors ${mode === 'sandbox' ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border hover:bg-muted'}`}>
                <div className="text-sm font-medium">Sandbox</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Test safely — no real actions are taken</div>
              </button>
              <button type="button" onClick={() => setMode('production')}
                className={`text-left rounded-lg border p-3 transition-colors ${mode === 'production' ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border hover:bg-muted'}`}>
                <div className="text-sm font-medium">Production</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">Perform real actions (publish, send, etc.)</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="model">Model override</label>
            <input id="model" value={defaultModel} onChange={e => setDefaultModel(e.target.value)}
              placeholder="Leave blank to use the workspace default" className={inputCls} />
          </div>
        </DisclosureSection>

        {/* ── Expert / guardrails (collapsed) ──────────────────────── */}
        <DisclosureSection title="Safety & guardrails" level="expert">
          <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
            <span>
              <span className="text-sm font-medium">Prompt-injection scan</span>
              <span className="block text-xs text-muted-foreground">Detect and block malicious instructions hidden in inputs.</span>
            </span>
            <input type="checkbox" checked={promptInjectionScan} onChange={e => setPromptInjectionScan(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary" />
          </label>
          <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
            <span>
              <span className="text-sm font-medium">Mask PII</span>
              <span className="block text-xs text-muted-foreground">Redact personal data before it reaches the model.</span>
            </span>
            <input type="checkbox" checked={piiMask} onChange={e => setPiiMask(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary" />
          </label>
          <div>
            <label className="block text-sm font-medium mb-1.5" htmlFor="maxCost">Max cost per run (USD)</label>
            <input id="maxCost" type="number" min="0" step="0.1" value={maxCost} onChange={e => setMaxCost(e.target.value)}
              className={inputCls} />
            <p className="text-xs text-muted-foreground mt-1">The agent stops a run if it would exceed this budget.</p>
          </div>
        </DisclosureSection>

        <div className="flex gap-3 pt-2">
          <Link href="/app/agents" className="flex-1 text-center border border-border px-4 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            <Bot className="w-4 h-4" />
            {loading ? 'Creating…' : 'Create agent'}
          </button>
        </div>
      </form>
    </div>
  );
}
