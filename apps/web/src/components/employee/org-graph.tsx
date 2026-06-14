'use client';

/**
 * OrgGraph — the employee org chart rendered with @xyflow/react. Nodes are
 * employees; edges are supervises / watches / delegates_to relationships from
 * /v1/agent-relationships. A simple layered layout puts supervisors above the
 * employees they supervise. Read-only for now (editing lands with the org editor).
 */
import { useMemo } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useQuery } from '@tanstack/react-query';
import { agentsApi, orchestrationApi, type Agent, type AgentRelationship } from '../../lib/api-client';

const EDGE_STYLE: Record<AgentRelationship['kind'], { stroke: string; label: string; dashed?: boolean }> = {
  supervises:   { stroke: '#7c3aed', label: 'supervises' },
  watches:      { stroke: '#0ea5e9', label: 'watches', dashed: true },
  delegates_to: { stroke: '#10b981', label: 'delegates' },
};

export function OrgGraph({ highlightAgentId }: { highlightAgentId?: string }) {
  const { data: agentsData } = useQuery({ queryKey: ['agents'], queryFn: () => agentsApi.list() });
  const { data: relData } = useQuery({ queryKey: ['agent-relationships'], queryFn: () => orchestrationApi.listRelationships() });

  const { nodes, edges } = useMemo(() => {
    const agents = (agentsData?.items ?? []) as Agent[];
    const rels = (relData?.items ?? []) as AgentRelationship[];

    // Layer 0 = employees that supervise someone (or no incoming supervises);
    // layer 1 = the rest. Simple two-row layout keeps it readable without a full DAG layout lib.
    const supervised = new Set(rels.filter((r) => r.kind === 'supervises').map((r) => r.toAgentId));
    const top = agents.filter((a) => !supervised.has(a.id));
    const bottom = agents.filter((a) => supervised.has(a.id));

    const place = (list: Agent[], y: number): Node[] =>
      list.map((a, i) => ({
        id: a.id,
        position: { x: 60 + i * 200, y },
        data: { label: a.name },
        style: {
          padding: 8, borderRadius: 12, fontSize: 12, width: 160,
          border: a.id === highlightAgentId ? '2px solid var(--color-primary, #7c3aed)' : '1px solid #e5e7eb',
          background: 'var(--color-card, #fff)',
        },
      }));

    const nodes: Node[] = [...place(top, 20), ...place(bottom, 160)];
    const edges: Edge[] = rels.map((r) => {
      const s = EDGE_STYLE[r.kind];
      return {
        id: r.id,
        source: r.fromAgentId,
        target: r.toAgentId,
        label: s.label,
        animated: r.kind === 'delegates_to',
        style: { stroke: s.stroke, strokeDasharray: s.dashed ? '4 4' : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color: s.stroke },
        labelStyle: { fontSize: 10, fill: s.stroke },
      };
    });
    return { nodes, edges };
  }, [agentsData, relData, highlightAgentId]);

  if (nodes.length === 0) {
    return (
      <div className="border border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">
        No employees yet. Hire employees to see the org chart.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden" style={{ height: 320 }} data-testid="org-graph">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
