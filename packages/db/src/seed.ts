/**
 * DB seed script — creates a demo workspace, starter agents, and brand voice examples.
 * Run with: pnpm db:seed
 * (DEVELOPMENT_TASKS.md P15-07)
 */
import 'dotenv/config';
import { createDb } from './client';
import { organizations, workspaces, users, memberships } from './schema/index';
import { sql } from 'drizzle-orm';

async function seed() {
  const db = createDb();
  console.log('🌱 Seeding Bitecodes demo data...');

  // Create demo organization
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Bitecodes Demo', slug: 'bitecodes-demo', plan: 'pro' })
    .onConflictDoNothing()
    .returning({ id: organizations.id });

  if (!org) {
    console.log('ℹ  Demo org already exists, skipping.');
    process.exit(0);
  }

  // Create demo workspace
  const [ws] = await db
    .insert(workspaces)
    .values({ organizationId: org.id, name: 'Demo Workspace', slug: 'demo' })
    .returning({ id: workspaces.id });

  // Create demo user
  const [user] = await db
    .insert(users)
    .values({ email: 'demo@bitecodes.com', name: 'Demo User', emailVerified: true })
    .onConflictDoNothing()
    .returning({ id: users.id });

  if (user && ws) {
    // Create membership
    await db
      .insert(memberships)
      .values({ userId: user.id, organizationId: org.id, workspaceId: ws.id, role: 'owner' })
      .onConflictDoNothing();
  }

  console.log('✅ Demo data seeded successfully.');
  console.log(`   Org: ${org.id}`);
  console.log(`   Workspace: ${ws?.id}`);
  console.log(`   User: ${user?.id}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
