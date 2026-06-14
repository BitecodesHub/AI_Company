/**
 * Creates a test account for local development.
 * Run: pnpm tsx scripts/create-test-user.ts
 *
 * Credentials:
 *   email:    test@bitecodes.com
 *   password: Test1234!
 */
import { Pool } from 'pg';
import crypto from 'node:crypto';

const DATABASE_URL = process.env['DATABASE_URL'] ?? 'postgresql://bitecodes:bitecodes_dev@localhost:5432/bitecodes';

// Simple password hashing matching Better Auth's bcrypt-compatible format
// Better Auth uses scrypt by default — use the Better Auth client to hash properly
async function hashPassword(password: string): Promise<string> {
  // Better Auth uses scrypt — we use Node's built-in scrypt
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      // Better Auth format: algorithm:params:salt:hash
      resolve(`scrypt:N=16384,r=16,p=1:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function createTestUser() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Ensure extensions
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    const email = 'test@bitecodes.com';
    const password = 'Test1234!';
    const name = 'Test User';

    console.log('Creating test user...');

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log(`\n✅ Test user already exists!\n\nEmail:    ${email}\nPassword: ${password}\nUser ID:  ${existing.rows[0].id}`);
      return;
    }

    const hashedPassword = await hashPassword(password);
    const userId = crypto.randomUUID();

    // Insert user (Better Auth table shape)
    await pool.query(
      `INSERT INTO users (id, email, name, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, true, now(), now())`,
      [userId, email, name],
    );

    // Insert account (Better Auth uses accounts table for credentials)
    await pool.query(
      `INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
       VALUES ($1, $2, 'credential', $3, $4, now(), now())`,
      [crypto.randomUUID(), email, userId, hashedPassword],
    );

    // Create a demo org and workspace
    const orgId = crypto.randomUUID();
    const wsId  = crypto.randomUUID();

    await pool.query(
      `INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
       VALUES ($1, 'Bitecodes Demo', 'bitecodes-demo', 'pro', now(), now())`,
      [orgId],
    );

    await pool.query(
      `INSERT INTO workspaces (id, organization_id, name, slug, created_at, updated_at)
       VALUES ($1, $2, 'Demo Workspace', 'demo', now(), now())`,
      [wsId, orgId],
    );

    await pool.query(
      `INSERT INTO memberships (id, user_id, organization_id, workspace_id, role, created_at)
       VALUES ($1, $2, $3, $4, 'owner', now())`,
      [crypto.randomUUID(), userId, orgId, wsId],
    );

    console.log(`
╔══════════════════════════════════════════╗
║   ✅  Test account created!              ║
╚══════════════════════════════════════════╝

  Email:     ${email}
  Password:  ${password}
  User ID:   ${userId}
  Org ID:    ${orgId}
  WS ID:     ${wsId}

  Sign in at: http://localhost:3002/login
`);

  } catch (err) {
    console.error('Error creating test user:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestUser();
