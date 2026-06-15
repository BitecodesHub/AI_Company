'use client';

import { Plug, Mail, MessageSquare, Twitter, Linkedin, Facebook, FileText, Github, Users, Check, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { connectorsApi, type Connector as LiveConnector } from '../../../../src/lib/api-client';

type CatalogConnector = {
  key: string;
  name: string;
  description: string;
  icon: typeof Plug;
};

// Catalog mirrors the connector types served by `@bitecodes/connectors` + the
// `/v1/connectors/*` OAuth controller. Connected/disconnected status is read
// live from `connectorsApi.list()`; the OAuth exchange itself lands in Phase 4.
const CONNECTORS: CatalogConnector[] = [
  { key: 'gmail',    name: 'Gmail',    description: 'Read and send email on behalf of an employee.', icon: Mail },
  { key: 'slack',    name: 'Slack',    description: 'Post and respond in channels and DMs.',          icon: MessageSquare },
  { key: 'x',        name: 'X',        description: 'Publish and monitor posts.',                     icon: Twitter },
  { key: 'linkedin', name: 'LinkedIn', description: 'Publish updates and read engagement.',           icon: Linkedin },
  { key: 'meta',     name: 'Meta',     description: 'Manage Instagram and Facebook Pages.',           icon: Facebook },
  { key: 'teams',    name: 'Microsoft Teams', description: 'Read channels & chats via Microsoft Graph; posting requires approval.', icon: Users },
  { key: 'notion',   name: 'Notion',   description: 'Read and write workspace documents.',            icon: FileText },
  { key: 'github',   name: 'GitHub',   description: 'Open issues and pull requests.',                 icon: Github },
];

// A placeholder origin the stubbed OAuth start returns; we refuse to redirect to
// it (no fake success). Real provider URLs replace it in Phase 4.
const STUB_OAUTH_HOST = 'provider.example.com';

export default function ConnectorsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['connectors'],
    queryFn: () => connectorsApi.list(),
  });

  const connected = new Map<string, LiveConnector>(
    (data?.items ?? []).map((c) => [c.type, c]),
  );

  const connect = useMutation({
    mutationFn: (type: string) => connectorsApi.oauthStart(type),
    onSuccess: (res: { authUrl?: string; authorizationUrl?: string }) => {
      const url = res.authUrl ?? res.authorizationUrl;
      if (url && !url.includes(STUB_OAUTH_HOST)) {
        window.location.href = url;
      } else {
        toast.info('Connector OAuth is not configured yet on this instance.');
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Could not start connection'),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => connectorsApi.remove(id),
    onSuccess: () => { toast.success('Disconnected'); qc.invalidateQueries({ queryKey: ['connectors'] }); },
    onError: (e: Error) => toast.error(e.message || 'Could not disconnect'),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connectors</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Securely link the tools your employees use. Credentials are encrypted in the vault.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="connectors-grid">
        {CONNECTORS.map((c) => {
          const live = connected.get(c.key);
          const isConnected = !!live;
          return (
            <div key={c.key}
              className="border border-border rounded-2xl p-5 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
                  <c.icon className="w-5 h-5 text-white" />
                </div>
                {isConnected ? (
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    Not connected
                  </span>
                )}
              </div>
              <h3 className="font-semibold mb-1">{c.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>

              {isConnected ? (
                <button
                  type="button"
                  onClick={() => live && disconnect.mutate(live.id)}
                  disabled={disconnect.isPending}
                  className="mt-4 w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => connect.mutate(c.key)}
                  disabled={isLoading || connect.isPending}
                  className="mt-4 w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2 text-sm font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-60"
                >
                  {connect.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
