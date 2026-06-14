'use client';

/**
 * EmployeeMarketplace — a fluid hiring gallery. Browse curated role templates
 * (HR, Manager, Support, …) and hire one with a click; the chosen template is
 * provisioned as a real employee via POST /v1/agents/hire. Motion is provided by
 * framer-motion (animated overlay, staggered cards, hover lift) and respects the
 * app's reduced-motion guard.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, Loader2, Search, Sparkles } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agentsApi } from '../../lib/api-client';
import { EMPLOYEE_TEMPLATES, EMPLOYEE_CATEGORIES, type EmployeeTemplate, type EmployeeCategory } from '../../lib/employee-templates';

export function EmployeeMarketplace({ open, onClose, onHired }: { open: boolean; onClose: () => void; onHired?: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<EmployeeCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [hiredKeys, setHiredKeys] = useState<Set<string>>(new Set());

  const hire = useMutation({
    mutationFn: (t: EmployeeTemplate) =>
      agentsApi.hire({
        name: t.name, role: t.role, goal: t.goal, systemPrompt: t.systemPrompt,
        costTier: t.costTier, avatar: t.avatar, isRouter: t.isRouter ?? false, routingKeywords: t.routingKeywords,
      }),
    onSuccess: (_r, t) => {
      setHiredKeys((s) => new Set(s).add(t.key));
      toast.success(`${t.name} joined as ${t.role}`);
      qc.invalidateQueries({ queryKey: ['agents'] });
      onHired?.();
    },
    onError: (e: Error) => toast.error(e.message || 'Could not hire'),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EMPLOYEE_TEMPLATES.filter((t) =>
      (category === 'All' || t.category === category) &&
      (!q || t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q) || t.tagline.toLowerCase().includes(q)));
  }, [category, search]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-testid="employee-marketplace"
        >
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />

          <motion.div
            className="relative w-full max-w-5xl max-h-[88vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> Hire an employee
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">Pick a role and your new AI employee starts immediately.</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roles…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                {(['All', ...EMPLOYEE_CATEGORIES] as const).map((c) => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${category === c ? 'bg-primary text-white' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <motion.div
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-6 overflow-y-auto"
              initial="hidden" animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            >
              {filtered.map((t) => {
                const hired = hiredKeys.has(t.key);
                const pending = hire.isPending && hire.variables?.key === t.key;
                return (
                  <motion.div key={t.key}
                    variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                    whileHover={{ y: -3 }}
                    className="border border-border rounded-2xl p-4 bg-background flex flex-col"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${t.accent} flex items-center justify-center text-xl`}>{t.avatar}</div>
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.role}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">{t.tagline}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded-full px-2 py-0.5">{t.category}</span>
                      <button
                        onClick={() => !hired && hire.mutate(t)}
                        disabled={pending || hired}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${hired ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary text-white hover:bg-primary/90'} disabled:opacity-70`}
                      >
                        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : hired ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {hired ? 'Hired' : 'Hire'}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
