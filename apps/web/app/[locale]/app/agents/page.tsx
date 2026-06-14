'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { UserPlus, Bot, Sparkles, Play } from 'lucide-react';
import { agentsApi, type Agent } from '../../../../src/lib/api-client';
import { RouteRequest } from '../../../../src/components/employee/route-request';
import { EmployeeMarketplace } from '../../../../src/components/employee/employee-marketplace';

export default function AgentsPage() {
  const [marketOpen, setMarketOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['agents'], queryFn: () => agentsApi.list() });
  const agents = (data?.items ?? []) as Array<Agent & { avatar?: string | null }>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1 text-sm">Your AI team. Hire from the marketplace and they start immediately.</p>
        </div>
        <button onClick={() => setMarketOpen(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25">
          <UserPlus className="w-4 h-4" /> Hire employee
        </button>
      </div>

      {/* Route a request to the best-fit employee (auto-dispatch or divert). */}
      <RouteRequest />

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border rounded-2xl p-5 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-muted mb-4" />
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-full mb-1" />
              <div className="h-3 bg-muted rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        /* Empty state → opens the marketplace */
        <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary/10 to-violet-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2 tracking-tight">Build your team</h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm leading-relaxed">
            Hire ready-made employees — a Chief of Staff, HR Manager, Support Lead, and more.
            Each starts with a role, goal, and the controls to work safely.
          </p>
          <button onClick={() => setMarketOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25">
            <Sparkles className="w-4 h-4" /> Browse the marketplace
          </button>
        </div>
      ) : (
        <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {agents.map((a) => (
              <motion.div key={a.id} layout
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
                <Link href={`/app/agents/${a.id}`}
                  className="block border border-border rounded-2xl p-5 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl">
                      {a.avatar ?? <Bot className="w-5 h-5 text-white" />}
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                      a.mode === 'production'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>{a.mode}</span>
                  </div>
                  <h3 className="font-semibold mb-1">{a.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.goal || a.role}</p>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    <span className="text-xs text-muted-foreground capitalize">{a.costTier} tier</span>
                    <span className="ml-auto text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <Play className="w-3 h-3" /> Open
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <EmployeeMarketplace open={marketOpen} onClose={() => setMarketOpen(false)} />
    </div>
  );
}
