'use client';

import {
  Plug, Mail, MessageSquare, Twitter, Linkedin, Facebook, FileText, Github, Users, Check, Loader2,
  Globe, Webhook, Rss, Send, Phone, Video, Calendar, Cloud, Database, BookOpen, GitBranch, Briefcase,
  Zap, AlertTriangle, LifeBuoy, Headphones, CreditCard, ShoppingCart, Megaphone, BarChart3,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { connectorsApi, type Connector as LiveConnector } from '../../../../src/lib/api-client';

type CatalogConnector = {
  key: string;
  name: string;
  description: string;
  icon: typeof Plug;
  category: string;
  noConfig?: boolean;
};

// Catalog of connector types. Status is read live from connectorsApi.list().
// `noConfig` connectors connect INSTANTLY with no OAuth/keys (built-in tools).
const CONNECTORS: CatalogConnector[] = [
  // Built-in — work with zero setup
  { key: 'web',     name: 'Web Access',      description: 'Fetch and read public web pages and search results.', icon: Globe,    category: 'Built-in · no setup', noConfig: true },
  { key: 'webhook', name: 'Inbound Webhook', description: 'Get a unique URL to receive events from any service.', icon: Webhook,  category: 'Built-in · no setup', noConfig: true },
  { key: 'http',    name: 'HTTP / REST',     description: 'Call any HTTP API with JSON requests.',               icon: Send,     category: 'Built-in · no setup', noConfig: true },
  { key: 'rss',     name: 'RSS Feeds',       description: 'Subscribe to and read RSS / Atom feeds.',              icon: Rss,      category: 'Built-in · no setup', noConfig: true },

  // Communication
  { key: 'slack',    name: 'Slack',           description: 'Post and respond in channels and DMs.',               icon: MessageSquare, category: 'Communication' },
  { key: 'teams',    name: 'Microsoft Teams', description: 'Read channels & chats via Microsoft Graph.',           icon: Users,         category: 'Communication' },
  { key: 'discord',  name: 'Discord',         description: 'Send and read messages in servers.',                  icon: MessageSquare, category: 'Communication' },
  { key: 'telegram', name: 'Telegram',        description: 'Send and receive bot messages.',                      icon: Send,          category: 'Communication' },
  { key: 'gmail',    name: 'Gmail',           description: 'Read and send email on behalf of an employee.',        icon: Mail,          category: 'Communication' },
  { key: 'outlook',  name: 'Outlook',         description: 'Read and send Microsoft 365 mail.',                   icon: Mail,          category: 'Communication' },
  { key: 'twilio',   name: 'Twilio SMS',      description: 'Send and receive text messages.',                     icon: Phone,         category: 'Communication' },

  // Social
  { key: 'x',         name: 'X',         description: 'Publish and monitor posts.',                 icon: Twitter,  category: 'Social' },
  { key: 'linkedin',  name: 'LinkedIn',  description: 'Publish updates and read engagement.',       icon: Linkedin, category: 'Social' },
  { key: 'meta',      name: 'Meta',      description: 'Manage Instagram and Facebook Pages.',       icon: Facebook, category: 'Social' },
  { key: 'youtube',   name: 'YouTube',   description: 'Read channel analytics and comments.',       icon: Video,    category: 'Social' },
  { key: 'reddit',    name: 'Reddit',    description: 'Read and post to subreddits.',               icon: MessageSquare, category: 'Social' },

  // Productivity
  { key: 'notion',   name: 'Notion',          description: 'Read and write workspace documents.',     icon: FileText, category: 'Productivity' },
  { key: 'gdrive',   name: 'Google Drive',    description: 'Read and manage files.',                  icon: Cloud,    category: 'Productivity' },
  { key: 'gcal',     name: 'Google Calendar', description: 'Read and create events.',                 icon: Calendar, category: 'Productivity' },
  { key: 'dropbox',  name: 'Dropbox',         description: 'Read and manage files.',                  icon: Cloud,    category: 'Productivity' },
  { key: 'airtable', name: 'Airtable',        description: 'Read and update bases.',                  icon: Database, category: 'Productivity' },
  { key: 'confluence', name: 'Confluence',    description: 'Read and write wiki pages.',              icon: BookOpen, category: 'Productivity' },

  // Developer
  { key: 'github',  name: 'GitHub',  description: 'Open issues and pull requests.',     icon: Github,    category: 'Developer' },
  { key: 'gitlab',  name: 'GitLab',  description: 'Manage issues and merge requests.',  icon: GitBranch, category: 'Developer' },
  { key: 'jira',    name: 'Jira',    description: 'Create and track issues.',           icon: Briefcase, category: 'Developer' },
  { key: 'linear',  name: 'Linear',  description: 'Create and update issues.',          icon: Zap,       category: 'Developer' },
  { key: 'sentry',  name: 'Sentry',  description: 'Read errors and issues.',            icon: AlertTriangle, category: 'Developer' },

  // CRM & Sales
  { key: 'hubspot',   name: 'HubSpot',    description: 'Manage contacts and deals.',     icon: Briefcase, category: 'CRM & Sales' },
  { key: 'salesforce', name: 'Salesforce', description: 'Read and update CRM records.',   icon: Cloud,     category: 'CRM & Sales' },
  { key: 'pipedrive', name: 'Pipedrive',  description: 'Manage your sales pipeline.',    icon: BarChart3, category: 'CRM & Sales' },

  // Support
  { key: 'zendesk',  name: 'Zendesk',  description: 'Read and reply to tickets.',  icon: LifeBuoy,      category: 'Support' },
  { key: 'intercom', name: 'Intercom', description: 'Read and reply to conversations.', icon: MessageSquare, category: 'Support' },
  { key: 'freshdesk', name: 'Freshdesk', description: 'Manage support tickets.',    icon: Headphones,    category: 'Support' },

  // Commerce & Payments
  { key: 'stripe',  name: 'Stripe',  description: 'Read payments and customers.',  icon: CreditCard,   category: 'Commerce & Payments' },
  { key: 'shopify', name: 'Shopify', description: 'Read orders and products.',      icon: ShoppingCart, category: 'Commerce & Payments' },
  { key: 'paypal',  name: 'PayPal',  description: 'Read transactions.',            icon: CreditCard,   category: 'Commerce & Payments' },

  // Marketing
  { key: 'mailchimp', name: 'Mailchimp', description: 'Manage audiences and campaigns.', icon: Megaphone, category: 'Marketing' },
  { key: 'sendgrid',  name: 'SendGrid',  description: 'Send transactional email.',        icon: Send,      category: 'Marketing' },
  { key: 'ganalytics', name: 'Google Analytics', description: 'Read traffic and conversion reports.', icon: BarChart3, category: 'Marketing' },
];

const CATEGORY_ORDER = [
  'Built-in · no setup', 'Communication', 'Social', 'Productivity',
  'Developer', 'CRM & Sales', 'Support', 'Commerce & Payments', 'Marketing',
];

// A placeholder origin the stubbed OAuth start returns; we refuse to redirect to it.
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
    onSuccess: (res) => {
      if (res.connected) {
        toast.success('Connected — ready to use, no setup needed.');
        qc.invalidateQueries({ queryKey: ['connectors'] });
        return;
      }
      const url = res.authUrl ?? res.authorizationUrl;
      if (url && !url.includes(STUB_OAUTH_HOST)) {
        window.location.href = url;
      } else {
        toast.info('This connector needs OAuth keys set on the server. Built-in connectors work with no setup.');
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Could not start connection'),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => connectorsApi.remove(id),
    onSuccess: () => { toast.success('Disconnected'); qc.invalidateQueries({ queryKey: ['connectors'] }); },
    onError: (e: Error) => toast.error(e.message || 'Could not disconnect'),
  });

  const categories = CATEGORY_ORDER.filter((cat) => CONNECTORS.some((c) => c.category === cat));

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Connectors</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Link the tools your employees use. Credentials are encrypted in the vault. Built-in connectors work with no setup.
          </p>
        </div>
      </div>

      <div className="space-y-8" data-testid="connectors-grid">
        {categories.map((cat) => (
          <section key={cat}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{cat}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CONNECTORS.filter((c) => c.category === cat).map((c) => {
                const live = connected.get(c.key);
                const isConnected = !!live;
                return (
                  <div key={c.key}
                    className="border border-border rounded-2xl p-5 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${c.noConfig ? 'from-primary to-violet-600' : 'from-slate-500 to-slate-700'}`}>
                        <c.icon className="w-5 h-5 text-white" />
                      </div>
                      {isConnected ? (
                        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Connected
                        </span>
                      ) : c.noConfig ? (
                        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                          No setup
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                          Not connected
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold mb-1">{c.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">{c.description}</p>

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
                        {c.noConfig ? 'Connect instantly' : 'Connect'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
